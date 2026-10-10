// Integration tests for the Attendance Management API.
// Exercises the full HTTP layer through createApp(), covering:
//  - list (admin), self-history (/me), detail, create, update
//  - Admin vs Employee permission boundaries
//  - Pagination / filter / sort
//  - Validation, date normalization, duplicate detection
//  - Cross-employee data isolation for non-admin users
//  - Regression: auth, health, employee, department, position still work

import { describe, it, before, after, beforeEach } from 'node:test';
import { strict as assert } from 'node:assert';

import { createApp } from '../src/app.js';
import {
  User,
  Employee,
  Department,
  Position,
  Attendance,
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

async function makeAdmin(overrides = {}) {
  return createTestUser({
    email: `admin-${Date.now()}-${Math.random().toString(36).slice(2, 8)}@example.com`,
    role: 'admin',
    ...overrides,
  });
}

async function makeEmployeeUser(overrides = {}) {
  return createTestUser({
    email: `worker-${Date.now()}-${Math.random().toString(36).slice(2, 8)}@example.com`,
    role: 'employee',
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

function basePayload(overrides = {}) {
  return {
    employeeId: '64b000000000000000000000',
    workDate: '2026-10-09',
    status: 'present',
    ...overrides,
  };
}

describe('Attendance API', () => {
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

  // ====================================================================
  // Authorization
  // ====================================================================
  describe('Authorization', () => {
    it('GET / returns 401 without a token', async () => {
      const res = await http('GET', '/api/attendance');
      assert.equal(res.status, 401);
    });

    it('GET / returns 403 for an employee user', async () => {
      const { user } = await makeEmployeeUser();
      const token = await issueTokenFor(user);
      const res = await http('GET', '/api/attendance', { token });
      assert.equal(res.status, 403);
    });

    it('POST / returns 401 without a token', async () => {
      const res = await http('POST', '/api/attendance', { body: basePayload() });
      assert.equal(res.status, 401);
    });

    it('POST / returns 403 for an employee user', async () => {
      const { user } = await makeEmployeeUser();
      const token = await issueTokenFor(user);
      const res = await http('POST', '/api/attendance', {
        body: basePayload(),
        token,
      });
      assert.equal(res.status, 403);
    });

    it('PATCH /:id returns 403 for an employee user', async () => {
      const { user } = await makeEmployeeUser();
      const token = await issueTokenFor(user);
      const res = await http('PATCH', '/api/attendance/64b000000000000000000000', {
        body: { note: 'x' },
        token,
      });
      assert.equal(res.status, 403);
    });

    it('GET /me works for an employee user (linked or not)', async () => {
      const { user } = await makeEmployeeUser();
      const token = await issueTokenFor(user);
      const res = await http('GET', '/api/attendance/me', { token });
      // 200 with empty data is the OK case; 404 if no linked employee.
      assert.ok([200, 404].includes(res.status));
    });

    it('invalid token returns 401', async () => {
      const res = await http('GET', '/api/attendance', { token: 'not-a-jwt' });
      assert.equal(res.status, 401);
    });
  });

  // ====================================================================
  // GET /api/attendance — Admin list
  // ====================================================================
  describe('GET /api/attendance — list (Admin)', () => {
    it('returns 200 with default pagination when empty', async () => {
      const { user } = await makeAdmin();
      const token = await issueTokenFor(user);
      const res = await http('GET', '/api/attendance', { token });
      assert.equal(res.status, 200);
      assert.deepEqual(res.body.data, []);
      assert.equal(res.body.pagination.page, 1);
      assert.equal(res.body.pagination.limit, 10);
      assert.equal(res.body.pagination.total, 0);
    });

    it('respects page and limit', async () => {
      const { user } = await makeAdmin();
      const token = await issueTokenFor(user);
      const e = await makeEmployeeDoc();
      for (let i = 0; i < 7; i++) {
        const day = new Date(Date.UTC(2026, 9, i + 1));
        await Attendance.create({
          employeeId: e._id,
          workDate: day,
          status: 'present',
        });
      }
      const p1 = await http('GET', '/api/attendance?page=1&limit=3', { token });
      assert.equal(p1.body.data.length, 3);
      assert.equal(p1.body.pagination.total, 7);
      const p3 = await http('GET', '/api/attendance?page=3&limit=3', { token });
      assert.equal(p3.body.data.length, 1);
    });

    it('caps limit at 100', async () => {
      const { user } = await makeAdmin();
      const token = await issueTokenFor(user);
      const res = await http('GET', '/api/attendance?limit=500', { token });
      assert.equal(res.status, 400);
      assert.equal(res.body.error.field, 'limit');
    });

    it('rejects non-integer page/limit', async () => {
      const { user } = await makeAdmin();
      const token = await issueTokenFor(user);
      const r1 = await http('GET', '/api/attendance?page=abc', { token });
      assert.equal(r1.status, 400);
      const r2 = await http('GET', '/api/attendance?limit=-1', { token });
      assert.equal(r2.status, 400);
    });

    it('filters by employeeId', async () => {
      const { user } = await makeAdmin();
      const token = await issueTokenFor(user);
      const e1 = await makeEmployeeDoc();
      const e2 = await makeEmployeeDoc();
      await Attendance.create({
        employeeId: e1._id,
        workDate: new Date(Date.UTC(2026, 9, 1)),
        status: 'present',
      });
      await Attendance.create({
        employeeId: e2._id,
        workDate: new Date(Date.UTC(2026, 9, 2)),
        status: 'absent',
      });
      const res = await http(
        'GET',
        `/api/attendance?employeeId=${e1._id.toString()}`,
        { token },
      );
      assert.equal(res.body.data.length, 1);
      assert.equal(res.body.data[0].employeeId, e1._id.toString());
    });

    it('rejects invalid employeeId ObjectId', async () => {
      const { user } = await makeAdmin();
      const token = await issueTokenFor(user);
      const res = await http('GET', '/api/attendance?employeeId=not-an-id', { token });
      assert.equal(res.status, 400);
      assert.equal(res.body.error.field, 'employeeId');
    });

    it('filters by status', async () => {
      const { user } = await makeAdmin();
      const token = await issueTokenFor(user);
      const e = await makeEmployeeDoc();
      await Attendance.create({
        employeeId: e._id,
        workDate: new Date(Date.UTC(2026, 9, 1)),
        status: 'present',
      });
      await Attendance.create({
        employeeId: e._id,
        workDate: new Date(Date.UTC(2026, 9, 2)),
        status: 'absent',
      });
      const res = await http('GET', '/api/attendance?status=absent', { token });
      assert.equal(res.body.data.length, 1);
      assert.equal(res.body.data[0].status, 'absent');
    });

    it('rejects unknown status enum', async () => {
      const { user } = await makeAdmin();
      const token = await issueTokenFor(user);
      const res = await http('GET', '/api/attendance?status=bogus', { token });
      assert.equal(res.status, 400);
    });

    it('filters by startDate and endDate (inclusive)', async () => {
      const { user } = await makeAdmin();
      const token = await issueTokenFor(user);
      const e = await makeEmployeeDoc();
      // 2026-10-01, 2026-10-15, 2026-10-31
      const days = [1, 15, 31];
      for (const d of days) {
        await Attendance.create({
          employeeId: e._id,
          workDate: new Date(Date.UTC(2026, 9, d)),
          status: 'present',
        });
      }
      const res = await http(
        'GET',
        '/api/attendance?startDate=2026-10-10&endDate=2026-10-20',
        { token },
      );
      assert.equal(res.body.data.length, 1);
    });

    it('rejects invalid startDate', async () => {
      const { user } = await makeAdmin();
      const token = await issueTokenFor(user);
      const res = await http('GET', '/api/attendance?startDate=not-a-date', { token });
      assert.equal(res.status, 400);
      assert.equal(res.body.error.field, 'startDate');
    });

    it('rejects startDate after endDate', async () => {
      const { user } = await makeAdmin();
      const token = await issueTokenFor(user);
      const res = await http(
        'GET',
        '/api/attendance?startDate=2026-10-31&endDate=2026-10-01',
        { token },
      );
      assert.equal(res.status, 400);
    });

    it('sorts by allowlist', async () => {
      const { user } = await makeAdmin();
      const token = await issueTokenFor(user);
      const e = await makeEmployeeDoc();
      await Attendance.create({
        employeeId: e._id,
        workDate: new Date(Date.UTC(2026, 9, 1)),
        status: 'present',
      });
      await Attendance.create({
        employeeId: e._id,
        workDate: new Date(Date.UTC(2026, 9, 15)),
        status: 'absent',
      });
      const asc = await http('GET', '/api/attendance?sortBy=workDate&sortOrder=asc', { token });
      assert.equal(asc.body.data[0].status, 'present');
      assert.equal(asc.body.data[1].status, 'absent');
    });

    it('rejects sortBy outside the allowlist', async () => {
      const { user } = await makeAdmin();
      const token = await issueTokenFor(user);
      const res = await http('GET', '/api/attendance?sortBy=note', { token });
      assert.equal(res.status, 400);
    });

    it('rejects sortOrder outside asc/desc', async () => {
      const { user } = await makeAdmin();
      const token = await issueTokenFor(user);
      const res = await http('GET', '/api/attendance?sortOrder=sideways', { token });
      assert.equal(res.status, 400);
    });
  });

  // ====================================================================
  // GET /api/attendance/me — self-history
  // ====================================================================
  describe('GET /api/attendance/me — self-history', () => {
    it('returns 404 when the user has no linked Employee', async () => {
      const { user } = await makeEmployeeUser();
      const token = await issueTokenFor(user);
      const res = await http('GET', '/api/attendance/me', { token });
      assert.equal(res.status, 404);
      assert.equal(res.body.error.code, 'EMPLOYEE_NOT_FOUND');
    });

    it('returns the records of the linked Employee only', async () => {
      const { user: admin } = await makeAdmin();
      const adminToken = await issueTokenFor(admin);

      const { user: worker } = await makeEmployeeUser();
      const workerToken = await issueTokenFor(worker);
      const myEmployee = await makeEmployeeDoc({ userId: worker._id });
      const otherEmployee = await makeEmployeeDoc();

      await Attendance.create({
        employeeId: myEmployee._id,
        workDate: new Date(Date.UTC(2026, 9, 1)),
        status: 'present',
      });
      await Attendance.create({
        employeeId: myEmployee._id,
        workDate: new Date(Date.UTC(2026, 9, 2)),
        status: 'absent',
      });
      await Attendance.create({
        employeeId: otherEmployee._id,
        workDate: new Date(Date.UTC(2026, 9, 3)),
        status: 'late',
      });

      const res = await http('GET', '/api/attendance/me', { token: workerToken });
      assert.equal(res.status, 200);
      assert.equal(res.body.data.length, 2);
      for (const r of res.body.data) {
        assert.equal(r.employeeId, myEmployee._id.toString());
      }
    });

    it('ignores employeeId query param when listing /me', async () => {
      const { user: worker } = await makeEmployeeUser();
      const workerToken = await issueTokenFor(worker);
      const myEmployee = await makeEmployeeDoc({ userId: worker._id });
      const otherEmployee = await makeEmployeeDoc();

      await Attendance.create({
        employeeId: myEmployee._id,
        workDate: new Date(Date.UTC(2026, 9, 1)),
        status: 'present',
      });
      await Attendance.create({
        employeeId: otherEmployee._id,
        workDate: new Date(Date.UTC(2026, 9, 2)),
        status: 'absent',
      });

      // Try to spoof with a different employeeId — must still return own.
      const res = await http(
        'GET',
        `/api/attendance/me?employeeId=${otherEmployee._id.toString()}`,
        { token: workerToken },
      );
      assert.equal(res.status, 200);
      assert.equal(res.body.data.length, 1);
      assert.equal(res.body.data[0].employeeId, myEmployee._id.toString());
    });

    it('paginates /me', async () => {
      const { user: worker } = await makeEmployeeUser();
      const workerToken = await issueTokenFor(worker);
      const myEmployee = await makeEmployeeDoc({ userId: worker._id });
      for (let i = 0; i < 7; i++) {
        await Attendance.create({
          employeeId: myEmployee._id,
          workDate: new Date(Date.UTC(2026, 9, i + 1)),
          status: 'present',
        });
      }
      const res = await http('GET', '/api/attendance/me?page=2&limit=3', { token: workerToken });
      assert.equal(res.status, 200);
      assert.equal(res.body.data.length, 3);
      assert.equal(res.body.pagination.page, 2);
      assert.equal(res.body.pagination.total, 7);
    });

    it('Admin without a linked Employee gets 404 on /me', async () => {
      const { user: admin } = await makeAdmin();
      const token = await issueTokenFor(admin);
      const res = await http('GET', '/api/attendance/me', { token });
      assert.equal(res.status, 404);
    });
  });

  // ====================================================================
  // GET /api/attendance/:id — detail
  // ====================================================================
  describe('GET /api/attendance/:id — detail', () => {
    it('returns 400 for a malformed id', async () => {
      const { user } = await makeAdmin();
      const token = await issueTokenFor(user);
      const res = await http('GET', '/api/attendance/not-an-id', { token });
      assert.equal(res.status, 400);
    });

    it('returns 404 for a valid-but-missing id', async () => {
      const { user } = await makeAdmin();
      const token = await issueTokenFor(user);
      const res = await http('GET', '/api/attendance/64b000000000000000000000', { token });
      assert.equal(res.status, 404);
      assert.equal(res.body.error.code, 'ATTENDANCE_NOT_FOUND');
    });

    it('admin can view any record', async () => {
      const { user } = await makeAdmin();
      const token = await issueTokenFor(user);
      const e = await makeEmployeeDoc();
      const a = await Attendance.create({
        employeeId: e._id,
        workDate: new Date(Date.UTC(2026, 9, 9)),
        status: 'present',
      });
      const res = await http('GET', `/api/attendance/${a._id}`, { token });
      assert.equal(res.status, 200);
      assert.equal(res.body.data.status, 'present');
    });

    it('employee can view their own record', async () => {
      const { user: worker } = await makeEmployeeUser();
      const token = await issueTokenFor(worker);
      const e = await makeEmployeeDoc({ userId: worker._id });
      const a = await Attendance.create({
        employeeId: e._id,
        workDate: new Date(Date.UTC(2026, 9, 9)),
        status: 'present',
      });
      const res = await http('GET', `/api/attendance/${a._id}`, { token });
      assert.equal(res.status, 200);
    });

    it('employee cannot view another employee record (returns 404)', async () => {
      const { user: worker } = await makeEmployeeUser();
      const token = await issueTokenFor(worker);
      const other = await makeEmployeeDoc();
      const a = await Attendance.create({
        employeeId: other._id,
        workDate: new Date(Date.UTC(2026, 9, 9)),
        status: 'present',
      });
      const res = await http('GET', `/api/attendance/${a._id}`, { token });
      assert.equal(res.status, 404);
    });
  });

  // ====================================================================
  // POST /api/attendance — create (Admin)
  // ====================================================================
  describe('POST /api/attendance — create', () => {
    it('admin creates a valid record with HTTP 201', async () => {
      const { user: admin } = await makeAdmin();
      const token = await issueTokenFor(admin);
      const e = await makeEmployeeDoc();
      const res = await http('POST', '/api/attendance', {
        body: basePayload({ employeeId: e._id.toString() }),
        token,
      });
      assert.equal(res.status, 201);
      assert.equal(res.body.data.status, 'present');
      assert.equal(res.body.data.employeeId, e._id.toString());
      assert.equal(res.body.data.workDate, '2026-10-09T00:00:00.000Z');
      assert.equal(res.body.data.createdBy, admin._id.toString());
    });

    it('rejects missing employeeId', async () => {
      const { user } = await makeAdmin();
      const token = await issueTokenFor(user);
      const res = await http('POST', '/api/attendance', {
        body: { workDate: '2026-10-09', status: 'present' },
        token,
      });
      assert.equal(res.status, 400);
      assert.equal(res.body.error.field, 'employeeId');
    });

    it('rejects missing workDate', async () => {
      const { user } = await makeAdmin();
      const token = await issueTokenFor(user);
      const e = await makeEmployeeDoc();
      const res = await http('POST', '/api/attendance', {
        body: { employeeId: e._id.toString(), status: 'present' },
        token,
      });
      assert.equal(res.status, 400);
      assert.equal(res.body.error.field, 'workDate');
    });

    it('rejects non-date workDate (must be YYYY-MM-DD)', async () => {
      const { user } = await makeAdmin();
      const token = await issueTokenFor(user);
      const e = await makeEmployeeDoc();
      const res = await http('POST', '/api/attendance', {
        body: {
          employeeId: e._id.toString(),
          workDate: '2026-10-09T08:00:00.000Z',
          status: 'present',
        },
        token,
      });
      assert.equal(res.status, 400);
      assert.equal(res.body.error.field, 'workDate');
    });

    it('rejects unknown status enum', async () => {
      const { user } = await makeAdmin();
      const token = await issueTokenFor(user);
      const e = await makeEmployeeDoc();
      const res = await http('POST', '/api/attendance', {
        body: basePayload({ employeeId: e._id.toString(), status: 'unknown' }),
        token,
      });
      assert.equal(res.status, 400);
      assert.equal(res.body.error.field, 'status');
    });

    it('rejects non-existent employee', async () => {
      const { user } = await makeAdmin();
      const token = await issueTokenFor(user);
      const res = await http('POST', '/api/attendance', {
        body: basePayload({ employeeId: '64b000000000000000000001' }),
        token,
      });
      assert.equal(res.status, 400);
      assert.equal(res.body.error.field, 'employeeId');
    });

    it('rejects soft-deleted employee', async () => {
      const { user } = await makeAdmin();
      const token = await issueTokenFor(user);
      const e = await makeEmployeeDoc({ isDeleted: true, deletedAt: new Date() });
      const res = await http('POST', '/api/attendance', {
        body: basePayload({ employeeId: e._id.toString() }),
        token,
      });
      assert.equal(res.status, 400);
      assert.equal(res.body.error.field, 'employeeId');
    });

    it('rejects checkOutAt earlier than checkInAt', async () => {
      const { user } = await makeAdmin();
      const token = await issueTokenFor(user);
      const e = await makeEmployeeDoc();
      const res = await http('POST', '/api/attendance', {
        body: basePayload({
          employeeId: e._id.toString(),
          checkInAt: '2026-10-09T08:00:00.000Z',
          checkOutAt: '2026-10-09T07:00:00.000Z',
        }),
        token,
      });
      assert.equal(res.status, 400);
      assert.equal(res.body.error.field, 'checkOutAt');
    });

    it('rejects duplicate (employeeId, workDate) with 409', async () => {
      const { user } = await makeAdmin();
      const token = await issueTokenFor(user);
      const e = await makeEmployeeDoc();
      await http('POST', '/api/attendance', {
        body: basePayload({ employeeId: e._id.toString() }),
        token,
      });
      const res = await http('POST', '/api/attendance', {
        body: basePayload({
          employeeId: e._id.toString(),
          status: 'late',
        }),
        token,
      });
      assert.equal(res.status, 409);
      assert.equal(res.body.error.code, 'DUPLICATE_ATTENDANCE');
    });

    it('rejects unknown fields', async () => {
      const { user } = await makeAdmin();
      const token = await issueTokenFor(user);
      const e = await makeEmployeeDoc();
      const res = await http('POST', '/api/attendance', {
        body: { ...basePayload({ employeeId: e._id.toString() }), createdBy: 'evil' },
        token,
      });
      assert.equal(res.status, 400);
    });

    it('does not trust createdBy / updatedBy from client', async () => {
      const { user: admin } = await makeAdmin();
      const token = await issueTokenFor(admin);
      const e = await makeEmployeeDoc();
      const res = await http('POST', '/api/attendance', {
        body: {
          ...basePayload({ employeeId: e._id.toString() }),
          createdBy: '64b000000000000000000099',
          updatedBy: '64b000000000000000000099',
        },
        token,
      });
      assert.equal(res.status, 400);
    });

    it('does not accept _id, __v, createdAt, updatedAt', async () => {
      const { user } = await makeAdmin();
      const token = await issueTokenFor(user);
      const e = await makeEmployeeDoc();
      const res = await http('POST', '/api/attendance', {
        body: {
          ...basePayload({ employeeId: e._id.toString() }),
          _id: '64b000000000000000000099',
          createdAt: '2000-01-01T00:00:00.000Z',
        },
        token,
      });
      assert.equal(res.status, 400);
    });
  });

  // ====================================================================
  // PATCH /api/attendance/:id — update (Admin)
  // ====================================================================
  describe('PATCH /api/attendance/:id — update', () => {
    it('returns 400 for a malformed id', async () => {
      const { user } = await makeAdmin();
      const token = await issueTokenFor(user);
      const res = await http('PATCH', '/api/attendance/not-an-id', {
        body: { note: 'x' },
        token,
      });
      assert.equal(res.status, 400);
    });

    it('returns 404 for a missing record', async () => {
      const { user } = await makeAdmin();
      const token = await issueTokenFor(user);
      const res = await http('PATCH', '/api/attendance/64b000000000000000000000', {
        body: { note: 'x' },
        token,
      });
      assert.equal(res.status, 404);
    });

    it('rejects empty body', async () => {
      const { user } = await makeAdmin();
      const token = await issueTokenFor(user);
      const e = await makeEmployeeDoc();
      const a = await Attendance.create({
        employeeId: e._id,
        workDate: new Date(Date.UTC(2026, 9, 9)),
        status: 'present',
      });
      const res = await http('PATCH', `/api/attendance/${a._id}`, {
        body: {},
        token,
      });
      assert.equal(res.status, 400);
    });

    it('admin can update allowed fields', async () => {
      const { user: admin } = await makeAdmin();
      const token = await issueTokenFor(admin);
      const e = await makeEmployeeDoc();
      const a = await Attendance.create({
        employeeId: e._id,
        workDate: new Date(Date.UTC(2026, 9, 9)),
        status: 'present',
      });
      const res = await http('PATCH', `/api/attendance/${a._id}`, {
        body: { note: 'Updated', status: 'late' },
        token,
      });
      assert.equal(res.status, 200);
      assert.equal(res.body.data.note, 'Updated');
      assert.equal(res.body.data.status, 'late');
      assert.equal(res.body.data.updatedBy, admin._id.toString());
    });

    it('rejects fields outside the allowlist', async () => {
      const { user } = await makeAdmin();
      const token = await issueTokenFor(user);
      const e = await makeEmployeeDoc();
      const a = await Attendance.create({
        employeeId: e._id,
        workDate: new Date(Date.UTC(2026, 9, 9)),
        status: 'present',
      });
      const r1 = await http('PATCH', `/api/attendance/${a._id}`, {
        body: { _id: 'fake' },
        token,
      });
      assert.equal(r1.status, 400);
      const r2 = await http('PATCH', `/api/attendance/${a._id}`, {
        body: { createdBy: 'fake' },
        token,
      });
      assert.equal(r2.status, 400);
      const r3 = await http('PATCH', `/api/attendance/${a._id}`, {
        body: { createdAt: '2000-01-01T00:00:00.000Z' },
        token,
      });
      assert.equal(r3.status, 400);
    });

    it('rejects unknown status enum on update', async () => {
      const { user } = await makeAdmin();
      const token = await issueTokenFor(user);
      const e = await makeEmployeeDoc();
      const a = await Attendance.create({
        employeeId: e._id,
        workDate: new Date(Date.UTC(2026, 9, 9)),
        status: 'present',
      });
      const res = await http('PATCH', `/api/attendance/${a._id}`, {
        body: { status: 'bogus' },
        token,
      });
      assert.equal(res.status, 400);
    });

    it('rejects non-existent employee on update', async () => {
      const { user } = await makeAdmin();
      const token = await issueTokenFor(user);
      const e = await makeEmployeeDoc();
      const a = await Attendance.create({
        employeeId: e._id,
        workDate: new Date(Date.UTC(2026, 9, 9)),
        status: 'present',
      });
      const res = await http('PATCH', `/api/attendance/${a._id}`, {
        body: { employeeId: '64b000000000000000000010' },
        token,
      });
      assert.equal(res.status, 400);
    });

    it('rejects duplicate (employeeId, workDate) after update', async () => {
      const { user } = await makeAdmin();
      const token = await issueTokenFor(user);
      const e1 = await makeEmployeeDoc();
      const e2 = await makeEmployeeDoc();
      await Attendance.create({
        employeeId: e1._id,
        workDate: new Date(Date.UTC(2026, 9, 9)),
        status: 'present',
      });
      const a2 = await Attendance.create({
        employeeId: e2._id,
        workDate: new Date(Date.UTC(2026, 9, 9)),
        status: 'absent',
      });
      // Try to move a2 to e1's (date, employee) — should conflict.
      const res = await http('PATCH', `/api/attendance/${a2._id}`, {
        body: { employeeId: e1._id.toString() },
        token,
      });
      assert.equal(res.status, 409);
      assert.equal(res.body.error.code, 'DUPLICATE_ATTENDANCE');
    });

    it('can clear checkOutAt by sending null', async () => {
      const { user } = await makeAdmin();
      const token = await issueTokenFor(user);
      const e = await makeEmployeeDoc();
      const a = await Attendance.create({
        employeeId: e._id,
        workDate: new Date(Date.UTC(2026, 9, 9)),
        checkInAt: new Date('2026-10-09T08:00:00.000Z'),
        checkOutAt: new Date('2026-10-09T17:00:00.000Z'),
        status: 'present',
      });
      const res = await http('PATCH', `/api/attendance/${a._id}`, {
        body: { checkOutAt: null },
        token,
      });
      assert.equal(res.status, 200);
      assert.equal(res.body.data.checkOutAt, null);
    });

    it('can change workDate if no collision', async () => {
      const { user } = await makeAdmin();
      const token = await issueTokenFor(user);
      const e = await makeEmployeeDoc();
      const a = await Attendance.create({
        employeeId: e._id,
        workDate: new Date(Date.UTC(2026, 9, 1)),
        status: 'present',
      });
      const res = await http('PATCH', `/api/attendance/${a._id}`, {
        body: { workDate: '2026-10-15' },
        token,
      });
      assert.equal(res.status, 200);
      assert.equal(res.body.data.workDate, '2026-10-15T00:00:00.000Z');
    });
  });

  // ====================================================================
  // Regression — other endpoints still work
  // ====================================================================
  describe('Regression — other endpoints still work', () => {
    it('GET /api/health returns 200', async () => {
      const res = await http('GET', '/api/health');
      assert.equal(res.status, 200);
    });

    it('GET /api/auth/admin-check works for admin', async () => {
      const { user } = await makeAdmin();
      const token = await issueTokenFor(user);
      const res = await http('GET', '/api/auth/admin-check', { token });
      assert.equal(res.status, 200);
    });

    it('GET /api/employees still works (Phase 4 regression)', async () => {
      const { user } = await makeAdmin();
      const token = await issueTokenFor(user);
      const res = await http('GET', '/api/employees', { token });
      assert.equal(res.status, 200);
    });

    it('GET /api/departments still works (Phase 5 regression)', async () => {
      const { user } = await makeAdmin();
      const token = await issueTokenFor(user);
      const res = await http('GET', '/api/departments', { token });
      assert.equal(res.status, 200);
    });

    it('GET /api/positions still works (Phase 5 regression)', async () => {
      const { user } = await makeAdmin();
      const token = await issueTokenFor(user);
      const res = await http('GET', '/api/positions', { token });
      assert.equal(res.status, 200);
    });
  });
});
