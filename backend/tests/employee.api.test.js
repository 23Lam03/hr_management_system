// Integration tests for the Employee Management API.
// Exercises the full HTTP layer through createApp(), covering:
//  - list, detail, create, update, soft-delete
//  - Admin vs Employee permission boundaries
//  - Pagination / search / filter / sort
//  - Soft-delete idempotency
//  - Validation & error responses
//  - Regression: auth + health still work

import { describe, it, before, after, beforeEach } from 'node:test';
import { strict as assert } from 'node:assert';
import mongoose from 'mongoose';

import { createApp } from '../src/app.js';
import {
  User,
  Employee,
  Department,
  Position,
} from '../src/models/index.js';
import { setupTestDb, clearTestDb, teardownTestDb } from './helpers/db.js';
import { createTestUser, TEST_PASSWORD, issueTokenFor } from './helpers/auth.js';

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

async function http(method, path, { body, token, headers } = {}) {
  const opts = { method, headers: { 'Content-Type': 'application/json' } };
  if (body !== undefined) opts.body = JSON.stringify(body);
  if (token) opts.headers.Authorization = `Bearer ${token}`;
  if (headers) Object.assign(opts.headers, headers);
  const res = await fetch(`http://127.0.0.1:${port}${path}`, opts);
  let payload = null;
  const ct = res.headers.get('content-type') || '';
  if (ct.includes('application/json')) {
    payload = await res.json();
  } else {
    payload = await res.text();
  }
  return { status: res.status, body: payload };
}

async function makeAdmin() {
  return createTestUser({
    email: `admin-${Date.now()}-${Math.random().toString(36).slice(2, 8)}@example.com`,
    role: 'admin',
  });
}

async function makeEmployee(overrides = {}) {
  return createTestUser({
    email: `worker-${Date.now()}-${Math.random().toString(36).slice(2, 8)}@example.com`,
    role: 'employee',
    ...overrides,
  });
}

function basePayload(overrides = {}) {
  return {
    employeeCode: 'NV0001',
    fullName: 'Alice Person',
    email: 'alice@example.com',
    employmentType: 'full_time',
    hireDate: '2024-01-01',
    ...overrides,
  };
}

