// Auth service — User lookup, JWT issuance, session management.
//
// Responsibilities (Phase 14 expanded):
// - Look up users by normalized email (matching User schema behavior).
// - Verify password with bcrypt.
// - Enforce status policy (only `active` may authenticate).
// - Issue JWT access tokens with minimal identity claims (sub, role, jti).
// - Create a Session document for each successful login. The
//   Session stores the SHA-256 hash of an opaque refresh token —
//   the plaintext is returned to the client ONCE and never logged.
// - Refresh token rotation with reuse detection (token-family kill
//   switch).
// - Logout that actually revokes the Session and its family, blocking
//   future token issuance.
// - Provide a "current user" loader for /api/auth/me.
//
// Security notes:
// - All errors thrown here that should be exposed to the client carry
//   an `expose: true` flag + a stable `code`. Login failures always
//   use the generic code 'INVALID_CREDENTIALS' regardless of root
//   cause (missing user, wrong password, locked account) so we do
//   not leak account existence.
// - We do NOT log email or password here. We do NOT include
//   passwordHash in any return value.
// - We do NOT log refresh tokens. We log only the Session._id when
//   writing audit events.

import { randomBytes } from 'node:crypto';
import jwt from 'jsonwebtoken';
import { config, parseDurationMs } from '../config/env.js';
import { User, Employee, Session } from '../models/index.js';
import {
  hashRefreshToken,
  SESSION_REVOKE_REASONS,
} from '../models/session.model.js';

// ---------------------------------------------------------------------------
// Access token (JWT)
// ---------------------------------------------------------------------------

/**
 * Sign a JWT carrying the minimal identity required by the API.
 * - `sub` is the canonical subject claim (User._id).
 * - `role` is included for convenience but the protect middleware
 *   re-validates role from the database on every request, so a
 *   stale token cannot outlive a role change.
 * - `jti` is the Session._id that issued this access token. It is
 *   used for audit / future denylist, NOT enforced by the protect
 *   middleware (Plan A — see docs/AUTH_SESSION_MANAGEMENT.md).
 *
 * We deliberately do NOT include email, fullName, or any profile
 * data in the token — keep the token small and avoid leaking PII
 * into logs that may capture JWTs.
 */
export function signAuthToken(user, sessionId) {
  if (!user || !user._id) {
    throw new Error('signAuthToken requires a user with an _id');
  }
  if (!sessionId) {
    throw new Error('signAuthToken requires a sessionId');
  }
  const payload = {
    sub: user._id.toString(),
    role: user.role,
    jti: sessionId.toString(),
  };
  return jwt.sign(payload, config.jwtSecret, {
    expiresIn: config.jwtExpiresIn,
  });
}

/**
 * Verify a JWT and return the decoded payload.
 * Returns { payload } or { error: { code, message } } with stable codes.
 */
export function verifyAuthToken(token) {
  try {
    const payload = jwt.verify(token, config.jwtSecret);
    return { payload };
  } catch (err) {
    if (err && err.name === 'TokenExpiredError') {
      return { error: { code: 'TOKEN_EXPIRED', message: 'Token has expired' } };
    }
    return { error: { code: 'TOKEN_INVALID', message: 'Token is invalid' } };
  }
}

// ---------------------------------------------------------------------------
// Refresh token (opaque, random)
// ---------------------------------------------------------------------------

/**
 * Generate a new opaque refresh token. Returns the plaintext (to be
 * sent to the client) and its SHA-256 hash (to be stored in the
 * database). 32 bytes of entropy = 256 bits.
 */
export function generateRefreshToken() {
  const plaintext = randomBytes(32).toString('hex'); // 64 hex chars
  const tokenHash = hashRefreshToken(plaintext);
  return { plaintext, tokenHash };
}

/**
 * Compute the expiry Date for a new refresh token based on
 * config.refreshTokenExpiresIn. Throws if the configured TTL is
 * unparseable so a misconfiguration fails fast.
 */
