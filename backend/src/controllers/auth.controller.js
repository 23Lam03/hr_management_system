// Auth controller.
//
// Thin layer that adapts HTTP requests to the auth service. Holds no
// business logic of its own. Returns the standard response shape used
// across the API:
//   { success: true,  data: ... }
//   { success: false, error: { code, message } }

import {
  authenticateWithPassword,
  createSessionForUser,
  rotateRefreshToken,
  revokeSessionForUser,
  revokeAllSessionsForUser,
  listActiveSessionsForUser,
  buildCurrentUserResponse,
  buildLogoutNotice,
} from '../services/auth.service.js';
import { validateLoginPayload, validateRefreshPayload } from '../validators/auth.validator.js';
import { recordEvent, recordEventSafe } from '../services/auditLog.service.js';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function clientMeta(req) {
  // Prefer the Phase 15 request context (set by
  // requestContext.middleware.js) over ad-hoc extraction. The
  // context already validates length, so we can pass it through.
  const ctx = (req && req.context) || {};
  return {
    userAgent: ctx.userAgent || (req && req.headers && req.headers['user-agent']),
    ip: ctx.ip || (req && req.ip),
  };
}

function auditCtx(req) {
  const ctx = (req && req.context) || {};
  return {
    requestId: ctx.requestId || null,
    ip: ctx.ip || null,
    userAgent: ctx.userAgent || null,
  };
}

// ---------------------------------------------------------------------------
// POST /api/auth/login
// ---------------------------------------------------------------------------

/**
 * POST /api/auth/login
 * Body: { email, password }
 *
 * On success: 200 with { accessToken, refreshToken, expiresIn, refreshExpiresIn, user }.
 * On failure: 400 for validation, 401 for credential errors.
 *
 * Phase 14:
 *   - Issues a refresh token alongside the access token.
 *   - The plaintext refresh token is returned ONCE in the response
 *     and never persisted.
 *   - The hash is stored in the Session collection.
 */
export async function login(req, res, next) {
  try {
    const validated = validateLoginPayload(req.body);
    if (validated.error) {
      return res.status(validated.error.status).json({
        success: false,
        error: {
          code: validated.error.code,
          message: validated.error.message,
          field: validated.error.field,
        },
      });
    }
    const { email, password } = validated.value;

    const { user, error } = await authenticateWithPassword(email, password);
    if (error) {
      // Phase 15: audit the failure. We do NOT log the email or
      // password — only the outcome and request context.
      await recordEventSafe({
        action: 'auth.login.failure',
        resourceType: 'auth',
        resourceId: null,
        description: 'User login failed',
        status: 'failure',
        ...auditCtx(req),
      });
      return res.status(401).json({
        success: false,
        error: { code: error.code, message: error.message },
      });
    }

    const meta = clientMeta(req);
    let tokens;
    try {
      tokens = await createSessionForUser(user, meta);
    } catch (err) {
      // eslint-disable-next-line no-console
      console.error('[auth] failed to create session:', err.message);
      return res.status(500).json({
        success: false,
        error: {
          code: 'SESSION_CREATE_FAILED',
          message: 'Could not create a session at this time. Please try again.',
        },
      });
    }

    // Best-effort lastLoginAt update. Failures are logged but do not
    // block the response.
    try {
      user.lastLoginAt = new Date();
      await user.save();
    } catch (err) {
      // eslint-disable-next-line no-console
      console.error('[auth] failed to update lastLoginAt:', err.message);
    }

    // Audit: use the session id (not the access/refresh token) as the
    // resource id. We deliberately do NOT include the tokens in metadata.
    // `actorRole` is already a top-level field — do NOT duplicate it
    // inside metadata.
    await recordEvent({
      actor: { _id: user._id, role: user.role },
      action: 'auth.login.success',
      resourceType: 'auth',
      resourceId: user._id,
      description: 'User login successful',
      metadata: { sessionId: String(tokens.sessionId) },
      status: 'success',
      ...auditCtx(req),
    });

    return res.status(200).json({
      success: true,
      data: {
        accessToken: tokens.accessToken,
        refreshToken: tokens.refreshToken,
        expiresIn: tokens.expiresIn,
        refreshExpiresIn: tokens.refreshExpiresIn,
        // Session id is exposed for client-side session management
        // (e.g. "log out this device"). The id alone is not a
        // credential — the corresponding refresh token is.
        sessionId: String(tokens.sessionId),
        user: user.toJSON(),
      },
    });
  } catch (err) {
    return next(err);
  }
}

