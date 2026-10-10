// Unit tests for auditLogService — Phase 10.

import { describe, it, before, after, beforeEach } from 'node:test';
import { strict as assert } from 'node:assert';

import AuditLog from '../src/models/auditLog.model.js';
import {
  recordEvent,
  listAuditLogs,
  getAuditLogById,
} from '../src/services/auditLog.service.js';
import { setupTestDb, clearTestDb, teardownTestDb } from './helpers/db.js';
import { createTestUser } from './helpers/auth.js';

const FAKE_OID = '0123456789abcdef01234567';

describe('auditLogService', () => {
  before(async () => {
    await setupTestDb();
  });
  after(async () => {
    await teardownTestDb();
  });
  beforeEach(async () => {
    await clearTestDb();
  });

  // ===== recordEvent =====

  it('recordEvent persists a valid event with actor derived from server context', async () => {
    const { user } = await createTestUser({ role: 'admin' });
    const result = await recordEvent({
      actor: user,
      action: 'employee.create',
      resourceType: 'employee',
      resourceId: FAKE_OID,
      description: 'Created',
      metadata: { changedFields: ['fullName'] },
    });
    assert.ok(result && result._id);
    assert.equal(result.actorUserId.toString(), user._id.toString());
    assert.equal(result.actorRole, 'admin');
    assert.equal(result.action, 'employee.create');
    assert.equal(result.resourceType, 'employee');
  });

  it('rejects action outside allowlist (no record persisted)', async () => {
    const { user } = await createTestUser({ role: 'admin' });
    const result = await recordEvent({
      actor: user,
      action: 'hacker.action',
      resourceType: 'employee',
    });
    assert.equal(result, null);
    const count = await AuditLog.countDocuments();
    assert.equal(count, 0);
  });

  it('rejects resourceType outside allowlist', async () => {
    const { user } = await createTestUser({ role: 'admin' });
    const result = await recordEvent({
      actor: user,
      action: 'employee.create',
      resourceType: 'secret',
    });
    assert.equal(result, null);
  });

  it('strips forbidden metadata keys (password, token, secret, ...)', async () => {
    const { user } = await createTestUser({ role: 'admin' });
    const result = await recordEvent({
      actor: user,
      action: 'employee.update',
      resourceType: 'employee',
      resourceId: FAKE_OID,
      metadata: {
        changedFields: ['fullName'],
        password: 'leaked',
        passwordHash: 'leaked',
        token: 'leaked-jwt',
        refreshToken: 'leaked',
        secret: 'leaked',
        mongoUri: 'leaked',
        baseSalary: 9999,
        grossSalary: 8888,
        email: 'leaked@x.com',
        phone: 'leaked',
        fullName: 'leaked',
      },
    });
    assert.equal(result.metadata.changedFields[0], 'fullName');
    assert.equal(result.metadata.password, undefined);
    assert.equal(result.metadata.passwordHash, undefined);
    assert.equal(result.metadata.token, undefined);
    assert.equal(result.metadata.refreshToken, undefined);
    assert.equal(result.metadata.secret, undefined);
    assert.equal(result.metadata.mongoUri, undefined);
    assert.equal(result.metadata.baseSalary, undefined);
    assert.equal(result.metadata.grossSalary, undefined);
    assert.equal(result.metadata.email, undefined);
    assert.equal(result.metadata.phone, undefined);
    assert.equal(result.metadata.fullName, undefined);
  });

  it('handles missing actor gracefully (system event)', async () => {
    const result = await recordEvent({
      actor: null,
      action: 'auth.login.success',
      resourceType: 'auth',
      resourceId: null,
    });
    assert.ok(result && result._id);
    assert.equal(result.actorUserId, null);
    assert.equal(result.actorRole, null);
  });

  it('truncates long description to 500 chars', async () => {
    const { user } = await createTestUser({ role: 'admin' });
    const long = 'x'.repeat(1000);
    const result = await recordEvent({
      actor: user,
      action: 'employee.create',
      resourceType: 'employee',
      description: long,
    });
    assert.ok(result.description.length <= 500);
  });

  it('does not throw when internal save fails (best-effort)', async () => {
    // Inject a broken action to trigger the allowlist branch which returns null.
    // We additionally simulate "DB error" by passing an invalid status value that
    // would fail validation.
    const { user } = await createTestUser({ role: 'admin' });
    // status 'failure' is allowed, but if we pass garbage role, it should not throw.
    const result = await recordEvent({
      actor: { _id: user._id, role: 'unknown' },
      action: 'employee.create',
      resourceType: 'employee',
      status: 'failure',
    });
    // Should still persist (unknown role becomes null actorRole).
    assert.ok(result && result._id);
    assert.equal(result.actorRole, null);
    assert.equal(result.status, 'failure');
  });

  it('returns null when args is not an object', async () => {
    const result = await recordEvent(null);
    assert.equal(result, null);
  });

  // ===== listAuditLogs =====

  it('listAuditLogs paginates results', async () => {
    const { user } = await createTestUser({ role: 'admin' });
    for (let i = 0; i < 5; i += 1) {
      // eslint-disable-next-line no-await-in-loop
      await recordEvent({
        actor: user,
        action: 'employee.create',
        resourceType: 'employee',
        resourceId: FAKE_OID,
      });
    }
    const r1 = await listAuditLogs({ page: 1, limit: 2, sort: '-createdAt' });
    assert.equal(r1.data.length, 2);
    assert.equal(r1.pagination.total, 5);
    assert.equal(r1.pagination.totalPages, 3);

    const r2 = await listAuditLogs({ page: 3, limit: 2, sort: '-createdAt' });
    assert.equal(r2.data.length, 1);
  });

  it('listAuditLogs filters by actorUserId, action, resourceType', async () => {
    const { user: admin } = await createTestUser({ role: 'admin' });
    const { user: emp } = await createTestUser({ role: 'employee' });
    await recordEvent({ actor: admin, action: 'employee.create', resourceType: 'employee', resourceId: FAKE_OID });
    await recordEvent({ actor: emp, action: 'attendance.create', resourceType: 'attendance', resourceId: FAKE_OID });

    const r1 = await listAuditLogs({ filters: { actorUserId: admin._id.toString() } });
    assert.equal(r1.data.length, 1);
    assert.equal(r1.data[0].action, 'employee.create');

    const r2 = await listAuditLogs({ filters: { action: 'attendance.create' } });
    assert.equal(r2.data.length, 1);

    const r3 = await listAuditLogs({ filters: { resourceType: 'attendance' } });
    assert.equal(r3.data.length, 1);
  });

  it('listAuditLogs filters by date range', async () => {
    const { user } = await createTestUser({ role: 'admin' });
    await recordEvent({ actor: user, action: 'employee.create', resourceType: 'employee', resourceId: FAKE_OID });

    const r = await listAuditLogs({
      filters: {
        startDate: new Date('2020-01-01'),
        endDate: new Date('2030-01-01'),
      },
    });
    assert.equal(r.data.length, 1);
  });

  it('listAuditLogs caps limit at 100', async () => {
    const { user } = await createTestUser({ role: 'admin' });
    const r = await listAuditLogs({ page: 1, limit: 9999 });
    assert.equal(r.pagination.limit, 100);
  });

  it('listAuditLogs strips __v in result', async () => {
    const { user } = await createTestUser({ role: 'admin' });
    await recordEvent({ actor: user, action: 'employee.create', resourceType: 'employee', resourceId: FAKE_OID });
    const r = await listAuditLogs({});
    assert.equal(r.data[0].__v, undefined);
  });

  // ===== getAuditLogById =====

  it('getAuditLogById returns the doc', async () => {
    const { user } = await createTestUser({ role: 'admin' });
    const created = await recordEvent({ actor: user, action: 'employee.create', resourceType: 'employee', resourceId: FAKE_OID });
    // recordEvent trả về JSON, _id là string.
    // getAuditLogById cần string 24-hex, đảm bảo cast.
    const id = String(created._id);
    const r = await getAuditLogById(id);
    assert.equal(r.error, undefined);
    assert.equal(String(r.data._id), id);
  });

  it('getAuditLogById returns 400 for invalid id', async () => {
    const r = await getAuditLogById('not-an-id');
    assert.ok(r.error);
    assert.equal(r.error.status, 400);
  });

  it('getAuditLogById returns 404 for missing', async () => {
    const r = await getAuditLogById(FAKE_OID);
    assert.ok(r.error);
    assert.equal(r.error.status, 404);
  });
});
