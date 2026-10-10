// Integration tests for Dashboard & Reports API (Phase 9).

import { describe, it, before, after, beforeEach } from 'node:test';
import { strict as assert } from 'node:assert';

import { createApp } from '../src/app.js';
import {
  Employee,
  Department,
  Position,
  Attendance,
  LeaveRequest,
  Payroll,
} from '../src/models/index.js';
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

async function http(method, path, { body, token } = {}) {
  const opts = { method, headers: { 'Content-Type': 'application/json' } };
  if (body !== undefined) opts.body = JSON.stringify(body);
  if (token) opts.headers.Authorization = `Bearer ${token}`;
  const res = await fetch(`http://127.0.0.1:${port}${path}`, opts);
  let payload = null;
  const ct = res.headers.get('content-type') || '';
  if (ct.includes('application/json')) payload = await res.json();
  else payload = await res.text();
  return { status: res.status, body: payload };
}

async function makeAdmin() {
  const { user } = await createTestUser({
    email: `admin-${Date.now()}-${Math.random().toString(36).slice(2, 8)}@example.com`,
    role: 'admin',
  });
  return { user, token: await issueTokenFor(user) };
}

async function makeEmployeeUser() {
  const { user } = await createTestUser({
    email: `worker-${Date.now()}-${Math.random().toString(36).slice(2, 8)}@example.com`,
    role: 'employee',
  });
  return { user, token: await issueTokenFor(user) };
}

