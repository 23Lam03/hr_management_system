// Model tests cho Notification — Phase 11.

import { describe, it, before, after, beforeEach } from 'node:test';
import { strict as assert } from 'node:assert';

import Notification, {
  NOTIFICATION_TYPES,
  NOTIFICATION_RESOURCE_TYPES,
} from '../src/models/notification.model.js';
import { setupTestDb, clearTestDb, teardownTestDb } from './helpers/db.js';

const FAKE_OID = '0123456789abcdef01234567';
const FAKE_OID_2 = 'abcdef0123456789abcdef01';

async function makeUser(_id) {
  return Notification.create({
    recipientUserId: _id || FAKE_OID,
    type: 'leave_request_created',
    title: 'Test',
    message: 'Hello',
  });
}

describe('Notification model', () => {
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
    assert.ok(NOTIFICATION_TYPES.length >= 7);
    assert.ok(NOTIFICATION_TYPES.includes('leave_request_approved'));
    assert.ok(NOTIFICATION_RESOURCE_TYPES.includes('leave_request'));
    assert.ok(NOTIFICATION_RESOURCE_TYPES.includes('payroll'));
  });

  it('persists a valid record with all fields', async () => {
    const doc = await Notification.create({
      recipientUserId: FAKE_OID,
      type: 'leave_request_approved',
      title: 'Leave approved',
      message: 'Your leave has been approved.',
      resourceType: 'leave_request',
      resourceId: FAKE_OID_2,
    });
    assert.equal(doc.isRead, false);
    assert.equal(doc.readAt, null);
    // Mongoose cast 24-hex thành ObjectId, so we compare toString.
    assert.equal(doc.recipientUserId.toString(), FAKE_OID);
  });

  it('requires recipientUserId, type, title, message', async () => {
    await assert.rejects(
      Notification.create({
        type: 'leave_request_created',
        title: 't',
        message: 'm',
      }),
      /recipientUserId is required/,
    );
    await assert.rejects(
      Notification.create({
        recipientUserId: FAKE_OID,
        title: 't',
        message: 'm',
      }),
      /type is required/,
    );
    await assert.rejects(
      Notification.create({
        recipientUserId: FAKE_OID,
        type: 'leave_request_created',
        message: 'm',
      }),
      /title is required/,
    );
    await assert.rejects(
      Notification.create({
        recipientUserId: FAKE_OID,
        type: 'leave_request_created',
        title: 't',
      }),
      /message is required/,
    );
  });

  it('rejects unknown type', async () => {
    await assert.rejects(
      Notification.create({
        recipientUserId: FAKE_OID,
        type: 'hacker.type',
        title: 't',
        message: 'm',
      }),
      /type must be one of/,
    );
  });

  it('rejects unknown resourceType', async () => {
    await assert.rejects(
      Notification.create({
        recipientUserId: FAKE_OID,
        type: 'leave_request_created',
        title: 't',
        message: 'm',
        resourceType: 'secret',
      }),
      /resourceType must be one of/,
    );
  });

  it('defaults isRead to false and readAt to null', async () => {
    const doc = await Notification.create({
      recipientUserId: FAKE_OID,
      type: 'leave_request_created',
      title: 't',
      message: 'm',
    });
    assert.equal(doc.isRead, false);
    assert.equal(doc.readAt, null);
  });

  it('produces createdAt and updatedAt', async () => {
    const doc = await makeUser();
    assert.ok(doc.createdAt instanceof Date);
    assert.ok(doc.updatedAt instanceof Date);
  });

  it('strips __v in JSON', async () => {
    const doc = await makeUser();
    const json = doc.toJSON();
    assert.equal(json.__v, undefined);
  });

  it('rejects title > 120 chars', async () => {
    await assert.rejects(
      Notification.create({
        recipientUserId: FAKE_OID,
        type: 'leave_request_created',
        title: 'x'.repeat(121),
        message: 'm',
      }),
      /title must be at most 120 characters/,
    );
  });

  it('rejects message > 500 chars', async () => {
    await assert.rejects(
      Notification.create({
        recipientUserId: FAKE_OID,
        type: 'leave_request_created',
        title: 't',
        message: 'x'.repeat(501),
      }),
      /message must be at most 500 characters/,
    );
  });

  it('indexes are configured (no duplicates)', async () => {
    const indexes = await Notification.collection.indexes();
    assert.ok(indexes.length >= 3);
    const seen = new Set();
    for (const ix of indexes) {
      const key = JSON.stringify(ix.key);
      assert.ok(!seen.has(key), `duplicate index: ${key}`);
      seen.add(key);
    }
  });

  it('system fields cannot be set arbitrarily via DB? (covered by service-level filter)', async () => {
    // Service thực sự filter recipientUserId. Model cho phép set
    // (vì Mongoose không thể enforce business ownership). Đây là test
    // xác minh schema cho phép các field này tồn tại.
    const doc = await Notification.create({
      recipientUserId: FAKE_OID,
      type: 'leave_request_created',
      title: 't',
      message: 'm',
      isRead: true,
      readAt: new Date('2026-01-01'),
    });
    // Set trực tiếp qua Mongoose vẫn được, nhưng service/validator
    // sẽ ngăn client. Đây là kỳ vọng hợp lý cho model.
    assert.equal(doc.isRead, true);
    assert.ok(doc.readAt instanceof Date);
  });
});
