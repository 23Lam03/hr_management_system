// Tests for Payroll model.

import { describe, it, before, after, beforeEach } from 'node:test';
import { strict as assert } from 'node:assert';

import { Payroll, Employee } from '../src/models/index.js';
import { setupTestDb, clearTestDb, teardownTestDb } from './helpers/db.js';

async function makeEmployee(overrides = {}) {
  return Employee.create({
    employeeCode: `NV${Date.now()}${Math.floor(Math.random() * 1000)}`,
    fullName: 'Test Person',
    email: `e-${Date.now()}-${Math.random().toString(36).slice(2, 8)}@example.com`,
    employmentType: 'full_time',
    hireDate: new Date('2024-01-01'),
    ...overrides,
  });
}

function basePayload(overrides = {}) {
  return {
    employeeId: undefined, // sẽ gán trong test
    periodMonth: 10,
    periodYear: 2026,
    baseSalary: 10_000_000,
    allowances: 1_000_000,
    bonuses: 500_000,
    deductions: 200_000,
    grossSalary: 11_500_000,
    netSalary: 11_300_000,
    ...overrides,
  };
}

describe('Payroll model', () => {
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
    assert.equal(Payroll.modelName, 'Payroll');
  });

  it('rejects missing employeeId', async () => {
    const r = new Payroll(basePayload());
    await assert.rejects(
      () => r.save(),
      (err) => err.name === 'ValidationError' && /employeeId/.test(err.message),
    );
  });

  it('rejects missing periodMonth', async () => {
    const e = await makeEmployee();
    const r = new Payroll(basePayload({ employeeId: e._id, periodMonth: undefined }));
    await assert.rejects(
      () => r.save(),
      (err) => err.name === 'ValidationError' && /periodMonth/.test(err.message),
    );
  });

  it('rejects missing periodYear', async () => {
    const e = await makeEmployee();
    const r = new Payroll(basePayload({ employeeId: e._id, periodYear: undefined }));
    await assert.rejects(
      () => r.save(),
      (err) => err.name === 'ValidationError' && /periodYear/.test(err.message),
    );
  });

  it('rejects missing baseSalary', async () => {
    const e = await makeEmployee();
    const r = new Payroll(basePayload({ employeeId: e._id, baseSalary: undefined }));
    await assert.rejects(
      () => r.save(),
      (err) => err.name === 'ValidationError' && /baseSalary/.test(err.message),
    );
  });

  it('rejects periodMonth outside 1-12', async () => {
    const e = await makeEmployee();
    const r1 = new Payroll(basePayload({ employeeId: e._id, periodMonth: 0 }));
    await assert.rejects(() => r1.save(), (err) => err.name === 'ValidationError');
    const r2 = new Payroll(basePayload({ employeeId: e._id, periodMonth: 13 }));
    await assert.rejects(() => r2.save(), (err) => err.name === 'ValidationError');
  });

  it('rejects periodYear outside 2000-2100', async () => {
    const e = await makeEmployee();
    const r1 = new Payroll(basePayload({ employeeId: e._id, periodYear: 1999 }));
    await assert.rejects(() => r1.save(), (err) => err.name === 'ValidationError');
    const r2 = new Payroll(basePayload({ employeeId: e._id, periodYear: 2101 }));
    await assert.rejects(() => r2.save(), (err) => err.name === 'ValidationError');
  });

  it('rejects negative baseSalary / allowances / bonuses / deductions', async () => {
    const e = await makeEmployee();
    for (const field of ['baseSalary', 'allowances', 'bonuses', 'deductions']) {
      const r = new Payroll(basePayload({ employeeId: e._id, [field]: -1 }));
      await assert.rejects(
        () => r.save(),
        (err) => err.name === 'ValidationError' && new RegExp(field).test(err.message),
      );
    }
  });

  it('rejects NaN / Infinity on money fields', async () => {
    const e = await makeEmployee();
    const r1 = new Payroll(basePayload({ employeeId: e._id, baseSalary: NaN }));
    await assert.rejects(() => r1.save(), (err) => err.name === 'ValidationError');
    const r2 = new Payroll(basePayload({ employeeId: e._id, baseSalary: Infinity }));
    await assert.rejects(() => r2.save(), (err) => err.name === 'ValidationError');
  });

  it('rejects non-integer workedDays / standardWorkDays', async () => {
    const e = await makeEmployee();
    const r1 = new Payroll(basePayload({ employeeId: e._id, workedDays: 22.5 }));
    await assert.rejects(() => r1.save(), (err) => err.name === 'ValidationError');
    const r2 = new Payroll(basePayload({ employeeId: e._id, standardWorkDays: 30.1 }));
    await assert.rejects(() => r2.save(), (err) => err.name === 'ValidationError');
  });

  it('rejects workedDays / standardWorkDays > 31', async () => {
    const e = await makeEmployee();
    const r = new Payroll(basePayload({ employeeId: e._id, workedDays: 32 }));
    await assert.rejects(() => r.save(), (err) => err.name === 'ValidationError');
  });

  it('accepts null workedDays / standardWorkDays', async () => {
    const e = await makeEmployee();
    const r = await Payroll.create({
      employeeId: e._id,
      periodMonth: 10,
      periodYear: 2026,
      baseSalary: 10_000_000,
      grossSalary: 10_000_000,
      netSalary: 10_000_000,
      workedDays: null,
      standardWorkDays: null,
    });
    assert.equal(r.workedDays, null);
    assert.equal(r.standardWorkDays, null);
  });

  it('rejects unknown status enum', async () => {
    const e = await makeEmployee();
    const r = new Payroll(basePayload({ employeeId: e._id, status: 'weird' }));
    await assert.rejects(
      () => r.save(),
      (err) => err.name === 'ValidationError' && /status/.test(err.message),
    );
  });

  it('defaults status to draft', async () => {
    const e = await makeEmployee();
    const r = await Payroll.create({
      employeeId: e._id,
      periodMonth: 10,
      periodYear: 2026,
      baseSalary: 10_000_000,
      grossSalary: 10_000_000,
      netSalary: 10_000_000,
    });
    assert.equal(r.status, 'draft');
  });

  it('accepts all status enum values', async () => {
    const e = await makeEmployee();
    const statuses = ['draft', 'approved', 'paid', 'cancelled'];
    for (let i = 0; i < statuses.length; i++) {
      const r = await Payroll.create({
        employeeId: e._id,
        periodMonth: (i % 12) + 1, // tránh trùng kỳ vì cùng employee
        periodYear: 2026,
        baseSalary: 10_000_000,
        grossSalary: 10_000_000,
        netSalary: 10_000_000,
        status: statuses[i],
      });
      assert.equal(r.status, statuses[i]);
    }
  });

  it('trims whitespace from note', async () => {
    const e = await makeEmployee();
    const r = await Payroll.create({
      employeeId: e._id,
      periodMonth: 10,
      periodYear: 2026,
      baseSalary: 10_000_000,
      grossSalary: 10_000_000,
      netSalary: 10_000_000,
      note: '  Some note  ',
    });
    assert.equal(r.note, 'Some note');
  });

  it('populates timestamps', async () => {
    const e = await makeEmployee();
    const r = await Payroll.create({
      employeeId: e._id,
      periodMonth: 10,
      periodYear: 2026,
      baseSalary: 10_000_000,
      grossSalary: 10_000_000,
      netSalary: 10_000_000,
    });
    assert.ok(r.createdAt instanceof Date);
    assert.ok(r.updatedAt instanceof Date);
  });

  it('toJSON strips __v', async () => {
    const e = await makeEmployee();
    const r = await Payroll.create({
      employeeId: e._id,
      periodMonth: 10,
      periodYear: 2026,
      baseSalary: 10_000_000,
      grossSalary: 10_000_000,
      netSalary: 10_000_000,
    });
    const json = r.toJSON();
    assert.ok(!('__v' in json));
  });

  it('approvedBy / approvedAt / paidBy / paidAt default to null', async () => {
    const e = await makeEmployee();
    const r = await Payroll.create({
      employeeId: e._id,
      periodMonth: 10,
      periodYear: 2026,
      baseSalary: 10_000_000,
      grossSalary: 10_000_000,
      netSalary: 10_000_000,
    });
    assert.equal(r.approvedBy, null);
    assert.equal(r.approvedAt, null);
    assert.equal(r.paidBy, null);
    assert.equal(r.paidAt, null);
    assert.equal(r.createdBy, null);
    assert.equal(r.updatedBy, null);
  });

  it('enforces unique (employeeId, periodMonth, periodYear) — duplicate throws E11000', async () => {
    const e = await makeEmployee();
    await Payroll.create({
      employeeId: e._id,
      periodMonth: 10,
      periodYear: 2026,
      baseSalary: 10_000_000,
      grossSalary: 10_000_000,
      netSalary: 10_000_000,
    });
    await assert.rejects(
      () =>
        Payroll.create({
          employeeId: e._id,
          periodMonth: 10,
          periodYear: 2026,
          baseSalary: 11_000_000,
          grossSalary: 11_000_000,
          netSalary: 11_000_000,
        }),
      (err) => err.code === 11000,
    );
  });

  it('allows same employee across different months', async () => {
    const e = await makeEmployee();
    const r1 = await Payroll.create({
      employeeId: e._id,
      periodMonth: 10,
      periodYear: 2026,
      baseSalary: 10_000_000,
      grossSalary: 10_000_000,
      netSalary: 10_000_000,
    });
    const r2 = await Payroll.create({
      employeeId: e._id,
      periodMonth: 11,
      periodYear: 2026,
      baseSalary: 10_000_000,
      grossSalary: 10_000_000,
      netSalary: 10_000_000,
    });
    assert.ok(r1);
    assert.ok(r2);
  });

  it('allows same periodMonth across different years', async () => {
    const e = await makeEmployee();
    await Payroll.create({
      employeeId: e._id,
      periodMonth: 10,
      periodYear: 2026,
      baseSalary: 10_000_000,
      grossSalary: 10_000_000,
      netSalary: 10_000_000,
    });
    const r = await Payroll.create({
      employeeId: e._id,
      periodMonth: 10,
      periodYear: 2027,
      baseSalary: 10_000_000,
      grossSalary: 10_000_000,
      netSalary: 10_000_000,
    });
    assert.ok(r);
  });

  it('allows same period across different employees', async () => {
    const e1 = await makeEmployee();
    const e2 = await makeEmployee();
    await Payroll.create({
      employeeId: e1._id,
      periodMonth: 10,
      periodYear: 2026,
      baseSalary: 10_000_000,
      grossSalary: 10_000_000,
      netSalary: 10_000_000,
    });
    const r = await Payroll.create({
      employeeId: e2._id,
      periodMonth: 10,
      periodYear: 2026,
      baseSalary: 10_000_000,
      grossSalary: 10_000_000,
      netSalary: 10_000_000,
    });
    assert.ok(r);
  });
});
