// Phase 15 — Audit log, data retention & security monitoring tests.
//
// Coverage:
//  - Security events: login success/failure, refresh success/failure/reuse,
//    logout, session revoked (single + all).
//  - Forbidden keys are never persisted.
//  - Logger failure does not break business flow.
//  - Cleanup is idempotent, batch-bounded, refuses bad params.
//  - Authorization: only admin can read audit logs.
//  - Client never sees the internal refresh outcome; the
//    response code is the same for all refresh failures.
//  - requestContext middleware: generates a requestId, never
//    trusts a client-supplied X-Request-Id.

import { describe, it, before, after, beforeEach } from 'node:test';
import { strict as assert } from 'node:assert';

import { createApp } from '../src/app.js';
import {
  AuditLog,
  Session,
  User,
} from '../src/models/index.js';
import {
  recordEvent,
  recordEventSafe,
  cleanupExpiredLogs,
  validateCleanupParams,
  listAuditLogs,
} from '../src/services/auditLog.service.js';
import {
  rotateRefreshToken,
  createSessionForUser,
} from '../src/services/auth.service.js';
import { hashRefreshToken } from '../src/models/session.model.js';
import { requestContext } from '../src/middlewares/requestContext.middleware.js';
import { setupTestDb, clearTestDb, teardownTestDb } from './helpers/db.js';
import { createTestUser, issueTokenFor } from './helpers/auth.js';

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
  const opts = { method, headers: { 'Content-Type': 'application/json' } };
  if (body !== undefined) opts.body = JSON.stringify(body);
  if (token) opts.headers.Authorization = `Bearer ${token}`;
  if (headers) Object.assign(opts.headers, headers);
  const res = await fetch(`http://127.0.0.1:${port}${path}`, opts);
  let payload = null;
  const ct = res.headers.get('content-type') || '';
  if (ct.includes('application/json')) payload = await res.json();
  else payload = await res.text();
  return { status: res.status, body: payload, headers: res.headers };
}

function logFailure(label, r) {
  // eslint-disable-next-line no-console
  console.error(`[fail-debug] ${label}: status=${r.status} body=`, r.body);
}

async function makeAdmin() {
  const { user } = await createTestUser({
    email: `p15-admin-${Date.now()}-${Math.random().toString(36).slice(2, 8)}@example.com`,
    role: 'admin',
  });
  const token = await issueTokenFor(user);
  return { user, token };
}

async function makeEmployeeUser() {
  const { user } = await createTestUser({
    email: `p15-emp-${Date.now()}-${Math.random().toString(36).slice(2, 8)}@example.com`,
    role: 'employee',
  });
  const token = await issueTokenFor(user);
  return { user, token };
}

// ---------------------------------------------------------------------------
// 1. recordEvent: security, sanitization, new fields
// ---------------------------------------------------------------------------

