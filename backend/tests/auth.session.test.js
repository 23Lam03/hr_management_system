// Phase 14 — Token lifecycle & session management tests.
//
// Covers:
//   1. Login creates a Session document and returns access+refresh tokens.
//   2. Failed login does NOT create a Session.
//   3. Refresh token is opaque, ~64 hex chars, not stored in plaintext.
//   4. Access token is a JWT, refresh token is NOT a JWT.
//   5. Refresh token rotation issues a new pair and revokes the old session.
//   6. The old refresh token cannot be reused after rotation.
//   7. Reusing an already-revoked refresh token triggers family kill.
//   8. Expired refresh token is rejected.
//   9. Logout revokes the refresh session and refreshes are blocked afterwards.
//  10. /me still works with the (still-valid) access token after logout (Plan A).
//  11. GET /api/auth/sessions returns the caller's active sessions, no tokenHash.
//  12. DELETE /api/auth/sessions/:id revokes one of the caller's sessions.
//  13. Users cannot revoke sessions belonging to other users.
//  14. Inactive / locked users cannot refresh.
//  15. Two concurrent refresh requests — only one wins (atomicity).
//  16. refresh-token-as-access-token and access-token-as-refresh-token rejected.
//  17. Refresh-token storage is hash-only (no plaintext in DB).

import { describe, it, before, after, beforeEach } from 'node:test';
import { strict as assert } from 'node:assert';

import { createApp } from '../src/app.js';
import { Session, User } from '../src/models/index.js';
import {
  hashRefreshToken,
} from '../src/models/session.model.js';
import {
  createSessionForUser,
  rotateRefreshToken,
  signAuthToken,
} from '../src/services/auth.service.js';
import { config } from '../src/config/env.js';
import { setupTestDb, clearTestDb, teardownTestDb } from './helpers/db.js';
import {
  createTestUser,
  TEST_PASSWORD,
  issueFullSessionFor,
  issueTokenFor,
} from './helpers/auth.js';

let app;
let server;
let port;

async function startServer() {
  app = createApp();
  server = app.listen(0);
  await new Promise((r) => server.once('listening', r));
  port = server.address().port;
}

async function stopServer() {
  if (!server) return;
  await new Promise((r) => server.close(r));
  server = null;
  app = null;
}

async function http(method, path, { body, token, headers } = {}) {
  const opts = {
    method,
    headers: { 'Content-Type': 'application/json', ...(headers || {}) },
  };
  if (body !== undefined) opts.body = JSON.stringify(body);
  if (token) opts.headers.Authorization = `Bearer ${token}`;
  const res = await fetch(`http://127.0.0.1:${port}${path}`, opts);
  let payload = null;
  const ct = res.headers.get('content-type') || '';
  if (ct.includes('application/json')) {
    payload = await res.json();
  } else {
    payload = await res.text();
  }
  return { status: res.status, body: payload };
}

async function loginAs(email) {
  return http('POST', '/api/auth/login', {
    body: { email, password: TEST_PASSWORD },
  });
}

