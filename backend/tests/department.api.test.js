// Integration tests for the Department Management API.
// Exercises the full HTTP layer through createApp(), covering:
//  - list, detail, create, update, deactivate
//  - Admin-only authorization
//  - Pagination / search / filter / sort
//  - Validation & error responses
//  - Soft-deactivation idempotency
//  - Preservation of Employee / Position links on deactivation

import { describe, it, before, after, beforeEach } from 'node:test';
import { strict as assert } from 'node:assert';

import { createApp } from '../src/app.js';
import {
  User,
  Employee,
  Department,
  Position,
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
    name: 'IT Department',
    code: 'IT',
    ...overrides,
  };
}

describe('Department API', () => {
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
  // Authentication & Authorization
  // ====================================================================
  describe('Authentication & Authorization', () => {
    it('GET / returns 401 without a token', async () => {
      const res = await http('GET', '/api/departments');
      assert.equal(res.status, 401);
    });

    it('GET / returns 403 for an employee user', async () => {
      const { user } = await makeEmployee();
      const token = await issueTokenFor(user);
      const res = await http('GET', '/api/departments', { token });
      assert.equal(res.status, 403);
      assert.equal(res.body.error.code, 'FORBIDDEN');
    });

    it('POST / returns 401 without a token', async () => {
      const res = await http('POST', '/api/departments', { body: basePayload() });
      assert.equal(res.status, 401);
    });

    it('POST / returns 403 for an employee user', async () => {
      const { user } = await makeEmployee();
      const token = await issueTokenFor(user);
      const res = await http('POST', '/api/departments', {
        body: basePayload(),
        token,
      });
      assert.equal(res.status, 403);
    });

    it('PATCH /:id returns 401 without a token', async () => {
      const res = await http('PATCH', '/api/departments/64b000000000000000000000', {
        body: { name: 'Xy' },
      });
      assert.equal(res.status, 401);
    });

    it('PATCH /:id returns 403 for an employee user', async () => {
      const { user } = await makeEmployee();
      const token = await issueTokenFor(user);
      const res = await http('PATCH', '/api/departments/64b000000000000000000000', {
        body: { name: 'Xy' },
        token,
      });
      assert.equal(res.status, 403);
    });

    it('invalid / expired token returns 401', async () => {
      const res = await http('GET', '/api/departments', { token: 'not-a-jwt' });
      assert.equal(res.status, 401);
    });
  });

  // ====================================================================
  // GET /api/departments — List
  // ====================================================================
  describe('GET /api/departments — list', () => {
    it('returns 200 + empty data with default pagination', async () => {
      const { user } = await makeAdmin();
      const token = await issueTokenFor(user);
      const res = await http('GET', '/api/departments', { token });
      assert.equal(res.status, 200);
      assert.deepEqual(res.body.data, []);
      assert.equal(res.body.pagination.page, 1);
      assert.equal(res.body.pagination.limit, 10);
      assert.equal(res.body.pagination.total, 0);
      assert.equal(res.body.pagination.totalPages, 0);
    });

    it('respects page and limit', async () => {
      const { user } = await makeAdmin();
      const token = await issueTokenFor(user);
      for (let i = 0; i < 7; i++) {
        await Department.create({
          name: `Dept ${i + 1}`,
          code: `D${String(i + 1).padStart(3, '0')}`,
        });
      }
      const p1 = await http('GET', '/api/departments?page=1&limit=3', { token });
      assert.equal(p1.body.data.length, 3);
      assert.equal(p1.body.pagination.total, 7);
      const p3 = await http('GET', '/api/departments?page=3&limit=3', { token });
      assert.equal(p3.body.data.length, 1);
    });

    it('caps limit at 100', async () => {
      const { user } = await makeAdmin();
      const token = await issueTokenFor(user);
      const res = await http('GET', '/api/departments?limit=500', { token });
      assert.equal(res.status, 400);
      assert.equal(res.body.error.field, 'limit');
    });

    it('rejects non-integer page/limit', async () => {
      const { user } = await makeAdmin();
      const token = await issueTokenFor(user);
      const r1 = await http('GET', '/api/departments?page=abc', { token });
      assert.equal(r1.status, 400);
      const r2 = await http('GET', '/api/departments?limit=-1', { token });
      assert.equal(r2.status, 400);
    });

    it('searches by name and code', async () => {
      const { user } = await makeAdmin();
      const token = await issueTokenFor(user);
      await Department.create({ name: 'Information Technology', code: 'IT' });
      await Department.create({ name: 'Human Resources', code: 'HR' });
      await Department.create({ name: 'Finance', code: 'FIN' });

      const byName = await http(
        'GET',
        '/api/departments?search=Technology',
        { token },
      );
      assert.equal(byName.body.data.length, 1);
      assert.equal(byName.body.data[0].name, 'Information Technology');

      const byCode = await http('GET', '/api/departments?search=hr', { token });
      assert.equal(byCode.body.data.length, 1);
      assert.equal(byCode.body.data[0].code, 'HR');
    });

    it('escapes regex metacharacters in search', async () => {
      const { user } = await makeAdmin();
      const token = await issueTokenFor(user);
      await Department.create({ name: 'A .* Department', code: 'DD1' });
      await Department.create({ name: 'B Department', code: 'DD2' });
      const res = await http('GET', '/api/departments?search=.*', { token });
      assert.equal(res.status, 200);
      assert.equal(res.body.data.length, 1);
      assert.equal(res.body.data[0].name, 'A .* Department');
    });

    it('filters by status', async () => {
      const { user } = await makeAdmin();
      const token = await issueTokenFor(user);
      await Department.create({ name: 'AA', code: 'AA1', status: 'active' });
      await Department.create({ name: 'BB', code: 'BB1', status: 'inactive' });
      const res = await http('GET', '/api/departments?status=inactive', { token });
      assert.equal(res.body.data.length, 1);
      assert.equal(res.body.data[0].name, 'BB');
    });

    it('rejects unknown status enum', async () => {
      const { user } = await makeAdmin();
      const token = await issueTokenFor(user);
      const res = await http('GET', '/api/departments?status=archived', { token });
      assert.equal(res.status, 400);
      assert.equal(res.body.error.field, 'status');
    });

    it('sorts by allowlist (asc/desc)', async () => {
      const { user } = await makeAdmin();
      const token = await issueTokenFor(user);
      await Department.create({ name: 'Charlie', code: 'CC' });
      await Department.create({ name: 'Alice', code: 'AA' });
      await Department.create({ name: 'Bob', code: 'BB' });

      const asc = await http(
        'GET',
        '/api/departments?sortBy=name&sortOrder=asc',
        { token },
      );
      assert.equal(asc.body.data[0].name, 'Alice');
      assert.equal(asc.body.data[2].name, 'Charlie');

      const desc = await http(
        'GET',
        '/api/departments?sortBy=name&sortOrder=desc',
        { token },
      );
      assert.equal(desc.body.data[0].name, 'Charlie');
    });

    it('rejects sortBy outside the allowlist', async () => {
      const { user } = await makeAdmin();
      const token = await issueTokenFor(user);
      const res = await http('GET', '/api/departments?sortBy=passwordHash', { token });
      assert.equal(res.status, 400);
      assert.equal(res.body.error.field, 'sortBy');
    });

    it('rejects sortOrder outside asc/desc', async () => {
      const { user } = await makeAdmin();
      const token = await issueTokenFor(user);
      const res = await http('GET', '/api/departments?sortOrder=sideways', { token });
      assert.equal(res.status, 400);
    });
  });

  // ====================================================================
  // GET /api/departments/:id — Detail
  // ====================================================================
  describe('GET /api/departments/:id — detail', () => {
    it('returns 400 for a malformed id', async () => {
      const { user } = await makeAdmin();
      const token = await issueTokenFor(user);
      const res = await http('GET', '/api/departments/not-an-id', { token });
      assert.equal(res.status, 400);
    });

    it('returns 404 for a valid-but-missing id', async () => {
      const { user } = await makeAdmin();
      const token = await issueTokenFor(user);
      const fakeId = '64b000000000000000000000';
      const res = await http('GET', `/api/departments/${fakeId}`, { token });
      assert.equal(res.status, 404);
      assert.equal(res.body.error.code, 'DEPARTMENT_NOT_FOUND');
    });

    it('admin can view a department', async () => {
      const { user } = await makeAdmin();
      const token = await issueTokenFor(user);
      const d = await Department.create({ name: 'IT', code: 'IT' });
      const res = await http('GET', `/api/departments/${d._id}`, { token });
      assert.equal(res.status, 200);
      assert.equal(res.body.data.name, 'IT');
    });

    it('does not leak sensitive internals', async () => {
      const { user } = await makeAdmin();
      const token = await issueTokenFor(user);
      const d = await Department.create({ name: 'IT', code: 'IT' });
      const res = await http('GET', `/api/departments/${d._id}`, { token });
      assert.equal(res.status, 200);
      assert.ok(!('__v' in res.body.data), '__v should be stripped');
    });
  });

  // ====================================================================
  // POST /api/departments — Create
  // ====================================================================
  describe('POST /api/departments — create', () => {
    it('admin creates a valid department with HTTP 201', async () => {
      const { user } = await makeAdmin();
      const token = await issueTokenFor(user);
      const res = await http('POST', '/api/departments', {
        body: basePayload(),
        token,
      });
      assert.equal(res.status, 201);
      assert.equal(res.body.data.name, 'IT Department');
      assert.equal(res.body.data.code, 'IT');
      assert.equal(res.body.data.status, 'active');
    });

    it('rejects missing required name', async () => {
      const { user } = await makeAdmin();
      const token = await issueTokenFor(user);
      const res = await http('POST', '/api/departments', {
        body: { code: 'IT' },
        token,
      });
      assert.equal(res.status, 400);
      assert.equal(res.body.error.field, 'name');
    });

    it('rejects missing required code', async () => {
      const { user } = await makeAdmin();
      const token = await issueTokenFor(user);
      const res = await http('POST', '/api/departments', {
        body: { name: 'IT' },
        token,
      });
      assert.equal(res.status, 400);
      assert.equal(res.body.error.field, 'code');
    });

    it('rejects name shorter than 2 characters', async () => {
      const { user } = await makeAdmin();
      const token = await issueTokenFor(user);
      const res = await http('POST', '/api/departments', {
        body: { name: 'A', code: 'AA' },
        token,
      });
      assert.equal(res.status, 400);
      assert.equal(res.body.error.field, 'name');
    });

    it('rejects invalid code characters', async () => {
      const { user } = await makeAdmin();
      const token = await issueTokenFor(user);
      const res = await http('POST', '/api/departments', {
        body: { name: 'IT', code: 'it!' },
        token,
      });
      assert.equal(res.status, 400);
      assert.equal(res.body.error.field, 'code');
    });

    it('rejects whitespace-only name', async () => {
      const { user } = await makeAdmin();
      const token = await issueTokenFor(user);
      const res = await http('POST', '/api/departments', {
        body: { name: '   ', code: 'IT' },
        token,
      });
      assert.equal(res.status, 400);
      assert.equal(res.body.error.field, 'name');
    });

    it('rejects unknown status enum', async () => {
      const { user } = await makeAdmin();
      const token = await issueTokenFor(user);
      const res = await http('POST', '/api/departments', {
        body: { name: 'IT', code: 'IT', status: 'archived' },
        token,
      });
      assert.equal(res.status, 400);
      assert.equal(res.body.error.field, 'status');
    });

    it('rejects duplicate code with 409', async () => {
      const { user } = await makeAdmin();
      const token = await issueTokenFor(user);
      await http('POST', '/api/departments', { body: basePayload(), token });
      const res = await http('POST', '/api/departments', {
        body: { name: 'IT 2', code: 'IT' },
        token,
      });
      assert.equal(res.status, 409);
      assert.equal(res.body.error.code, 'DUPLICATE_DEPARTMENT_CODE');
    });

    it('rejects unknown managerEmployeeId (400)', async () => {
      const { user } = await makeAdmin();
      const token = await issueTokenFor(user);
      const fakeId = '64b000000000000000000001';
      const res = await http('POST', '/api/departments', {
        body: { ...basePayload(), managerEmployeeId: fakeId },
        token,
      });
      assert.equal(res.status, 400);
      assert.equal(res.body.error.field, 'managerEmployeeId');
    });

    it('rejects managerEmployeeId pointing to a soft-deleted Employee (400)', async () => {
      const { user } = await makeAdmin();
      const token = await issueTokenFor(user);
      const deleted = await Employee.create({
        employeeCode: 'NV0001',
        fullName: 'Deleted Person',
        email: 'd@example.com',
        employmentType: 'full_time',
        hireDate: new Date('2024-01-01'),
        isDeleted: true,
        deletedAt: new Date(),
      });
      const res = await http('POST', '/api/departments', {
        body: {
          ...basePayload({ code: 'FIN' }),
          managerEmployeeId: deleted._id.toString(),
        },
        token,
      });
      assert.equal(res.status, 400);
      assert.equal(res.body.error.field, 'managerEmployeeId');
    });

    it('rejects unknown fields', async () => {
      const { user } = await makeAdmin();
      const token = await issueTokenFor(user);
      const res = await http('POST', '/api/departments', {
        body: { ...basePayload(), _id: 'fake', createdAt: 'x' },
        token,
      });
      assert.equal(res.status, 400);
    });

    it('creates with a valid managerEmployeeId', async () => {
      const { user } = await makeAdmin();
      const token = await issueTokenFor(user);
      const e = await Employee.create({
        employeeCode: 'NV0001',
        fullName: 'Manager Person',
        email: 'm@example.com',
        employmentType: 'full_time',
        hireDate: new Date('2024-01-01'),
      });
      const res = await http('POST', '/api/departments', {
        body: {
          ...basePayload({ code: 'IT2' }),
          managerEmployeeId: e._id.toString(),
        },
        token,
      });
      assert.equal(res.status, 201);
      assert.equal(res.body.data.managerEmployeeId, e._id.toString());
    });
  });

  // ====================================================================
  // PATCH /api/departments/:id — Update
  // ====================================================================
  describe('PATCH /api/departments/:id — update', () => {
    it('returns 400 for a malformed id', async () => {
      const { user } = await makeAdmin();
      const token = await issueTokenFor(user);
      const res = await http('PATCH', '/api/departments/not-an-id', {
        body: { name: 'New' },
        token,
      });
      assert.equal(res.status, 400);
    });

    it('returns 404 when department does not exist', async () => {
      const { user } = await makeAdmin();
      const token = await issueTokenFor(user);
      const fakeId = '64b000000000000000000000';
      const res = await http('PATCH', `/api/departments/${fakeId}`, {
        body: { name: 'New' },
        token,
      });
      assert.equal(res.status, 404);
    });

    it('admin can update allowed fields', async () => {
      const { user } = await makeAdmin();
      const token = await issueTokenFor(user);
      const d = await Department.create({ name: 'IT', code: 'IT' });
      const res = await http('PATCH', `/api/departments/${d._id}`, {
        body: { name: 'IT Updated', description: 'New desc' },
        token,
      });
      assert.equal(res.status, 200);
      assert.equal(res.body.data.name, 'IT Updated');
      assert.equal(res.body.data.description, 'New desc');
    });

    it('rejects empty body', async () => {
      const { user } = await makeAdmin();
      const token = await issueTokenFor(user);
      const d = await Department.create({ name: 'IT', code: 'IT' });
      const res = await http('PATCH', `/api/departments/${d._id}`, {
        body: {},
        token,
      });
      assert.equal(res.status, 400);
    });

    it('rejects fields outside the allowlist', async () => {
      const { user } = await makeAdmin();
      const token = await issueTokenFor(user);
      const d = await Department.create({ name: 'IT', code: 'IT' });
      const r1 = await http('PATCH', `/api/departments/${d._id}`, {
        body: { _id: 'fake' },
        token,
      });
      assert.equal(r1.status, 400);
      const r2 = await http('PATCH', `/api/departments/${d._id}`, {
        body: { createdAt: '2000-01-01T00:00:00.000Z' },
        token,
      });
      assert.equal(r2.status, 400);
    });

    it('rejects duplicate code on update (409)', async () => {
      const { user } = await makeAdmin();
      const token = await issueTokenFor(user);
      await Department.create({ name: 'IT', code: 'IT' });
      const d2 = await Department.create({ name: 'HR', code: 'HR' });
      const res = await http('PATCH', `/api/departments/${d2._id}`, {
        body: { code: 'IT' },
        token,
      });
      assert.equal(res.status, 409);
      assert.equal(res.body.error.code, 'DUPLICATE_DEPARTMENT_CODE');
    });

    it('rejects unknown managerEmployeeId on update (400)', async () => {
      const { user } = await makeAdmin();
      const token = await issueTokenFor(user);
      const d = await Department.create({ name: 'IT', code: 'IT' });
      const fakeId = '64b000000000000000000001';
      const res = await http('PATCH', `/api/departments/${d._id}`, {
        body: { managerEmployeeId: fakeId },
        token,
      });
      assert.equal(res.status, 400);
    });

    it('allows unlinking managerEmployeeId with null', async () => {
      const { user } = await makeAdmin();
      const token = await issueTokenFor(user);
      const e = await Employee.create({
        employeeCode: 'NV0001',
        fullName: 'M Person',
        email: 'm@example.com',
        employmentType: 'full_time',
        hireDate: new Date('2024-01-01'),
      });
      const d = await Department.create({
        name: 'IT',
        code: 'IT',
        managerEmployeeId: e._id,
      });
      const res = await http('PATCH', `/api/departments/${d._id}`, {
        body: { managerEmployeeId: null },
        token,
      });
      assert.equal(res.status, 200);
      assert.equal(res.body.data.managerEmployeeId, null);
    });

    it('rejects unknown status enum on update', async () => {
      const { user } = await makeAdmin();
      const token = await issueTokenFor(user);
      const d = await Department.create({ name: 'IT', code: 'IT' });
      const res = await http('PATCH', `/api/departments/${d._id}`, {
        body: { status: 'archived' },
        token,
      });
      assert.equal(res.status, 400);
    });
  });

  // ====================================================================
  // PATCH /api/departments/:id/deactivate
  // ====================================================================
  describe('PATCH /api/departments/:id/deactivate', () => {
    it('returns 400 for a malformed id', async () => {
      const { user } = await makeAdmin();
      const token = await issueTokenFor(user);
      const res = await http('PATCH', '/api/departments/not-an-id/deactivate', {
        token,
      });
      assert.equal(res.status, 400);
    });

    it('returns 404 for a missing department', async () => {
      const { user } = await makeAdmin();
      const token = await issueTokenFor(user);
      const res = await http(
        'PATCH',
        '/api/departments/64b000000000000000000000/deactivate',
        { token },
      );
      assert.equal(res.status, 404);
    });

    it('admin can deactivate an active department (200)', async () => {
      const { user } = await makeAdmin();
      const token = await issueTokenFor(user);
      const d = await Department.create({ name: 'IT', code: 'IT' });
      const res = await http('PATCH', `/api/departments/${d._id}/deactivate`, {
        token,
      });
      assert.equal(res.status, 200);
      assert.equal(res.body.data.status, 'inactive');
      assert.equal(res.body.meta.alreadyDeactivated, false);
    });

    it('is idempotent — second call returns alreadyDeactivated=true', async () => {
      const { user } = await makeAdmin();
      const token = await issueTokenFor(user);
      const d = await Department.create({ name: 'IT', code: 'IT' });
      const r1 = await http('PATCH', `/api/departments/${d._id}/deactivate`, {
        token,
      });
      assert.equal(r1.body.meta.alreadyDeactivated, false);
      const r2 = await http('PATCH', `/api/departments/${d._id}/deactivate`, {
        token,
      });
      assert.equal(r2.status, 200);
      assert.equal(r2.body.meta.alreadyDeactivated, true);
    });

    it('returns 403 for an employee user', async () => {
      const { user } = await makeEmployee();
      const token = await issueTokenFor(user);
      const d = await Department.create({ name: 'IT', code: 'IT' });
      const res = await http('PATCH', `/api/departments/${d._id}/deactivate`, {
        token,
      });
      assert.equal(res.status, 403);
    });

    it('does NOT delete or break linked Employee references', async () => {
      const { user } = await makeAdmin();
      const token = await issueTokenFor(user);
      const d = await Department.create({ name: 'IT', code: 'IT' });
      const e = await Employee.create({
        employeeCode: 'NV0001',
        fullName: 'Person',
        email: 'p@example.com',
        employmentType: 'full_time',
        hireDate: new Date('2024-01-01'),
        departmentId: d._id,
      });
      await http('PATCH', `/api/departments/${d._id}/deactivate`, { token });
      const reloaded = await Employee.findById(e._id);
      assert.ok(reloaded);
      assert.equal(reloaded.departmentId.toString(), d._id.toString());
    });

    it('does NOT delete or break linked Position references', async () => {
      const { user } = await makeAdmin();
      const token = await issueTokenFor(user);
      const d = await Department.create({ name: 'IT', code: 'IT' });
      const p = await Position.create({
        name: 'Engineer',
        code: 'ENG',
        departmentId: d._id,
      });
      await http('PATCH', `/api/departments/${d._id}/deactivate`, { token });
      const reloaded = await Position.findById(p._id);
      assert.ok(reloaded);
      assert.equal(reloaded.departmentId.toString(), d._id.toString());
    });
  });

  // ====================================================================
  // Regression — auth + health still work
  // ====================================================================
  describe('Regression — auth + health still work', () => {
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
  });
});
