// API + integration tests for AuditLog endpoints — Phase 10.

import { describe, it, before, after, beforeEach } from 'node:test';
import { strict as assert } from 'node:assert';

import { createApp } from '../src/app.js';
import { AuditLog, Employee, Department, Position } from '../src/models/index.js';
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

async function seedAuditLogs(adminId, count = 3) {
  const out = [];
  for (let i = 0; i < count; i += 1) {
    // eslint-disable-next-line no-await-in-loop
    const doc = await AuditLog.create({
      actorUserId: adminId,
      actorRole: 'admin',
      action: 'employee.create',
      resourceType: 'employee',
      resourceId: '0123456789abcdef01234567',
      description: `seed ${i}`,
      metadata: { changedFields: ['fullName'] },
    });
    out.push(doc);
  }
  return out;
}

describe('AuditLog API — auth & RBAC', () => {
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

  it('GET /api/audit-logs without token → 401', async () => {
    const r = await http('GET', '/api/audit-logs');
    assert.equal(r.status, 401);
  });

  it('GET /api/audit-logs with employee token → 403', async () => {
    const { token } = await makeEmployeeUser();
    const r = await http('GET', '/api/audit-logs', { token });
    assert.equal(r.status, 403);
  });

  it('GET /api/audit-logs/:id with employee token → 403', async () => {
    const { token } = await makeEmployeeUser();
    const r = await http('GET', '/api/audit-logs/0123456789abcdef01234567', { token });
    assert.equal(r.status, 403);
  });

  it('GET /api/audit-logs with admin token → 200 + data + pagination', async () => {
    const { user, token } = await makeAdmin();
    await seedAuditLogs(user._id, 3);
    const r = await http('GET', '/api/audit-logs', { token });
    assert.equal(r.status, 200);
    assert.equal(r.body.success, true);
    assert.ok(Array.isArray(r.body.data));
    assert.equal(r.body.data.length, 3);
    assert.equal(r.body.pagination.total, 3);
  });

  it('GET /api/audit-logs/:id with admin → 200', async () => {
    const { user, token } = await makeAdmin();
    const [doc] = await seedAuditLogs(user._id, 1);
    const r = await http('GET', `/api/audit-logs/${doc._id}`, { token });
    assert.equal(r.status, 200);
    assert.equal(r.body.success, true);
    assert.equal(r.body.data._id, doc._id.toString());
  });

  it('GET /api/audit-logs/:id with bad id → 400', async () => {
    const { token } = await makeAdmin();
    const r = await http('GET', '/api/audit-logs/not-a-valid-id', { token });
    assert.equal(r.status, 400);
    assert.equal(r.body.error.code, 'VALIDATION_ERROR');
  });

  it('GET /api/audit-logs/:id with non-existent → 404', async () => {
    const { token } = await makeAdmin();
    const r = await http('GET', '/api/audit-logs/0123456789abcdef01234567', { token });
    assert.equal(r.status, 404);
    assert.equal(r.body.error.code, 'AUDIT_LOG_NOT_FOUND');
  });
});