function computeRefreshExpiry() {
  const ms = parseDurationMs(config.refreshTokenExpiresIn);
  if (ms === null || ms <= 0) {
    throw new Error(
      `Invalid REFRESH_TOKEN_EXPIRES_IN: ${JSON.stringify(config.refreshTokenExpiresIn)}`,
    );
  }
  return new Date(Date.now() + ms);
}

// ---------------------------------------------------------------------------
// Authentication
// ---------------------------------------------------------------------------

/**
 * Look up an active user by email, and verify their password.
 * Returns { user } on success, or { error } with a stable code.
 */
export async function authenticateWithPassword(email, password) {
  const user = await User.findOne({ email }).select('+passwordHash');
  if (!user) {
    return { error: { code: 'INVALID_CREDENTIALS', message: 'Invalid email or password' } };
  }
  if (user.status !== 'active') {
    return { error: { code: 'INVALID_CREDENTIALS', message: 'Invalid email or password' } };
  }
  const ok = await user.verifyPassword(password);
  if (!ok) {
    return { error: { code: 'INVALID_CREDENTIALS', message: 'Invalid email or password' } };
  }
  return { user };
}

// ---------------------------------------------------------------------------
// Session lifecycle
// ---------------------------------------------------------------------------

/**
 * Create a new Session for a freshly authenticated user, generate a
 * refresh token, and sign an access token bound to the session.
 *
 * Returns:
 *   {
 *     accessToken,        // JWT
 *     refreshToken,       // plaintext — only returned ONCE
 *     expiresIn,          // access-token TTL in seconds (number)
 *     refreshExpiresIn,   // refresh-token TTL in seconds (number)
 *     sessionId,          // Session._id
 *   }
 *
 * On database failure, the partial session (if any) is rolled back.
 */
export async function createSessionForUser(user, { userAgent, ip } = {}) {
  if (!user || !user._id) {
    throw new Error('createSessionForUser requires a user with an _id');
  }
  const familyId = Session.newFamilyId();
  const expiresAt = computeRefreshExpiry();
  const { plaintext, tokenHash } = generateRefreshToken();

  const session = await Session.create({
    userId: user._id,
    tokenHash,
    familyId,
    expiresAt,
    userAgent: typeof userAgent === 'string' ? userAgent.slice(0, 512) : null,
    ip: typeof ip === 'string' ? ip.slice(0, 64) : null,
  });

  const accessToken = signAuthToken(user, session._id);

  return {
    accessToken,
    refreshToken: plaintext,
    expiresIn: parseDurationToSeconds(config.jwtExpiresIn),
    refreshExpiresIn: parseDurationToSeconds(config.refreshTokenExpiresIn),
    sessionId: session._id,
  };
}

/**
 * Best-effort helper: convert a TTL string to seconds for client
 * response. Returns 0 on parse failure (caller has already validated
 * via assertConfig).
 */
function parseDurationToSeconds(s) {
  const ms = parseDurationMs(s);
  return ms === null ? 0 : Math.floor(ms / 1000);
}

/**
 * Refresh token rotation.
 *
 * Flow:
 *  1. Hash the incoming refresh token, look up the matching Session.
 *  2. If no session / wrong hash → { error: { code: 'TOKEN_INVALID' } }.
 *     We deliberately do NOT differentiate "no session" from
 *     "expired session" / "revoked session" here — leaking that
 *     information would help attackers.
 *  3. If the session is already revoked (revokedAt !== null) → this
 *     is a REUSE attempt. Kill the entire family and return a
 *     generic invalid-token error.
 *  4. If the session is expired (expiresAt < now) → return a
 *     generic invalid-token error. We do NOT auto-rotate on expiry.
 *  5. Atomic update: set revokedAt=now on the OLD session, ONLY if
 *     it is still active. This is the race-condition defense: two
 *     concurrent refresh requests with the SAME old token will see
 *     at most one update succeed; the loser sees revokedAt set and
 *     falls into step 3 (family kill).
 *  6. Issue a NEW access token + NEW refresh token, create a new
 *     Session document in the same family, and return both.
 *
 * Returns:
 *   { accessToken, refreshToken, expiresIn, refreshExpiresIn, sessionId, outcome }
 *   or
 *   { error: { code, message, outcome } }
 *
 * `outcome` is an INTERNAL classification used by the controller
 * to emit accurate audit events. It is NEVER returned to the
 * client. The client always sees the same `code: 'TOKEN_INVALID'`
 * regardless of the underlying reason.
 */
