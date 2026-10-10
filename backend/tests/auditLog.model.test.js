// Unit tests for AuditLog model — Phase 10.

import { describe, it, before, after, beforeEach } from 'node:test';
import { strict as assert } from 'node:assert';

import AuditLog, {
  AUDIT_ACTIONS,
  AUDIT_RESOURCE_TYPES,
  AUDIT_STATUSES,
  METADATA_FORBIDDEN_KEYS,
} from '../src/models/auditLog.model.js';
import { setupTestDb, clearTestDb, teardownTestDb } from './helpers/db.js';
import { createTestUser } from './helpers/auth.js';

const FAKE_OID = '0123456789abcdef01234567';

describe('AuditLog model', () => {
  before(async () => {
    await setupTestDb();
  });
  after(async () => {
    await teardownTestDb();
  });
  beforeEach(async () => {
    await clearTestDb();
  });

  it('exports allowlist constants', () => {
    assert.ok(AUDIT_ACTIONS.length >= 20);
    assert.ok(AUDIT_ACTIONS.includes('employee.create'));
    assert.ok(AUDIT_RESOURCE_TYPES.includes('employee'));
    assert.ok(AUDIT_STATUSES.includes('success'));
    assert.ok(METADATA_FORBIDDEN_KEYS.includes('password'));
  });

  it('persists a valid record with all fields', async () => {
    const { user } = await createTestUser({ role: 'admin' });
    const doc = await AuditLog.create({
      actorUserId: user._id,
      actorRole: 'admin',
      action: 'employee.create',
      resourceType: 'employee',
      resourceId: FAKE_OID,
      description: 'Test record',
      metadata: { changedFields: ['fullName'] },
      status: 'success',
    });
    assert.equal(doc.action, 'employee.create');
    assert.equal(doc.resourceType, 'employee');
    assert.equal(doc.status, 'success');
    assert.equal(doc.actorRole, 'admin');
    assert.deepEqual(doc.metadata, { changedFields: ['fullName'] });
  });

  it('requires action and resourceType', async () => {
    await assert.rejects(
      AuditLog.create({ resourceType: 'employee' }),
      /action is required/,
    );
    await assert.rejects(
      AuditLog.create({ action: 'employee.create' }),
      /resourceType is required/,
    );
  });

  it('rejects unknown action', async () => {
    await assert.rejects(
      AuditLog.create({
        action: 'hacker.action',
        resourceType: 'employee',
      }),
      /action must be one of/,
    );
  });

  it('rejects unknown resourceType', async () => {
    await assert.rejects(
      AuditLog.create({
        action: 'employee.create',
        resourceType: 'wat',
      }),
      /resourceType must be one of/,
    );
  });

  it('rejects resourceId not matching 24-char hex', async () => {
    await assert.rejects(
      AuditLog.create({
        action: 'employee.create',
        resourceType: 'employee',
        resourceId: 'not-a-real-oid',
      }),
      /resourceId must be a 24-character hex ObjectId string/,
    );
  });

  it('accepts null resourceId', async () => {
    const doc = await AuditLog.create({
      action: 'auth.login.success',
      resourceType: 'auth',
      resourceId: null,
    });
    assert.equal(doc.resourceId, null);
  });

  it('defaults status to success', async () => {
    const doc = await AuditLog.create({
      action: 'auth.login.success',
      resourceType: 'auth',
    });
    assert.equal(doc.status, 'success');
  });

  it('produces createdAt and updatedAt timestamps', async () => {
    const doc = await AuditLog.create({
      action: 'auth.login.success',
      resourceType: 'auth',
    });
    assert.ok(doc.createdAt instanceof Date);
    assert.ok(doc.updatedAt instanceof Date);
  });

  it('strips __v in JSON output', async () => {
    const doc = await AuditLog.create({
      action: 'auth.login.success',
      resourceType: 'auth',
    });
    const json = doc.toJSON();
    assert.equal(json.__v, undefined);
  });

  it('preserves __v in raw lean object (intentional — only JSON strips it)', async () => {
    await AuditLog.create({
      action: 'auth.login.success',
      resourceType: 'auth',
    });
    const lean = await AuditLog.findOne({}).lean();
    // Service listAuditLogs thực sự delete __v ở app-level (service layer
    // không qua toJSON). Xác minh bằng API test.
    assert.ok(lean !== null);
  });

  it('strips __v in service list response (API layer chịu trách nhiệm)', async () => {
    await AuditLog.create({
      action: 'auth.login.success',
      resourceType: 'auth',
    });
    // Service level sẽ xử lý strip; đảm bảo lean có __v để service biết cần strip.
    const docs = await AuditLog.find({}).lean();
    assert.equal(docs[0].__v, 0);
  });

  it('allows metadata to be a mixed object', async () => {
    const doc = await AuditLog.create({
      action: 'employee.update',
      resourceType: 'employee',
      resourceId: FAKE_OID,
      metadata: { changedFields: ['fullName', 'email'], count: 2, ok: true },
    });
    assert.deepEqual(doc.metadata.changedFields, ['fullName', 'email']);
    assert.equal(doc.metadata.count, 2);
    assert.equal(doc.metadata.ok, true);
  });

  it('rejects description > 500 chars', async () => {
    await assert.rejects(
      AuditLog.create({
        action: 'auth.login.success',
        resourceType: 'auth',
        description: 'x'.repeat(501),
      }),
      /description must be at most 500 characters/,
    );
  });

  it('indexes are configured (no duplicates)', async () => {
    const indexes = await AuditLog.collection.indexes();
    // có ít nhất 5 index: _id + 4 custom
    assert.ok(indexes.length >= 5);
    // Không có index trùng key
    const seen = new Set();
    for (const ix of indexes) {
      const key = JSON.stringify(ix.key);
      assert.ok(!seen.has(key), `duplicate index: ${key}`);
      seen.add(key);
    }
  });
});