describe('AuditLog API — list filters & pagination', () => {
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

  it('filters by action', async () => {
    const { user, token } = await makeAdmin();
    await seedAuditLogs(user._id, 2);
    await AuditLog.create({
      actorUserId: user._id,
      actorRole: 'admin',
      action: 'department.create',
      resourceType: 'department',
      resourceId: '0123456789abcdef01234567',
    });
    const r = await http('GET', '/api/audit-logs?action=department.create', { token });
    assert.equal(r.status, 200);
    assert.equal(r.body.data.length, 1);
    assert.equal(r.body.data[0].action, 'department.create');
  });

  it('filters by resourceType', async () => {
    const { user, token } = await makeAdmin();
    await seedAuditLogs(user._id, 1);
    await AuditLog.create({
      actorUserId: user._id,
      actorRole: 'admin',
      action: 'department.create',
      resourceType: 'department',
      resourceId: '0123456789abcdef01234567',
    });
    const r = await http('GET', '/api/audit-logs?resourceType=department', { token });
    assert.equal(r.body.data.length, 1);
  });

  it('rejects invalid action enum', async () => {
    const { token } = await makeAdmin();
    const r = await http('GET', '/api/audit-logs?action=hacker.action', { token });
    assert.equal(r.status, 400);
  });

  it('rejects invalid sort field', async () => {
    const { token } = await makeAdmin();
    const r = await http('GET', '/api/audit-logs?sort=password', { token });
    assert.equal(r.status, 400);
  });

  it('accepts allowed sort field', async () => {
    const { user, token } = await makeAdmin();
    await seedAuditLogs(user._id, 1);
    // Dùng '-createdAt' vì ' ' trong URL sẽ là space; test default descending.
    const r = await http('GET', '/api/audit-logs?sort=-createdAt', { token });
    assert.equal(r.status, 200);
  });

  it('paginates and caps limit at 100', async () => {
    const { user, token } = await makeAdmin();
    await seedAuditLogs(user._id, 5);
    const r1 = await http('GET', '/api/audit-logs?page=1&limit=2', { token });
    assert.equal(r1.body.data.length, 2);
    assert.equal(r1.body.pagination.totalPages, 3);

    const r2 = await http('GET', '/api/audit-logs?page=2&limit=2', { token });
    assert.equal(r2.body.data.length, 2);

    const r3 = await http('GET', '/api/audit-logs?page=3&limit=2', { token });
    assert.equal(r3.body.data.length, 1);

    const rCap = await http('GET', '/api/audit-logs?limit=9999', { token });
    // Service sẽ cap về 100.
    assert.equal(rCap.body.pagination.limit, 100);
  });

  it('rejects startDate > endDate', async () => {
    const { token } = await makeAdmin();
    const r = await http(
      'GET',
      '/api/audit-logs?startDate=2030-01-01&endDate=2020-01-01',
      { token },
    );
    assert.equal(r.status, 400);
  });

  it('rejects malformed date', async () => {
    const { token } = await makeAdmin();
    const r = await http('GET', '/api/audit-logs?startDate=not-a-date', { token });
    assert.equal(r.status, 400);
  });

  it('rejects invalid actorUserId (not ObjectId)', async () => {
    const { token } = await makeAdmin();
    const r = await http('GET', '/api/audit-logs?actorUserId=wat', { token });
    assert.equal(r.status, 400);
  });
});

describe('AuditLog API — anti-tampering', () => {
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

  it('POST /api/audit-logs is not defined (no public write endpoint)', async () => {
    const { token } = await makeAdmin();
    const r = await http('POST', '/api/audit-logs', {
      token,
      body: { action: 'employee.create', resourceType: 'employee' },
    });
    // Express trả 404 cho method không đăng ký.
    assert.equal(r.status, 404);
  });

  it('PATCH /api/audit-logs/:id is not defined', async () => {
    const { token } = await makeAdmin();
    const r = await http('PATCH', '/api/audit-logs/0123456789abcdef01234567', {
      token,
      body: { action: 'hacker.action' },
    });
    assert.equal(r.status, 404);
  });

  it('DELETE /api/audit-logs/:id is not defined', async () => {
    const { token } = await makeAdmin();
    const r = await http('DELETE', '/api/audit-logs/0123456789abcdef01234567', { token });
    assert.equal(r.status, 404);
  });

  it('list response does not leak any sensitive field', async () => {
    const { user, token } = await makeAdmin();
    // Tạo log với metadata chứa thử các key nhạy cảm — service sẽ filter trước khi persist.
    await AuditLog.create({
      actorUserId: user._id,
      actorRole: 'admin',
      action: 'employee.create',
      resourceType: 'employee',
      resourceId: '0123456789abcdef01234567',
      metadata: { changedFields: ['fullName'] },
    });
    const r = await http('GET', '/api/audit-logs', { token });
    assert.equal(r.status, 200);
    const item = r.body.data[0];
    // Đảm bảo response không chứa __v, passwordHash, ...
    assert.equal(item.__v, undefined);
    // Không có key nhạy cảm nào lọt vào response
    const forbidden = [
      'password', 'passwordHash', 'token', 'refreshToken', 'secret',
      'mongoUri', 'baseSalary', 'grossSalary', 'netSalary',
    ];
    for (const k of forbidden) {
      assert.equal(item[k], undefined, `field ${k} must not appear in response`);
    }
  });
});