describe('Employee API', () => {
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
  // GET /api/employees — List
  // ====================================================================
  describe('GET /api/employees — list', () => {
    it('returns 401 without a token', async () => {
      const res = await http('GET', '/api/employees');
      assert.equal(res.status, 401);
    });

    it('returns 403 for an employee user (admin only)', async () => {
      const { user } = await makeEmployee();
      const token = await issueTokenFor(user);
      const res = await http('GET', '/api/employees', { token });
      assert.equal(res.status, 403);
      assert.equal(res.body.error.code, 'FORBIDDEN');
    });

    it('returns 200 + pagination meta for admin with no data', async () => {
      const { user } = await makeAdmin();
      const token = await issueTokenFor(user);
      const res = await http('GET', '/api/employees', { token });
      assert.equal(res.status, 200);
      assert.equal(res.body.success, true);
      assert.deepEqual(res.body.data, []);
      assert.equal(res.body.pagination.page, 1);
      assert.equal(res.body.pagination.limit, 10);
      assert.equal(res.body.pagination.total, 0);
      assert.equal(res.body.pagination.totalPages, 0);
    });

    it('returns the list for admin with default pagination', async () => {
      const { user } = await makeAdmin();
      const token = await issueTokenFor(user);
      for (let i = 0; i < 12; i++) {
        await Employee.create({
          employeeCode: `NV${String(i + 1).padStart(4, '0')}`,
          fullName: `Person ${i + 1}`,
          email: `p${i + 1}@example.com`,
          employmentType: 'full_time',
          hireDate: new Date('2024-01-01'),
        });
      }
      const res = await http('GET', '/api/employees', { token });
      assert.equal(res.status, 200);
      assert.equal(res.body.data.length, 10);
      assert.equal(res.body.pagination.total, 12);
      assert.equal(res.body.pagination.totalPages, 2);
    });

    it('respects page and limit query params', async () => {
      const { user } = await makeAdmin();
      const token = await issueTokenFor(user);
      for (let i = 0; i < 7; i++) {
        await Employee.create({
          employeeCode: `NV${String(i + 1).padStart(4, '0')}`,
          fullName: `Person ${i + 1}`,
          email: `p${i + 1}@example.com`,
          employmentType: 'full_time',
          hireDate: new Date('2024-01-01'),
        });
      }
      const p1 = await http('GET', '/api/employees?page=1&limit=3', { token });
      assert.equal(p1.body.data.length, 3);
      assert.equal(p1.body.pagination.page, 1);
      assert.equal(p1.body.pagination.total, 7);
      const p3 = await http('GET', '/api/employees?page=3&limit=3', { token });
      assert.equal(p3.body.data.length, 1);
    });

    it('caps limit at 100', async () => {
      const { user } = await makeAdmin();
      const token = await issueTokenFor(user);
      const res = await http('GET', '/api/employees?limit=500', { token });
      assert.equal(res.status, 400);
      assert.equal(res.body.error.code, 'VALIDATION_ERROR');
      assert.equal(res.body.error.field, 'limit');
    });

    it('rejects non-integer page/limit', async () => {
      const { user } = await makeAdmin();
      const token = await issueTokenFor(user);
      const r1 = await http('GET', '/api/employees?page=abc', { token });
      assert.equal(r1.status, 400);
      const r2 = await http('GET', '/api/employees?limit=0', { token });
      assert.equal(r2.status, 400);
      const r3 = await http('GET', '/api/employees?page=-1', { token });
      assert.equal(r3.status, 400);
    });

    it('searches by fullName, employeeCode, and email', async () => {
      const { user } = await makeAdmin();
      const token = await issueTokenFor(user);
      await Employee.create({
        employeeCode: 'NV0001',
        fullName: 'Alice Wonderland',
        email: 'alice@example.com',
        employmentType: 'full_time',
        hireDate: new Date('2024-01-01'),
      });
      await Employee.create({
        employeeCode: 'NV0002',
        fullName: 'Bob Builder',
        email: 'bob@example.com',
        employmentType: 'full_time',
        hireDate: new Date('2024-01-01'),
      });
      await Employee.create({
        employeeCode: 'NV-LEAD',
        fullName: 'Carol Singer',
        email: 'carol@example.com',
        employmentType: 'full_time',
        hireDate: new Date('2024-01-01'),
      });

      const byName = await http('GET', '/api/employees?search=Alice', { token });
      assert.equal(byName.body.data.length, 1);
      assert.equal(byName.body.data[0].fullName, 'Alice Wonderland');

      const byCode = await http('GET', '/api/employees?search=NV-LEAD', { token });
      assert.equal(byCode.body.data.length, 1);
      assert.equal(byCode.body.data[0].employeeCode, 'NV-LEAD');

      const byEmail = await http('GET', '/api/employees?search=bob@example.com', { token });
      assert.equal(byEmail.body.data.length, 1);
      assert.equal(byEmail.body.data[0].email, 'bob@example.com');
    });

    it('escapes regex metacharacters in search (does not change query logic)', async () => {
      const { user } = await makeAdmin();
      const token = await issueTokenFor(user);
      await Employee.create({
        employeeCode: 'NV0001',
        fullName: 'Alice .* Example',
        email: 'a@example.com',
        employmentType: 'full_time',
        hireDate: new Date('2024-01-01'),
      });
      await Employee.create({
        employeeCode: 'NV0002',
        fullName: 'Bob Builder',
        email: 'b@example.com',
        employmentType: 'full_time',
        hireDate: new Date('2024-01-01'),
      });
      // Search string with regex metacharacters should match as a
      // substring, not as a regex pattern that returns everything.
      const res = await http('GET', '/api/employees?search=.*', { token });
      assert.equal(res.status, 200);
      assert.equal(res.body.data.length, 1);
      assert.equal(res.body.data[0].fullName, 'Alice .* Example');
    });

    it('filters by departmentId, positionId, and employmentStatus', async () => {
      const { user } = await makeAdmin();
      const token = await issueTokenFor(user);
      const dept1 = await Department.create({ name: 'IT', code: 'IT' });
      const dept2 = await Department.create({ name: 'HR', code: 'HR' });
      const pos1 = await Position.create({
        name: 'Engineer',
        code: 'ENG',
        departmentId: dept1._id,
      });
      const pos2 = await Position.create({
        name: 'Recruiter',
        code: 'REC',
        departmentId: dept2._id,
      });

      await Employee.create({
        employeeCode: 'NV0001',
        fullName: 'Alice',
        email: 'a@example.com',
        employmentType: 'full_time',
        hireDate: new Date('2024-01-01'),
        departmentId: dept1._id,
        positionId: pos1._id,
        employmentStatus: 'active',
      });
      await Employee.create({
        employeeCode: 'NV0002',
        fullName: 'Bob',
        email: 'b@example.com',
        employmentType: 'full_time',
        hireDate: new Date('2024-01-01'),
        departmentId: dept2._id,
        positionId: pos2._id,
        employmentStatus: 'on_leave',
      });

      const r1 = await http(
        'GET',
        `/api/employees?departmentId=${dept1._id.toString()}`,
        { token },
      );
      assert.equal(r1.body.data.length, 1);
      assert.equal(r1.body.data[0].fullName, 'Alice');

      const r2 = await http(
        'GET',
        `/api/employees?positionId=${pos2._id.toString()}`,
        { token },
      );
      assert.equal(r2.body.data.length, 1);

      const r3 = await http(
        'GET',
        '/api/employees?employmentStatus=on_leave',
        { token },
      );
      assert.equal(r3.body.data.length, 1);
      assert.equal(r3.body.data[0].fullName, 'Bob');
    });

    it('rejects invalid ObjectId for departmentId filter', async () => {
      const { user } = await makeAdmin();
      const token = await issueTokenFor(user);
      const res = await http('GET', '/api/employees?departmentId=not-an-id', { token });
      assert.equal(res.status, 400);
      assert.equal(res.body.error.field, 'departmentId');
    });

    it('rejects invalid employmentStatus enum', async () => {
      const { user } = await makeAdmin();
      const token = await issueTokenFor(user);
      const res = await http(
        'GET',
        '/api/employees?employmentStatus=terminated',
        { token },
      );
      assert.equal(res.status, 400);
      assert.equal(res.body.error.field, 'employmentStatus');
    });

    it('sorts by allowlist field only (asc/desc)', async () => {
      const { user } = await makeAdmin();
      const token = await issueTokenFor(user);
      await Employee.create({
        employeeCode: 'NV0003',
        fullName: 'Charlie',
        email: 'c@example.com',
        employmentType: 'full_time',
        hireDate: new Date('2024-03-01'),
      });
      await Employee.create({
        employeeCode: 'NV0001',
        fullName: 'Alice',
        email: 'a@example.com',
        employmentType: 'full_time',
        hireDate: new Date('2024-01-01'),
      });
      await Employee.create({
        employeeCode: 'NV0002',
        fullName: 'Bob',
        email: 'b@example.com',
        employmentType: 'full_time',
        hireDate: new Date('2024-02-01'),
      });

      const asc = await http('GET', '/api/employees?sortBy=fullName&sortOrder=asc', { token });
      assert.equal(asc.body.data[0].fullName, 'Alice');
      assert.equal(asc.body.data[1].fullName, 'Bob');
      assert.equal(asc.body.data[2].fullName, 'Charlie');

      const desc = await http('GET', '/api/employees?sortBy=fullName&sortOrder=desc', { token });
      assert.equal(desc.body.data[0].fullName, 'Charlie');
    });

    it('rejects sortBy outside the allowlist', async () => {
      const { user } = await makeAdmin();
      const token = await issueTokenFor(user);
      const res = await http('GET', '/api/employees?sortBy=passwordHash', { token });
      assert.equal(res.status, 400);
      assert.equal(res.body.error.field, 'sortBy');
    });

    it('rejects sortOrder outside asc/desc', async () => {
      const { user } = await makeAdmin();
      const token = await issueTokenFor(user);
      const res = await http('GET', '/api/employees?sortOrder=up', { token });
      assert.equal(res.status, 400);
      assert.equal(res.body.error.field, 'sortOrder');
    });

    it('does not return passwordHash from any employee', async () => {
      const { user: u } = await makeAdmin();
      const token = await issueTokenFor(u);
      await Employee.create({
        employeeCode: 'NV0001',
        fullName: 'Alice',
        email: 'a@example.com',
        employmentType: 'full_time',
        hireDate: new Date('2024-01-01'),
        userId: u._id,
      });
      const res = await http('GET', '/api/employees', { token });
      const text = JSON.stringify(res.body);
      assert.ok(!text.includes('passwordHash'), 'passwordHash must not appear in list response');
    });

    it('excludes soft-deleted employees by default', async () => {
      const { user } = await makeAdmin();
      const token = await issueTokenFor(user);
      const e1 = await Employee.create({
        employeeCode: 'NV0001',
        fullName: 'Active',
        email: 'a@example.com',
        employmentType: 'full_time',
        hireDate: new Date('2024-01-01'),
      });
      const e2 = await Employee.create({
        employeeCode: 'NV0002',
        fullName: 'Deleted',
        email: 'd@example.com',
        employmentType: 'full_time',
        hireDate: new Date('2024-01-01'),
      });
      e2.isDeleted = true;
      e2.deletedAt = new Date();
      e2.deletedBy = user._id;
      await e2.save();

      const res = await http('GET', '/api/employees', { token });
      assert.equal(res.body.data.length, 1);
      assert.equal(res.body.data[0].fullName, 'Active');
    });
  });

  // ====================================================================
  // GET /api/employees/:id — Detail
  // ====================================================================
  describe('GET /api/employees/:id — detail', () => {
    it('returns 401 without a token', async () => {
      const res = await http('GET', '/api/employees/64b000000000000000000000');
      assert.equal(res.status, 401);
    });

    it('returns 400 for a malformed id', async () => {
      const { user } = await makeAdmin();
      const token = await issueTokenFor(user);
      const res = await http('GET', '/api/employees/not-an-id', { token });
      assert.equal(res.status, 400);
      assert.equal(res.body.error.code, 'VALIDATION_ERROR');
    });

    it('returns 404 for a valid-but-missing id', async () => {
      const { user } = await makeAdmin();
      const token = await issueTokenFor(user);
      const fakeId = '64b000000000000000000000';
      const res = await http('GET', `/api/employees/${fakeId}`, { token });
      assert.equal(res.status, 404);
      assert.equal(res.body.error.code, 'EMPLOYEE_NOT_FOUND');
    });

    it('admin can view any employee', async () => {
      const { user: admin } = await makeAdmin();
      const adminToken = await issueTokenFor(admin);
      const { user: worker } = await makeEmployee();
      const e = await Employee.create({
        employeeCode: 'NV0001',
        fullName: 'Worker',
        email: 'w@example.com',
        employmentType: 'full_time',
        hireDate: new Date('2024-01-01'),
        userId: worker._id,
      });
      const res = await http('GET', `/api/employees/${e._id}`, { token: adminToken });
      assert.equal(res.status, 200);
      assert.equal(res.body.data.fullName, 'Worker');
    });

    it('employee can view their own profile', async () => {
      const { user: worker } = await makeEmployee();
      const token = await issueTokenFor(worker);
      const e = await Employee.create({
        employeeCode: 'NV0001',
        fullName: 'Worker',
        email: 'w@example.com',
        employmentType: 'full_time',
        hireDate: new Date('2024-01-01'),
        userId: worker._id,
      });
      const res = await http('GET', `/api/employees/${e._id}`, { token });
      assert.equal(res.status, 200);
      assert.equal(res.body.data.fullName, 'Worker');
    });

    it('employee cannot view another employee (returns 404, not 403)', async () => {
      const { user: worker1 } = await createTestUser({
        email: 'w1@example.com',
        role: 'employee',
      });
      const { user: worker2 } = await createTestUser({
        email: 'w2@example.com',
        role: 'employee',
      });
      const token1 = await issueTokenFor(worker1);
      const e = await Employee.create({
        employeeCode: 'NV0001',
        fullName: 'Worker Two',
        email: 'w2-emp@example.com',
        employmentType: 'full_time',
        hireDate: new Date('2024-01-01'),
        userId: worker2._id,
      });
      const res = await http('GET', `/api/employees/${e._id}`, { token: token1 });
      // Returns 404 (not 403) on purpose to avoid leaking ID existence.
      assert.equal(res.status, 404);
      assert.equal(res.body.error.code, 'EMPLOYEE_NOT_FOUND');
    });

    it('a user without a linked employee cannot claim another employee', async () => {
      const { user: orphan } = await makeEmployee();
      const { user: other } = await makeEmployee();
      const token = await issueTokenFor(orphan);
      const e = await Employee.create({
        employeeCode: 'NV0001',
        fullName: 'Other',
        email: 'other-emp@example.com',
        employmentType: 'full_time',
        hireDate: new Date('2024-01-01'),
        userId: other._id,
      });
      const res = await http('GET', `/api/employees/${e._id}`, { token });
      assert.equal(res.status, 404);
    });

    it('returns 404 for a soft-deleted record when caller is not admin', async () => {
      const { user: admin } = await makeAdmin();
      const { user: worker } = await makeEmployee();
      const token = await issueTokenFor(worker);
      const e = await Employee.create({
        employeeCode: 'NV0001',
        fullName: 'Worker',
        email: 'w@example.com',
        employmentType: 'full_time',
        hireDate: new Date('2024-01-01'),
        userId: worker._id,
      });
      e.isDeleted = true;
      e.deletedAt = new Date();
      e.deletedBy = admin._id;
      await e.save();
      const res = await http('GET', `/api/employees/${e._id}`, { token });
      assert.equal(res.status, 404);
    });
  });

  // ====================================================================
  // POST /api/employees — Create
  // ====================================================================
  describe('POST /api/employees — create', () => {
    it('returns 401 without a token', async () => {
      const res = await http('POST', '/api/employees', { body: basePayload() });
      assert.equal(res.status, 401);
    });

    it('returns 403 for an employee user', async () => {
      const { user } = await makeEmployee();
      const token = await issueTokenFor(user);
      const res = await http('POST', '/api/employees', { body: basePayload(), token });
      assert.equal(res.status, 403);
    });

    it('admin creates a valid employee with HTTP 201', async () => {
      const { user } = await makeAdmin();
      const token = await issueTokenFor(user);
      const res = await http('POST', '/api/employees', { body: basePayload(), token });
      assert.equal(res.status, 201);
      assert.equal(res.body.success, true);
      assert.equal(res.body.data.employeeCode, 'NV0001');
      assert.equal(res.body.data.fullName, 'Alice Person');
      assert.equal(res.body.data.email, 'alice@example.com');
      assert.equal(res.body.data.employmentStatus, 'active');
    });

    it('rejects missing required fields', async () => {
      const { user } = await makeAdmin();
      const token = await issueTokenFor(user);
      const res = await http('POST', '/api/employees', { body: {}, token });
      assert.equal(res.status, 400);
      assert.equal(res.body.error.code, 'VALIDATION_ERROR');
      assert.equal(res.body.error.field, 'employeeCode');
    });

    it('rejects malformed email', async () => {
      const { user } = await makeAdmin();
      const token = await issueTokenFor(user);
      const res = await http('POST', '/api/employees', {
        body: basePayload({ email: 'not-an-email' }),
        token,
      });
      assert.equal(res.status, 400);
      assert.equal(res.body.error.field, 'email');
    });

    it('rejects unknown employmentType', async () => {
      const { user } = await makeAdmin();
      const token = await issueTokenFor(user);
      const res = await http('POST', '/api/employees', {
        body: basePayload({ employmentType: 'freelance' }),
        token,
      });
      assert.equal(res.status, 400);
    });

    it('rejects unknown employmentStatus', async () => {
      const { user } = await makeAdmin();
      const token = await issueTokenFor(user);
      const res = await http('POST', '/api/employees', {
        body: basePayload({ employmentStatus: 'terminated' }),
        token,
      });
      assert.equal(res.status, 400);
    });

    it('rejects future hireDate', async () => {
      const { user } = await makeAdmin();
      const token = await issueTokenFor(user);
      const future = new Date(Date.now() + 1000 * 60 * 60 * 24 * 365).toISOString();
      const res = await http('POST', '/api/employees', {
        body: basePayload({ hireDate: future }),
        token,
      });
      assert.equal(res.status, 400);
    });

    it('rejects duplicate employeeCode with 409', async () => {
      const { user } = await makeAdmin();
      const token = await issueTokenFor(user);
      await http('POST', '/api/employees', { body: basePayload(), token });
      const res = await http('POST', '/api/employees', {
        body: basePayload({ email: 'different@example.com' }),
        token,
      });
      assert.equal(res.status, 409);
      assert.equal(res.body.error.code, 'DUPLICATE_EMPLOYEE_CODE');
    });

    it('rejects duplicate email with 409', async () => {
      const { user } = await makeAdmin();
      const token = await issueTokenFor(user);
      await http('POST', '/api/employees', { body: basePayload(), token });
      const res = await http('POST', '/api/employees', {
        body: basePayload({ employeeCode: 'NV9999' }),
        token,
      });
      assert.equal(res.status, 409);
      assert.equal(res.body.error.code, 'DUPLICATE_EMAIL');
    });

    it('rejects non-existent department', async () => {
      const { user } = await makeAdmin();
      const token = await issueTokenFor(user);
      const fakeId = '64b000000000000000000001';
      const res = await http('POST', '/api/employees', {
        body: basePayload({ departmentId: fakeId }),
        token,
      });
      assert.equal(res.status, 400);
      assert.equal(res.body.error.field, 'departmentId');
    });

    it('rejects non-existent position', async () => {
      const { user } = await makeAdmin();
      const token = await issueTokenFor(user);
      const fakeId = '64b000000000000000000002';
      const res = await http('POST', '/api/employees', {
        body: basePayload({ positionId: fakeId }),
        token,
      });
      assert.equal(res.status, 400);
    });

    it('rejects when position does not belong to department (422)', async () => {
      const { user } = await makeAdmin();
      const token = await issueTokenFor(user);
      const deptIT = await Department.create({ name: 'IT', code: 'IT' });
      const deptHR = await Department.create({ name: 'HR', code: 'HR' });
      const posIT = await Position.create({
        name: 'Engineer',
        code: 'ENG',
        departmentId: deptIT._id,
      });
      const res = await http('POST', '/api/employees', {
        body: basePayload({
          departmentId: deptHR._id.toString(),
          positionId: posIT._id.toString(),
        }),
        token,
      });
      assert.equal(res.status, 422);
      assert.equal(res.body.error.code, 'POSITION_DEPARTMENT_MISMATCH');
    });

    it('rejects non-existent userId', async () => {
      const { user } = await makeAdmin();
      const token = await issueTokenFor(user);
      const fakeId = '64b000000000000000000003';
      const res = await http('POST', '/api/employees', {
        body: basePayload({ userId: fakeId }),
        token,
      });
      assert.equal(res.status, 400);
    });

    it('rejects userId already linked to another employee (409)', async () => {
      const { user: admin } = await makeAdmin();
      const token = await issueTokenFor(admin);
      const { user: worker } = await makeEmployee();
      await http('POST', '/api/employees', {
        body: basePayload({ userId: worker._id.toString() }),
        token,
      });
      // Try to create a second employee with the same userId.
      const res = await http('POST', '/api/employees', {
        body: basePayload({
          employeeCode: 'NV0002',
          email: 'second@example.com',
          userId: worker._id.toString(),
        }),
        token,
      });
      assert.equal(res.status, 409);
      assert.equal(res.body.error.code, 'DUPLICATE_USER_LINK');
    });

    it('rejects unknown fields (no extra fields allowed)', async () => {
      const { user } = await makeAdmin();
      const token = await issueTokenFor(user);
      const res = await http('POST', '/api/employees', {
        body: { ...basePayload(), passwordHash: 'evil', role: 'admin' },
        token,
      });
      assert.equal(res.status, 400);
      assert.equal(res.body.error.code, 'VALIDATION_ERROR');
    });

    it('does not accept _id, __v, createdAt, updatedAt from client', async () => {
      const { user } = await makeAdmin();
      const token = await issueTokenFor(user);
      const res = await http('POST', '/api/employees', {
        body: {
          ...basePayload(),
          _id: '64b000000000000000000099',
          createdAt: '2000-01-01T00:00:00.000Z',
        },
        token,
      });
      assert.equal(res.status, 400);
    });

    it('does not create a default admin (no privilege escalation)', async () => {
      const { user } = await makeAdmin();
      const token = await issueTokenFor(user);
      await http('POST', '/api/employees', { body: basePayload(), token });
      // The user we created earlier is the only admin in the system.
      const admins = await User.countDocuments({ role: 'admin' });
      assert.equal(admins, 1);
    });
  });

  // ====================================================================
  // PATCH /api/employees/:id — Update
  // ====================================================================
  describe('PATCH /api/employees/:id — update', () => {
    it('returns 401 without a token', async () => {
      const res = await http('PATCH', '/api/employees/64b000000000000000000000', {
        body: { fullName: 'Xy' },
      });
      assert.equal(res.status, 401);
    });

    it('returns 403 for an employee user', async () => {
      const { user } = await makeEmployee();
      const token = await issueTokenFor(user);
      const e = await Employee.create({
        employeeCode: 'NV0001',
        fullName: 'Xy',
        email: 'x@example.com',
        employmentType: 'full_time',
        hireDate: new Date('2024-01-01'),
      });
      const res = await http('PATCH', `/api/employees/${e._id}`, {
        body: { fullName: 'New Name' },
        token,
      });
      assert.equal(res.status, 403);
    });

    it('returns 400 for a malformed id', async () => {
      const { user } = await makeAdmin();
      const token = await issueTokenFor(user);
      const res = await http('PATCH', '/api/employees/not-an-id', {
        body: { fullName: 'Xy' },
        token,
      });
      assert.equal(res.status, 400);
    });

    it('returns 404 when employee does not exist', async () => {
      const { user } = await makeAdmin();
      const token = await issueTokenFor(user);
      const fakeId = '64b000000000000000000000';
      const res = await http('PATCH', `/api/employees/${fakeId}`, {
        body: { fullName: 'Xy' },
        token,
      });
      assert.equal(res.status, 404);
    });

    it('admin can update allowed fields', async () => {
      const { user } = await makeAdmin();
      const token = await issueTokenFor(user);
      const e = await Employee.create({
        employeeCode: 'NV0001',
        fullName: 'Alice',
        email: 'a@example.com',
        employmentType: 'full_time',
        hireDate: new Date('2024-01-01'),
      });
      const res = await http('PATCH', `/api/employees/${e._id}`, {
        body: { fullName: 'Alice Updated', phone: '+1 555 0100' },
        token,
      });
      assert.equal(res.status, 200);
      assert.equal(res.body.data.fullName, 'Alice Updated');
      assert.equal(res.body.data.phone, '+1 555 0100');
    });

    it('rejects updating fields outside the allowlist', async () => {
      const { user } = await makeAdmin();
      const token = await issueTokenFor(user);
      const e = await Employee.create({
        employeeCode: 'NV0001',
        fullName: 'Alice',
        email: 'a@example.com',
        employmentType: 'full_time',
        hireDate: new Date('2024-01-01'),
      });
      const r1 = await http('PATCH', `/api/employees/${e._id}`, {
        body: { passwordHash: 'evil' },
        token,
      });
      assert.equal(r1.status, 400);
      const r2 = await http('PATCH', `/api/employees/${e._id}`, {
        body: { isDeleted: true },
        token,
      });
      assert.equal(r2.status, 400);
      const r3 = await http('PATCH', `/api/employees/${e._id}`, {
        body: { createdAt: '2000-01-01T00:00:00.000Z' },
        token,
      });
      assert.equal(r3.status, 400);
    });

    it('rejects empty update body', async () => {
      const { user } = await makeAdmin();
      const token = await issueTokenFor(user);
      const e = await Employee.create({
        employeeCode: 'NV0001',
        fullName: 'Alice',
        email: 'a@example.com',
        employmentType: 'full_time',
        hireDate: new Date('2024-01-01'),
      });
      const res = await http('PATCH', `/api/employees/${e._id}`, { body: {}, token });
      assert.equal(res.status, 400);
    });

    it('runs Mongoose validation on update (rejects bad email)', async () => {
      const { user } = await makeAdmin();
      const token = await issueTokenFor(user);
      const e = await Employee.create({
        employeeCode: 'NV0001',
        fullName: 'Alice',
        email: 'a@example.com',
        employmentType: 'full_time',
        hireDate: new Date('2024-01-01'),
      });
      const res = await http('PATCH', `/api/employees/${e._id}`, {
        body: { email: 'not-an-email' },
        token,
      });
      assert.equal(res.status, 400);
    });

    it('rejects duplicate employeeCode on update (409)', async () => {
      const { user } = await makeAdmin();
      const token = await issueTokenFor(user);
      await Employee.create({
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
      const res = await http('PATCH', `/api/employees/${e2._id}`, {
        body: { employeeCode: 'NV0001' },
        token,
      });
      assert.equal(res.status, 409);
      assert.equal(res.body.error.code, 'DUPLICATE_EMPLOYEE_CODE');
    });

    it('rejects linking to a userId already used by another employee (409)', async () => {
      const { user: admin } = await makeAdmin();
      const token = await issueTokenFor(admin);
      const { user: worker1 } = await createTestUser({
        email: 'w1@example.com',
        role: 'employee',
      });
      const { user: worker2 } = await createTestUser({
        email: 'w2@example.com',
        role: 'employee',
      });
      const e1 = await Employee.create({
        employeeCode: 'NV0001',
        userId: worker1._id,
        fullName: 'E1',
        email: 'e1@example.com',
        employmentType: 'full_time',
        hireDate: new Date('2024-01-01'),
      });
      const e2 = await Employee.create({
        employeeCode: 'NV0002',
        userId: worker2._id,
        fullName: 'E2',
        email: 'e2@example.com',
        employmentType: 'full_time',
        hireDate: new Date('2024-01-01'),
      });
      const res = await http('PATCH', `/api/employees/${e2._id}`, {
        body: { userId: worker1._id.toString() },
        token,
      });
      assert.equal(res.status, 409);
      assert.equal(res.body.error.code, 'DUPLICATE_USER_LINK');
      // e1.userId remains unchanged
      const reloaded = await Employee.findById(e1._id);
      assert.equal(reloaded.userId.toString(), worker1._id.toString());
    });

    it('allows unlinking userId by sending null', async () => {
      const { user: admin } = await makeAdmin();
      const token = await issueTokenFor(admin);
      const { user: worker } = await makeEmployee();
      const e = await Employee.create({
        employeeCode: 'NV0001',
        userId: worker._id,
        fullName: 'Edward Tester',
        email: 'edward@example.com',
        employmentType: 'full_time',
        hireDate: new Date('2024-01-01'),
      });
      const res = await http('PATCH', `/api/employees/${e._id}`, {
        body: { userId: null },
        token,
      });
      assert.equal(res.status, 200);
      const reloaded = await Employee.findById(e._id);
      assert.equal(reloaded.userId, null);
    });

    it('rejects updating departmentId to a non-existent department', async () => {
      const { user } = await makeAdmin();
      const token = await issueTokenFor(user);
      const e = await Employee.create({
        employeeCode: 'NV0001',
        fullName: 'Alice Tester',
        email: 'a@example.com',
        employmentType: 'full_time',
        hireDate: new Date('2024-01-01'),
      });
      const fakeId = '64b000000000000000000010';
      const res = await http('PATCH', `/api/employees/${e._id}`, {
        body: { departmentId: fakeId },
        token,
      });
      assert.equal(res.status, 400);
    });

    it('rejects position/department mismatch on update (422)', async () => {
      const { user } = await makeAdmin();
      const token = await issueTokenFor(user);
      const deptIT = await Department.create({ name: 'IT', code: 'IT' });
      const deptHR = await Department.create({ name: 'HR', code: 'HR' });
      const posIT = await Position.create({
        name: 'Eng',
        code: 'ENG',
        departmentId: deptIT._id,
      });
      const e = await Employee.create({
        employeeCode: 'NV0001',
        fullName: 'Alice Tester',
        email: 'a@example.com',
        employmentType: 'full_time',
        hireDate: new Date('2024-01-01'),
        departmentId: deptHR._id,
      });
      const res = await http('PATCH', `/api/employees/${e._id}`, {
        body: { positionId: posIT._id.toString() },
        token,
      });
      assert.equal(res.status, 422);
    });
  });

  // ====================================================================
  // DELETE /api/employees/:id — Soft delete
  // ====================================================================
  describe('DELETE /api/employees/:id — soft delete', () => {
    it('returns 401 without a token', async () => {
      const res = await http('DELETE', '/api/employees/64b000000000000000000000');
      assert.equal(res.status, 401);
    });

    it('returns 403 for an employee user', async () => {
      const { user } = await makeEmployee();
      const token = await issueTokenFor(user);
      const e = await Employee.create({
        employeeCode: 'NV0001',
        fullName: 'Alice Tester',
        email: 'a@example.com',
        employmentType: 'full_time',
        hireDate: new Date('2024-01-01'),
        userId: user._id,
      });
      const res = await http('DELETE', `/api/employees/${e._id}`, { token });
      assert.equal(res.status, 403);
    });

    it('admin soft-deletes an employee (200)', async () => {
      const { user: admin } = await makeAdmin();
      const token = await issueTokenFor(admin);
      const e = await Employee.create({
        employeeCode: 'NV0001',
        fullName: 'Alice Tester',
        email: 'a@example.com',
        employmentType: 'full_time',
        hireDate: new Date('2024-01-01'),
      });
      const res = await http('DELETE', `/api/employees/${e._id}`, { token });
      assert.equal(res.status, 200);
      assert.equal(res.body.success, true);
      assert.equal(res.body.data.isDeleted, true);
      assert.ok(res.body.data.deletedAt);
      assert.equal(res.body.meta.alreadyDeleted, false);
    });

    it('soft-deleted employees disappear from the default list', async () => {
      const { user } = await makeAdmin();
      const token = await issueTokenFor(user);
      const e1 = await Employee.create({
        employeeCode: 'NV0001',
        fullName: 'Keep',
        email: 'k@example.com',
        employmentType: 'full_time',
        hireDate: new Date('2024-01-01'),
      });
      const e2 = await Employee.create({
        employeeCode: 'NV0002',
        fullName: 'Delete',
        email: 'd@example.com',
        employmentType: 'full_time',
        hireDate: new Date('2024-01-01'),
      });
      await http('DELETE', `/api/employees/${e2._id}`, { token });
      const listRes = await http('GET', '/api/employees', { token });
      const codes = listRes.body.data.map((d) => d.employeeCode);
      assert.deepEqual(codes, ['NV0001']);
    });

    it('does NOT delete the linked User account', async () => {
      const { user: admin } = await makeAdmin();
      const token = await issueTokenFor(admin);
      const { user: worker } = await makeEmployee();
      const e = await Employee.create({
        employeeCode: 'NV0001',
        userId: worker._id,
        fullName: 'Alice Tester',
        email: 'a@example.com',
        employmentType: 'full_time',
        hireDate: new Date('2024-01-01'),
      });
      await http('DELETE', `/api/employees/${e._id}`, { token });
      const stillThere = await User.findById(worker._id);
      assert.ok(stillThere);
      assert.equal(stillThere.status, 'active');
    });

    it('does NOT hard-delete the employee record', async () => {
      const { user } = await makeAdmin();
      const token = await issueTokenFor(user);
      const e = await Employee.create({
        employeeCode: 'NV0001',
        fullName: 'Alice Tester',
        email: 'a@example.com',
        employmentType: 'full_time',
        hireDate: new Date('2024-01-01'),
      });
      await http('DELETE', `/api/employees/${e._id}`, { token });
      const stillThere = await Employee.findById(e._id);
      assert.ok(stillThere);
      assert.equal(stillThere.isDeleted, true);
    });

    it('is idempotent — a second call returns 200 with alreadyDeleted=true', async () => {
      const { user } = await makeAdmin();
      const token = await issueTokenFor(user);
      const e = await Employee.create({
        employeeCode: 'NV0001',
        fullName: 'Alice Tester',
        email: 'a@example.com',
        employmentType: 'full_time',
        hireDate: new Date('2024-01-01'),
      });
      const r1 = await http('DELETE', `/api/employees/${e._id}`, { token });
      assert.equal(r1.status, 200);
      assert.equal(r1.body.meta.alreadyDeleted, false);
      const r2 = await http('DELETE', `/api/employees/${e._id}`, { token });
      assert.equal(r2.status, 200);
      assert.equal(r2.body.meta.alreadyDeleted, true);
    });

    it('returns 404 for a non-existent id', async () => {
      const { user } = await makeAdmin();
      const token = await issueTokenFor(user);
      const fakeId = '64b000000000000000000000';
      const res = await http('DELETE', `/api/employees/${fakeId}`, { token });
      assert.equal(res.status, 404);
    });
  });

  // ====================================================================
  // Regression — auth & health still work
  // ====================================================================
  describe('Regression — auth + health still work', () => {
    it('GET /api/health returns 200', async () => {
      const res = await http('GET', '/api/health');
      assert.equal(res.status, 200);
      assert.equal(res.body.data.database.connected, true);
    });

    it('GET /api/auth/me works with a valid token', async () => {
      const email = 'admin-regression@example.com';
      const { user } = await createTestUser({ email, role: 'admin' });
      const token = await issueTokenFor(user);
      const res = await http('GET', '/api/auth/me', { token });
      assert.equal(res.status, 200);
      assert.equal(res.body.data.user.email, email);
    });

    it('admin-check rejects employee', async () => {
      const { user } = await makeEmployee();
      const token = await issueTokenFor(user);
      const res = await http('GET', '/api/auth/admin-check', { token });
      assert.equal(res.status, 403);
    });
  });
});