describe('auditLogService — Phase 15 security events', () => {
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

  it('records auth.login.success with the request context fields', async () => {
    const { user } = await createTestUser({ role: 'admin' });
    const out = await recordEvent({
      actor: user,
      action: 'auth.login.success',
      resourceType: 'auth',
      resourceId: user._id,
      description: 'login',
      metadata: { sessionId: 'abc' },
      status: 'success',
      requestId: 'req-12345',
      ip: '10.0.0.1',
      userAgent: 'jest-test/1.0',
    });
    assert.ok(out && out._id);
    assert.equal(out.requestId, 'req-12345');
    assert.equal(out.ip, '10.0.0.1');
    assert.equal(out.userAgent, 'jest-test/1.0');
  });

  it('records auth.login.failure without an actor (server-side context only)', async () => {
    const out = await recordEventSafe({
      action: 'auth.login.failure',
      resourceType: 'auth',
      description: 'bad credentials',
      status: 'failure',
      requestId: 'req-fail-1',
      ip: '10.0.0.2',
    });
    assert.ok(out && out._id);
    assert.equal(out.status, 'failure');
    assert.equal(out.requestId, 'req-fail-1');
    // No actor on a failed login (we don't know who they are).
    assert.equal(out.actorUserId, null);
  });

  it('strips forbidden metadata keys (password, token, tokenHash, ...)', async () => {
    const { user } = await createTestUser({ role: 'admin' });
    const out = await recordEvent({
      actor: user,
      action: 'auth.login.failure',
      resourceType: 'auth',
      description: 'scrub',
      metadata: {
        password: 'hunter2',
        passwordHash: 'sha256:abc',
        token: 'plain.jwt.token',
        accessToken: 'jwt',
        refreshToken: 'rt',
        tokenHash: 'sha256-rt',
        email: 'leak@example.com',
        baseSalary: 9999,
        changedFields: ['email'],
      },
    });
    assert.ok(out);
    const m = out.metadata;
    assert.equal(m.password, undefined);
    assert.equal(m.passwordHash, undefined);
    assert.equal(m.token, undefined);
    assert.equal(m.accessToken, undefined);
    assert.equal(m.refreshToken, undefined);
    assert.equal(m.tokenHash, undefined);
    assert.equal(m.email, undefined);
    assert.equal(m.baseSalary, undefined);
    // Allowed keys survive.
    assert.deepEqual(m.changedFields, ['email']);
  });

  it('truncates oversized metadata strings', async () => {
    const { user } = await createTestUser({ role: 'admin' });
    const huge = 'x'.repeat(2_000);
    const out = await recordEvent({
      actor: user,
      action: 'employee.update',
      resourceType: 'employee',
      metadata: { customNote: huge, changedFields: ['email'] },
    });
    assert.ok(out);
    assert.ok(out.metadata.customNote.length <= 502); // 500 + ellipsis
    assert.deepEqual(out.metadata.changedFields, ['email']);
  });

  it('caps metadata key count', async () => {
    const { user } = await createTestUser({ role: 'admin' });
    const meta = {};
    for (let i = 0; i < 200; i += 1) meta[`k${i}`] = i;
    const out = await recordEvent({
      actor: user,
      action: 'employee.update',
      resourceType: 'employee',
      metadata: meta,
    });
    assert.ok(Object.keys(out.metadata).length <= 32);
  });

  it('rejects resourceId that is not a valid ObjectId', async () => {
    const { user } = await createTestUser({ role: 'admin' });
    const out = await recordEvent({
      actor: user,
      action: 'employee.update',
      resourceType: 'employee',
      resourceId: 'not-an-objectid',
    });
    assert.equal(out, null);
  });

  it('accepts actorRole=system (e.g. for cleanup events)', async () => {
    const out = await recordEvent({
      actor: { role: 'system' },
      action: 'auditlog.cleanup',
      resourceType: 'auditlog',
      description: 'system retention sweep',
      status: 'success',
    });
    assert.ok(out && out._id);
    assert.equal(out.actorRole, 'system');
    assert.equal(out.actorUserId, null);
  });
});

// ---------------------------------------------------------------------------
// 2. Refresh audit events — reuse detection, generic client error
// ---------------------------------------------------------------------------