// ---------------------------------------------------------------------------
// POST /api/auth/refresh
// ---------------------------------------------------------------------------

/**
 * POST /api/auth/refresh
 * Body: { refreshToken }
 *
 * Returns: 200 with a NEW { accessToken, refreshToken, ... }. The old
 * refresh token is rotated (revoked). If the old token was already
 * revoked, the entire token family is killed.
 *
 * Errors:
 *   400 - validation
 *   401 - invalid / expired / reused refresh token (all collapsed to
 *         a single generic code so we don't leak which case it was)
 */
export async function refresh(req, res, next) {
  try {
    const validated = validateRefreshPayload(req.body);
    if (validated.error) {
      // Validation error → 400. Audit as a failure but do not log
      // the user-supplied value (it could be a malformed token).
      await recordEventSafe({
        action: 'auth.refresh.failure',
        resourceType: 'auth',
        resourceId: null,
        description: 'Refresh request validation failed',
        status: 'failure',
        ...auditCtx(req),
      });
      return res.status(validated.error.status).json({
        success: false,
        error: {
          code: validated.error.code,
          message: validated.error.message,
          field: validated.error.field,
        },
      });
    }

    const meta = clientMeta(req);
    const result = await rotateRefreshToken(validated.value.refreshToken, meta);
    if (result.error) {
      // Pick the audit event based on the INTERNAL outcome. The
      // client only ever sees the generic `code: 'TOKEN_INVALID'`.
      const isReuse = result.error.outcome === 'reuse_detected';
      await recordEventSafe({
        action: isReuse ? 'auth.refresh.reuse_detected' : 'auth.refresh.failure',
        resourceType: 'auth',
        resourceId: null,
        description: isReuse
          ? 'Refresh token reuse detected; family killed'
          : 'Refresh token rejected',
        status: 'failure',
        // The reason is safe to log server-side: it does not leak
        // via the client response.
        metadata: { reason: result.error.outcome || 'invalid' },
        ...auditCtx(req),
      });
      return res.status(401).json({
        success: false,
        error: { code: result.error.code, message: result.error.message },
      });
    }

    // Success — we DO know the user id (from the rotated session).
    // We import the Session lazily to avoid a cycle.
    const { default: Session } = await import('../models/session.model.js');
    const session = await Session.findById(result.sessionId);
    if (session) {
      await recordEvent({
        actor: { _id: session.userId, role: null },
        action: 'auth.refresh.success',
        resourceType: 'auth',
        resourceId: session.userId,
        description: 'Refresh token rotated',
        metadata: { sessionId: String(result.sessionId) },
        status: 'success',
        ...auditCtx(req),
      });
    }

    return res.status(200).json({
      success: true,
      data: {
        accessToken: result.accessToken,
        refreshToken: result.refreshToken,
        expiresIn: result.expiresIn,
        refreshExpiresIn: result.refreshExpiresIn,
      },
    });
  } catch (err) {
    return next(err);
  }
}

// ---------------------------------------------------------------------------
// GET /api/auth/me
// ---------------------------------------------------------------------------

export async function me(req, res, next) {
  try {
    const { loadActiveUserById } = await import('../services/auth.service.js');
    const { user, error } = await loadActiveUserById(req.user._id);
    if (error) {
      return res.status(error.status || 401).json({
        success: false,
        error: { code: error.code, message: error.message },
      });
    }
    const data = await buildCurrentUserResponse(user);
    return res.status(200).json({ success: true, data });
  } catch (err) {
    return next(err);
  }
}

// ---------------------------------------------------------------------------
// POST /api/auth/logout
// ---------------------------------------------------------------------------

/**
 * Phase 14 logout. Accepts the refresh token in the request body
 * and revokes the corresponding Session. If no body is provided,
 * logout still returns 200 and revokes whatever session is
 * associated with the access token (best-effort, may be a no-op
 * if the token's `jti` is not a valid session id).
 *
 * Access tokens are NOT revoked server-side (Plan A — see
 * docs/AUTH_SESSION_MANAGEMENT.md §6). The response message makes
 * this explicit.
 */