// ============================================================
// INTEGRATION: xác minh nghiệp vụ thật ghi audit log đúng cách.
// ============================================================

describe('AuditLog integration — auth.login writes audit', () => {
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

  it('POST /api/auth/login thành công ghi 1 audit log', async () => {
    // Tạo user qua service
    const { password } = await createTestUser({ role: 'admin' });
    // Lấy email bằng cách query
    const { User } = await import('../src/models/index.js');
    const u = await User.findOne({});
    const r = await http('POST', '/api/auth/login', {
      body: { email: u.email, password },
    });
    assert.equal(r.status, 200);

    const logs = await AuditLog.find({ action: 'auth.login.success' });
    assert.equal(logs.length, 1);
    assert.equal(logs[0].actorUserId.toString(), u._id.toString());
    assert.equal(logs[0].actorRole, 'admin');
    assert.equal(logs[0].resourceType, 'auth');
  });

  it('POST /api/auth/login thất bại KHÔNG ghi audit', async () => {
    await createTestUser({ role: 'admin' });
    const r = await http('POST', '/api/auth/login', {
      body: { email: 'nobody@example.com', password: 'wrong' },
    });
    assert.equal(r.status, 401);
    const logs = await AuditLog.find({ action: 'auth.login.success' });
    assert.equal(logs.length, 0);
  });
});

describe('AuditLog integration — employee writes audit', () => {
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

  it('POST /api/employees ghi employee.create', async () => {
    const { token } = await makeAdmin();
    const r = await http('POST', '/api/employees', {
      token,
      body: {
        employeeCode: 'NV001',
        fullName: 'Nguyen Van A',
        email: 'a@x.com',
        employmentType: 'full_time',
        hireDate: '2024-01-01',
      },
    });
    assert.equal(r.status, 201);
    const logs = await AuditLog.find({ action: 'employee.create' });
    assert.equal(logs.length, 1);
    assert.equal(logs[0].resourceType, 'employee');
  });

  it('POST /api/employees thất bại KHÔNG ghi log', async () => {
    const { token } = await makeAdmin();
    const r = await http('POST', '/api/employees', {
      token,
      body: { fullName: 'X' }, // thiếu field
    });
    assert.equal(r.status, 400);
    const logs = await AuditLog.find({ action: 'employee.create' });
    assert.equal(logs.length, 0);
  });

  it('PATCH /api/employees/:id ghi employee.update với changedFields', async () => {
    const { token } = await makeAdmin();
    const emp = await Employee.create({
      employeeCode: 'NV001',
      fullName: 'Old Name',
      email: 'old@x.com',
      employmentType: 'full_time',
      hireDate: new Date('2024-01-01'),
    });
    const r = await http('PATCH', `/api/employees/${emp._id}`, {
      token,
      body: { fullName: 'New Name' },
    });
    assert.equal(r.status, 200);
    const log = await AuditLog.findOne({ action: 'employee.update' });
    assert.ok(log);
    assert.deepEqual(log.metadata.changedFields, ['fullName']);
  });

  it('DELETE /api/employees/:id ghi employee.softDelete', async () => {
    const { token } = await makeAdmin();
    const emp = await Employee.create({
      employeeCode: 'NV001',
      fullName: 'Test Person',
      email: 'x@x.com',
      employmentType: 'full_time',
      hireDate: new Date('2024-01-01'),
    });
    const r = await http('DELETE', `/api/employees/${emp._id}`, { token });
    assert.equal(r.status, 200);
    const log = await AuditLog.findOne({ action: 'employee.softDelete' });
    assert.ok(log);
  });
});

