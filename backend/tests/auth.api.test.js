// Auth integration tests — exercises the full HTTP layer through
// createApp(). Covers login, /me, logout, admin-check, and middleware
// edge cases (missing/expired/invalid tokens, role changes, etc.).

import { describe, it, before, after, beforeEach } from 'node:test';
import { strict as assert } from 'node:assert';
import jwt from 'jsonwebtoken';

import { createApp } from '../src/app.js';
import { User, Employee } from '../src/models/index.js';
import { config } from '../src/config/env.js';
import { setupTestDb, clearTestDb, teardownTestDb } from './helpers/db.js';
import { createTestUser, TEST_PASSWORD, issueTokenFor } from './helpers/auth.js';

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
  if (ct.includes('application/json')) {
    payload = await res.json();
  } else {
    payload = await res.text();
  }
  return { status: res.status, body: payload };
}

describe('Auth API', () => {
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

  // ----- POST /api/auth/login ---------------------------------------------

  describe('POST /api/auth/login', () => {
    it('returns 200 + accessToken + refreshToken + safe user on correct credentials', async () => {
      await createTestUser({ email: 'login@example.com', role: 'admin' });
      const res = await http('POST', '/api/auth/login', {
        body: { email: 'login@example.com', password: TEST_PASSWORD },
      });
      assert.equal(res.status, 200);
      assert.equal(res.body.success, true);
      // Phase 14: response shape changed.
      assert.ok(res.body.data.accessToken);
      assert.equal(typeof res.body.data.accessToken, 'string');
      assert.ok(res.body.data.refreshToken);
      assert.equal(typeof res.body.data.refreshToken, 'string');
      assert.equal(res.body.data.refreshToken.length, 64); // 32 bytes hex
      assert.equal(typeof res.body.data.expiresIn, 'number');
      assert.equal(typeof res.body.data.refreshExpiresIn, 'number');
      assert.equal(res.body.data.user.email, 'login@example.com');
      assert.equal(res.body.data.user.role, 'admin');
      assert.ok(!('passwordHash' in res.body.data.user));
      // Legacy field MUST NOT be present (was the only token field pre-Phase 14).
      assert.equal(res.body.data.token, undefined);
    });

    it('normalizes email before lookup', async () => {
      await createTestUser({ email: 'mixed@example.com' });
      const res = await http('POST', '/api/auth/login', {
        body: { email: '  MIXED@Example.COM  ', password: TEST_PASSWORD },
      });
      assert.equal(res.status, 200);
    });

    it('returns 401 for unknown email', async () => {
      const res = await http('POST', '/api/auth/login', {
        body: { email: 'nobody@example.com', password: TEST_PASSWORD },
      });
      assert.equal(res.status, 401);
      assert.equal(res.body.error.code, 'INVALID_CREDENTIALS');
    });

    it('returns 401 for wrong password', async () => {
      await createTestUser({ email: 'wrong@example.com' });
      const res = await http('POST', '/api/auth/login', {
        body: { email: 'wrong@example.com', password: 'WRONG-PASSWORD-123' },
      });
      assert.equal(res.status, 401);
      assert.equal(res.body.error.code, 'INVALID_CREDENTIALS');
    });

    it('returns 401 for inactive account', async () => {
      await createTestUser({ email: 'off@example.com', status: 'inactive' });
      const res = await http('POST', '/api/auth/login', {
        body: { email: 'off@example.com', password: TEST_PASSWORD },
      });
      assert.equal(res.status, 401);
      assert.equal(res.body.error.code, 'INVALID_CREDENTIALS');
    });

    it('returns 401 for locked account', async () => {
      await createTestUser({ email: 'locked@example.com', status: 'locked' });
      const res = await http('POST', '/api/auth/login', {
        body: { email: 'locked@example.com', password: TEST_PASSWORD },
      });
      assert.equal(res.status, 401);
      assert.equal(res.body.error.code, 'INVALID_CREDENTIALS');
    });

    it('returns 400 when email is missing', async () => {
      const res = await http('POST', '/api/auth/login', {
        body: { password: TEST_PASSWORD },
      });
      assert.equal(res.status, 400);
      assert.equal(res.body.error.code, 'VALIDATION_ERROR');
    });

    it('returns 400 when password is missing', async () => {
      const res = await http('POST', '/api/auth/login', {
        body: { email: 'a@b.com' },
      });
      assert.equal(res.status, 400);
      assert.equal(res.body.error.code, 'VALIDATION_ERROR');
    });

    it('returns 400 when email is malformed', async () => {
      const res = await http('POST', '/api/auth/login', {
        body: { email: 'not-an-email', password: TEST_PASSWORD },
      });
      assert.equal(res.status, 400);
      assert.equal(res.body.error.code, 'VALIDATION_ERROR');
    });

    it('updates lastLoginAt after successful login', async () => {
      const { user } = await createTestUser({ email: 'last@example.com' });
      assert.equal(user.lastLoginAt, null);
      const res = await http('POST', '/api/auth/login', {
        body: { email: 'last@example.com', password: TEST_PASSWORD },
      });
      assert.equal(res.status, 200);
      const reloaded = await User.findById(user._id);
      assert.ok(reloaded.lastLoginAt instanceof Date);
    });

    it('does not create a default admin when login fails', async () => {
      const res = await http('POST', '/api/auth/login', {
        body: { email: 'phantom@example.com', password: 'x' },
      });
      assert.equal(res.status, 401);
      const count = await User.countDocuments({});
      assert.equal(count, 0);
    });
  });

  // ----- GET /api/auth/me -------------------------------------------------

  describe('GET /api/auth/me', () => {
    it('returns 200 with safe user + linked employee when present', async () => {
      const { user } = await createTestUser({ email: 'me@example.com', role: 'admin' });
      await Employee.create({
        employeeCode: 'NV-ME',
        userId: user._id,
        fullName: 'Me Person',
        email: 'me-emp@example.com',
        employmentType: 'full_time',
        hireDate: new Date('2024-01-01'),
      });
      const token = await issueTokenFor(user);
      const res = await http('GET', '/api/auth/me', { token });
      assert.equal(res.status, 200);
      assert.ok(!('passwordHash' in res.body.data.user));
      assert.equal(res.body.data.user.email, 'me@example.com');
      assert.equal(res.body.data.user.role, 'admin');
      assert.ok(res.body.data.employee);
      assert.equal(res.body.data.employee.userId.toString(), user._id.toString());
    });

    it('returns user but employee=null when no employee is linked', async () => {
      const { user } = await createTestUser({ email: 'noemp@example.com' });
      const token = await issueTokenFor(user);
      const res = await http('GET', '/api/auth/me', { token });
      assert.equal(res.status, 200);
      assert.ok(res.body.data.user);
      assert.equal(res.body.data.employee, null);
    });

    it('returns 401 when Authorization header is missing', async () => {
      const res = await http('GET', '/api/auth/me');
      assert.equal(res.status, 401);
      assert.equal(res.body.error.code, 'AUTH_MISSING');
    });

    it('returns 401 when Authorization header has wrong format', async () => {
      const res = await http('GET', '/api/auth/me', {
        headers: { Authorization: 'NotBearer abc' },
      });
      assert.equal(res.status, 401);
      assert.equal(res.body.error.code, 'AUTH_FORMAT');
    });

    it('returns 401 for a malformed token', async () => {
      const res = await http('GET', '/api/auth/me', { token: 'not.a.jwt' });
      assert.equal(res.status, 401);
      assert.equal(res.body.error.code, 'TOKEN_INVALID');
    });

    it('returns 401 for a token with bad signature', async () => {
      const { user } = await createTestUser({ email: 'badsig@example.com' });
      const good = await issueTokenFor(user);
      const parts = good.split('.');
      const tampered = `${parts[0]}.${parts[1]}.WRONG`;
      const res = await http('GET', '/api/auth/me', { token: tampered });
      assert.equal(res.status, 401);
      assert.equal(res.body.error.code, 'TOKEN_INVALID');
    });

    it('returns 401 for an expired token', async () => {
      const { user } = await createTestUser({ email: 'exp@example.com' });
      const expired = jwt.sign(
        { sub: user._id.toString(), role: user.role },
        config.jwtSecret,
        { expiresIn: -5 },
      );
      const res = await http('GET', '/api/auth/me', { token: expired });
      assert.equal(res.status, 401);
      assert.equal(res.body.error.code, 'TOKEN_EXPIRED');
    });

    it('returns 401 when the user has been deleted after token issuance', async () => {
      const { user } = await createTestUser({ email: 'del@example.com' });
      const token = await issueTokenFor(user);
      await User.deleteOne({ _id: user._id });
      const res = await http('GET', '/api/auth/me', { token });
      assert.equal(res.status, 401);
      assert.equal(res.body.error.code, 'USER_NOT_FOUND');
    });

    it('re-reads role from DB (role change invalidates an old token)', async () => {
      const { user } = await createTestUser({ email: 'role@example.com', role: 'employee' });
      const token = await issueTokenFor(user); // token says role=employee
      // Promote to admin in DB
      await User.updateOne({ _id: user._id }, { $set: { role: 'admin' } });
      // /api/auth/me reflects new role
      const me = await http('GET', '/api/auth/me', { token });
      assert.equal(me.status, 200);
      assert.equal(me.body.data.user.role, 'admin');
      // admin-check now succeeds
      const admin = await http('GET', '/api/auth/admin-check', { token });
      assert.equal(admin.status, 200);
    });

    it('does not return passwordHash even with +select bypass', async () => {
      // Re-verify the toJSON strip survives the controller path.
      const { user } = await createTestUser({ email: 'noexpose@example.com' });
      const token = await issueTokenFor(user);
      const res = await http('GET', '/api/auth/me', { token });
      const text = JSON.stringify(res.body);
      assert.ok(!text.includes('passwordHash'));
    });
  });

  // ----- POST /api/auth/logout --------------------------------------------

  describe('POST /api/auth/logout', () => {
    it('returns 200 and revokes the refresh session (Plan A: access token still valid until exp)', async () => {
      const { user } = await createTestUser({ email: 'logout@example.com' });
      const token = await issueTokenFor(user);
      const res = await http('POST', '/api/auth/logout', { token });
      assert.equal(res.status, 200);
      assert.equal(res.body.success, true);
      // Phase 14: refresh session IS revoked server-side. The response
      // message is honest about the access-token expiry.
      assert.equal(res.body.data.revoked, true);
      assert.equal(res.body.data.revokedTarget, 'refresh_session');
      assert.equal(res.body.data.refreshSessionRevoked, true);
      // Same access token still works for /me (Plan A — JWTs are
      // stateless, so we cannot revoke the access token without
      // a denylist). The refresh path is closed.
      const me = await http('GET', '/api/auth/me', { token });
      assert.equal(me.status, 200);
    });

    it('returns 401 without a valid token', async () => {
      const res = await http('POST', '/api/auth/logout');
      assert.equal(res.status, 401);
    });
  });

  // ----- GET /api/auth/admin-check ----------------------------------------

  describe('GET /api/auth/admin-check (admin only)', () => {
    it('returns 200 for an admin user', async () => {
      const { user } = await createTestUser({ email: 'admin@example.com', role: 'admin' });
      const token = await issueTokenFor(user);
      const res = await http('GET', '/api/auth/admin-check', { token });
      assert.equal(res.status, 200);
      assert.equal(res.body.data.role, 'admin');
    });

    it('returns 403 for an employee user', async () => {
      const { user } = await createTestUser({ email: 'regular@example.com', role: 'employee' });
      const token = await issueTokenFor(user);
      const res = await http('GET', '/api/auth/admin-check', { token });
      assert.equal(res.status, 403);
      assert.equal(res.body.error.code, 'FORBIDDEN');
    });

    it('returns 401 without a token', async () => {
      const res = await http('GET', '/api/auth/admin-check');
      assert.equal(res.status, 401);
    });
  });
});