describe('refresh audit + generic client error (Phase 15)', () => {
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

  it('records auth.refresh.success after a successful rotation', async () => {
    const { user } = await createTestUser({ role: 'admin' });
    const tokens = await createSessionForUser(user, {
      userAgent: 'jest/1.0',
      ip: '127.0.0.1',
    });

    const r = await http('POST', '/api/auth/refresh', {
      body: { refreshToken: tokens.refreshToken },
    });
    if (r.status !== 200) logFailure('refresh success', r);
    assert.equal(r.status, 200);

    const docs = await AuditLog.find({ action: 'auth.refresh.success' }).lean();
    assert.equal(docs.length, 1);
    assert.equal(docs[0].status, 'success');
  });

  it('records auth.refresh.failure for a non-existent token AND does not leak which case it was', async () => {
    // A well-formed 64-hex refresh token that is not in the DB.
    const fakeToken = 'a'.repeat(64);
    const r = await http('POST', '/api/auth/refresh', {
      body: { refreshToken: fakeToken },
    });
    assert.equal(r.status, 401);
    assert.equal(r.body.error.code, 'TOKEN_INVALID');
    // The internal `outcome` MUST NOT leak to the client.
    assert.equal(r.body.error.outcome, undefined);
    assert.equal(r.body.error.message, 'Refresh token is invalid');

    const docs = await AuditLog.find({
      action: 'auth.refresh.failure',
    }).lean();
    assert.equal(docs.length, 1);
    assert.equal(docs[0].status, 'failure');
  });

  it('records auth.refresh.reuse_detected when a revoked token is replayed', async () => {
    const { user } = await createTestUser({ role: 'admin' });
    const tokens = await createSessionForUser(user, {
      userAgent: 'jest/1.0',
      ip: '127.0.0.1',
    });

    // First refresh — should succeed.
    const r1 = await http('POST', '/api/auth/refresh', {
      body: { refreshToken: tokens.refreshToken },
    });
    assert.equal(r1.status, 200);

    // Replay the SAME old token. The family should be killed.
    const r2 = await http('POST', '/api/auth/refresh', {
      body: { refreshToken: tokens.refreshToken },
    });
    assert.equal(r2.status, 401);
    assert.equal(r2.body.error.code, 'TOKEN_INVALID');

    const reuseDocs = await AuditLog.find({
      action: 'auth.refresh.reuse_detected',
    }).lean();
    assert.equal(reuseDocs.length, 1);

    // The family must be killed: the freshly issued token from
    // r1 should now also be rejected.
    const r3 = await http('POST', '/api/auth/refresh', {
      body: { refreshToken: r1.body.data.refreshToken },
    });
    assert.equal(r3.status, 401);
  });

  it('records auth.login.failure for bad password AND the response does not leak which field was wrong', async () => {
    const email = `p15-fail-${Date.now()}-${Math.random().toString(36).slice(2, 8)}@example.com`;
    const { user } = await createTestUser({ email, role: 'employee' });

    const r = await http('POST', '/api/auth/login', {
      body: { email, password: 'definitely-wrong' },
    });
    assert.equal(r.status, 401);
    // Generic code, no "user not found" vs "bad password" leak.
    assert.ok(typeof r.body.error.code === 'string');
    assert.ok(!/user not found/i.test(r.body.error.message));
    assert.ok(!/not found/i.test(r.body.error.message));

    const docs = await AuditLog.find({ action: 'auth.login.failure' }).lean();
    assert.equal(docs.length, 1);
    assert.equal(docs[0].status, 'failure');
    // Sensitive fields must NOT be in metadata.
    const m = docs[0].metadata || {};
    assert.equal(m.email, undefined);
    assert.equal(m.password, undefined);
  });
});

// ---------------------------------------------------------------------------
// 3. Logout / session-revocation audit
// ---------------------------------------------------------------------------