export async function logout(req, res, next) {
  try {
    let body = req && req.body;
    if (typeof body === 'string') {
      try {
        body = JSON.parse(body);
      } catch (_) {
        body = null;
      }
    }

    // Optional refresh token in the body.
    const refreshToken = body && typeof body.refreshToken === 'string'
      ? body.refreshToken
      : null;

    let revoked = false;
    if (refreshToken) {
      // Hash + lookup, then revoke. We import lazily to avoid a cycle.
      const { hashRefreshToken } = await import('../models/session.model.js');
      const { default: Session } = await import('../models/session.model.js');
      const tokenHash = hashRefreshToken(refreshToken);
      const session = await Session.findOne({ tokenHash });
      if (session && req.user && session.userId.toString() === req.user._id.toString()) {
        revoked = await revokeSessionForUser(session._id, req.user._id, 'logout');
      }
    } else if (req.user && req.user._id && req.user._id) {
      // Try to revoke the session matching the access-token's jti.
      const { default: Session } = await import('../models/session.model.js');
      const jti = req.auth && req.auth.jti;
      if (jti) {
        // Verify ownership before revoking.
        const session = await Session.findOne({ _id: jti });
        if (session && session.userId.toString() === req.user._id.toString()) {
          revoked = await revokeSessionForUser(session._id, req.user._id, 'logout');
        }
      }
    }

    // Audit. best-effort. We log the outcome but not the token.
    await recordEvent({
      actor: req.user,
      action: 'auth.logout',
      resourceType: 'auth',
      resourceId: req.user && req.user._id,
      description: revoked
        ? 'User logout; refresh session revoked'
        : 'User logout; no active refresh session found to revoke',
      status: 'success',
      ...auditCtx(req),
    });

    return res.status(200).json({
      success: true,
      data: {
        ...buildLogoutNotice(),
        refreshSessionRevoked: revoked,
      },
    });
  } catch (err) {
    return next(err);
  }
}

// ---------------------------------------------------------------------------
// Session management
// ---------------------------------------------------------------------------

/**
 * GET /api/auth/sessions — list the caller's active refresh sessions.
 */
export async function listMySessions(req, res, next) {
  try {
    const sessions = await listActiveSessionsForUser(req.user._id);
    return res.status(200).json({
      success: true,
      data: { sessions },
    });
  } catch (err) {
    return next(err);
  }
}

/**
 * DELETE /api/auth/sessions/:id — revoke one of the caller's
 * refresh sessions by id.
 */
export async function revokeMySession(req, res, next) {
  try {
    const { id } = req.params;
    if (!id || !/^[a-fA-F0-9]{24}$/.test(id)) {
      return res.status(400).json({
        success: false,
        error: {
          code: 'VALIDATION_ERROR',
          field: 'id',
          message: 'id must be a valid session id',
        },
      });
    }
    const revoked = await revokeSessionForUser(id, req.user._id, 'logout');
    if (!revoked) {
      return res.status(404).json({
        success: false,
        error: {
          code: 'SESSION_NOT_FOUND',
          message: 'No active session with that id for the current user',
        },
      });
    }

    await recordEvent({
      actor: req.user,
      action: 'auth.session.revoked',
      resourceType: 'auth',
      resourceId: req.user && req.user._id,
      description: 'User revoked a single refresh session',
      metadata: { sessionId: id },
      status: 'success',
      ...auditCtx(req),
    });

    return res.status(200).json({
      success: true,
      data: { revoked: true, sessionId: id },
    });
  } catch (err) {
    return next(err);
  }
}

/**
 * POST /api/auth/sessions/revoke-all — revoke every refresh session
 * for the caller. Optionally excludes the current session via
 * the `exceptCurrent` flag in the body.
 */
export async function revokeAllMySessions(req, res, next) {
  try {
    const body = req && req.body;
    const exceptCurrent = !!(body && body.exceptCurrent === true);
    const currentJti = req.auth && req.auth.jti;
    const excludeId = exceptCurrent ? currentJti : null;
    const count = await revokeAllSessionsForUser(req.user._id, {
      excludeSessionId: excludeId,
      reason: 'user_logout_all',
    });

    await recordEvent({
      actor: req.user,
      action: 'auth.sessions.revoked_all',
      resourceType: 'auth',
      resourceId: req.user && req.user._id,
      description: 'User revoked all refresh sessions',
      metadata: { revokedCount: count, excludedCurrent: exceptCurrent },
      status: 'success',
      ...auditCtx(req),
    });

    return res.status(200).json({
      success: true,
      data: { revokedCount: count, excludedCurrent: exceptCurrent },
    });
  } catch (err) {
    return next(err);
  }
}

// ---------------------------------------------------------------------------
// Diagnostic (unchanged)
// ---------------------------------------------------------------------------

export function adminCheck(req, res) {
  return res.status(200).json({
    success: true,
    data: {
      role: req.user.role,
      userId: req.user._id,
      message: 'Admin authorization confirmed',
    },
  });
}