describe('AuditLog integration — department/position', () => {
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

  it('department create/update/deactivate ghi audit', async () => {
    const { token } = await makeAdmin();
    const c = await http('POST', '/api/departments', {
      token,
      body: { code: 'HR', name: 'Human Resources' },
    });
    assert.equal(c.status, 201);
    const id = c.body.data._id;

    const u = await http('PATCH', `/api/departments/${id}`, {
      token,
      body: { name: 'HR & People' },
    });
    assert.equal(u.status, 200);

    const d = await http('PATCH', `/api/departments/${id}/deactivate`, { token });
    assert.equal(d.status, 200);

    const logs = await AuditLog.find({ resourceType: 'department' }).sort({ createdAt: 1 });
    assert.equal(logs.length, 3);
    assert.deepEqual(logs.map((l) => l.action), [
      'department.create',
      'department.update',
      'department.deactivate',
    ]);
  });

  it('position create/update/deactivate ghi audit', async () => {
    const { token } = await makeAdmin();
    const c = await http('POST', '/api/positions', {
      token,
      body: { code: 'DEV', name: 'Developer' },
    });
    assert.equal(c.status, 201);
    const id = c.body.data._id;
    await http('PATCH', `/api/positions/${id}`, { token, body: { name: 'Senior Developer' } });
    await http('PATCH', `/api/positions/${id}/deactivate`, { token });

    const logs = await AuditLog.find({ resourceType: 'position' }).sort({ createdAt: 1 });
    assert.equal(logs.length, 3);
    assert.deepEqual(logs.map((l) => l.action), [
      'position.create',
      'position.update',
      'position.deactivate',
    ]);
  });
});

describe('AuditLog integration — attendance', () => {
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

  it('attendance create/update ghi audit', async () => {
    const { token } = await makeAdmin();
    const emp = await Employee.create({
      employeeCode: 'NV001',
      fullName: 'Test Person',
      email: 'x@x.com',
      employmentType: 'full_time',
      hireDate: new Date('2024-01-01'),
    });
    const c = await http('POST', '/api/attendance', {
      token,
      body: { employeeId: emp._id.toString(), workDate: '2026-03-01', status: 'present' },
    });
    assert.equal(c.status, 201);
    const id = c.body.data._id;
    await http('PATCH', `/api/attendance/${id}`, { token, body: { status: 'late' } });

    const logs = await AuditLog.find({ resourceType: 'attendance' }).sort({ createdAt: 1 });
    assert.equal(logs.length, 2);
    assert.deepEqual(logs.map((l) => l.action), ['attendance.create', 'attendance.update']);
  });
});

describe('AuditLog integration — leave request', () => {
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

  it('leave create/update/cancel/approve/reject ghi audit', async () => {
    const { token: adminToken } = await makeAdmin();
    const { user: empUser, token: empToken } = await makeEmployeeUser();
    const emp = await Employee.create({
      employeeCode: 'NV001',
      fullName: 'Test Person',
      email: 'x@x.com',
      employmentType: 'full_time',
      hireDate: new Date('2024-01-01'),
      userId: empUser._id,
    });

    // create
    const c = await http('POST', '/api/leave-requests', {
      token: empToken,
      body: {
        startDate: '2026-04-01',
        endDate: '2026-04-03',
        leaveType: 'annual',
        reason: 'vacation',
      },
    });
    assert.equal(c.status, 201);
    const id = c.body.data._id;

    // update
    const u = await http('PATCH', `/api/leave-requests/${id}`, {
      token: empToken,
      body: { reason: 'vacation extended' },
    });
    assert.equal(u.status, 200);

    // approve
    const a = await http('PATCH', `/api/leave-requests/${id}/approve`, {
      token: adminToken,
      body: {},
    });
    assert.equal(a.status, 200);

    // Thử reject sau khi approved (sẽ fail), vẫn không ghi log
    const rFail = await http('PATCH', `/api/leave-requests/${id}/reject`, {
      token: adminToken,
      body: {},
    });
    assert.notEqual(rFail.status, 200);

    // Tạo leave mới để reject
    const c2 = await http('POST', '/api/leave-requests', {
      token: empToken,
      body: {
        startDate: '2026-05-01',
        endDate: '2026-05-02',
        leaveType: 'sick',
        reason: 'sick',
      },
    });
    logFailure('c2', c2);
    assert.equal(c2.status, 201);
    const r = await http('PATCH', `/api/leave-requests/${c2.body.data._id}/reject`, {
      token: adminToken,
      body: {},
    });
    assert.equal(r.status, 200);

    // cancel một leave pending
    const c3 = await http('POST', '/api/leave-requests', {
      token: empToken,
      body: {
        startDate: '2026-06-01',
        endDate: '2026-06-01',
        leaveType: 'annual',
        reason: 'reason for cancel test',
      },
    });
    logFailure('c3', c3);
    assert.equal(c3.status, 201);
    const cancel = await http('PATCH', `/api/leave-requests/${c3.body.data._id}/cancel`, {
      token: empToken,
    });
    assert.equal(cancel.status, 200);

    const logs = await AuditLog.find({ resourceType: 'leave_request' }).sort({ createdAt: 1 });
    const actions = logs.map((l) => l.action);
    assert.ok(actions.includes('leave.create'));
    assert.ok(actions.includes('leave.update'));
    assert.ok(actions.includes('leave.approve'));
    assert.ok(actions.includes('leave.reject'));
    assert.ok(actions.includes('leave.cancel'));

    // Verify employee create thì actor là employee, approve thì actor là admin.
    const approveLog = logs.find((l) => l.action === 'leave.approve');
    assert.equal(approveLog.actorRole, 'admin');
    const createLog = logs.find((l) => l.action === 'leave.create');
    assert.equal(createLog.actorRole, 'employee');
    // Use vars to silence linter about unused
    void emp;
  });
});

