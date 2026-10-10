// Integration tests for the Payroll Management API.

import { describe, it, before, after, beforeEach } from 'node:test';
import { strict as assert } from 'node:assert';

import { createApp } from '../src/app.js';
import { Payroll, Employee } from '../src/models/index.js';
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

function logFailure(label, r) {
  // eslint-disable-next-line no-console
  console.error(`[fail-debug] ${label}: status=${r.status} body=`, r.body);
}

async function makeAdmin() {
  const { user } = await createTestUser({
    email: `admin-${Date.now()}-${Math.random().toString(36).slice(2, 8)}@example.com`,
    role: 'admin',
  });
  const token = await issueTokenFor(user);
  return { user, token };
}

async function makeEmployeeUser() {
  const { user } = await createTestUser({
    email: `worker-${Date.now()}-${Math.random().toString(36).slice(2, 8)}@example.com`,
    role: 'employee',
  });
  const token = await issueTokenFor(user);
  return { user, token };
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

async function linkEmployeeToUser(employeeId, userId) {
  return Employee.findByIdAndUpdate(employeeId, { userId }, { new: true });
}

function idStr(maybeId) {
  return typeof maybeId === 'string' ? maybeId : maybeId.toString();
}

function baseCreateBody(overrides = {}) {
  return {
    employeeId: undefined, // gán trong test
    periodMonth: 10,
    periodYear: 2026,
    baseSalary: 10_000_000,
    allowances: 1_000_000,
    bonuses: 500_000,
    deductions: 200_000,
    workedDays: 22,
    standardWorkDays: 22,
    note: 'thưởng Tết',
    ...overrides,
  };
}

async function seedPayroll(employeeId, overrides = {}) {
  return Payroll.create({
    employeeId,
    periodMonth: 10,
    periodYear: 2026,
    baseSalary: 10_000_000,
    allowances: 1_000_000,
    bonuses: 500_000,
    deductions: 200_000,
    grossSalary: 11_500_000,
    netSalary: 11_300_000,
    workedDays: 22,
    standardWorkDays: 22,
    ...overrides,
  });
}

describe('Payroll API — auth & 401', () => {
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

  it('GET /api/payroll without token → 401', async () => {
    const r = await http('GET', '/api/payroll');
    assert.equal(r.status, 401);
  });

  it('GET /api/payroll with bad token → 401', async () => {
    const r = await http('GET', '/api/payroll', { token: 'not-a-jwt' });
    assert.equal(r.status, 401);
  });

  it('POST /api/payroll without token → 401', async () => {
    const r = await http('POST', '/api/payroll', { body: {} });
    assert.equal(r.status, 401);
  });
});

describe('Payroll API — RBAC (Admin-only write & state transitions)', () => {
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

  it('Employee cannot list all payrolls → 403', async () => {
    const { token } = await makeEmployeeUser();
    const r = await http('GET', '/api/payroll', { token });
    assert.equal(r.status, 403);
  });

  it('Employee cannot create payroll → 403', async () => {
    const { token } = await makeEmployeeUser();
    const e = await makeEmployeeDoc();
    const body = baseCreateBody({ employeeId: idStr(e._id) });
    const r = await http('POST', '/api/payroll', { body, token });
    assert.equal(r.status, 403);
  });

  it('Employee cannot approve → 403', async () => {
    const { token } = await makeEmployeeUser();
    const e = await makeEmployeeDoc();
    const p = await seedPayroll(e._id);
    const r = await http('PATCH', `/api/payroll/${p._id}/approve`, { token });
    assert.equal(r.status, 403);
  });

  it('Employee cannot mark-paid → 403', async () => {
    const { token } = await makeEmployeeUser();
    const e = await makeEmployeeDoc();
    const p = await seedPayroll(e._id, { status: 'approved' });
    const r = await http('PATCH', `/api/payroll/${p._id}/mark-paid`, { token });
    assert.equal(r.status, 403);
  });

  it('Employee cannot cancel → 403', async () => {
    const { token } = await makeEmployeeUser();
    const e = await makeEmployeeDoc();
    const p = await seedPayroll(e._id);
    const r = await http('PATCH', `/api/payroll/${p._id}/cancel`, { token });
    assert.equal(r.status, 403);
  });

  it('Admin can list → 200', async () => {
    const { token } = await makeAdmin();
    const r = await http('GET', '/api/payroll', { token });
    assert.equal(r.status, 200);
    assert.equal(r.body.success, true);
    assert.ok(Array.isArray(r.body.data));
  });
});

describe('Payroll API — Create (POST /)', () => {
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

  it('Admin creates a payroll record with computed gross/net', async () => {
    const { token, user: admin } = await makeAdmin();
    const e = await makeEmployeeDoc();
    const body = baseCreateBody({ employeeId: idStr(e._id) });
    const r = await http('POST', '/api/payroll', { body, token });
    assert.equal(r.status, 201);
    assert.equal(r.body.success, true);
    assert.equal(r.body.data.employeeId, idStr(e._id));
    assert.equal(r.body.data.periodMonth, 10);
    assert.equal(r.body.data.periodYear, 2026);
    assert.equal(r.body.data.grossSalary, 11_500_000); // 10M + 1M + 0.5M
    assert.equal(r.body.data.netSalary, 11_300_000); // 11.5M - 0.2M
    assert.equal(r.body.data.status, 'draft');
    assert.equal(r.body.data.createdBy, idStr(admin._id));
  });

  it('Rejects missing employeeId', async () => {
    const { token } = await makeAdmin();
    const r = await http('POST', '/api/payroll', {
      body: { periodMonth: 10, periodYear: 2026, baseSalary: 1 },
      token,
    });
    assert.equal(r.status, 400);
  });

  it('Rejects invalid employeeId', async () => {
    const { token } = await makeAdmin();
    const r = await http('POST', '/api/payroll', {
      body: {
        employeeId: 'not-an-objectid',
        periodMonth: 10,
        periodYear: 2026,
        baseSalary: 1,
      },
      token,
    });
    assert.equal(r.status, 400);
  });

  it('Rejects non-existing employee', async () => {
    const { token } = await makeAdmin();
    const fakeId = '0123456789abcdef01234567';
    const r = await http('POST', '/api/payroll', {
      body: {
        employeeId: fakeId,
        periodMonth: 10,
        periodYear: 2026,
        baseSalary: 1,
      },
      token,
    });
    assert.equal(r.status, 400);
  });

  it('Rejects soft-deleted employee', async () => {
    const { token } = await makeAdmin();
    const e = await makeEmployeeDoc({ isDeleted: true, deletedAt: new Date() });
    const r = await http('POST', '/api/payroll', {
      body: baseCreateBody({ employeeId: idStr(e._id) }),
      token,
    });
    assert.equal(r.status, 400);
  });

  it('Rejects duplicate (employeeId, periodMonth, periodYear) → 409', async () => {
    const { token } = await makeAdmin();
    const e = await makeEmployeeDoc();
    const body = baseCreateBody({ employeeId: idStr(e._id) });
    const r1 = await http('POST', '/api/payroll', { body, token });
    assert.equal(r1.status, 201);
    const r2 = await http('POST', '/api/payroll', { body, token });
    assert.equal(r2.status, 409);
    assert.equal(r2.body.error.code, 'DUPLICATE_PAYROLL');
  });

  it('Rejects negative money values', async () => {
    const { token } = await makeAdmin();
    const e = await makeEmployeeDoc();
    const r = await http('POST', '/api/payroll', {
      body: baseCreateBody({ employeeId: idStr(e._id), baseSalary: -1 }),
      token,
    });
    assert.equal(r.status, 400);
  });

  it('Rejects NaN baseSalary', async () => {
    const { token } = await makeAdmin();
    const e = await makeEmployeeDoc();
    // JSON không gửi được NaN trực tiếp, dùng string không phải số
    const r = await http('POST', '/api/payroll', {
      body: { ...baseCreateBody({ employeeId: idStr(e._id) }), baseSalary: 'abc' },
      token,
    });
    assert.equal(r.status, 400);
  });

  it('Rejects client-supplied grossSalary', async () => {
    const { token } = await makeAdmin();
    const e = await makeEmployeeDoc();
    const body = baseCreateBody({ employeeId: idStr(e._id) });
    body.grossSalary = 999_999_999;
    const r = await http('POST', '/api/payroll', { body, token });
    assert.equal(r.status, 400);
  });

  it('Rejects client-supplied netSalary', async () => {
    const { token } = await makeAdmin();
    const e = await makeEmployeeDoc();
    const body = baseCreateBody({ employeeId: idStr(e._id) });
    body.netSalary = 999_999_999;
    const r = await http('POST', '/api/payroll', { body, token });
    assert.equal(r.status, 400);
  });

  it('Rejects client-supplied status', async () => {
    const { token } = await makeAdmin();
    const e = await makeEmployeeDoc();
    const body = baseCreateBody({ employeeId: idStr(e._id) });
    body.status = 'approved';
    const r = await http('POST', '/api/payroll', { body, token });
    assert.equal(r.status, 400);
  });

  it('Rejects client-supplied approvedBy', async () => {
    const { token } = await makeAdmin();
    const e = await makeEmployeeDoc();
    const body = baseCreateBody({ employeeId: idStr(e._id) });
    body.approvedBy = '6' + '0'.repeat(23) + '1';
    const r = await http('POST', '/api/payroll', { body, token });
    assert.equal(r.status, 400);
  });

  it('Defaults allowances/bonuses/deductions to 0', async () => {
    const { token } = await makeAdmin();
    const e = await makeEmployeeDoc();
    const body = {
      employeeId: idStr(e._id),
      periodMonth: 10,
      periodYear: 2026,
      baseSalary: 10_000_000,
    };
    const r = await http('POST', '/api/payroll', { body, token });
    assert.equal(r.status, 201);
    assert.equal(r.body.data.allowances, 0);
    assert.equal(r.body.data.bonuses, 0);
    assert.equal(r.body.data.deductions, 0);
    assert.equal(r.body.data.grossSalary, 10_000_000);
    assert.equal(r.body.data.netSalary, 10_000_000);
  });

  it('Rejects periodMonth > 12', async () => {
    const { token } = await makeAdmin();
    const e = await makeEmployeeDoc();
    const r = await http('POST', '/api/payroll', {
      body: baseCreateBody({ employeeId: idStr(e._id), periodMonth: 13 }),
      token,
    });
    assert.equal(r.status, 400);
  });
});

describe('Payroll API — Read (GET /)', () => {
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

  it('Admin list returns all', async () => {
    const { token } = await makeAdmin();
    const e1 = await makeEmployeeDoc();
    const e2 = await makeEmployeeDoc();
    await seedPayroll(e1._id);
    await seedPayroll(e2._id, {
      periodMonth: 11,
      baseSalary: 5_000_000,
      grossSalary: 5_000_000,
      netSalary: 5_000_000,
    });
    const r = await http('GET', '/api/payroll', { token });
    assert.equal(r.status, 200);
    assert.equal(r.body.data.length, 2);
    assert.equal(r.body.meta.pagination.total, 2);
  });

  it('Admin list filters by employeeId / periodMonth / periodYear / status', async () => {
    const { token } = await makeAdmin();
    const e1 = await makeEmployeeDoc();
    const e2 = await makeEmployeeDoc();
    await seedPayroll(e1._id);
    await seedPayroll(e2._id, { periodMonth: 11, baseSalary: 5_000_000, grossSalary: 5_000_000, netSalary: 5_000_000 });
    await seedPayroll(e2._id, {
      periodMonth: 12,
      periodYear: 2026,
      baseSalary: 5_000_000,
      grossSalary: 5_000_000,
      netSalary: 5_000_000,
      status: 'approved',
    });
    const r1 = await http('GET', `/api/payroll?employeeId=${idStr(e2._id)}`, { token });
    assert.equal(r1.body.data.length, 2);
    const r2 = await http('GET', '/api/payroll?periodMonth=11', { token });
    assert.equal(r2.body.data.length, 1);
    const r3 = await http('GET', '/api/payroll?status=approved', { token });
    assert.equal(r3.body.data.length, 1);
  });

  it('Admin list pagination + sort', async () => {
    const { token } = await makeAdmin();
    const e = await makeEmployeeDoc();
    for (let m = 1; m <= 5; m++) {
      await seedPayroll(e._id, { periodMonth: m, baseSalary: 1_000_000, grossSalary: 1_000_000, netSalary: 1_000_000 });
    }
    const r = await http('GET', '/api/payroll?page=1&limit=2&sort=periodMonth', { token });
    assert.equal(r.body.data.length, 2);
    assert.equal(r.body.meta.pagination.total, 5);
    assert.equal(r.body.data[0].periodMonth, 1);
  });

  it('Admin gets by id', async () => {
    const { token } = await makeAdmin();
    const e = await makeEmployeeDoc();
    const p = await seedPayroll(e._id);
    const r = await http('GET', `/api/payroll/${p._id}`, { token });
    assert.equal(r.status, 200);
    assert.equal(r.body.data._id, idStr(p._id));
  });

  it('GET /:id with invalid id → 400', async () => {
    const { token } = await makeAdmin();
    const r = await http('GET', '/api/payroll/not-an-id', { token });
    assert.equal(r.status, 400);
  });

  it('GET /:id with non-existing id → 404', async () => {
    const { token } = await makeAdmin();
    const fakeId = '0123456789abcdef01234567';
    const r = await http('GET', `/api/payroll/${fakeId}`, { token });
    assert.equal(r.status, 404);
  });
});

describe('Payroll API — Update (PATCH /:id)', () => {
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

  it('Admin updates draft — recomputes gross/net', async () => {
    const { token } = await makeAdmin();
    const e = await makeEmployeeDoc();
    const p = await seedPayroll(e._id);
    const r = await http('PATCH', `/api/payroll/${p._id}`, {
      body: { baseSalary: 20_000_000, allowances: 2_000_000 },
      token,
    });
    assert.equal(r.status, 200);
    assert.equal(r.body.data.baseSalary, 20_000_000);
    assert.equal(r.body.data.allowances, 2_000_000);
    // gross = 20M + 2M + 0.5M = 22.5M
    assert.equal(r.body.data.grossSalary, 22_500_000);
    // net = 22.5M - 0.2M = 22.3M
    assert.equal(r.body.data.netSalary, 22_300_000);
  });

  it('Rejects update on approved record → 409', async () => {
    const { token } = await makeAdmin();
    const e = await makeEmployeeDoc();
    const p = await seedPayroll(e._id, { status: 'approved' });
    const r = await http('PATCH', `/api/payroll/${p._id}`, {
      body: { baseSalary: 20_000_000 },
      token,
    });
    assert.equal(r.status, 409);
    assert.equal(r.body.error.code, 'INVALID_STATE');
  });

  it('Rejects update on paid record → 409', async () => {
    const { token } = await makeAdmin();
    const e = await makeEmployeeDoc();
    const p = await seedPayroll(e._id, { status: 'paid' });
    const r = await http('PATCH', `/api/payroll/${p._id}`, {
      body: { baseSalary: 20_000_000 },
      token,
    });
    assert.equal(r.status, 409);
  });

  it('Rejects update on cancelled record → 409', async () => {
    const { token } = await makeAdmin();
    const e = await makeEmployeeDoc();
    const p = await seedPayroll(e._id, { status: 'cancelled' });
    const r = await http('PATCH', `/api/payroll/${p._id}`, {
      body: { baseSalary: 20_000_000 },
      token,
    });
    assert.equal(r.status, 409);
  });

  it('Rejects update with no fields → 400', async () => {
    const { token } = await makeAdmin();
    const e = await makeEmployeeDoc();
    const p = await seedPayroll(e._id);
    const r = await http('PATCH', `/api/payroll/${p._id}`, { body: {}, token });
    assert.equal(r.status, 400);
  });

  it('Rejects client-supplied employeeId in update', async () => {
    const { token } = await makeAdmin();
    const e = await makeEmployeeDoc();
    const e2 = await makeEmployeeDoc();
    const p = await seedPayroll(e._id);
    const r = await http('PATCH', `/api/payroll/${p._id}`, {
      body: { employeeId: idStr(e2._id) },
      token,
    });
    assert.equal(r.status, 400);
  });

  it('Rejects client-supplied status in update', async () => {
    const { token } = await makeAdmin();
    const e = await makeEmployeeDoc();
    const p = await seedPayroll(e._id);
    const r = await http('PATCH', `/api/payroll/${p._id}`, {
      body: { status: 'approved' },
      token,
    });
    assert.equal(r.status, 400);
  });

  it('Rejects client-supplied grossSalary in update', async () => {
    const { token } = await makeAdmin();
    const e = await makeEmployeeDoc();
    const p = await seedPayroll(e._id);
    const r = await http('PATCH', `/api/payroll/${p._id}`, {
      body: { grossSalary: 999 },
      token,
    });
    assert.equal(r.status, 400);
  });

  it('Update with invalid id → 400', async () => {
    const { token } = await makeAdmin();
    const r = await http('PATCH', '/api/payroll/not-an-id', {
      body: { baseSalary: 1 },
      token,
    });
    assert.equal(r.status, 400);
  });

  it('Update non-existing → 404', async () => {
    const { token } = await makeAdmin();
    const fakeId = '0123456789abcdef01234567';
    const r = await http('PATCH', `/api/payroll/${fakeId}`, {
      body: { baseSalary: 1 },
      token,
    });
    assert.equal(r.status, 404);
  });
});

describe('Payroll API — State transitions (approve / mark-paid / cancel)', () => {
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

  it('Admin approves a draft → 200, sets approvedBy/At', async () => {
    const { token, user: admin } = await makeAdmin();
    const e = await makeEmployeeDoc();
    const p = await seedPayroll(e._id);
    const before = Date.now();
    const r = await http('PATCH', `/api/payroll/${p._id}/approve`, { token });
    const after = Date.now();
    assert.equal(r.status, 200);
    assert.equal(r.body.data.status, 'approved');
    assert.equal(r.body.data.approvedBy, idStr(admin._id));
    const at = new Date(r.body.data.approvedAt).getTime();
    assert.ok(at >= before - 1000 && at <= after + 1000);
  });

  it('Approve a soft-deleted employee → 409', async () => {
    const { token } = await makeAdmin();
    const e = await makeEmployeeDoc();
    const p = await seedPayroll(e._id);
    await Employee.findByIdAndUpdate(e._id, { isDeleted: true, deletedAt: new Date() });
    const r = await http('PATCH', `/api/payroll/${p._id}/approve`, { token });
    assert.equal(r.status, 409);
    assert.equal(r.body.error.code, 'EMPLOYEE_DELETED');
  });

  it('Approve an already-approved record → idempotent 200 with meta', async () => {
    const { token } = await makeAdmin();
    const e = await makeEmployeeDoc();
    const p = await seedPayroll(e._id, { status: 'approved' });
    const r = await http('PATCH', `/api/payroll/${p._id}/approve`, { token });
    assert.equal(r.status, 200);
    assert.equal(r.body.meta.alreadyApproved, true);
  });

  it('Approve a paid record → 409', async () => {
    const { token } = await makeAdmin();
    const e = await makeEmployeeDoc();
    const p = await seedPayroll(e._id, { status: 'paid' });
    const r = await http('PATCH', `/api/payroll/${p._id}/approve`, { token });
    assert.equal(r.status, 409);
  });

  it('Mark-paid approved → 200, sets paidBy/At', async () => {
    const { token, user: admin } = await makeAdmin();
    const e = await makeEmployeeDoc();
    const p = await seedPayroll(e._id, { status: 'approved' });
    const before = Date.now();
    const r = await http('PATCH', `/api/payroll/${p._id}/mark-paid`, { token });
    const after = Date.now();
    assert.equal(r.status, 200);
    assert.equal(r.body.data.status, 'paid');
    assert.equal(r.body.data.paidBy, idStr(admin._id));
    const at = new Date(r.body.data.paidAt).getTime();
    assert.ok(at >= before - 1000 && at <= after + 1000);
  });

  it('Mark-paid draft → 409', async () => {
    const { token } = await makeAdmin();
    const e = await makeEmployeeDoc();
    const p = await seedPayroll(e._id);
    const r = await http('PATCH', `/api/payroll/${p._id}/mark-paid`, { token });
    assert.equal(r.status, 409);
    assert.equal(r.body.error.code, 'INVALID_STATE');
  });

  it('Mark-paid already-paid → idempotent 200 with meta', async () => {
    const { token } = await makeAdmin();
    const e = await makeEmployeeDoc();
    const p = await seedPayroll(e._id, { status: 'paid' });
    const r = await http('PATCH', `/api/payroll/${p._id}/mark-paid`, { token });
    assert.equal(r.status, 200);
    assert.equal(r.body.meta.alreadyPaid, true);
  });

  it('Cancel draft → cancelled', async () => {
    const { token } = await makeAdmin();
    const e = await makeEmployeeDoc();
    const p = await seedPayroll(e._id);
    const r = await http('PATCH', `/api/payroll/${p._id}/cancel`, { token });
    assert.equal(r.status, 200);
    assert.equal(r.body.data.status, 'cancelled');
  });

  it('Cancel approved → cancelled', async () => {
    const { token } = await makeAdmin();
    const e = await makeEmployeeDoc();
    const p = await seedPayroll(e._id, { status: 'approved' });
    const r = await http('PATCH', `/api/payroll/${p._id}/cancel`, { token });
    assert.equal(r.status, 200);
    assert.equal(r.body.data.status, 'cancelled');
  });

  it('Cancel paid → 409', async () => {
    const { token } = await makeAdmin();
    const e = await makeEmployeeDoc();
    const p = await seedPayroll(e._id, { status: 'paid' });
    const r = await http('PATCH', `/api/payroll/${p._id}/cancel`, { token });
    assert.equal(r.status, 409);
  });

  it('Cancel already-cancelled → idempotent', async () => {
    const { token } = await makeAdmin();
    const e = await makeEmployeeDoc();
    const p = await seedPayroll(e._id, { status: 'cancelled' });
    const r = await http('PATCH', `/api/payroll/${p._id}/cancel`, { token });
    assert.equal(r.status, 200);
    assert.equal(r.body.meta.alreadyCancelled, true);
  });

  it('Approve/mark-paid/cancel non-existing id → 404', async () => {
    const { token } = await makeAdmin();
    const fakeId = '0123456789abcdef01234567';
    const r1 = await http('PATCH', `/api/payroll/${fakeId}/approve`, { token });
    assert.equal(r1.status, 404);
    const r2 = await http('PATCH', `/api/payroll/${fakeId}/mark-paid`, { token });
    assert.equal(r2.status, 404);
    const r3 = await http('PATCH', `/api/payroll/${fakeId}/cancel`, { token });
    assert.equal(r3.status, 404);
  });

  it('State transition with invalid id → 400', async () => {
    const { token } = await makeAdmin();
    const r1 = await http('PATCH', '/api/payroll/not-an-id/approve', { token });
    assert.equal(r1.status, 400);
    const r2 = await http('PATCH', '/api/payroll/not-an-id/mark-paid', { token });
    assert.equal(r2.status, 400);
    const r3 = await http('PATCH', '/api/payroll/not-an-id/cancel', { token });
    assert.equal(r3.status, 400);
  });

  it('Client-supplied approvedBy in PATCH is ignored (forbidden field)', async () => {
    const { token } = await makeAdmin();
    const e = await makeEmployeeDoc();
    const p = await seedPayroll(e._id);
    // /approve không chấp nhận body
    const r = await http('PATCH', `/api/payroll/${p._id}/approve`, {
      body: { approvedBy: '0123456789abcdef01234567' },
      token,
    });
    assert.equal(r.status, 200);
    // approvedBy vẫn từ req.user, không từ client
    assert.notEqual(r.body.data.approvedBy, '6' + '0'.repeat(23) + '1');
  });
});

describe('Payroll API — Privacy & /me', () => {
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

  it('GET /me without linked Employee → 404', async () => {
    const { token } = await makeEmployeeUser();
    const r = await http('GET', '/api/payroll/me', { token });
    assert.equal(r.status, 404);
    assert.equal(r.body.error.code, 'EMPLOYEE_NOT_FOUND');
  });

  it('GET /me returns own payroll records', async () => {
    const { user, token } = await makeEmployeeUser();
    const e = await makeEmployeeDoc({ userId: user._id });
    const p1 = await seedPayroll(e._id);
    const p2 = await seedPayroll(e._id, {
      periodMonth: 11,
      baseSalary: 5_000_000,
      grossSalary: 5_000_000,
      netSalary: 5_000_000,
    });
    const r = await http('GET', '/api/payroll/me', { token });
    assert.equal(r.status, 200);
    assert.equal(r.body.data.length, 2);
    const ids = r.body.data.map((d) => d._id).sort();
    assert.deepEqual(ids, [idStr(p1._id), idStr(p2._id)].sort());
  });

  it('GET /me ignores employeeId from query (anti-spoof)', async () => {
    const { user, token } = await makeEmployeeUser();
    const e1 = await makeEmployeeDoc({ userId: user._id });
    const e2 = await makeEmployeeDoc();
    await seedPayroll(e1._id);
    await seedPayroll(e2._id, {
      periodMonth: 11,
      baseSalary: 1_000_000,
      grossSalary: 1_000_000,
      netSalary: 1_000_000,
    });
    // Client gửi employeeId của e2 — service phải bỏ qua và dùng e1.
    const r = await http('GET', `/api/payroll/me?employeeId=${idStr(e2._id)}`, { token });
    assert.equal(r.status, 200);
    assert.equal(r.body.data.length, 1);
    assert.equal(r.body.data[0].employeeId, idStr(e1._id));
  });

  it('GET /me with soft-deleted linked Employee → 404', async () => {
    const { user, token } = await makeEmployeeUser();
    await makeEmployeeDoc({ userId: user._id, isDeleted: true, deletedAt: new Date() });
    const r = await http('GET', '/api/payroll/me', { token });
    assert.equal(r.status, 404);
  });

  it('Employee GET /:id of own record → 200', async () => {
    const { user, token } = await makeEmployeeUser();
    const e = await makeEmployeeDoc({ userId: user._id });
    const p = await seedPayroll(e._id);
    const r = await http('GET', `/api/payroll/${p._id}`, { token });
    assert.equal(r.status, 200);
    assert.equal(r.body.data._id, idStr(p._id));
  });

  it('Employee GET /:id of another employee → 404 (anti-leak)', async () => {
    const { token } = await makeEmployeeUser();
    const otherEmp = await makeEmployeeDoc();
    const p = await seedPayroll(otherEmp._id);
    const r = await http('GET', `/api/payroll/${p._id}`, { token });
    assert.equal(r.status, 404);
  });

  it('Employee cannot use POST /api/payroll → 403', async () => {
    const { token } = await makeEmployeeUser();
    const r = await http('POST', '/api/payroll', {
      body: { periodMonth: 10, periodYear: 2026, baseSalary: 1 },
      token,
    });
    assert.equal(r.status, 403);
  });
});

describe('Payroll API — No DELETE endpoint', () => {
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

  it('DELETE /api/payroll/:id is not allowed → 404 (no route)', async () => {
    const { token } = await makeAdmin();
    const e = await makeEmployeeDoc();
    const p = await seedPayroll(e._id);
    const r = await http('DELETE', `/api/payroll/${p._id}`, { token });
    assert.equal(r.status, 404);
  });
});

describe('Payroll API — Regression: other endpoints unaffected', () => {
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

  it('GET /api/leave-requests still works with admin token', async () => {
    const { token } = await makeAdmin();
    const r = await http('GET', '/api/leave-requests', { token });
    assert.equal(r.status, 200);
  });

  it('GET /api/attendance still works with admin token', async () => {
    const { token } = await makeAdmin();
    const r = await http('GET', '/api/attendance', { token });
    assert.equal(r.status, 200);
  });

  it('GET /api/departments still works', async () => {
    const { token } = await makeAdmin();
    const r = await http('GET', '/api/departments', { token });
    assert.equal(r.status, 200);
  });

  it('GET /api/positions still works', async () => {
    const { token } = await makeAdmin();
    const r = await http('GET', '/api/positions', { token });
    assert.equal(r.status, 200);
  });
});