// ---------------------------------------------------------------------------
// 1, 2, 3, 4, 17 — login creates session, token shape, no plaintext
// ---------------------------------------------------------------------------
describe('Phase 14 — login and session creation', () => {
  before(async () => {
    await setupTestDb();
    await startServer();
  });
  after(async () => {
    await stopServer();
    await teardownTestDb();
  });
  beforeEach(async () => {
    await clearTestDb();
  });

  it('successful login creates a Session and returns access + refresh tokens', async () => {
    await createTestUser({ email: 'create@example.com' });
    const before = await Session.countDocuments({});
    const res = await loginAs('create@example.com');
    assert.equal(res.status, 200);
    assert.equal(res.body.success, true);
    assert.ok(res.body.data.accessToken);
    assert.ok(res.body.data.refreshToken);
    assert.equal(typeof res.body.data.accessToken, 'string');
    assert.equal(typeof res.body.data.refreshToken, 'string');
    assert.equal(res.body.data.accessToken.split('.').length, 3); // JWT
    assert.equal(res.body.data.refreshToken.length, 64); // 32 bytes hex
    assert.equal(typeof res.body.data.expiresIn, 'number');
    assert.equal(typeof res.body.data.refreshExpiresIn, 'number');

    const after = await Session.countDocuments({});
    assert.equal(after, before + 1);
  });

  it('failed login does NOT create a Session', async () => {
    await createTestUser({ email: 'no@example.com' });
    const before = await Session.countDocuments({});
    const res = await http('POST', '/api/auth/login', {
      body: { email: 'no@example.com', password: 'WRONG-PW' },
    });
    assert.equal(res.status, 401);
    const after = await Session.countDocuments({});
    assert.equal(after, before);
  });

  it('refresh token is stored as a SHA-256 hash, not plaintext', async () => {
    await createTestUser({ email: 'hash@example.com' });
    const res = await loginAs('hash@example.com');
    const refreshPlain = res.body.data.refreshToken;
    const session = await Session.findOne({});
    assert.ok(session);
    assert.notEqual(session.tokenHash, refreshPlain);
    assert.equal(session.tokenHash, hashRefreshToken(refreshPlain));
    assert.equal(session.tokenHash.length, 64); // SHA-256 hex
  });

  it('refresh token is NOT a JWT (opaque, not parseable as 3-part base64url)', async () => {
    await createTestUser({ email: 'opaque@example.com' });
    const res = await loginAs('opaque@example.com');
    const refreshPlain = res.body.data.refreshToken;
    assert.equal(refreshPlain.split('.').length, 1, 'refresh token must not be a JWT');
  });

  it('access token CANNOT be used as a refresh token', async () => {
    await createTestUser({ email: 'cross1@example.com' });
    const loginRes = await loginAs('cross1@example.com');
    const accessToken = loginRes.body.data.accessToken;
    const refresh = await http('POST', '/api/auth/refresh', {
      body: { refreshToken: accessToken },
    });
    // 400 (validation: not 64 hex) or 401 (service: not found). Either
    // is acceptable; the important thing is that it does NOT succeed.
    assert.ok(
      refresh.status === 400 || refresh.status === 401,
      `expected 400/401, got ${refresh.status}`,
    );
  });

  it('refresh token CANNOT be used as an access token on /me', async () => {
    await createTestUser({ email: 'cross2@example.com' });
    const loginRes = await loginAs('cross2@example.com');
    const refresh = loginRes.body.data.refreshToken;
    const me = await http('GET', '/api/auth/me', { token: refresh });
    assert.equal(me.status, 401);
  });
});

