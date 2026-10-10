// Tests for LeaveRequest model.

import { describe, it, before, after, beforeEach } from 'node:test';
import { strict as assert } from 'node:assert';

import { LeaveRequest, Employee } from '../src/models/index.js';
import { setupTestDb, clearTestDb, teardownTestDb } from './helpers/db.js';

function utcMidnight(year, month, day) {
  return new Date(Date.UTC(year, month - 1, day));
}

async function makeEmployee() {
  return Employee.create({
    employeeCode: `NV${Date.now()}${Math.floor(Math.random() * 1000)}`,
    fullName: 'Test Person',
    email: `e-${Date.now()}-${Math.random().toString(36).slice(2, 8)}@example.com`,
    employmentType: 'full_time',
    hireDate: new Date('2024-01-01'),
  });
}

function basePayload(overrides = {}) {
  return {
    leaveType: 'annual',
    startDate: utcMidnight(2026, 10, 1),
    endDate: utcMidnight(2026, 10, 3),
    reason: 'Family vacation',
    ...overrides,
  };
}

describe('LeaveRequest model', () => {
  before(async () => {
    await setupTestDb();
  });
  after(async () => {
    await teardownTestDb();
  });
  beforeEach(async () => {
    await clearTestDb();
  });

  it('imports without error', () => {
    assert.equal(LeaveRequest.modelName, 'LeaveRequest');
  });

  it('rejects missing required employeeId', async () => {
    const r = new LeaveRequest(basePayload());
    await assert.rejects(
      () => r.save(),
      (err) => err.name === 'ValidationError' && /employeeId/.test(err.message),
    );
  });

  it('rejects missing required leaveType', async () => {
    const e = await makeEmployee();
    const r = new LeaveRequest(basePayload({ employeeId: e._id, leaveType: undefined }));
    await assert.rejects(
      () => r.save(),
      (err) => err.name === 'ValidationError' && /leaveType/.test(err.message),
    );
  });

  it('rejects missing required startDate', async () => {
    const e = await makeEmployee();
    const r = new LeaveRequest(basePayload({ employeeId: e._id, startDate: undefined }));
    await assert.rejects(
      () => r.save(),
      (err) => err.name === 'ValidationError' && /startDate/.test(err.message),
    );
  });

  it('rejects missing required endDate', async () => {
    const e = await makeEmployee();
    const r = new LeaveRequest(basePayload({ employeeId: e._id, endDate: undefined }));
    await assert.rejects(
      () => r.save(),
      (err) => err.name === 'ValidationError' && /endDate/.test(err.message),
    );
  });

  it('rejects missing required reason', async () => {
    const e = await makeEmployee();
    const r = new LeaveRequest(basePayload({ employeeId: e._id, reason: undefined }));
    await assert.rejects(
      () => r.save(),
      (err) => err.name === 'ValidationError' && /reason/.test(err.message),
    );
  });

  it('rejects reason shorter than 3 chars', async () => {
    const e = await makeEmployee();
    const r = new LeaveRequest(basePayload({ employeeId: e._id, reason: 'ab' }));
    await assert.rejects(
      () => r.save(),
      (err) => err.name === 'ValidationError' && /reason/.test(err.message),
    );
  });

  it('rejects reason longer than 500 chars', async () => {
    const e = await makeEmployee();
    const r = new LeaveRequest(basePayload({
      employeeId: e._id,
      reason: 'x'.repeat(501),
    }));
    await assert.rejects(
      () => r.save(),
      (err) => err.name === 'ValidationError' && /reason/.test(err.message),
    );
  });

  it('rejects unknown leaveType enum', async () => {
    const e = await makeEmployee();
    const r = new LeaveRequest(basePayload({ employeeId: e._id, leaveType: 'maternity' }));
    await assert.rejects(
      () => r.save(),
      (err) => err.name === 'ValidationError' && /leaveType/.test(err.message),
    );
  });

  it('accepts all leaveType enum values', async () => {
    const e = await makeEmployee();
    const types = ['annual', 'sick', 'unpaid', 'other'];
    for (let i = 0; i < types.length; i++) {
      const r = await LeaveRequest.create({
        employeeId: e._id,
        leaveType: types[i],
        startDate: utcMidnight(2026, 10, i + 1),
        endDate: utcMidnight(2026, 10, i + 1),
        reason: 'reason ' + types[i],
      });
      assert.equal(r.leaveType, types[i]);
    }
  });

  it('rejects unknown status enum', async () => {
    const e = await makeEmployee();
    const r = new LeaveRequest(basePayload({ employeeId: e._id, status: 'pending_approval' }));
    await assert.rejects(
      () => r.save(),
      (err) => err.name === 'ValidationError' && /status/.test(err.message),
    );
  });

  it('defaults status to pending', async () => {
    const e = await makeEmployee();
    const r = await LeaveRequest.create({
      employeeId: e._id,
      leaveType: 'annual',
      startDate: utcMidnight(2026, 10, 1),
      endDate: utcMidnight(2026, 10, 3),
      reason: 'Vacation',
    });
    assert.equal(r.status, 'pending');
  });

  it('rejects endDate earlier than startDate', async () => {
    const e = await makeEmployee();
    const r = new LeaveRequest({
      employeeId: e._id,
      leaveType: 'annual',
      startDate: utcMidnight(2026, 10, 10),
      endDate: utcMidnight(2026, 10, 5),
      reason: 'vacation',
    });
    await assert.rejects(
      () => r.save(),
      (err) => err.name === 'ValidationError' && /endDate/.test(err.message),
    );
  });

  it('accepts endDate equal to startDate (single-day leave)', async () => {
    const e = await makeEmployee();
    const same = utcMidnight(2026, 10, 9);
    const r = await LeaveRequest.create({
      employeeId: e._id,
      leaveType: 'annual',
      startDate: same,
      endDate: same,
      reason: 'single day',
    });
    assert.ok(r);
  });

  it('trims whitespace from reason', async () => {
    const e = await makeEmployee();
    const r = await LeaveRequest.create({
      employeeId: e._id,
      leaveType: 'annual',
      startDate: utcMidnight(2026, 10, 1),
      endDate: utcMidnight(2026, 10, 3),
      reason: '   Family vacation   ',
    });
    assert.equal(r.reason, 'Family vacation');
  });

  it('rejects whitespace-only reason', async () => {
    const e = await makeEmployee();
    // Note: trim() runs after minlength, so '   ' is 3 chars before trim.
    // We test that the trimmed value would be < 3 chars.
    const r = new LeaveRequest({
      employeeId: e._id,
      leaveType: 'annual',
      startDate: utcMidnight(2026, 10, 1),
      endDate: utcMidnight(2026, 10, 3),
      reason: '   ',
    });
    // After trim, reason is empty string — Mongoose's required + minlength
    // should still reject.
    await assert.rejects(
      () => r.save(),
      (err) => err.name === 'ValidationError',
    );
  });

  it('populates timestamps', async () => {
    const e = await makeEmployee();
    const r = await LeaveRequest.create({
      employeeId: e._id,
      leaveType: 'annual',
      startDate: utcMidnight(2026, 10, 1),
      endDate: utcMidnight(2026, 10, 3),
      reason: 'vacation',
    });
    assert.ok(r.createdAt instanceof Date);
    assert.ok(r.updatedAt instanceof Date);
  });

  it('toJSON strips __v', async () => {
    const e = await makeEmployee();
    const r = await LeaveRequest.create({
      employeeId: e._id,
      leaveType: 'annual',
      startDate: utcMidnight(2026, 10, 1),
      endDate: utcMidnight(2026, 10, 3),
      reason: 'vacation',
    });
    const json = r.toJSON();
    assert.ok(!('__v' in json));
  });

  it('reviewedBy / reviewedAt / reviewNote default to null / empty', async () => {
    const e = await makeEmployee();
    const r = await LeaveRequest.create({
      employeeId: e._id,
      leaveType: 'annual',
      startDate: utcMidnight(2026, 10, 1),
      endDate: utcMidnight(2026, 10, 3),
      reason: 'vacation',
    });
    assert.equal(r.reviewedBy, null);
    assert.equal(r.reviewedAt, null);
    assert.equal(r.reviewNote, '');
  });

  it('allows creating multiple requests for the same employee on different ranges (no DB unique)', async () => {
    const e = await makeEmployee();
    const r1 = await LeaveRequest.create({
      employeeId: e._id,
      leaveType: 'annual',
      startDate: utcMidnight(2026, 10, 1),
      endDate: utcMidnight(2026, 10, 3),
      reason: 'vacation 1',
    });
    const r2 = await LeaveRequest.create({
      employeeId: e._id,
      leaveType: 'sick',
      startDate: utcMidnight(2026, 11, 1),
      endDate: utcMidnight(2026, 11, 2),
      reason: 'sick 2',
    });
    assert.ok(r1);
    assert.ok(r2);
  });
});