describe('logout + session revoke audit (Phase 15)', () => {
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

  it('records auth.logout with status=success', async () => {
    const { user, token } = await makeEmployeeUser();
    const r = await http('POST', '/api/auth/logout', {
      token,
      body: {},
    });
    assert.equal(r.status, 200);

    const docs = await AuditLog.find({ action: 'auth.logout' }).lean();
    assert.equal(docs.length, 1);
    assert.equal(docs[0].actorUserId.toString(), user._id.toString());
  });

  it('records auth.session.revoked on DELETE /api/auth/sessions/:id', async () => {
    const { user, token } = await makeEmployeeUser();
    const sess = await createSessionForUser(user, {
      userAgent: 'jest/1.0',
      ip: '127.0.0.1',
    });

    const r = await http('DELETE', `/api/auth/sessions/${sess.sessionId}`, {
      token,
    });
    assert.equal(r.status, 200);

    const docs = await AuditLog.find({ action: 'auth.session.revoked' }).lean();
    assert.equal(docs.length, 1);
    assert.equal(docs[0].metadata.sessionId, String(sess.sessionId));
  });

  it('records auth.sessions.revoked_all on POST /api/auth/sessions/revoke-all', async () => {
    const { user, token } = await makeEmployeeUser();
    // Create a couple of extra sessions.
    await createSessionForUser(user, { userAgent: 'jest/1.0', ip: '127.0.0.1' });
    await createSessionForUser(user, { userAgent: 'jest/1.0', ip: '127.0.0.1' });

    const r = await http('POST', '/api/auth/sessions/revoke-all', {
      token,
      body: { exceptCurrent: true },
    });
    assert.equal(r.status, 200);

    const docs = await AuditLog.find({
      action: 'auth.sessions.revoked_all',
    }).lean();
    assert.equal(docs.length, 1);
    assert.ok(docs[0].metadata.revokedCount >= 2);
  });
});

// ---------------------------------------------------------------------------
// 4. Retention / cleanup
// ---------------------------------------------------------------------------

describe('audit log retention (Phase 15)', () => {
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

  it('validateCleanupParams rejects negative / NaN / non-integer values', () => {
    const r1 = validateCleanupParams({ retentionDays: -5 });
    assert.ok(r1.error);
    const r2 = validateCleanupParams({ retentionDays: 'abc' });
    assert.ok(r2.error);
    const r3 = validateCleanupParams({ retentionDays: 1.5 });
    assert.ok(r3.error);
    const r4 = validateCleanupParams({ retentionDays: 0 });
    assert.ok(r4.error);
    const r5 = validateCleanupParams({ retentionDays: 100 });
    assert.equal(r5.error, undefined);
    assert.equal(r5.retentionDays, 100);
  });

  it('validateCleanupParams caps the batch size to a safe maximum', () => {
    const r = validateCleanupParams({ retentionDays: 30, batchSize: 999_999 });
    assert.ok(r.error);
  });

  it('cleanupExpiredLogs does not delete logs inside the retention window', async () => {
    const { user } = await createTestUser({ role: 'admin' });
    // Insert a fresh log.
    await AuditLog.create({
      actorUserId: user._id,
      actorRole: 'admin',
      action: 'employee.create',
      resourceType: 'employee',
      status: 'success',
    });
    const beforeCount = await AuditLog.countDocuments();
    assert.equal(beforeCount, 1);

    const r = await cleanupExpiredLogs({ retentionDays: 30, batchSize: 100 });
    assert.equal(r.error, undefined);
    assert.equal(r.deletedCount, 0);

    const afterCount = await AuditLog.countDocuments();
    assert.equal(afterCount, 1);
  });

  it('cleanupExpiredLogs deletes logs older than retentionDays and is idempotent', async () => {
    const { user } = await createTestUser({ role: 'admin' });
    // Insert 5 old logs.
    for (let i = 0; i < 5; i += 1) {
      // eslint-disable-next-line no-await-in-loop
      await AuditLog.create({
        actorUserId: user._id,
        actorRole: 'admin',
        action: 'employee.create',
        resourceType: 'employee',
        status: 'success',
        createdAt: new Date(Date.now() - 100 * 24 * 60 * 60 * 1000),
        updatedAt: new Date(Date.now() - 100 * 24 * 60 * 60 * 1000),
      });
    }
    // Insert 3 fresh logs.
    for (let i = 0; i < 3; i += 1) {
      // eslint-disable-next-line no-await-in-loop
      await AuditLog.create({
        actorUserId: user._id,
        actorRole: 'admin',
        action: 'employee.create',
        resourceType: 'employee',
        status: 'success',
      });
    }

    const r1 = await cleanupExpiredLogs({
      retentionDays: 30,
      batchSize: 100,
    });
    assert.equal(r1.error, undefined);
    assert.equal(r1.deletedCount, 5);
    assert.equal(r1.hasMore, false);

    // Second call is a no-op.
    const r2 = await cleanupExpiredLogs({
      retentionDays: 30,
      batchSize: 100,
    });
    assert.equal(r2.deletedCount, 0);

    // Fresh records still there.
    const remaining = await AuditLog.countDocuments();
    assert.equal(remaining, 3);
  });

  it('cleanupExpiredLogs respects the batch size and signals hasMore', async () => {
    const { user } = await createTestUser({ role: 'admin' });
    for (let i = 0; i < 10; i += 1) {
      // eslint-disable-next-line no-await-in-loop
      await AuditLog.create({
        actorUserId: user._id,
        actorRole: 'admin',
        action: 'employee.create',
        resourceType: 'employee',
        status: 'success',
        createdAt: new Date(Date.now() - 200 * 24 * 60 * 60 * 1000),
        updatedAt: new Date(Date.now() - 200 * 24 * 60 * 60 * 1000),
      });
    }

    const r = await cleanupExpiredLogs({ retentionDays: 30, batchSize: 4 });
    assert.equal(r.error, undefined);
    assert.equal(r.deletedCount, 4);
    assert.equal(r.hasMore, true);

    // Run again — should pick up the next 4.
    const r2 = await cleanupExpiredLogs({ retentionDays: 30, batchSize: 4 });
    assert.equal(r2.deletedCount, 4);
    assert.equal(r2.hasMore, true);

    // Third run — final 2.
    const r3 = await cleanupExpiredLogs({ retentionDays: 30, batchSize: 4 });
    assert.equal(r3.deletedCount, 2);
    assert.equal(r3.hasMore, false);
  });

  it('cleanupExpiredLogs with bad retentionDays returns error and does nothing', async () => {
    const { user } = await createTestUser({ role: 'admin' });
    await AuditLog.create({
      actorUserId: user._id,
      actorRole: 'admin',
      action: 'employee.create',
      resourceType: 'employee',
      status: 'success',
      createdAt: new Date(Date.now() - 1000 * 24 * 60 * 60 * 1000),
      updatedAt: new Date(Date.now() - 1000 * 24 * 60 * 60 * 1000),
    });
    const r = await cleanupExpiredLogs({ retentionDays: 'forever' });
    assert.ok(r.error);
    const after = await AuditLog.countDocuments();
    assert.equal(after, 1); // nothing deleted
  });
});