// ---------------------------------------------------------------------------
// 5, 6, 7, 8 — rotation, reuse, expiry
// ---------------------------------------------------------------------------
describe('Phase 14 — refresh token rotation', () => {
  before(async () => {
    await setupTestDb();
    await startServer();
  });
  after(async () => {
    await stopServer();
    await teardownTestDb();
  });
  beforeEach(async () => {
    await clearTestDb();
  });

  it('rotates the refresh token, returns a new pair, revokes the old session', async () => {
    await createTestUser({ email: 'rot@example.com' });
    const loginRes = await loginAs('rot@example.com');
    const oldRefresh = loginRes.body.data.refreshToken;
    const oldAccess = loginRes.body.data.accessToken;
    const oldSessionId = loginRes.body.data.sessionId ?? null;

    const before = await Session.countDocuments({});
    const refresh = await http('POST', '/api/auth/refresh', {
      body: { refreshToken: oldRefresh },
    });
    assert.equal(refresh.status, 200);
    assert.ok(refresh.body.data.accessToken);
    assert.ok(refresh.body.data.refreshToken);
    assert.notEqual(refresh.body.data.refreshToken, oldRefresh);
    assert.notEqual(refresh.body.data.accessToken, oldAccess);

    // Old session should now be revoked.
    if (oldSessionId) {
      const oldSession = await Session.findById(oldSessionId);
      assert.ok(oldSession.revokedAt);
      assert.equal(oldSession.revokedReason, 'refresh_rotation');
    } else {
      // Find by token hash
      const oldHash = hashRefreshToken(oldRefresh);
      const oldSession = await Session.findOne({ tokenHash: oldHash });
      assert.ok(oldSession.revokedAt);
      assert.equal(oldSession.revokedReason, 'refresh_rotation');
    }

    // Session count should be +1 (old revoked, new added).
    const after = await Session.countDocuments({});
    assert.equal(after, before + 1);
  });

  it('a revoked refresh token cannot be reused', async () => {
    await createTestUser({ email: 'noreuse@example.com' });
    const loginRes = await loginAs('noreuse@example.com');
    const oldRefresh = loginRes.body.data.refreshToken;

    // First refresh succeeds.
    const r1 = await http('POST', '/api/auth/refresh', {
      body: { refreshToken: oldRefresh },
    });
    assert.equal(r1.status, 200);

    // Second refresh with the SAME old token must fail.
    const r2 = await http('POST', '/api/auth/refresh', {
      body: { refreshToken: oldRefresh },
    });
    assert.equal(r2.status, 401);
    assert.equal(r2.body.error.code, 'TOKEN_INVALID');
  });

  it('reusing an already-revoked refresh token kills the entire token family', async () => {
    await createTestUser({ email: 'family@example.com' });
    const loginRes = await loginAs('family@example.com');
    const firstRefresh = loginRes.body.data.refreshToken;

    // Successful rotation — new pair.
    const r1 = await http('POST', '/api/auth/refresh', {
      body: { refreshToken: firstRefresh },
    });
    assert.equal(r1.status, 200);
    const secondRefresh = r1.body.data.refreshToken;

    // Attacker reuses the FIRST (now-revoked) token. Family kill.
    const r2 = await http('POST', '/api/auth/refresh', {
      body: { refreshToken: firstRefresh },
    });
    assert.equal(r2.status, 401);

    // The second (newly-issued) token should ALSO be invalid now,
    // because the family was killed.
    const r3 = await http('POST', '/api/auth/refresh', {
      body: { refreshToken: secondRefresh },
    });
    assert.equal(r3.status, 401);
  });

  it('expired refresh token is rejected', async () => {
    const { user } = await createTestUser({ email: 'expref@example.com' });
    // Create a session that is already expired.
    await Session.create({
      userId: user._id,
      tokenHash: hashRefreshToken('a'.repeat(64)),
      familyId: Session.newFamilyId(),
      expiresAt: new Date(Date.now() - 60_000),
    });
    const res = await http('POST', '/api/auth/refresh', {
      body: { refreshToken: 'a'.repeat(64) },
    });
    assert.equal(res.status, 401);
  });

  it('refresh for an inactive user is rejected (and family is killed)', async () => {
    const { user } = await createTestUser({ email: 'inactive@example.com' });
    const loginRes = await loginAs('inactive@example.com');
    const refresh = loginRes.body.data.refreshToken;

    // Lock the user.
    await User.updateOne({ _id: user._id }, { $set: { status: 'locked' } });

    const res = await http('POST', '/api/auth/refresh', {
      body: { refreshToken: refresh },
    });
    assert.equal(res.status, 401);

    // Family should be killed: the session is now revoked with
    // reason user_status_changed.
    const sessionDoc = await Session.findOne({
      tokenHash: hashRefreshToken(refresh),
    });
    assert.ok(sessionDoc.revokedAt);
    assert.equal(sessionDoc.revokedReason, 'user_status_changed');
  });

  it('refresh request with malformed body is rejected (400)', async () => {
    const res = await http('POST', '/api/auth/refresh', { body: {} });
    assert.equal(res.status, 400);
    assert.equal(res.body.error.field, 'refreshToken');
  });

  it('refresh request with empty string is rejected (400)', async () => {
    const res = await http('POST', '/api/auth/refresh', {
      body: { refreshToken: '' },
    });
    assert.equal(res.status, 400);
  });

  it('refresh request with wrong format is rejected (400)', async () => {
    const res = await http('POST', '/api/auth/refresh', {
      body: { refreshToken: 'not-a-hex-string-just-some-words' },
    });
    assert.equal(res.status, 400);
  });
});