async function makeDepartment(overrides = {}) {
  return Department.create({
    name: `Dept ${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
    code: `D${Date.now().toString().slice(-6)}${Math.floor(Math.random() * 1000)}`,
    ...overrides,
  });
}

async function makePosition(overrides = {}) {
  return Position.create({
    name: `Pos ${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
    code: `P${Date.now().toString().slice(-6)}${Math.floor(Math.random() * 1000)}`,
    ...overrides,
  });
}

async function makeEmployeeDoc(overrides = {}) {
  return Employee.create({
    employeeCode: `NV${Date.now()}${Math.floor(Math.random() * 1000)}`,
    fullName: 'Test Person',
    email: `emp-${Date.now()}-${Math.random().toString(36).slice(2, 8)}@example.com`,
    employmentType: 'full_time',
    hireDate: new Date('2024-01-01'),
    ...overrides,
  });
}

async function seedAttendance(employeeId, workDate, status) {
  return Attendance.create({
    employeeId,
    workDate,
    status,
  });
}

async function seedLeave(employeeId, overrides = {}) {
  return LeaveRequest.create({
    employeeId,
    leaveType: 'annual',
    startDate: new Date(Date.UTC(2026, 9, 1)),
    endDate: new Date(Date.UTC(2026, 9, 3)),
    reason: 'precreated reason',
    ...overrides,
  });
}

async function seedPayroll(employeeId, overrides = {}) {
  const base = 10_000_000;
  const allowances = 1_000_000;
  const bonuses = 500_000;
  const deductions = 200_000;
  const grossSalary = base + allowances + bonuses;
  const netSalary = grossSalary - deductions;
  return Payroll.create({
    employeeId,
    periodMonth: 10,
    periodYear: 2026,
    baseSalary: base,
    allowances,
    bonuses,
    deductions,
    grossSalary,
    netSalary,
    ...overrides,
  });
}

describe('Dashboard API — auth & 401', () => {
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

  for (const path of [
    '/api/dashboard/overview',
    '/api/dashboard/attendance-summary',
    '/api/dashboard/leave-summary',
    '/api/dashboard/payroll-summary',
    '/api/reports/employees',
    '/api/reports/attendance',
    '/api/reports/leave-requests',
    '/api/reports/payroll',
  ]) {
    it(`GET ${path} without token → 401`, async () => {
      const r = await http('GET', path);
      assert.equal(r.status, 401);
    });
  }
});

describe('Dashboard API — Employee forbidden (403)', () => {
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

  for (const path of [
    '/api/dashboard/overview',
    '/api/dashboard/attendance-summary',
    '/api/dashboard/leave-summary',
    '/api/dashboard/payroll-summary',
    '/api/reports/employees',
    '/api/reports/attendance',
    '/api/reports/leave-requests',
    '/api/reports/payroll',
  ]) {
    it(`GET ${path} as employee → 403`, async () => {
      const { token } = await makeEmployeeUser();
      const r = await http('GET', path, { token });
      assert.equal(r.status, 403);
    });
  }
});

describe('Dashboard API — overview', () => {
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

  it('returns 200 with zero counters when empty', async () => {
    const { token } = await makeAdmin();
    const r = await http('GET', '/api/dashboard/overview', { token });
    assert.equal(r.status, 200);
    assert.equal(r.body.data.employees.total, 0);
    assert.equal(r.body.data.employees.active, 0);
    assert.equal(r.body.data.employees.inactive, 0);
    assert.equal(r.body.data.departments.active, 0);
    assert.equal(r.body.data.positions.active, 0);
    assert.equal(r.body.data.leaveRequests.pending, 0);
    assert.equal(r.body.data.attendance.recordsInMonth, 0);
    assert.ok(r.body.meta.generatedAt);
  });

  it('counts active vs inactive employees correctly, excluding soft-deleted', async () => {
    const { token } = await makeAdmin();
    await makeEmployeeDoc({ employmentStatus: 'active' });
    await makeEmployeeDoc({ employmentStatus: 'active' });
    await makeEmployeeDoc({ employmentStatus: 'on_leave' });
    await makeEmployeeDoc({ employmentStatus: 'inactive' });
    // Soft-deleted — must NOT be counted.
    await makeEmployeeDoc({
      employmentStatus: 'active',
      isDeleted: true,
      deletedAt: new Date(),
    });
    const r = await http('GET', '/api/dashboard/overview', { token });
    assert.equal(r.status, 200);
    assert.equal(r.body.data.employees.total, 4);
    assert.equal(r.body.data.employees.active, 2);
    assert.equal(r.body.data.employees.inactive, 2);
  });

  it('counts active departments and positions', async () => {
    const { token } = await makeAdmin();
    await makeDepartment({ status: 'active' });
    await makeDepartment({ status: 'active' });
    await makeDepartment({ status: 'inactive' });
    await makePosition({ status: 'active' });
    await makePosition({ status: 'inactive' });
    const r = await http('GET', '/api/dashboard/overview', { token });
    assert.equal(r.body.data.departments.active, 2);
    assert.equal(r.body.data.positions.active, 1);
  });

  it('counts only pending leave requests', async () => {
    const { token } = await makeAdmin();
    const e = await makeEmployeeDoc();
    await seedLeave(e._id, { status: 'pending' });
    await seedLeave(e._id, {
      status: 'pending',
      startDate: new Date(Date.UTC(2026, 10, 1)),
      endDate: new Date(Date.UTC(2026, 10, 2)),
    });
    await seedLeave(e._id, {
      status: 'approved',
      startDate: new Date(Date.UTC(2026, 11, 1)),
      endDate: new Date(Date.UTC(2026, 11, 2)),
    });
    const r = await http('GET', '/api/dashboard/overview', { token });
    assert.equal(r.body.data.leaveRequests.pending, 2);
  });
});

describe('Dashboard API — attendance summary', () => {
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

  it('returns 0 / 0 / empty maps when no data', async () => {
    const { token } = await makeAdmin();
    const r = await http('GET', '/api/dashboard/attendance-summary', { token });
    assert.equal(r.status, 200);
    assert.equal(r.body.data.total, 0);
    assert.equal(r.body.data.uniqueDays, 0);
    assert.deepEqual(r.body.data.byStatus, {
      present: 0,
      late: 0,
      absent: 0,
      leave: 0,
      half_day: 0,
    });
    assert.deepEqual(r.body.data.byDepartment, []);
  });

  it('aggregates by status and day correctly', async () => {
    const { token } = await makeAdmin();
    const e1 = await makeEmployeeDoc();
    const e2 = await makeEmployeeDoc();
    const e3 = await makeEmployeeDoc();
    const d1 = new Date(Date.UTC(2026, 8, 1));
    const d2 = new Date(Date.UTC(2026, 8, 2));
    await seedAttendance(e1._id, d1, 'present');
    await seedAttendance(e2._id, d1, 'late');
    await seedAttendance(e3._id, d2, 'absent');
    const r = await http(
      'GET',
      '/api/dashboard/attendance-summary?startDate=2026-09-01&endDate=2026-09-30',
      { token },
    );
    assert.equal(r.status, 200);
    assert.equal(r.body.data.total, 3);
    assert.equal(r.body.data.uniqueDays, 2);
    assert.equal(r.body.data.byStatus.present, 1);
    assert.equal(r.body.data.byStatus.late, 1);
    assert.equal(r.body.data.byStatus.absent, 1);
    assert.equal(r.body.data.byStatus.leave, 0);
    assert.equal(r.body.data.byStatus.half_day, 0);
  });

  it('groups by department via $lookup', async () => {
    const { token } = await makeAdmin();
    const dept = await makeDepartment({ status: 'active' });
    const e1 = await makeEmployeeDoc({ departmentId: dept._id });
    const e2 = await makeEmployeeDoc({ departmentId: dept._id });
    const d1 = new Date(Date.UTC(2026, 8, 1));
    await seedAttendance(e1._id, d1, 'present');
    await seedAttendance(e2._id, d1, 'present');
    const r = await http(
      'GET',
      '/api/dashboard/attendance-summary?startDate=2026-09-01&endDate=2026-09-30',
      { token },
    );
    assert.equal(r.body.data.byDepartment.length, 1);
    assert.equal(r.body.data.byDepartment[0].count, 2);
    assert.equal(r.body.data.byDepartment[0].name, dept.name);
  });

  it('rejects invalid date format', async () => {
    const { token } = await makeAdmin();
    const r = await http('GET', '/api/dashboard/attendance-summary?startDate=oops', { token });
    assert.equal(r.status, 400);
  });

  it('rejects startDate > endDate', async () => {
    const { token } = await makeAdmin();
    const r = await http(
      'GET',
      '/api/dashboard/attendance-summary?startDate=2026-09-30&endDate=2026-09-01',
      { token },
    );
    assert.equal(r.status, 400);
  });

  it('rejects range > 366 days', async () => {
    const { token } = await makeAdmin();
    const r = await http(
      'GET',
      '/api/dashboard/attendance-summary?startDate=2024-01-01&endDate=2026-12-31',
      { token },
    );
    assert.equal(r.status, 400);
  });
});

describe('Dashboard API — leave summary', () => {
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

  it('returns 0 / empty maps when no data', async () => {
    const { token } = await makeAdmin();
    const r = await http('GET', '/api/dashboard/leave-summary', { token });
    assert.equal(r.status, 200);
    assert.equal(r.body.data.total, 0);
    assert.deepEqual(r.body.data.byStatus, {
      pending: 0,
      approved: 0,
      rejected: 0,
      cancelled: 0,
    });
    assert.equal(r.body.data.range.filterBy, 'startDate');
  });

  it('aggregates by status and leaveType', async () => {
    const { token } = await makeAdmin();
    const e = await makeEmployeeDoc();
    await seedLeave(e._id, { status: 'pending', leaveType: 'annual' });
    await seedLeave(e._id, {
      status: 'approved',
      leaveType: 'sick',
      startDate: new Date(Date.UTC(2026, 9, 5)),
      endDate: new Date(Date.UTC(2026, 9, 6)),
    });
    await seedLeave(e._id, {
      status: 'rejected',
      leaveType: 'unpaid',
      startDate: new Date(Date.UTC(2026, 9, 7)),
      endDate: new Date(Date.UTC(2026, 9, 7)),
    });
    await seedLeave(e._id, {
      status: 'cancelled',
      leaveType: 'other',
      startDate: new Date(Date.UTC(2026, 9, 8)),
      endDate: new Date(Date.UTC(2026, 9, 8)),
    });
    const r = await http(
      'GET',
      '/api/dashboard/leave-summary?startDate=2026-10-01&endDate=2026-10-31',
      { token },
    );
    assert.equal(r.status, 200);
    assert.equal(r.body.data.total, 4);
    assert.equal(r.body.data.byStatus.pending, 1);
    assert.equal(r.body.data.byStatus.approved, 1);
    assert.equal(r.body.data.byStatus.rejected, 1);
    assert.equal(r.body.data.byStatus.cancelled, 1);
    assert.equal(r.body.data.byLeaveType.annual, 1);
    assert.equal(r.body.data.byLeaveType.sick, 1);
    assert.equal(r.body.data.byLeaveType.unpaid, 1);
    assert.equal(r.body.data.byLeaveType.other, 1);
  });

  it('rejects invalid by value', async () => {
    const { token } = await makeAdmin();
    const r = await http('GET', '/api/dashboard/leave-summary?by=foo', { token });
    assert.equal(r.status, 400);
  });

  it('rejects startDate > endDate', async () => {
    const { token } = await makeAdmin();
    const r = await http(
      'GET',
      '/api/dashboard/leave-summary?startDate=2026-10-31&endDate=2026-10-01',
      { token },
    );
    assert.equal(r.status, 400);
  });
});

describe('Dashboard API — payroll summary', () => {
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

  it('returns 0 / empty maps when no data', async () => {
    const { token } = await makeAdmin();
    const r = await http('GET', '/api/dashboard/payroll-summary', { token });
    assert.equal(r.status, 200);
    assert.equal(r.body.data.count, 0);
    assert.equal(r.body.data.totalNet, 0);
    assert.equal(r.body.data.totalNetPaid, 0);
    assert.deepEqual(r.body.data.byStatus, {
      draft: 0,
      approved: 0,
      paid: 0,
      cancelled: 0,
    });
  });

  it('aggregates totals by status; draft is NOT counted in totalNetPaid', async () => {
    const { token } = await makeAdmin();
    const e1 = await makeEmployeeDoc();
    const e2 = await makeEmployeeDoc();
    const e3 = await makeEmployeeDoc();
    // base 10M + allow 1M + bonus 500k = gross 11.5M; deductions 200k → net 11.3M.
    await seedPayroll(e1._id, { status: 'paid' });
    await seedPayroll(e2._id, { status: 'approved' });
    await seedPayroll(e3._id, { status: 'draft' });
    const r = await http(
      'GET',
      '/api/dashboard/payroll-summary?periodMonth=10&periodYear=2026',
      { token },
    );
    assert.equal(r.status, 200);
    assert.equal(r.body.data.count, 3);
    assert.equal(r.body.data.byStatus.paid, 1);
    assert.equal(r.body.data.byStatus.approved, 1);
    assert.equal(r.body.data.byStatus.draft, 1);
    assert.equal(r.body.data.byStatus.cancelled, 0);
    // totalNet = 3 × 11.3M = 33.9M
    assert.equal(r.body.data.totalNet, 33_900_000);
    // totalNetPaid chỉ tính paid
    assert.equal(r.body.data.totalNetPaid, 11_300_000);
    // totalNetApproved chỉ tính approved
    assert.equal(r.body.data.totalNetApproved, 11_300_000);
    // totalGross = 3 × 11.5M = 34.5M
    assert.equal(r.body.data.totalGross, 34_500_000);
  });

  it('does not mix different periods', async () => {
    const { token } = await makeAdmin();
    const e1 = await makeEmployeeDoc();
    const e2 = await makeEmployeeDoc();
    await seedPayroll(e1._id, { periodMonth: 10, periodYear: 2026, status: 'paid' });
    await seedPayroll(e2._id, { periodMonth: 11, periodYear: 2026, status: 'paid' });
    const r = await http(
      'GET',
      '/api/dashboard/payroll-summary?periodMonth=10&periodYear=2026',
      { token },
    );
    assert.equal(r.body.data.count, 1);
    assert.equal(r.body.data.totalNetPaid, 11_300_000);
  });

  it('rejects invalid period', async () => {
    const { token } = await makeAdmin();
    const r1 = await http(
      'GET',
      '/api/dashboard/payroll-summary?periodMonth=13&periodYear=2026',
      { token },
    );
    assert.equal(r1.status, 400);
    const r2 = await http(
      'GET',
      '/api/dashboard/payroll-summary?periodMonth=10',
      { token },
    );
    assert.equal(r2.status, 400); // thiếu periodYear
  });
});

describe('Reports API — employees', () => {
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

  it('returns zero report when empty', async () => {
    const { token } = await makeAdmin();
    const r = await http('GET', '/api/reports/employees', { token });
    assert.equal(r.status, 200);
    assert.equal(r.body.data.total, 0);
    assert.equal(r.body.data.byDepartment.length, 0);
    assert.equal(r.body.data.byPosition.length, 0);
  });

  it('aggregates by department / position / employmentType / hireYear; excludes soft-deleted', async () => {
    const { token } = await makeAdmin();
    const dept = await makeDepartment({ status: 'active' });
    const pos = await makePosition({ status: 'active' });
    await makeEmployeeDoc({ departmentId: dept._id, positionId: pos._id, employmentType: 'full_time', hireDate: new Date('2024-03-15') });
    await makeEmployeeDoc({ departmentId: dept._id, positionId: pos._id, employmentType: 'part_time', hireDate: new Date('2024-08-10') });
    await makeEmployeeDoc({ employmentType: 'contract', hireDate: new Date('2025-01-05') });
    // Soft-deleted — must NOT be counted
    await makeEmployeeDoc({
      departmentId: dept._id,
      positionId: pos._id,
      employmentType: 'full_time',
      isDeleted: true,
      deletedAt: new Date(),
    });
    const r = await http('GET', '/api/reports/employees', { token });
    assert.equal(r.status, 200);
    assert.equal(r.body.data.total, 3);
    assert.equal(r.body.data.byDepartment[0].count, 2);
    assert.equal(r.body.data.byDepartment[0].name, dept.name);
    assert.equal(r.body.data.byPosition[0].count, 2);
    assert.equal(r.body.data.byEmploymentType.full_time, 1);
    assert.equal(r.body.data.byEmploymentType.part_time, 1);
    assert.equal(r.body.data.byEmploymentType.contract, 1);
    // 2 năm tuyển dụng: 2024 (2) và 2025 (1)
    const years = Object.fromEntries(r.body.data.byHireYear.map((y) => [y.year, y.count]));
    assert.equal(years[2024], 2);
    assert.equal(years[2025], 1);
  });
});

describe('Reports API — attendance', () => {
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

  it('returns 0 when empty', async () => {
    const { token } = await makeAdmin();
    const r = await http('GET', '/api/reports/attendance', { token });
    assert.equal(r.status, 200);
    assert.equal(r.body.data.total, 0);
    assert.equal(r.body.data.byEmployee.length, 0);
    assert.equal(r.body.data.byDepartment.length, 0);
  });

  it('aggregates total, byStatus, byEmployee, byDepartment in a date range', async () => {
    const { token } = await makeAdmin();
    const dept = await makeDepartment({ status: 'active' });
    const e1 = await makeEmployeeDoc({ departmentId: dept._id });
    const e2 = await makeEmployeeDoc({ departmentId: dept._id });
    await seedAttendance(e1._id, new Date(Date.UTC(2026, 8, 1)), 'present');
    await seedAttendance(e1._id, new Date(Date.UTC(2026, 8, 2)), 'late');
    await seedAttendance(e2._id, new Date(Date.UTC(2026, 8, 2)), 'present');
    const r = await http(
      'GET',
      '/api/reports/attendance?startDate=2026-09-01&endDate=2026-09-30',
      { token },
    );
    assert.equal(r.status, 200);
    assert.equal(r.body.data.total, 3);
    assert.equal(r.body.data.byStatus.present, 2);
    assert.equal(r.body.data.byStatus.late, 1);
    assert.equal(r.body.data.byDepartment.length, 1);
    assert.equal(r.body.data.byDepartment[0].count, 3);
    assert.equal(r.body.data.byEmployee.length, 2);
  });

  it('rejects startDate > endDate', async () => {
    const { token } = await makeAdmin();
    const r = await http(
      'GET',
      '/api/reports/attendance?startDate=2026-09-30&endDate=2026-09-01',
      { token },
    );
    assert.equal(r.status, 400);
  });
});

describe('Reports API — leave-requests', () => {
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

  it('returns 0 when empty', async () => {
    const { token } = await makeAdmin();
    const r = await http('GET', '/api/reports/leave-requests', { token });
    assert.equal(r.status, 200);
    assert.equal(r.body.data.total, 0);
  });

  it('aggregates by status / type / employee / department; filters by startDate', async () => {
    const { token } = await makeAdmin();
    const dept = await makeDepartment({ status: 'active' });
    const e1 = await makeEmployeeDoc({ departmentId: dept._id });
    const e2 = await makeEmployeeDoc({ departmentId: dept._id });
    await seedLeave(e1._id, {
      status: 'pending',
      leaveType: 'annual',
      startDate: new Date(Date.UTC(2026, 9, 5)),
      endDate: new Date(Date.UTC(2026, 9, 5)),
    });
    await seedLeave(e2._id, {
      status: 'approved',
      leaveType: 'sick',
      startDate: new Date(Date.UTC(2026, 9, 6)),
      endDate: new Date(Date.UTC(2026, 9, 6)),
    });
    // Out of range
    await seedLeave(e1._id, {
      status: 'pending',
      leaveType: 'annual',
      startDate: new Date(Date.UTC(2027, 0, 1)),
      endDate: new Date(Date.UTC(2027, 0, 1)),
    });
    const r = await http(
      'GET',
      '/api/reports/leave-requests?startDate=2026-10-01&endDate=2026-10-31',
      { token },
    );
    assert.equal(r.status, 200);
    assert.equal(r.body.data.total, 2);
    assert.equal(r.body.data.byStatus.pending, 1);
    assert.equal(r.body.data.byStatus.approved, 1);
    assert.equal(r.body.data.byLeaveType.annual, 1);
    assert.equal(r.body.data.byLeaveType.sick, 1);
    assert.equal(r.body.data.byDepartment[0].count, 2);
    assert.equal(r.body.data.range.filterBy, 'startDate');
  });
});

describe('Reports API — payroll', () => {
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

  it('returns 0 totals when empty', async () => {
    const { token } = await makeAdmin();
    const r = await http('GET', '/api/reports/payroll', { token });
    assert.equal(r.status, 200);
    assert.equal(r.body.data.count, 0);
    assert.equal(r.body.data.totalNet, 0);
  });

  it('returns per-status totals for a specific period', async () => {
    const { token } = await makeAdmin();
    const e1 = await makeEmployeeDoc();
    const e2 = await makeEmployeeDoc();
    await seedPayroll(e1._id, { status: 'paid' });
    await seedPayroll(e2._id, { status: 'approved' });
    const r = await http(
      'GET',
      '/api/reports/payroll?periodMonth=10&periodYear=2026',
      { token },
    );
    assert.equal(r.body.data.count, 2);
    assert.equal(r.body.data.byStatus.paid, 1);
    assert.equal(r.body.data.byStatus.approved, 1);
    assert.equal(r.body.data.totalNetPaid, 11_300_000);
    assert.equal(r.body.data.totalNetApproved, 11_300_000);
  });

  it('does not mix periods', async () => {
    const { token } = await makeAdmin();
    const e1 = await makeEmployeeDoc();
    const e2 = await makeEmployeeDoc();
    await seedPayroll(e1._id, { periodMonth: 10, periodYear: 2026, status: 'paid' });
    await seedPayroll(e2._id, { periodMonth: 11, periodYear: 2026, status: 'paid' });
    const r = await http(
      'GET',
      '/api/reports/payroll?periodMonth=10&periodYear=2026',
      { token },
    );
    assert.equal(r.body.data.count, 1);
  });

  it('rejects periodMonth without periodYear', async () => {
    const { token } = await makeAdmin();
    const r = await http('GET', '/api/reports/payroll?periodMonth=10', { token });
    assert.equal(r.status, 400);
  });
});

describe('Dashboard & Reports — regression of other modules', () => {
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

  it('GET /api/health still works', async () => {
    const r = await http('GET', '/api/health');
    assert.equal(r.status, 200);
  });

  it('GET /api/employees still works with admin token', async () => {
    const { token } = await makeAdmin();
    const r = await http('GET', '/api/employees', { token });
    assert.equal(r.status, 200);
  });

  it('GET /api/payroll still works with admin token', async () => {
    const { token } = await makeAdmin();
    const r = await http('GET', '/api/payroll', { token });
    assert.equal(r.status, 200);
  });
});