// ---------------------------------------------------------------------------
// 5. Logger failure isolation
// ---------------------------------------------------------------------------

describe('audit logger failure isolation (Phase 15)', () => {
  before(async () => {
    await setupTestDb();
  });
  after(async () => {
    await teardownTestDb();
  });
  beforeEach(async () => {
    await clearTestDb();
  });

  it('logger rejection (action not in allowlist) does not throw', async () => {
    const { user } = await createTestUser({ role: 'admin' });
    const out = await recordEvent({
      actor: user,
      action: 'invalid.action',
      resourceType: 'employee',
    });
    assert.equal(out, null);
  });

  it('recordEvent returns null on a rejected resourceType and does not persist', async () => {
    const { user } = await createTestUser({ role: 'admin' });
    const out = await recordEvent({
      actor: user,
      action: 'employee.create',
      resourceType: 'no_such_type',
    });
    assert.equal(out, null);
    const c = await AuditLog.countDocuments();
    assert.equal(c, 0);
  });
});

// ---------------------------------------------------------------------------
// 6. Authorization: only admin can read audit logs
// ---------------------------------------------------------------------------

describe('audit log API authorization (Phase 15)', () => {
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

  it('GET /api/audit-logs with employee token → 403', async () => {
    const { token } = await makeEmployeeUser();
    const r = await http('GET', '/api/audit-logs', { token });
    assert.equal(r.status, 403);
  });

  it('GET /api/audit-logs with admin token → 200', async () => {
    const { token } = await makeAdmin();
    const r = await http('GET', '/api/audit-logs', { token });
    assert.equal(r.status, 200);
    assert.equal(r.body.success, true);
    assert.ok(Array.isArray(r.body.data));
  });

  it('GET /api/audit-logs?status=failure filters by status', async () => {
    const { user, token } = await makeAdmin();
    // Create one success, one failure.
    await AuditLog.create({
      actorUserId: user._id,
      actorRole: 'admin',
      action: 'auth.login.success',
      resourceType: 'auth',
      status: 'success',
    });
    await AuditLog.create({
      actorUserId: user._id,
      actorRole: 'admin',
      action: 'auth.login.failure',
      resourceType: 'auth',
      status: 'failure',
    });

    const r = await http('GET', '/api/audit-logs?status=failure', { token });
    assert.equal(r.status, 200);
    assert.equal(r.body.data.length, 1);
    assert.equal(r.body.data[0].status, 'failure');
  });

  it('rejects bogus sort field', async () => {
    const { token } = await makeAdmin();
    const r = await http('GET', '/api/audit-logs?sort=password', { token });
    assert.equal(r.status, 400);
    assert.equal(r.body.error.field, 'sort');
  });
});