// ---------------------------------------------------------------------------
// 9, 10 — logout behavior (Plan A)
// ---------------------------------------------------------------------------
describe('Phase 14 — logout revokes the refresh session', () => {
  before(async () => {
    await setupTestDb();
    await startServer();
  });
  after(async () => {
    await stopServer();
    await teardownTestDb();
  });
  beforeEach(async () => {
    await clearTestDb();
  });

  it('logout with refreshToken in body revokes the session and blocks further refresh', async () => {
    await createTestUser({ email: 'lo1@example.com' });
    const loginRes = await loginAs('lo1@example.com');
    const accessToken = loginRes.body.data.accessToken;
    const refresh = loginRes.body.data.refreshToken;

    const logoutRes = await http('POST', '/api/auth/logout', {
      token: accessToken,
      body: { refreshToken: refresh },
    });
    assert.equal(logoutRes.status, 200);
    assert.equal(logoutRes.body.data.revoked, true);
    assert.equal(logoutRes.body.data.refreshSessionRevoked, true);

    // Refresh should now fail.
    const r = await http('POST', '/api/auth/refresh', {
      body: { refreshToken: refresh },
    });
    assert.equal(r.status, 401);
  });

  it('Plan A: /me still works with the (still-valid) access token after logout', async () => {
    await createTestUser({ email: 'lo2@example.com' });
    const loginRes = await loginAs('lo2@example.com');
    const accessToken = loginRes.body.data.accessToken;
    const refresh = loginRes.body.data.refreshToken;

    await http('POST', '/api/auth/logout', {
      token: accessToken,
      body: { refreshToken: refresh },
    });

    // The access token is still valid (Plan A) — protect middleware
    // re-loads the user from DB and the user is still active.
    const me = await http('GET', '/api/auth/me', { token: accessToken });
    assert.equal(me.status, 200);
  });

  it('logout without body still works (revoke by jti from access token)', async () => {
    await createTestUser({ email: 'lo3@example.com' });
    const loginRes = await loginAs('lo3@example.com');
    const accessToken = loginRes.body.data.accessToken;
    const refresh = loginRes.body.data.refreshToken;

    const logoutRes = await http('POST', '/api/auth/logout', {
      token: accessToken,
    });
    assert.equal(logoutRes.status, 200);

    // The session corresponding to the access token's jti should be
    // revoked.
    const r = await http('POST', '/api/auth/refresh', {
      body: { refreshToken: refresh },
    });
    assert.equal(r.status, 401);
  });

  it('logout response does not leak tokenHash, password, or any session secret', async () => {
    await createTestUser({ email: 'lo4@example.com' });
    const loginRes = await loginAs('lo4@example.com');
    const accessToken = loginRes.body.data.accessToken;
    const refresh = loginRes.body.data.refreshToken;

    const logoutRes = await http('POST', '/api/auth/logout', {
      token: accessToken,
      body: { refreshToken: refresh },
    });
    const text = JSON.stringify(logoutRes.body);
    assert.ok(!text.includes('tokenHash'));
    assert.ok(!text.includes(refresh));
    assert.ok(!text.includes(TEST_PASSWORD));
  });
});

// ---------------------------------------------------------------------------
// 11, 12, 13 — session list and per-session revoke
// ---------------------------------------------------------------------------
describe('Phase 14 — session management endpoints', () => {
  before(async () => {
    await setupTestDb();
    await startServer();
  });
  after(async () => {
    await stopServer();
    await teardownTestDb();
  });
  beforeEach(async () => {
    await clearTestDb();
  });

  it("GET /api/auth/sessions returns the caller's active sessions, no tokenHash", async () => {
    const { user } = await createTestUser({ email: 'sess1@example.com' });
    await issueFullSessionFor(user);
    await issueFullSessionFor(user);
    const token = (await issueFullSessionFor(user)).accessToken;

    const res = await http('GET', '/api/auth/sessions', { token });
    assert.equal(res.status, 200);
    assert.ok(Array.isArray(res.body.data.sessions));
    assert.equal(res.body.data.sessions.length, 3);
    for (const s of res.body.data.sessions) {
      assert.ok(!('tokenHash' in s), 'tokenHash must not be returned');
      assert.ok(s._id);
      assert.ok(s.userId);
    }
  });

  it("DELETE /api/auth/sessions/:id revokes one of the caller's sessions", async () => {
    const { user } = await createTestUser({ email: 'sess2@example.com' });
    const first = await issueFullSessionFor(user);
    const second = await issueFullSessionFor(user);

    const res = await http('DELETE', `/api/auth/sessions/${first.sessionId}`, {
      token: second.accessToken,
    });
    assert.equal(res.status, 200);
    assert.equal(res.body.data.revoked, true);

    // First refresh should now fail.
    const r = await http('POST', '/api/auth/refresh', {
      body: { refreshToken: first.refreshToken },
    });
    assert.equal(r.status, 401);

    // Second refresh still works.
    const r2 = await http('POST', '/api/auth/refresh', {
      body: { refreshToken: second.refreshToken },
    });
    assert.equal(r2.status, 200);
  });

  it('DELETE /api/auth/sessions/:id with another user\'s session id returns 404', async () => {
    const alice = await createTestUser({ email: 'alice@x.com' });
    const bob = await createTestUser({ email: 'bob@x.com' });
    const aliceSession = await issueFullSessionFor(alice.user);
    const bobToken = (await issueFullSessionFor(bob.user)).accessToken;

    const res = await http(
      'DELETE',
      `/api/auth/sessions/${aliceSession.sessionId}`,
      { token: bobToken },
    );
    // The session does not belong to bob → 404 (not 403, to avoid
    // leaking existence).
    assert.equal(res.status, 404);
    // Alice's session is still alive.
    const r = await http('POST', '/api/auth/refresh', {
      body: { refreshToken: aliceSession.refreshToken },
    });
    assert.equal(r.status, 200);
  });

  it('POST /api/auth/sessions/revoke-all revokes every other session', async () => {
    const { user } = await createTestUser({ email: 'sess3@example.com' });
    const a = await issueFullSessionFor(user);
    const b = await issueFullSessionFor(user);
    const c = await issueFullSessionFor(user);

    const res = await http('POST', '/api/auth/sessions/revoke-all', {
      token: b.accessToken,
      body: { exceptCurrent: true },
    });
    assert.equal(res.status, 200);
    assert.ok(res.body.data.revokedCount >= 2);

    // a and c are dead.
    assert.equal(
      (await http('POST', '/api/auth/refresh', {
        body: { refreshToken: a.refreshToken },
      })).status,
      401,
    );
    assert.equal(
      (await http('POST', '/api/auth/refresh', {
        body: { refreshToken: c.refreshToken },
      })).status,
      401,
    );

    // b is still alive.
    assert.equal(
      (await http('POST', '/api/auth/refresh', {
        body: { refreshToken: b.refreshToken },
      })).status,
      200,
    );
  });

  it('POST /api/auth/sessions/revoke-all with exceptCurrent=false revokes the current session too', async () => {
    const { user } = await createTestUser({ email: 'sess4@example.com' });
    const a = await issueFullSessionFor(user);

    const res = await http('POST', '/api/auth/sessions/revoke-all', {
      token: a.accessToken,
      body: { exceptCurrent: false },
    });
    assert.equal(res.status, 200);
    assert.ok(res.body.data.revokedCount >= 1);

    // a is dead.
    assert.equal(
      (await http('POST', '/api/auth/refresh', {
        body: { refreshToken: a.refreshToken },
      })).status,
      401,
    );
  });

  it('GET /api/auth/sessions requires authentication', async () => {
    const res = await http('GET', '/api/auth/sessions');
    assert.equal(res.status, 401);
  });

  it('DELETE /api/auth/sessions/:id with malformed id returns 400', async () => {
    const { user } = await createTestUser({ email: 'mal@example.com' });
    const { accessToken } = await issueFullSessionFor(user);
    const res = await http('DELETE', '/api/auth/sessions/not-an-id', {
      token: accessToken,
    });
    assert.equal(res.status, 400);
  });
});

