// Tests for Attendance model.

import { describe, it, before, after, beforeEach } from 'node:test';
import { strict as assert } from 'node:assert';

import { Attendance, Employee } from '../src/models/index.js';
import { setupTestDb, clearTestDb, teardownTestDb } from './helpers/db.js';

function utcMidnight(year, month, day) {
  return new Date(Date.UTC(year, month - 1, day));
}

describe('Attendance model', () => {
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
    assert.equal(Attendance.modelName, 'Attendance');
  });

  it('rejects missing required employeeId', async () => {
    const a = new Attendance({
      workDate: utcMidnight(2026, 10, 9),
      status: 'present',
    });
    await assert.rejects(
      () => a.save(),
      (err) => err.name === 'ValidationError' && /employeeId/.test(err.message),
    );
  });

  it('rejects missing required workDate', async () => {
    const e = await Employee.create({
      employeeCode: 'NV0001',
      fullName: 'Alice',
      email: 'a@example.com',
      employmentType: 'full_time',
      hireDate: new Date('2024-01-01'),
    });
    const a = new Attendance({
      employeeId: e._id,
      status: 'present',
    });
    await assert.rejects(
      () => a.save(),
      (err) => err.name === 'ValidationError' && /workDate/.test(err.message),
    );
  });

  it('rejects missing required status', async () => {
    const e = await Employee.create({
      employeeCode: 'NV0001',
      fullName: 'Alice',
      email: 'a@example.com',
      employmentType: 'full_time',
      hireDate: new Date('2024-01-01'),
    });
    const a = new Attendance({
      employeeId: e._id,
      workDate: utcMidnight(2026, 10, 9),
    });
    await assert.rejects(
      () => a.save(),
      (err) => err.name === 'ValidationError' && /status/.test(err.message),
    );
  });

  it('rejects unknown status enum', async () => {
    const e = await Employee.create({
      employeeCode: 'NV0001',
      fullName: 'Alice',
      email: 'a@example.com',
      employmentType: 'full_time',
      hireDate: new Date('2024-01-01'),
    });
    const a = new Attendance({
      employeeId: e._id,
      workDate: utcMidnight(2026, 10, 9),
      status: 'unknown_status',
    });
    await assert.rejects(
      () => a.save(),
      (err) => err.name === 'ValidationError' && /status/.test(err.message),
    );
  });

  it('accepts all enum statuses', async () => {
    const e = await Employee.create({
      employeeCode: 'NV0001',
      fullName: 'Alice',
      email: 'a@example.com',
      employmentType: 'full_time',
      hireDate: new Date('2024-01-01'),
    });
    const statuses = ['present', 'late', 'absent', 'leave', 'half_day'];
    for (let i = 0; i < statuses.length; i++) {
      const a = await Attendance.create({
        employeeId: e._id,
        workDate: utcMidnight(2026, 10, i + 1),
        status: statuses[i],
      });
      assert.equal(a.status, statuses[i]);
    }
  });

  it('rejects checkOutAt earlier than checkInAt', async () => {
    const e = await Employee.create({
      employeeCode: 'NV0001',
      fullName: 'Alice',
      email: 'a@example.com',
      employmentType: 'full_time',
      hireDate: new Date('2024-01-01'),
    });
    const a = new Attendance({
      employeeId: e._id,
      workDate: utcMidnight(2026, 10, 9),
      checkInAt: new Date('2026-10-09T08:00:00.000Z'),
      checkOutAt: new Date('2026-10-09T07:00:00.000Z'),
      status: 'present',
    });
    await assert.rejects(
      () => a.save(),
      (err) => err.name === 'ValidationError' && /checkOutAt/.test(err.message),
    );
  });

  it('accepts checkOutAt equal to checkInAt', async () => {
    const e = await Employee.create({
      employeeCode: 'NV0001',
      fullName: 'Alice',
      email: 'a@example.com',
      employmentType: 'full_time',
      hireDate: new Date('2024-01-01'),
    });
    const same = new Date('2026-10-09T08:00:00.000Z');
    const a = await Attendance.create({
      employeeId: e._id,
      workDate: utcMidnight(2026, 10, 9),
      checkInAt: same,
      checkOutAt: same,
      status: 'present',
    });
    assert.ok(a);
  });

  it('accepts only checkInAt without checkOutAt', async () => {
    const e = await Employee.create({
      employeeCode: 'NV0001',
      fullName: 'Alice',
      email: 'a@example.com',
      employmentType: 'full_time',
      hireDate: new Date('2024-01-01'),
    });
    const a = await Attendance.create({
      employeeId: e._id,
      workDate: utcMidnight(2026, 10, 9),
      checkInAt: new Date('2026-10-09T08:00:00.000Z'),
      status: 'present',
    });
    assert.equal(a.checkOutAt, null);
  });

  it('enforces unique (employeeId, workDate)', async () => {
    const e = await Employee.create({
      employeeCode: 'NV0001',
      fullName: 'Alice',
      email: 'a@example.com',
      employmentType: 'full_time',
      hireDate: new Date('2024-01-01'),
    });
    const day = utcMidnight(2026, 10, 9);
    await Attendance.create({
      employeeId: e._id,
      workDate: day,
      status: 'present',
    });
    await assert.rejects(
      () =>
        Attendance.create({
          employeeId: e._id,
          workDate: day,
          status: 'late',
        }),
      (err) => err.code === 11000,
    );
  });

  it('allows same employee on different days', async () => {
    const e = await Employee.create({
      employeeCode: 'NV0001',
      fullName: 'Alice',
      email: 'a@example.com',
      employmentType: 'full_time',
      hireDate: new Date('2024-01-01'),
    });
    await Attendance.create({
      employeeId: e._id,
      workDate: utcMidnight(2026, 10, 9),
      status: 'present',
    });
    const a2 = await Attendance.create({
      employeeId: e._id,
      workDate: utcMidnight(2026, 10, 10),
      status: 'late',
    });
    assert.ok(a2);
  });

  it('allows same day for different employees', async () => {
    const e1 = await Employee.create({
      employeeCode: 'NV0001',
      fullName: 'Alice',
      email: 'a@example.com',
      employmentType: 'full_time',
      hireDate: new Date('2024-01-01'),
    });
    const e2 = await Employee.create({
      employeeCode: 'NV0002',
      fullName: 'Bob',
      email: 'b@example.com',
      employmentType: 'full_time',
      hireDate: new Date('2024-01-01'),
    });
    const day = utcMidnight(2026, 10, 9);
    await Attendance.create({
      employeeId: e1._id,
      workDate: day,
      status: 'present',
    });
    const a2 = await Attendance.create({
      employeeId: e2._id,
      workDate: day,
      status: 'absent',
    });
    assert.ok(a2);
  });

  it('note defaults to empty string and trims whitespace', async () => {
    const e = await Employee.create({
      employeeCode: 'NV0001',
      fullName: 'Alice',
      email: 'a@example.com',
      employmentType: 'full_time',
      hireDate: new Date('2024-01-01'),
    });
    const a = await Attendance.create({
      employeeId: e._id,
      workDate: utcMidnight(2026, 10, 9),
      status: 'present',
      note: '   late due to traffic   ',
    });
    assert.equal(a.note, 'late due to traffic');
  });

  it('rejects note longer than 500 chars', async () => {
    const e = await Employee.create({
      employeeCode: 'NV0001',
      fullName: 'Alice',
      email: 'a@example.com',
      employmentType: 'full_time',
      hireDate: new Date('2024-01-01'),
    });
    const a = new Attendance({
      employeeId: e._id,
      workDate: utcMidnight(2026, 10, 9),
      status: 'present',
      note: 'x'.repeat(501),
    });
    await assert.rejects(
      () => a.save(),
      (err) => err.name === 'ValidationError' && /note/.test(err.message),
    );
  });

  it('populates timestamps', async () => {
    const e = await Employee.create({
      employeeCode: 'NV0001',
      fullName: 'Alice',
      email: 'a@example.com',
      employmentType: 'full_time',
      hireDate: new Date('2024-01-01'),
    });
    const a = await Attendance.create({
      employeeId: e._id,
      workDate: utcMidnight(2026, 10, 9),
      status: 'present',
    });
    assert.ok(a.createdAt instanceof Date);
    assert.ok(a.updatedAt instanceof Date);
  });

  it('toJSON strips __v', async () => {
    const e = await Employee.create({
      employeeCode: 'NV0001',
      fullName: 'Alice',
      email: 'a@example.com',
      employmentType: 'full_time',
      hireDate: new Date('2024-01-01'),
    });
    const a = await Attendance.create({
      employeeId: e._id,
      workDate: utcMidnight(2026, 10, 9),
      status: 'present',
    });
    const json = a.toJSON();
    assert.ok(!('__v' in json));
  });
});
