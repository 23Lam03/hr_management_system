// Auth service unit tests (no HTTP layer).
// Covers JWT signing, verifying, and the credential check.

import { describe, it, before, after, beforeEach } from 'node:test';
import { strict as assert } from 'node:assert';
import jwt from 'jsonwebtoken';

import { User, Employee } from '../src/models/index.js';
import {
  authenticateWithPassword,
  signAuthToken,
  verifyAuthToken,
  loadActiveUserById,
  buildCurrentUserResponse,
  buildLogoutNotice,
} from '../src/services/auth.service.js';
import { config } from '../src/config/env.js';
import { setupTestDb, clearTestDb, teardownTestDb } from './helpers/db.js';
import { createTestUser, TEST_PASSWORD } from './helpers/auth.js';

describe('Auth service', () => {
  before(async () => {
    await setupTestDb();
  });
  after(async () => {
    await teardownTestDb();
  });
  beforeEach(async () => {
    await clearTestDb();
  });

  describe('authenticateWithPassword', () => {
    it('returns user on correct credentials', async () => {
      const { user, password } = await createTestUser({
        email: 'alice@example.com',
      });
      const result = await authenticateWithPassword('alice@example.com', password);
      assert.equal(result.error, undefined);
      assert.equal(result.user._id.toString(), user._id.toString());
    });

    it('normalizes email (case + whitespace)', async () => {
      await createTestUser({ email: 'bob@example.com' });
      const result = await authenticateWithPassword(
        '  BOB@Example.COM  ',
        TEST_PASSWORD,
      );
      assert.equal(result.error, undefined);
    });

    it('returns INVALID_CREDENTIALS for unknown email', async () => {
      const result = await authenticateWithPassword('ghost@example.com', 'whatever');
      assert.equal(result.error.code, 'INVALID_CREDENTIALS');
    });

    it('returns INVALID_CREDENTIALS for wrong password', async () => {
      await createTestUser({ email: 'carol@example.com' });
      const result = await authenticateWithPassword('carol@example.com', 'wrong-password');
      assert.equal(result.error.code, 'INVALID_CREDENTIALS');
    });

    it('returns INVALID_CREDENTIALS for inactive account (no enumeration)', async () => {
      await createTestUser({ email: 'dan@example.com', status: 'inactive' });
      const result = await authenticateWithPassword('dan@example.com', TEST_PASSWORD);
      assert.equal(result.code, undefined); // not present
      assert.equal(result.error.code, 'INVALID_CREDENTIALS');
    });

    it('returns INVALID_CREDENTIALS for locked account (no enumeration)', async () => {
      await createTestUser({ email: 'eve@example.com', status: 'locked' });
      const result = await authenticateWithPassword('eve@example.com', TEST_PASSWORD);
      assert.equal(result.error.code, 'INVALID_CREDENTIALS');
    });

    it('uses the same code and message for missing/wrong/inactive', async () => {
      const a = await authenticateWithPassword('never@example.com', 'x');
      await createTestUser({ email: 'exists@example.com' });
      const b = await authenticateWithPassword('exists@example.com', 'wrong');
      await createTestUser({ email: 'off@example.com', status: 'inactive' });
      const c = await authenticateWithPassword('off@example.com', TEST_PASSWORD);
      assert.equal(a.error.code, b.error.code);
      assert.equal(b.error.code, c.error.code);
      assert.equal(a.error.message, b.error.message);
      assert.equal(b.error.message, c.error.message);
    });
  });

  describe('signAuthToken + verifyAuthToken', () => {
    it('signs a token with sub + role + jti claims', async () => {
      const { user } = await createTestUser({ email: 'token@example.com', role: 'admin' });
      // Phase 14: a real session id is required so logout can locate
      // the session. Tests can use the issueFullSessionFor helper.
      const { issueFullSessionFor } = await import('./helpers/auth.js');
      const { sessionId } = await issueFullSessionFor(user);
      const token = signAuthToken(user, sessionId);
      assert.ok(typeof token === 'string' && token.split('.').length === 3);
      const { payload, error } = verifyAuthToken(token);
      assert.equal(error, undefined);
      assert.equal(payload.sub, user._id.toString());
      assert.equal(payload.role, 'admin');
      assert.equal(payload.jti, String(sessionId));
      assert.ok(payload.exp, 'token must carry an exp claim');
    });

    it('rejects a token with an invalid signature', async () => {
      const { user } = await createTestUser({ email: 'sig@example.com' });
      const { issueFullSessionFor } = await import('./helpers/auth.js');
      const { sessionId } = await issueFullSessionFor(user);
      const token = signAuthToken(user, sessionId);
      const parts = token.split('.');
      const tampered = `${parts[0]}.${parts[1]}.WRONGSIGNATURE`;
      const { error } = verifyAuthToken(tampered);
      assert.equal(error.code, 'TOKEN_INVALID');
    });

    it('rejects a malformed token', () => {
      const { error } = verifyAuthToken('not-a-jwt');
      assert.equal(error.code, 'TOKEN_INVALID');
    });

    it('rejects an expired token', async () => {
      const { user } = await createTestUser({ email: 'exp@example.com' });
      // Sign a token that already expired 5s ago.
      const expired = jwt.sign(
        { sub: user._id.toString(), role: user.role },
        config.jwtSecret,
        { expiresIn: -5 },
      );
      const { error } = verifyAuthToken(expired);
      assert.equal(error.code, 'TOKEN_EXPIRED');
    });

    it('does not include email or fullName in the token payload', async () => {
      const { user } = await createTestUser({
        email: 'private@example.com',
        fullName: 'Should Not Appear',
      });
      const { issueFullSessionFor } = await import('./helpers/auth.js');
      const { sessionId } = await issueFullSessionFor(user);
      const token = signAuthToken(user, sessionId);
      const payloadB64 = token.split('.')[1];
      const json = Buffer.from(payloadB64, 'base64url').toString('utf8');
      assert.ok(!json.includes('private@example.com'));
      assert.ok(!json.includes('Should Not Appear'));
    });
  });

  describe('loadActiveUserById', () => {
    it('returns the user when active', async () => {
      const { user } = await createTestUser({ email: 'load@example.com' });
      const { user: loaded, error } = await loadActiveUserById(user._id);
      assert.equal(error, undefined);
      assert.equal(loaded._id.toString(), user._id.toString());
    });

    it('returns USER_NOT_FOUND when the user is deleted', async () => {
      const { user } = await createTestUser({ email: 'gone@example.com' });
      await User.deleteOne({ _id: user._id });
      const { error } = await loadActiveUserById(user._id);
      assert.equal(error.code, 'USER_NOT_FOUND');
      assert.equal(error.status, 401);
    });

    it('returns USER_INACTIVE when the user is locked', async () => {
      const { user } = await createTestUser({
        email: 'lock@example.com',
        status: 'locked',
      });
      const { error } = await loadActiveUserById(user._id);
      assert.equal(error.code, 'USER_INACTIVE');
      assert.equal(error.status, 401);
    });
  });

  describe('buildCurrentUserResponse', () => {
    it('strips passwordHash even if user was selected with +passwordHash', async () => {
      const { user } = await createTestUser({ email: 'strip@example.com' });
      const reloaded = await User.findById(user._id).select('+passwordHash');
      const data = await buildCurrentUserResponse(reloaded);
      assert.ok(!('passwordHash' in data.user));
      assert.equal(data.employee, null);
    });

    it('returns linked employee when present', async () => {
      const { user } = await createTestUser({
        email: 'linked@example.com',
        role: 'admin',
      });
      const employee = await Employee.create({
        employeeCode: 'NV-EMP',
        userId: user._id,
        fullName: 'Linked Person',
        email: 'linked-emp@example.com',
        employmentType: 'full_time',
        hireDate: new Date('2024-01-01'),
      });
      const reloaded = await User.findById(user._id).select('+passwordHash');
      const data = await buildCurrentUserResponse(reloaded);
      assert.ok(!('passwordHash' in data.user));
      assert.ok(data.employee);
      assert.equal(data.employee._id.toString(), employee._id.toString());
      assert.equal(data.employee.userId.toString(), user._id.toString());
    });
  });

  describe('buildLogoutNotice', () => {
    it('reports that the refresh session IS revoked (Plan A)', () => {
      const notice = buildLogoutNotice();
      assert.equal(notice.revoked, true);
      assert.equal(notice.revokedTarget, 'refresh_session');
      assert.ok(/discard/i.test(notice.message));
      // The TTL is now the access-token TTL (Plan A — access tokens
      // remain valid until exp).
      assert.ok(notice.accessTokenTtl);
    });
  });
});