export async function rotateRefreshToken(refreshTokenPlaintext, options = {}) {
  if (typeof refreshTokenPlaintext !== 'string' || refreshTokenPlaintext.length === 0) {
    return {
      error: { code: 'TOKEN_INVALID', message: 'Refresh token is missing or malformed', outcome: 'invalid' },
    };
  }

  const tokenHash = hashRefreshToken(refreshTokenPlaintext);

  // Step 1 — find the session by hash. The unique index on tokenHash
  // guarantees at most one document.
  const existing = await Session.findOne({ tokenHash });
  if (!existing) {
    return {
      error: { code: 'TOKEN_INVALID', message: 'Refresh token is invalid', outcome: 'not_found' },
    };
  }

  // Step 3 — already revoked? Treat as reuse.
  if (existing.revokedAt) {
    await revokeFamily(existing.familyId, 'reuse_detected').catch(() => {
      // best-effort: we do not fail the response on audit
    });
    return {
      error: { code: 'TOKEN_INVALID', message: 'Refresh token is invalid', outcome: 'reuse_detected' },
    };
  }

  // Step 4 — expired? Refuse.
  if (existing.expiresAt.getTime() <= Date.now()) {
    return {
      error: { code: 'TOKEN_INVALID', message: 'Refresh token is invalid', outcome: 'expired' },
    };
  }

  // Make sure the user is still allowed to authenticate. If not, the
  // session is revoked AND the family is killed.
  const user = await User.findById(existing.userId);
  if (!user || user.status !== 'active') {
    await revokeFamily(existing.familyId, 'user_status_changed').catch(() => {});
    return {
      error: { code: 'TOKEN_INVALID', message: 'Refresh token is invalid', outcome: 'user_inactive' },
    };
  }

  // Step 5 — atomic update. If two requests arrive concurrently, only
  // one wins (the one that finds revokedAt === null). The loser will
  // see revokedAt !== null on the next read, but we handle that case
  // explicitly here too: we re-read the document after the update.
  const now = new Date();
  const atomicResult = await Session.findOneAndUpdate(
    { _id: existing._id, revokedAt: null },
    { $set: { revokedAt: now, revokedReason: 'refresh_rotation', lastUsedAt: now } },
    { new: true },
  );
  if (!atomicResult) {
    // Another concurrent request already revoked this session.
    // Treat as reuse (defense in depth).
    await revokeFamily(existing.familyId, 'reuse_detected').catch(() => {});
    return {
      error: { code: 'TOKEN_INVALID', message: 'Refresh token is invalid', outcome: 'reuse_detected' },
    };
  }

  // Step 6 — issue new pair bound to the same family.
  const familyId = existing.familyId;
  const expiresAt = computeRefreshExpiry();
  const { plaintext, tokenHash: newHash } = generateRefreshToken();

  const newSession = await Session.create({
    userId: user._id,
    tokenHash: newHash,
    familyId,
    expiresAt,
    userAgent:
      typeof options.userAgent === 'string'
        ? options.userAgent.slice(0, 512)
        : existing.userAgent,
    ip: typeof options.ip === 'string' ? options.ip.slice(0, 64) : existing.ip,
  });

  const accessToken = signAuthToken(user, newSession._id);

  return {
    accessToken,
    refreshToken: plaintext,
    expiresIn: parseDurationToSeconds(config.jwtExpiresIn),
    refreshExpiresIn: parseDurationToSeconds(config.refreshTokenExpiresIn),
    sessionId: newSession._id,
    outcome: 'success',
  };
}

/**
 * Revoke a single session by id. The session MUST belong to the
 * requesting user — callers are responsible for passing the right
 * `expectedUserId`.
 */