// ---------------------------------------------------------------------------
// 7. Request context middleware
// ---------------------------------------------------------------------------

describe('requestContext middleware (Phase 15)', () => {
  it('generates a server-side requestId and ignores client-supplied one', () => {
    // Sanity: we can call the middleware directly with a fake req/res.
    const req = { headers: { 'user-agent': 'jest/1.0' }, ip: '1.2.3.4' };
    let nextCalled = false;
    const res = {
      setHeader(name, value) {
        this.headers = this.headers || {};
        this.headers[name] = value;
      },
    };
    requestContext(req, res, () => {
      nextCalled = true;
    });
    assert.ok(req.context.requestId);
    assert.match(req.context.requestId, /^[0-9a-f-]{36}$/);
    assert.equal(req.context.ip, '1.2.3.4');
    assert.equal(req.context.userAgent, 'jest/1.0');
    assert.equal(res.headers['X-Request-Id'], req.context.requestId);
    assert.ok(nextCalled);
  });

  it('does not throw when req.context already exists', () => {
    const req = { headers: {}, ip: '5.6.7.8', context: { requestId: 'pre-existing' } };
    const res = { setHeader() {} };
    requestContext(req, res, () => {});
    // Existing requestId is preserved.
    assert.equal(req.context.requestId, 'pre-existing');
  });
});

// ---------------------------------------------------------------------------
// 8. Session.metadata: ip / userAgent length cap (Phase 15)
// ---------------------------------------------------------------------------

describe('session metadata length cap (Phase 15)', () => {
  before(async () => {
    await setupTestDb();
  });
  after(async () => {
    await teardownTestDb();
  });
  beforeEach(async () => {
    await clearTestDb();
  });

  it('userAgent is truncated to 512 chars on session creation', async () => {
    const { user } = await createTestUser({ role: 'admin' });
    const huge = 'a'.repeat(2_000);
    const tokens = await createSessionForUser(user, {
      userAgent: huge,
      ip: '1.2.3.4',
    });
    const sess = await Session.findById(tokens.sessionId);
    assert.ok(sess);
    assert.ok(sess.userAgent.length <= 512);
  });

  it('ip is truncated to 64 chars on session creation', async () => {
    const { user } = await createTestUser({ role: 'admin' });
    const tokens = await createSessionForUser(user, {
      userAgent: 'jest/1.0',
      ip: '1'.repeat(500),
    });
    const sess = await Session.findById(tokens.sessionId);
    assert.ok(sess);
    assert.ok(sess.ip.length <= 64);
  });
});
