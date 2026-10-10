// Integration tests for the Position Management API.

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
    name: 'Frontend Engineer',
    code: 'FE',
    ...overrides,
  };
}

describe('Position API', () => {
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
      const res = await http('GET', '/api/positions');
      assert.equal(res.status, 401);
    });

    it('GET / returns 403 for an employee user', async () => {
      const { user } = await makeEmployee();
      const token = await issueTokenFor(user);
      const res = await http('GET', '/api/positions', { token });
      assert.equal(res.status, 403);
    });

    it('POST / returns 401 without a token', async () => {
      const res = await http('POST', '/api/positions', { body: basePayload() });
      assert.equal(res.status, 401);
    });

    it('POST / returns 403 for an employee user', async () => {
      const { user } = await makeEmployee();
      const token = await issueTokenFor(user);
      const res = await http('POST', '/api/positions', {
        body: basePayload(),
        token,
      });
      assert.equal(res.status, 403);
    });

    it('PATCH /:id returns 403 for an employee user', async () => {
      const { user } = await makeEmployee();
      const token = await issueTokenFor(user);
      const res = await http('PATCH', '/api/positions/64b000000000000000000000', {
        body: { name: 'New' },
        token,
      });
      assert.equal(res.status, 403);
    });
  });

  // ====================================================================
  // GET /api/positions — List
  // ====================================================================
  describe('GET /api/positions — list', () => {
    it('returns 200 + empty data with default pagination', async () => {
      const { user } = await makeAdmin();
      const token = await issueTokenFor(user);
      const res = await http('GET', '/api/positions', { token });
      assert.equal(res.status, 200);
      assert.deepEqual(res.body.data, []);
      assert.equal(res.body.pagination.page, 1);
      assert.equal(res.body.pagination.limit, 10);
    });

    it('respects page and limit', async () => {
      const { user } = await makeAdmin();
      const token = await issueTokenFor(user);
      for (let i = 0; i < 7; i++) {
        await Position.create({
          name: `Pos ${i + 1}`,
          code: `P${String(i + 1).padStart(3, '0')}`,
        });
      }
      const p1 = await http('GET', '/api/positions?page=1&limit=3', { token });
      assert.equal(p1.body.data.length, 3);
      assert.equal(p1.body.pagination.total, 7);
    });

    it('caps limit at 100', async () => {
      const { user } = await makeAdmin();
      const token = await issueTokenFor(user);
      const res = await http('GET', '/api/positions?limit=500', { token });
      assert.equal(res.status, 400);
      assert.equal(res.body.error.field, 'limit');
    });

    it('rejects non-integer page/limit', async () => {
      const { user } = await makeAdmin();
      const token = await issueTokenFor(user);
      const r1 = await http('GET', '/api/positions?page=abc', { token });
      assert.equal(r1.status, 400);
      const r2 = await http('GET', '/api/positions?limit=0', { token });
      assert.equal(r2.status, 400);
    });

    it('searches by name and code', async () => {
      const { user } = await makeAdmin();
      const token = await issueTokenFor(user);
      await Position.create({ name: 'Frontend Engineer', code: 'FE' });
      await Position.create({ name: 'Backend Engineer', code: 'BE' });
      await Position.create({ name: 'Designer', code: 'DS' });

      const byName = await http(
        'GET',
        '/api/positions?search=Frontend',
        { token },
      );
      assert.equal(byName.body.data.length, 1);
      assert.equal(byName.body.data[0].name, 'Frontend Engineer');

      const byCode = await http('GET', '/api/positions?search=be', { token });
      assert.equal(byCode.body.data.length, 1);
      assert.equal(byCode.body.data[0].code, 'BE');
    });

    it('escapes regex metacharacters in search', async () => {
      const { user } = await makeAdmin();
      const token = await issueTokenFor(user);
      await Position.create({ name: 'A .* Engineer', code: 'AA' });
      await Position.create({ name: 'B Engineer', code: 'BB' });
      const res = await http('GET', '/api/positions?search=.*', { token });
      assert.equal(res.status, 200);
      assert.equal(res.body.data.length, 1);
      assert.equal(res.body.data[0].name, 'A .* Engineer');
    });

    it('filters by status', async () => {
      const { user } = await makeAdmin();
      const token = await issueTokenFor(user);
      await Position.create({ name: 'AA', code: 'AA1', status: 'active' });
      await Position.create({ name: 'BB', code: 'BB1', status: 'inactive' });
      const res = await http('GET', '/api/positions?status=inactive', { token });
      assert.equal(res.body.data.length, 1);
      assert.equal(res.body.data[0].name, 'BB');
    });

    it('filters by departmentId', async () => {
      const { user } = await makeAdmin();
      const token = await issueTokenFor(user);
      const d1 = await Department.create({ name: 'IT', code: 'IT' });
      const d2 = await Department.create({ name: 'HR', code: 'HR' });
      await Position.create({ name: 'FE', code: 'FE', departmentId: d1._id });
      await Position.create({ name: 'BE', code: 'BE', departmentId: d1._id });
      await Position.create({ name: 'RE', code: 'RE', departmentId: d2._id });
      const res = await http(
        'GET',
        `/api/positions?departmentId=${d1._id.toString()}`,
        { token },
      );
      assert.equal(res.body.data.length, 2);
    });

    it('rejects invalid departmentId ObjectId', async () => {
      const { user } = await makeAdmin();
      const token = await issueTokenFor(user);
      const res = await http('GET', '/api/positions?departmentId=not-an-id', { token });
      assert.equal(res.status, 400);
      assert.equal(res.body.error.field, 'departmentId');
    });

    it('rejects unknown status enum', async () => {
      const { user } = await makeAdmin();
      const token = await issueTokenFor(user);
      const res = await http('GET', '/api/positions?status=archived', { token });
      assert.equal(res.status, 400);
    });

    it('sorts by allowlist (asc/desc)', async () => {
      const { user } = await makeAdmin();
      const token = await issueTokenFor(user);
      await Position.create({ name: 'Charlie', code: 'CC' });
      await Position.create({ name: 'Alice', code: 'AA' });
      await Position.create({ name: 'Bob', code: 'BB' });

      const asc = await http(
        'GET',
        '/api/positions?sortBy=name&sortOrder=asc',
        { token },
      );
      assert.equal(asc.body.data[0].name, 'Alice');
      assert.equal(asc.body.data[2].name, 'Charlie');
    });

    it('rejects sortBy outside the allowlist', async () => {
      const { user } = await makeAdmin();
      const token = await issueTokenFor(user);
      const res = await http('GET', '/api/positions?sortBy=passwordHash', { token });
      assert.equal(res.status, 400);
    });

    it('rejects sortOrder outside asc/desc', async () => {
      const { user } = await makeAdmin();
      const token = await issueTokenFor(user);
      const res = await http('GET', '/api/positions?sortOrder=sideways', { token });
      assert.equal(res.status, 400);
    });
  });

  // ====================================================================
  // GET /api/positions/:id — Detail
  // ====================================================================
  describe('GET /api/positions/:id — detail', () => {
    it('returns 400 for a malformed id', async () => {
      const { user } = await makeAdmin();
      const token = await issueTokenFor(user);
      const res = await http('GET', '/api/positions/not-an-id', { token });
      assert.equal(res.status, 400);
    });

    it('returns 404 for a valid-but-missing id', async () => {
      const { user } = await makeAdmin();
      const token = await issueTokenFor(user);
      const fakeId = '64b000000000000000000000';
      const res = await http('GET', `/api/positions/${fakeId}`, { token });
      assert.equal(res.status, 404);
      assert.equal(res.body.error.code, 'POSITION_NOT_FOUND');
    });

    it('admin can view a position', async () => {
      const { user } = await makeAdmin();
      const token = await issueTokenFor(user);
      const p = await Position.create({ name: 'Engineer', code: 'ENG' });
      const res = await http('GET', `/api/positions/${p._id}`, { token });
      assert.equal(res.status, 200);
      assert.equal(res.body.data.name, 'Engineer');
    });

    it('returns position with departmentId field (no populated internals)', async () => {
      const { user } = await makeAdmin();
      const token = await issueTokenFor(user);
      const d = await Department.create({ name: 'IT', code: 'IT' });
      const p = await Position.create({
        name: 'Engineer',
        code: 'ENG',
        departmentId: d._id,
      });
      const res = await http('GET', `/api/positions/${p._id}`, { token });
      assert.equal(res.status, 200);
      assert.equal(res.body.data.departmentId, d._id.toString());
      assert.ok(!('__v' in res.body.data));
    });
  });

  // ====================================================================
  // POST /api/positions — Create
  // ====================================================================
  describe('POST /api/positions — create', () => {
    it('admin creates a valid position with HTTP 201', async () => {
      const { user } = await makeAdmin();
      const token = await issueTokenFor(user);
      const res = await http('POST', '/api/positions', {
        body: basePayload(),
        token,
      });
      assert.equal(res.status, 201);
      assert.equal(res.body.data.name, 'Frontend Engineer');
      assert.equal(res.body.data.code, 'FE');
      assert.equal(res.body.data.status, 'active');
    });

    it('rejects missing required name', async () => {
      const { user } = await makeAdmin();
      const token = await issueTokenFor(user);
      const res = await http('POST', '/api/positions', {
        body: { code: 'FE' },
        token,
      });
      assert.equal(res.status, 400);
      assert.equal(res.body.error.field, 'name');
    });

    it('rejects missing required code', async () => {
      const { user } = await makeAdmin();
      const token = await issueTokenFor(user);
      const res = await http('POST', '/api/positions', {
        body: { name: 'Engineer' },
        token,
      });
      assert.equal(res.status, 400);
      assert.equal(res.body.error.field, 'code');
    });

    it('rejects name shorter than 2 characters', async () => {
      const { user } = await makeAdmin();
      const token = await issueTokenFor(user);
      const res = await http('POST', '/api/positions', {
        body: { name: 'X', code: 'XX' },
        token,
      });
      assert.equal(res.status, 400);
    });

    it('rejects invalid code characters', async () => {
      const { user } = await makeAdmin();
      const token = await issueTokenFor(user);
      const res = await http('POST', '/api/positions', {
        body: { name: 'Engineer', code: 'fe!' },
        token,
      });
      assert.equal(res.status, 400);
    });

    it('rejects whitespace-only name', async () => {
      const { user } = await makeAdmin();
      const token = await issueTokenFor(user);
      const res = await http('POST', '/api/positions', {
        body: { name: '   ', code: 'FE' },
        token,
      });
      assert.equal(res.status, 400);
      assert.equal(res.body.error.field, 'name');
    });

    it('rejects unknown status enum', async () => {
      const { user } = await makeAdmin();
      const token = await issueTokenFor(user);
      const res = await http('POST', '/api/positions', {
        body: { name: 'FE', code: 'FE', status: 'archived' },
        token,
      });
      assert.equal(res.status, 400);
    });

    it('rejects duplicate code with 409', async () => {
      const { user } = await makeAdmin();
      const token = await issueTokenFor(user);
      await http('POST', '/api/positions', { body: basePayload(), token });
      const res = await http('POST', '/api/positions', {
        body: { name: 'Other', code: 'FE' },
        token,
      });
      assert.equal(res.status, 409);
      assert.equal(res.body.error.code, 'DUPLICATE_POSITION_CODE');
    });

    it('rejects unknown departmentId (400)', async () => {
      const { user } = await makeAdmin();
      const token = await issueTokenFor(user);
      const fakeId = '64b000000000000000000001';
      const res = await http('POST', '/api/positions', {
        body: { ...basePayload({ code: 'BE' }), departmentId: fakeId },
        token,
      });
      assert.equal(res.status, 400);
      assert.equal(res.body.error.field, 'departmentId');
    });

    it('rejects inactive department (400)', async () => {
      const { user } = await makeAdmin();
      const token = await issueTokenFor(user);
      const d = await Department.create({
        name: 'Old',
        code: 'OLD',
        status: 'inactive',
      });
      const res = await http('POST', '/api/positions', {
        body: { ...basePayload({ code: 'BE' }), departmentId: d._id.toString() },
        token,
      });
      assert.equal(res.status, 400);
      assert.equal(res.body.error.field, 'departmentId');
    });

    it('creates with a valid active department', async () => {
      const { user } = await makeAdmin();
      const token = await issueTokenFor(user);
      const d = await Department.create({ name: 'IT', code: 'IT' });
      const res = await http('POST', '/api/positions', {
        body: { ...basePayload({ code: 'FE2' }), departmentId: d._id.toString() },
        token,
      });
      assert.equal(res.status, 201);
      assert.equal(res.body.data.departmentId, d._id.toString());
    });

    it('creates a general position with no department', async () => {
      const { user } = await makeAdmin();
      const token = await issueTokenFor(user);
      const res = await http('POST', '/api/positions', {
        body: basePayload({ name: 'Intern', code: 'INT' }),
        token,
      });
      assert.equal(res.status, 201);
      assert.equal(res.body.data.departmentId, null);
    });

    it('rejects unknown fields', async () => {
      const { user } = await makeAdmin();
      const token = await issueTokenFor(user);
      const res = await http('POST', '/api/positions', {
        body: { ...basePayload(), _id: 'fake' },
        token,
      });
      assert.equal(res.status, 400);
    });
  });

  // ====================================================================
  // PATCH /api/positions/:id — Update
  // ====================================================================
  describe('PATCH /api/positions/:id — update', () => {
    it('returns 400 for a malformed id', async () => {
      const { user } = await makeAdmin();
      const token = await issueTokenFor(user);
      const res = await http('PATCH', '/api/positions/not-an-id', {
        body: { name: 'New' },
        token,
      });
      assert.equal(res.status, 400);
    });

    it('returns 404 when position does not exist', async () => {
      const { user } = await makeAdmin();
      const token = await issueTokenFor(user);
      const res = await http('PATCH', '/api/positions/64b000000000000000000000', {
        body: { name: 'New' },
        token,
      });
      assert.equal(res.status, 404);
    });

    it('admin can update allowed fields', async () => {
      const { user } = await makeAdmin();
      const token = await issueTokenFor(user);
      const p = await Position.create({ name: 'Engineer', code: 'ENG' });
      const res = await http('PATCH', `/api/positions/${p._id}`, {
        body: { name: 'Engineer Updated', description: 'New' },
        token,
      });
      assert.equal(res.status, 200);
      assert.equal(res.body.data.name, 'Engineer Updated');
      assert.equal(res.body.data.description, 'New');
    });

    it('rejects empty body', async () => {
      const { user } = await makeAdmin();
      const token = await issueTokenFor(user);
      const p = await Position.create({ name: 'Engineer', code: 'ENG' });
      const res = await http('PATCH', `/api/positions/${p._id}`, {
        body: {},
        token,
      });
      assert.equal(res.status, 400);
    });

    it('rejects fields outside the allowlist', async () => {
      const { user } = await makeAdmin();
      const token = await issueTokenFor(user);
      const p = await Position.create({ name: 'Engineer', code: 'ENG' });
      const r1 = await http('PATCH', `/api/positions/${p._id}`, {
        body: { _id: 'fake' },
        token,
      });
      assert.equal(r1.status, 400);
      const r2 = await http('PATCH', `/api/positions/${p._id}`, {
        body: { createdAt: '2000-01-01T00:00:00.000Z' },
        token,
      });
      assert.equal(r2.status, 400);
    });

    it('rejects duplicate code on update (409)', async () => {
      const { user } = await makeAdmin();
      const token = await issueTokenFor(user);
      await Position.create({ name: 'FE', code: 'FE' });
      const p2 = await Position.create({ name: 'BE', code: 'BE' });
      const res = await http('PATCH', `/api/positions/${p2._id}`, {
        body: { code: 'FE' },
        token,
      });
      assert.equal(res.status, 409);
      assert.equal(res.body.error.code, 'DUPLICATE_POSITION_CODE');
    });

    it('rejects unknown departmentId on update (400)', async () => {
      const { user } = await makeAdmin();
      const token = await issueTokenFor(user);
      const p = await Position.create({ name: 'FE', code: 'FE' });
      const fakeId = '64b000000000000000000001';
      const res = await http('PATCH', `/api/positions/${p._id}`, {
        body: { departmentId: fakeId },
        token,
      });
      assert.equal(res.status, 400);
    });

    it('rejects inactive department on update (400)', async () => {
      const { user } = await makeAdmin();
      const token = await issueTokenFor(user);
      const p = await Position.create({ name: 'FE', code: 'FE' });
      const d = await Department.create({
        name: 'Old',
        code: 'OLD',
        status: 'inactive',
      });
      const res = await http('PATCH', `/api/positions/${p._id}`, {
        body: { departmentId: d._id.toString() },
        token,
      });
      assert.equal(res.status, 400);
      assert.equal(res.body.error.field, 'departmentId');
    });

    it('allows unlinking departmentId with null', async () => {
      const { user } = await makeAdmin();
      const token = await issueTokenFor(user);
      const d = await Department.create({ name: 'IT', code: 'IT' });
      const p = await Position.create({
        name: 'FE',
        code: 'FE',
        departmentId: d._id,
      });
      const res = await http('PATCH', `/api/positions/${p._id}`, {
        body: { departmentId: null },
        token,
      });
      assert.equal(res.status, 200);
      assert.equal(res.body.data.departmentId, null);
    });

    it('rejects unknown status enum on update', async () => {
      const { user } = await makeAdmin();
      const token = await issueTokenFor(user);
      const p = await Position.create({ name: 'FE', code: 'FE' });
      const res = await http('PATCH', `/api/positions/${p._id}`, {
        body: { status: 'archived' },
        token,
      });
      assert.equal(res.status, 400);
    });
  });

  // ====================================================================
  // PATCH /api/positions/:id/deactivate
  // ====================================================================
  describe('PATCH /api/positions/:id/deactivate', () => {
    it('returns 400 for a malformed id', async () => {
      const { user } = await makeAdmin();
      const token = await issueTokenFor(user);
      const res = await http('PATCH', '/api/positions/not-an-id/deactivate', {
        token,
      });
      assert.equal(res.status, 400);
    });

    it('returns 404 for a missing position', async () => {
      const { user } = await makeAdmin();
      const token = await issueTokenFor(user);
      const res = await http(
        'PATCH',
        '/api/positions/64b000000000000000000000/deactivate',
        { token },
      );
      assert.equal(res.status, 404);
    });

    it('admin can deactivate an active position (200)', async () => {
      const { user } = await makeAdmin();
      const token = await issueTokenFor(user);
      const p = await Position.create({ name: 'FE', code: 'FE' });
      const res = await http('PATCH', `/api/positions/${p._id}/deactivate`, {
        token,
      });
      assert.equal(res.status, 200);
      assert.equal(res.body.data.status, 'inactive');
      assert.equal(res.body.meta.alreadyDeactivated, false);
    });

    it('is idempotent — second call returns alreadyDeactivated=true', async () => {
      const { user } = await makeAdmin();
      const token = await issueTokenFor(user);
      const p = await Position.create({ name: 'FE', code: 'FE' });
      const r1 = await http('PATCH', `/api/positions/${p._id}/deactivate`, {
        token,
      });
      assert.equal(r1.body.meta.alreadyDeactivated, false);
      const r2 = await http('PATCH', `/api/positions/${p._id}/deactivate`, {
        token,
      });
      assert.equal(r2.status, 200);
      assert.equal(r2.body.meta.alreadyDeactivated, true);
    });

    it('returns 403 for an employee user', async () => {
      const { user } = await makeEmployee();
      const token = await issueTokenFor(user);
      const p = await Position.create({ name: 'FE', code: 'FE' });
      const res = await http('PATCH', `/api/positions/${p._id}/deactivate`, {
        token,
      });
      assert.equal(res.status, 403);
    });

    it('does NOT delete or break linked Employee references', async () => {
      const { user } = await makeAdmin();
      const token = await issueTokenFor(user);
      const p = await Position.create({ name: 'FE', code: 'FE' });
      const e = await Employee.create({
        employeeCode: 'NV0001',
        fullName: 'Person',
        email: 'p@example.com',
        employmentType: 'full_time',
        hireDate: new Date('2024-01-01'),
        positionId: p._id,
      });
      await http('PATCH', `/api/positions/${p._id}/deactivate`, { token });
      const reloaded = await Employee.findById(e._id);
      assert.ok(reloaded);
      assert.equal(reloaded.positionId.toString(), p._id.toString());
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

    it('GET /api/employees still works (Phase 4 regression)', async () => {
      const { user } = await makeAdmin();
      const token = await issueTokenFor(user);
      const res = await http('GET', '/api/employees', { token });
      assert.equal(res.status, 200);
    });

    it('GET /api/departments still works (Phase 5 self-regression)', async () => {
      const { user } = await makeAdmin();
      const token = await issueTokenFor(user);
      const res = await http('GET', '/api/departments', { token });
      assert.equal(res.status, 200);
    });
  });
});