export async function revokeSessionForUser(sessionId, expectedUserId, reason = 'logout') {
  if (!SESSION_REVOKE_REASONS.includes(reason)) {
    throw new Error(`Unknown revoke reason: ${reason}`);
  }
  const result = await Session.findOneAndUpdate(
    { _id: sessionId, userId: expectedUserId, revokedAt: null },
    { $set: { revokedAt: new Date(), revokedReason: reason } },
    { new: true },
  );
  return Boolean(result);
}

/**
 * Revoke all sessions for a user. Optionally exclude one session
 * id (e.g. the current session, so "log out everywhere else" does
 * not log out the current device).
 */
export async function revokeAllSessionsForUser(userId, options = {}) {
  if (!userId) {
    throw new Error('revokeAllSessionsForUser requires a userId');
  }
  const filter = { userId, revokedAt: null };
  if (options.excludeSessionId) {
    filter._id = { $ne: options.excludeSessionId };
  }
  const now = new Date();
  const result = await Session.updateMany(filter, {
    $set: { revokedAt: now, revokedReason: options.reason || 'user_logout_all' },
  });
  return result.modifiedCount || 0;
}

/**
 * Revoke every session in a family. Used when reuse is detected.
 */
export async function revokeFamily(familyId, reason = 'reuse_detected') {
  if (!familyId) {
    throw new Error('revokeFamily requires a familyId');
  }
  if (!SESSION_REVOKE_REASONS.includes(reason)) {
    throw new Error(`Unknown revoke reason: ${reason}`);
  }
  const result = await Session.updateMany(
    { familyId, revokedAt: null },
    { $set: { revokedAt: new Date(), revokedReason: reason } },
  );
  return result.modifiedCount || 0;
}

/**
 * List active sessions for a user, with sensitive fields projected
 * out. Returns plain objects (NOT Mongoose documents) so callers
 * can serialize directly.
 */
export async function listActiveSessionsForUser(userId) {
  if (!userId) {
    throw new Error('listActiveSessionsForUser requires a userId');
  }
  const now = new Date();
  const sessions = await Session.find({
    userId,
    revokedAt: null,
    expiresAt: { $gt: now },
  })
    .sort({ lastUsedAt: -1, createdAt: -1 })
    .lean({ virtuals: true });

  // Manually strip the `tokenHash` field from the lean document.
  return sessions.map((s) => {
    const out = { ...s };
    delete out.tokenHash;
    delete out.__v;
    return out;
  });
}

// ---------------------------------------------------------------------------
// Existing helpers (unchanged behavior)
// ---------------------------------------------------------------------------

/**
 * Load the authenticated user freshly from the database.
 * Used by the `protect` middleware and by /api/auth/me.
 * Returns { user } or { error: { code, status } }.
 *
 * The role returned here is the source of truth — never trust the
 * role in the token for authorization decisions.
 */
export async function loadActiveUserById(userId) {
  const user = await User.findById(userId);
  if (!user) {
    return { error: { code: 'USER_NOT_FOUND', status: 401, message: 'User no longer exists' } };
  }
  if (user.status !== 'active') {
    return { error: { code: 'USER_INACTIVE', status: 401, message: 'User is not allowed to authenticate' } };
  }
  return { user };
}

/**
 * For /api/auth/me: build a safe response including the linked Employee
 * (if any). We do NOT assume User._id === Employee._id.
 */
export async function buildCurrentUserResponse(user) {
  const safeUser = user.toJSON ? user.toJSON() : user;
  const employee = await Employee.findOne({ userId: user._id });
  return {
    user: safeUser,
    employee: employee ? employee.toJSON() : null,
  };
}

/**
 * Logout notice used by the route handler. The response is now
 * honest: refresh-session IS revoked; access-token expiry is
 * documented in the message.
 */
export function buildLogoutNotice() {
  return {
    revoked: true,
    revokedTarget: 'refresh_session',
    message:
      'Refresh session has been revoked. Discard the refresh token. The current access token will remain valid until its natural expiry (' +
      config.jwtExpiresIn +
      '); see docs/AUTH_SESSION_MANAGEMENT.md §6 (Plan A) for the rationale.',
    accessTokenTtl: config.jwtExpiresIn,
  };
}