// ---------------------------------------------------------------------------
// 14, 15, 16 — atomicity, status, cross-use
// ---------------------------------------------------------------------------
describe('Phase 14 — atomicity and edge cases', () => {
  before(async () => {
    await setupTestDb();
    await startServer();
  });
  after(async () => {
    await stopServer();
    await teardownTestDb();
  });
  beforeEach(async () => {
    await clearTestDb();
  });

  it('two concurrent refresh requests — only one succeeds (atomicity)', async () => {
    const { user } = await createTestUser({ email: 'race@example.com' });
    const loginRes = await loginAs('race@example.com');
    const refresh = loginRes.body.data.refreshToken;

    // Fire two requests in parallel.
    const [a, b] = await Promise.all([
      http('POST', '/api/auth/refresh', { body: { refreshToken: refresh } }),
      http('POST', '/api/auth/refresh', { body: { refreshToken: refresh } }),
    ]);

    const successes = [a, b].filter((r) => r.status === 200);
    const failures = [a, b].filter((r) => r.status === 401);

    // Exactly one success — findOneAndUpdate is atomic.
    assert.equal(successes.length, 1, 'expected exactly one 200, got ' + successes.length);
    assert.equal(failures.length, 1, 'expected exactly one 401, got ' + failures.length);

    // The success and the failure must have issued DIFFERENT refresh
    // tokens, or the success reuses the same one (rotation). Either
    // way, the failed request returns 401 and cannot be retried.
  });

  it('signAuthToken throws if no sessionId is provided', () => {
    const { user } = { user: { _id: '507f1f77bcf86cd799439011' } };
    assert.throws(
      () => signAuthToken(user, null),
      /sessionId/,
    );
  });

  it('createSessionForUser creates a new family for each login', async () => {
    const { user } = await createTestUser({ email: 'fam@example.com' });
    const a = await createSessionForUser(user);
    const b = await createSessionForUser(user);

    const docA = await Session.findById(a.sessionId);
    const docB = await Session.findById(b.sessionId);
    assert.notEqual(docA.familyId, docB.familyId);
  });

  it('the access token includes the session id in the jti claim', async () => {
    await createTestUser({ email: 'jti@example.com' });
    const loginRes = await loginAs('jti@example.com');
    const accessToken = loginRes.body.data.accessToken;
    const payloadB64 = accessToken.split('.')[1];
    const json = JSON.parse(Buffer.from(payloadB64, 'base64url').toString('utf8'));
    assert.ok(json.jti);
    assert.equal(json.jti, String(loginRes.body.data.sessionId));
  });
});