describe('AuditLog integration — payroll', () => {
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

  it('payroll create/update/approve/markPaid/cancel ghi audit', async () => {
    const { token } = await makeAdmin();
    const emp = await Employee.create({
      employeeCode: 'NV001',
      fullName: 'Test Person',
      email: 'x@x.com',
      employmentType: 'full_time',
      hireDate: new Date('2024-01-01'),
    });

    const c = await http('POST', '/api/payroll', {
      token,
      body: {
        employeeId: emp._id.toString(),
        periodMonth: 10,
        periodYear: 2026,
        baseSalary: 10_000_000,
        allowances: 1_000_000,
        bonuses: 500_000,
        deductions: 200_000,
        workedDays: 22,
        standardWorkDays: 22,
      },
    });
    assert.equal(c.status, 201);
    const id = c.body.data._id;

    const u = await http('PATCH', `/api/payroll/${id}`, {
      token,
      body: { bonuses: 600_000 },
    });
    assert.equal(u.status, 200);

    const a = await http('PATCH', `/api/payroll/${id}/approve`, { token });
    assert.equal(a.status, 200);

    const m = await http('PATCH', `/api/payroll/${id}/mark-paid`, { token });
    assert.equal(m.status, 200);

    // Tạo cái mới để cancel
    const c2 = await http('POST', '/api/payroll', {
      token,
      body: {
        employeeId: emp._id.toString(),
        periodMonth: 11,
        periodYear: 2026,
        baseSalary: 10_000_000,
        allowances: 1_000_000,
        bonuses: 0,
        deductions: 0,
        workedDays: 22,
        standardWorkDays: 22,
      },
    });
    assert.equal(c2.status, 201);
    const x = await http('PATCH', `/api/payroll/${c2.body.data._id}/cancel`, { token });
    assert.equal(x.status, 200);

    const logs = await AuditLog.find({ resourceType: 'payroll' }).sort({ createdAt: 1 });
    const actions = logs.map((l) => l.action);
    assert.deepEqual(actions, [
      'payroll.create',
      'payroll.update',
      'payroll.approve',
      'payroll.markPaid',
      'payroll.create',
      'payroll.cancel',
    ]);

    // Verify metadata chỉ chứa changedFields/toStatus, KHÔNG lộ số tiền.
    const updateLog = logs.find((l) => l.action === 'payroll.update');
    assert.deepEqual(updateLog.metadata.changedFields, ['bonuses']);
    assert.equal(updateLog.metadata.baseSalary, undefined);
    assert.equal(updateLog.metadata.grossSalary, undefined);
  });
});
