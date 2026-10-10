// Integration tests for the Leave Management API.
// Exercises the full HTTP layer through createApp(), covering:
//   - Authorization (no token / bad token / role boundary / cross-user isolation)
//   - GET /me (self-list) with pagination + filters
//   - POST / (create) with validation, role-based employeeId handling
//   - GET /:id with admin/employee ownership (404 for non-owner)
//   - PATCH /:id (update own pending) with overlap check
//   - PATCH /:id/cancel (idempotent)
//   - PATCH /:id/approve and /:id/reject (admin only)
//   - Overlap detection on create, update, approve
//   - 404 (anti-leak) for non-owners
//   - Field whitelist (no client-set status / reviewedBy / reviewedAt / reviewNote)
//   - System fields rejection on create/update/review
//   - Regression: auth, health, employee, department, position, attendance
//     still work
//   - /me returns 404 for unlinked user

import { describe, it, before, after, beforeEach } from 'node:test';
import { strict as assert } from 'node:assert';

import { createApp } from '../src/app.js';
import { LeaveRequest } from '../src/models/index.js';
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

async function makeEmployeeUser() {
  return createTestUser({
    email: `worker-${Date.now()}-${Math.random().toString(36).slice(2, 8)}@example.com`,
    role: 'employee',
  });
}

async function makeEmployeeDoc(overrides = {}) {
  const { Employee } = await import('../src/models/index.js');
  return Employee.create({
    employeeCode: `NV${Date.now()}${Math.floor(Math.random() * 1000)}`,
    fullName: 'Test Person',
    email: `emp-${Date.now()}-${Math.random().toString(36).slice(2, 8)}@example.com`,
    employmentType: 'full_time',
    hireDate: new Date('2024-01-01'),
    ...overrides,
  });
}

function baseBody(overrides = {}) {
  return {
    leaveType: 'annual',
    startDate: '2026-12-01',
    endDate: '2026-12-03',
    reason: 'Family vacation',
    ...overrides,
  };
}

async function createLeave(employeeId, overrides = {}) {
  return LeaveRequest.create({
    employeeId,
    leaveType: 'annual',
    startDate: new Date(Date.UTC(2026, 11, 1)),
    endDate: new Date(Date.UTC(2026, 11, 3)),
    reason: 'precreated reason',
    ...overrides,
  });
}

function idStr(maybeId) {
  return typeof maybeId === 'string' ? maybeId : maybeId.toString();
}

describe('Leave Request API', () => {
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

  // ==================================================================
  // Authorization
  // ==================================================================
  describe('Authorization', () => {
    it('GET / returns 401 without a token', async () => {
      const res = await http('GET', '/api/leave-requests');
      assert.equal(res.status, 401);
    });

    it('GET / returns 403 for an employee user', async () => {
      const { user } = await makeEmployeeUser();
      const token = await issueTokenFor(user);
      const res = await http('GET', '/api/leave-requests', { token });
      assert.equal(res.status, 403);
    });

    it('POST / is allowed for any authenticated user (Employee or Admin)', async () => {
      const { user: admin } = await makeAdmin();
      const adminToken = await issueTokenFor(admin);
      const e = await makeEmployeeDoc();
      const res = await http('POST', '/api/leave-requests', {
        token: adminToken,
        body: { ...baseBody(), employeeId: idStr(e._id) },
      });
      assert.equal(res.status, 201);
    });

    it('POST / without token returns 401', async () => {
      const res = await http('POST', '/api/leave-requests', { body: baseBody() });
      assert.equal(res.status, 401);
    });

    it('PATCH /:id/approve returns 403 for an employee user', async () => {
      const { user } = await makeEmployeeUser();
      const token = await issueTokenFor(user);
      const res = await http('PATCH', '/api/leave-requests/64b000000000000000000000/approve', {
        body: {},
        token,
      });
      assert.equal(res.status, 403);
    });

    it('PATCH /:id/reject returns 403 for an employee user', async () => {
      const { user } = await makeEmployeeUser();
      const token = await issueTokenFor(user);
      const res = await http('PATCH', '/api/leave-requests/64b000000000000000000000/reject', {
        body: {},
        token,
      });
      assert.equal(res.status, 403);
    });

    it('invalid token returns 401', async () => {
      const res = await http('GET', '/api/leave-requests', { token: 'not-a-jwt' });
      assert.equal(res.status, 401);
    });
  });

  // ==================================================================
  // POST /api/leave-requests — create
  // ==================================================================
  describe('POST /api/leave-requests — create', () => {
    it('Employee creates own request successfully → 201', async () => {
      const { user: worker } = await makeEmployeeUser();
      const token = await issueTokenFor(worker);
      const myEmployee = await makeEmployeeDoc({ userId: worker._id });

      const res = await http('POST', '/api/leave-requests', {
        token,
        body: baseBody(),
      });
      assert.equal(res.status, 201);
      assert.equal(res.body.data.status, 'pending');
      assert.equal(res.body.data.employeeId, idStr(myEmployee._id));
      assert.equal(res.body.data.leaveType, 'annual');
      // reason lưu trong DB
      assert.equal(res.body.data.reason, 'Family vacation');
      // reviewedBy null khi mới tạo
      assert.equal(res.body.data.reviewedBy, null);
      assert.equal(res.body.data.reviewedAt, null);
      assert.equal(res.body.data.reviewNote, '');
      assert.ok(res.body.data.createdAt);
      assert.ok(res.body.data.updatedAt);
    });

    it('Employee cannot pass employeeId — it is ignored (linked Employee used)', async () => {
      const { user: worker } = await makeEmployeeUser();
      const token = await issueTokenFor(worker);
      const myEmployee = await makeEmployeeDoc({ userId: worker._id });
      const otherEmployee = await makeEmployeeDoc();

      const res = await http('POST', '/api/leave-requests', {
        token,
        body: baseBody({ employeeId: idStr(otherEmployee._id) }),
      });
      assert.equal(res.status, 201);
      assert.equal(res.body.data.employeeId, idStr(myEmployee._id));
    });

    it('Admin creates on behalf of an employee with explicit employeeId', async () => {
      const { user: admin } = await makeAdmin();
      const token = await issueTokenFor(admin);
      const e = await makeEmployeeDoc();

      const res = await http('POST', '/api/leave-requests', {
        token,
        body: { ...baseBody(), employeeId: idStr(e._id) },
      });
      assert.equal(res.status, 201);
      assert.equal(res.body.data.employeeId, idStr(e._id));
    });

    it('Admin without employeeId → 400', async () => {
      const { user: admin } = await makeAdmin();
      const token = await issueTokenFor(admin);
      const res = await http('POST', '/api/leave-requests', {
        token,
        body: baseBody(),
      });
      assert.equal(res.status, 400);
      assert.equal(res.body.error.field, 'employeeId');
    });

    it('Returns 404 if the authenticated user has no linked Employee', async () => {
      const { user: worker } = await makeEmployeeUser();
      const token = await issueTokenFor(worker);
      // Không tạo Employee cho user này.
      const res = await http('POST', '/api/leave-requests', {
        token,
        body: baseBody(),
      });
      assert.equal(res.status, 404);
      assert.equal(res.body.error.code, 'EMPLOYEE_NOT_FOUND');
    });

    it('Rejects unknown leaveType', async () => {
      const { user: worker } = await makeEmployeeUser();
      const token = await issueTokenFor(worker);
      await makeEmployeeDoc({ userId: worker._id });
      const res = await http('POST', '/api/leave-requests', {
        token,
        body: baseBody({ leaveType: 'maternity' }),
      });
      assert.equal(res.status, 400);
    });

    it('Rejects missing reason', async () => {
      const { user: worker } = await makeEmployeeUser();
      const token = await issueTokenFor(worker);
      await makeEmployeeDoc({ userId: worker._id });
      const res = await http('POST', '/api/leave-requests', {
        token,
        body: { ...baseBody(), reason: undefined },
      });
      assert.equal(res.status, 400);
    });

    it('Rejects reason too short (after trim)', async () => {
      const { user: worker } = await makeEmployeeUser();
      const token = await issueTokenFor(worker);
      await makeEmployeeDoc({ userId: worker._id });
      const res = await http('POST', '/api/leave-requests', {
        token,
        body: baseBody({ reason: '  ' }),
      });
      assert.equal(res.status, 400);
    });

    it('Rejects endDate < startDate', async () => {
      const { user: worker } = await makeEmployeeUser();
      const token = await issueTokenFor(worker);
      await makeEmployeeDoc({ userId: worker._id });
      const res = await http('POST', '/api/leave-requests', {
        token,
        body: baseBody({ startDate: '2026-12-10', endDate: '2026-12-05' }),
      });
      assert.equal(res.status, 400);
      assert.equal(res.body.error.field, 'endDate');
    });

    it('Rejects invalid date format', async () => {
      const { user: worker } = await makeEmployeeUser();
      const token = await issueTokenFor(worker);
      await makeEmployeeDoc({ userId: worker._id });
      const res = await http('POST', '/api/leave-requests', {
        token,
        body: baseBody({ startDate: '12/01/2026' }),
      });
      assert.equal(res.status, 400);
    });

    it('Rejects client-set status field', async () => {
      const { user: worker } = await makeEmployeeUser();
      const token = await issueTokenFor(worker);
      await makeEmployeeDoc({ userId: worker._id });
      const res = await http('POST', '/api/leave-requests', {
        token,
        body: { ...baseBody(), status: 'approved' },
      });
      assert.equal(res.status, 400);
    });

    it('Rejects client-set reviewedBy / reviewedAt / reviewNote', async () => {
      const { user: worker } = await makeEmployeeUser();
      const token = await issueTokenFor(worker);
      await makeEmployeeDoc({ userId: worker._id });
      const r1 = await http('POST', '/api/leave-requests', {
        token,
        body: { ...baseBody(), reviewedBy: '64b000000000000000000000' },
      });
      assert.equal(r1.status, 400);
      const r2 = await http('POST', '/api/leave-requests', {
        token,
        body: { ...baseBody(), reviewedAt: '2026-12-01' },
      });
      assert.equal(r2.status, 400);
      const r3 = await http('POST', '/api/leave-requests', {
        token,
        body: { ...baseBody(), reviewNote: 'self-approved' },
      });
      assert.equal(r3.status, 400);
    });
  });

  // ==================================================================
  // Overlap check on create
  // ==================================================================
  describe('Overlap check on create', () => {
    it('rejects overlapping pending request for same employee', async () => {
      const { user: worker } = await makeEmployeeUser();
      const token = await issueTokenFor(worker);
      const myEmployee = await makeEmployeeDoc({ userId: worker._id });

      // First request: 2026-12-01 to 2026-12-05
      const r1 = await http('POST', '/api/leave-requests', {
        token,
        body: baseBody({ startDate: '2026-12-01', endDate: '2026-12-05' }),
      });
      assert.equal(r1.status, 201);

      // Second: 2026-12-03 to 2026-12-10 → overlap ngày 03, 04, 05.
      const r2 = await http('POST', '/api/leave-requests', {
        token,
        body: baseBody({ startDate: '2026-12-03', endDate: '2026-12-10' }),
      });
      assert.equal(r2.status, 409);
      assert.equal(r2.body.error.code, 'LEAVE_OVERLAP');
    });

    it('rejects when new range is fully contained inside existing', async () => {
      const { user: worker } = await makeEmployeeUser();
      const token = await issueTokenFor(worker);
      await makeEmployeeDoc({ userId: worker._id });

      const r1 = await http('POST', '/api/leave-requests', {
        token,
        body: baseBody({ startDate: '2026-12-01', endDate: '2026-12-31' }),
      });
      assert.equal(r1.status, 201);
      const r2 = await http('POST', '/api/leave-requests', {
        token,
        body: baseBody({ startDate: '2026-12-10', endDate: '2026-12-15' }),
      });
      assert.equal(r2.status, 409);
    });

    it('rejects when existing range is fully contained inside new', async () => {
      const { user: worker } = await makeEmployeeUser();
      const token = await issueTokenFor(worker);
      await makeEmployeeDoc({ userId: worker._id });

      const r1 = await http('POST', '/api/leave-requests', {
        token,
        body: baseBody({ startDate: '2026-12-10', endDate: '2026-12-15' }),
      });
      assert.equal(r1.status, 201);
      const r2 = await http('POST', '/api/leave-requests', {
        token,
        body: baseBody({ startDate: '2026-12-01', endDate: '2026-12-31' }),
      });
      assert.equal(r2.status, 409);
    });

    it('rejects touching at boundary (2026-12-05 == 2026-12-05)', async () => {
      const { user: worker } = await makeEmployeeUser();
      const token = await issueTokenFor(worker);
      await makeEmployeeDoc({ userId: worker._id });

      const r1 = await http('POST', '/api/leave-requests', {
        token,
        body: baseBody({ startDate: '2026-12-01', endDate: '2026-12-05' }),
      });
      assert.equal(r1.status, 201);
      const r2 = await http('POST', '/api/leave-requests', {
        token,
        body: baseBody({ startDate: '2026-12-05', endDate: '2026-12-10' }),
      });
      // [01,05] vs [05,10]: overlap 05 → 409
      assert.equal(r2.status, 409);
    });

    it('accepts non-overlapping adjacent ranges', async () => {
      const { user: worker } = await makeEmployeeUser();
      const token = await issueTokenFor(worker);
      await makeEmployeeDoc({ userId: worker._id });

      const r1 = await http('POST', '/api/leave-requests', {
        token,
        body: baseBody({ startDate: '2026-12-01', endDate: '2026-12-05' }),
      });
      assert.equal(r1.status, 201);
      const r2 = await http('POST', '/api/leave-requests', {
        token,
        body: baseBody({ startDate: '2026-12-06', endDate: '2026-12-10' }),
      });
      assert.equal(r2.status, 201);
    });

    it('rejected request does NOT block new request at same dates', async () => {
      const { user: worker } = await makeEmployeeUser();
      const token = await issueTokenFor(worker);
      await makeEmployeeDoc({ userId: worker._id });

      // Tạo đơn pending đầu tiên.
      const r1 = await http('POST', '/api/leave-requests', {
        token,
        body: baseBody({ startDate: '2026-12-01', endDate: '2026-12-05' }),
      });
      const id1 = r1.body.data.id || r1.body.data._id;

      // Admin reject đơn đầu.
      const { user: admin } = await makeAdmin();
      const adminToken = await issueTokenFor(admin);
      const rejectRes = await http('PATCH', `/api/leave-requests/${id1}/reject`, {
        token: adminToken,
        body: {},
      });
      assert.equal(rejectRes.status, 200);
      assert.equal(rejectRes.body.data.status, 'rejected');

      // Tạo đơn mới cùng ngày → OK vì rejected không block.
      const r2 = await http('POST', '/api/leave-requests', {
        token,
        body: baseBody({ startDate: '2026-12-01', endDate: '2026-12-05' }),
      });
      assert.equal(r2.status, 201);
    });

    it('cancelled request does NOT block new request at same dates', async () => {
      const { user: worker } = await makeEmployeeUser();
      const token = await issueTokenFor(worker);
      await makeEmployeeDoc({ userId: worker._id });

      const r1 = await http('POST', '/api/leave-requests', {
        token,
        body: baseBody({ startDate: '2026-12-01', endDate: '2026-12-05' }),
      });
      const id1 = r1.body.data.id || r1.body.data._id;

      const cancelRes = await http('PATCH', `/api/leave-requests/${id1}/cancel`, {
        token,
      });
      assert.equal(cancelRes.status, 200);
      assert.equal(cancelRes.body.data.status, 'cancelled');

      const r2 = await http('POST', '/api/leave-requests', {
        token,
        body: baseBody({ startDate: '2026-12-01', endDate: '2026-12-05' }),
      });
      assert.equal(r2.status, 201);
    });

    it('approved request DOES block new request at same dates', async () => {
      const { user: admin } = await makeAdmin();
      const adminToken = await issueTokenFor(admin);
      const e = await makeEmployeeDoc();
      // Tạo + approve đơn 1.
      const r1 = await http('POST', '/api/leave-requests', {
        token: adminToken,
        body: { ...baseBody(), employeeId: idStr(e._id) },
      });
      const id1 = r1.body.data.id || r1.body.data._id;
      const approveRes = await http('PATCH', `/api/leave-requests/${id1}/approve`, {
        token: adminToken,
        body: {},
      });
      assert.equal(approveRes.status, 200);
      assert.equal(approveRes.body.data.status, 'approved');

      // Tạo đơn 2 cùng ngày → 409.
      const r2 = await http('POST', '/api/leave-requests', {
        token: adminToken,
        body: { ...baseBody(), employeeId: idStr(e._id) },
      });
      assert.equal(r2.status, 409);
      assert.equal(r2.body.error.code, 'LEAVE_OVERLAP');
    });
  });

  // ==================================================================
  // GET /api/leave-requests — admin list
  // ==================================================================
  describe('GET /api/leave-requests — admin list', () => {
    it('returns paginated results', async () => {
      const { user: admin } = await makeAdmin();
      const token = await issueTokenFor(admin);
      const e = await makeEmployeeDoc();
      for (let i = 0; i < 5; i++) {
        await createLeave(e._id, {
          startDate: new Date(Date.UTC(2026, 11, i + 1)),
          endDate: new Date(Date.UTC(2026, 11, i + 1)),
        });
      }
      const res = await http('GET', '/api/leave-requests?limit=2&page=1', { token });
      assert.equal(res.status, 200);
      assert.equal(res.body.data.length, 2);
      assert.equal(res.body.pagination.total, 5);
      assert.equal(res.body.pagination.totalPages, 3);
    });

    it('caps limit at 100', async () => {
      const { user: admin } = await makeAdmin();
      const token = await issueTokenFor(admin);
      const res = await http('GET', '/api/leave-requests?limit=500', { token });
      assert.equal(res.status, 400);
    });

    it('filters by employeeId', async () => {
      const { user: admin } = await makeAdmin();
      const token = await issueTokenFor(admin);
      const e1 = await makeEmployeeDoc();
      const e2 = await makeEmployeeDoc();
      await createLeave(e1._id, { reason: 'reason r1' });
      await createLeave(e2._id, { reason: 'reason r2' });
      const res = await http(
        'GET',
        `/api/leave-requests?employeeId=${idStr(e1._id)}`,
        { token },
      );
      assert.equal(res.status, 200);
      assert.equal(res.body.data.length, 1);
      assert.equal(res.body.data[0].employeeId, idStr(e1._id));
    });

    it('filters by status', async () => {
      const { user: admin } = await makeAdmin();
      const token = await issueTokenFor(admin);
      const e = await makeEmployeeDoc();
      await createLeave(e._id, { status: 'pending' });
      await createLeave(e._id, { status: 'approved' });
      const res = await http('GET', '/api/leave-requests?status=approved', { token });
      assert.equal(res.status, 200);
      for (const d of res.body.data) {
        assert.equal(d.status, 'approved');
      }
    });

    it('rejects invalid status filter', async () => {
      const { user: admin } = await makeAdmin();
      const token = await issueTokenFor(admin);
      const res = await http('GET', '/api/leave-requests?status=bogus', { token });
      assert.equal(res.status, 400);
    });

    it('filters by startDate and endDate (inclusive)', async () => {
      const { user: admin } = await makeAdmin();
      const token = await issueTokenFor(admin);
      const e = await makeEmployeeDoc();
      await createLeave(e._id, {
        startDate: new Date(Date.UTC(2026, 11, 5)),
        endDate: new Date(Date.UTC(2026, 11, 5)),
      });
      await createLeave(e._id, {
        startDate: new Date(Date.UTC(2026, 11, 25)),
        endDate: new Date(Date.UTC(2026, 11, 25)),
      });
      const res = await http(
        'GET',
        '/api/leave-requests?startDate=2026-12-01&endDate=2026-12-10',
        { token },
      );
      assert.equal(res.status, 200);
      assert.equal(res.body.data.length, 1);
    });

    it('rejects sort field outside allowlist', async () => {
      const { user: admin } = await makeAdmin();
      const token = await issueTokenFor(admin);
      const res = await http('GET', '/api/leave-requests?sort=reason', { token });
      assert.equal(res.status, 400);
    });
  });

  // ==================================================================
  // GET /api/leave-requests/me
  // ==================================================================
  describe('GET /api/leave-requests/me — self-list', () => {
    it('returns 404 when user has no linked Employee', async () => {
      const { user: worker } = await makeEmployeeUser();
      const token = await issueTokenFor(worker);
      const res = await http('GET', '/api/leave-requests/me', { token });
      assert.equal(res.status, 404);
      assert.equal(res.body.error.code, 'EMPLOYEE_NOT_FOUND');
    });

    it('returns only own records (ignores employeeId query param)', async () => {
      const { user: worker } = await makeEmployeeUser();
      const token = await issueTokenFor(worker);
      const myEmployee = await makeEmployeeDoc({ userId: worker._id });
      const otherEmployee = await makeEmployeeDoc();
      await createLeave(myEmployee._id, { reason: 'mine' });
      await createLeave(otherEmployee._id, { reason: 'other' });

      const res = await http(
        'GET',
        `/api/leave-requests/me?employeeId=${idStr(otherEmployee._id)}`,
        { token },
      );
      assert.equal(res.status, 200);
      assert.equal(res.body.data.length, 1);
      assert.equal(res.body.data[0].employeeId, idStr(myEmployee._id));
    });

    it('filters by status / leaveType', async () => {
      const { user: worker } = await makeEmployeeUser();
      const token = await issueTokenFor(worker);
      const myEmployee = await makeEmployeeDoc({ userId: worker._id });
      await createLeave(myEmployee._id, { leaveType: 'annual' });
      await createLeave(myEmployee._id, { leaveType: 'sick' });
      const res = await http('GET', '/api/leave-requests/me?leaveType=sick', { token });
      assert.equal(res.status, 200);
      assert.equal(res.body.data.length, 1);
      assert.equal(res.body.data[0].leaveType, 'sick');
    });
  });

  // ==================================================================
  // GET /api/leave-requests/:id
  // ==================================================================
  describe('GET /api/leave-requests/:id — detail', () => {
    it('Admin can view any record', async () => {
      const { user: admin } = await makeAdmin();
      const token = await issueTokenFor(admin);
      const e = await makeEmployeeDoc();
      const r = await createLeave(e._id);
      const res = await http('GET', `/api/leave-requests/${idStr(r._id)}`, { token });
      assert.equal(res.status, 200);
      assert.equal(res.body.data.employeeId, idStr(e._id));
    });

    it('Employee can view own record', async () => {
      const { user: worker } = await makeEmployeeUser();
      const token = await issueTokenFor(worker);
      const myEmployee = await makeEmployeeDoc({ userId: worker._id });
      const r = await createLeave(myEmployee._id);
      const res = await http('GET', `/api/leave-requests/${idStr(r._id)}`, { token });
      assert.equal(res.status, 200);
    });

    it('Employee gets 404 (not 403) for someone else\'s record', async () => {
      const { user: worker } = await makeEmployeeUser();
      const token = await issueTokenFor(worker);
      const otherEmployee = await makeEmployeeDoc();
      const r = await createLeave(otherEmployee._id);
      const res = await http('GET', `/api/leave-requests/${idStr(r._id)}`, { token });
      assert.equal(res.status, 404);
      assert.equal(res.body.error.code, 'LEAVE_REQUEST_NOT_FOUND');
    });

    it('Invalid id format → 400', async () => {
      const { user: admin } = await makeAdmin();
      const token = await issueTokenFor(admin);
      const res = await http('GET', '/api/leave-requests/not-an-id', { token });
      assert.equal(res.status, 400);
    });

    it('Non-existent id → 404', async () => {
      const { user: admin } = await makeAdmin();
      const token = await issueTokenFor(admin);
      const res = await http('GET', '/api/leave-requests/64b000000000000000000000', { token });
      assert.equal(res.status, 404);
    });
  });

  // ==================================================================
  // PATCH /api/leave-requests/:id — update
  // ==================================================================
  describe('PATCH /api/leave-requests/:id — update', () => {
    it('Employee updates own pending request → 200', async () => {
      const { user: worker } = await makeEmployeeUser();
      const token = await issueTokenFor(worker);
      const myEmployee = await makeEmployeeDoc({ userId: worker._id });
      const r = await createLeave(myEmployee._id, {
        startDate: new Date(Date.UTC(2026, 11, 1)),
        endDate: new Date(Date.UTC(2026, 11, 3)),
      });
      const res = await http('PATCH', `/api/leave-requests/${idStr(r._id)}`, {
        token,
        body: {
          startDate: '2026-12-05',
          endDate: '2026-12-07',
          reason: 'updated reason',
        },
      });
      assert.equal(res.status, 200);
      assert.equal(res.body.data.reason, 'updated reason');
    });

    it('Employee cannot update when status is approved', async () => {
      const { user: admin } = await makeAdmin();
      const adminToken = await issueTokenFor(admin);
      const { user: worker } = await makeEmployeeUser();
      const token = await issueTokenFor(worker);
      const myEmployee = await makeEmployeeDoc({ userId: worker._id });
      const r = await createLeave(myEmployee._id, {
        status: 'approved',
        reviewedBy: admin._id,
        reviewedAt: new Date(),
      });
      const res = await http('PATCH', `/api/leave-requests/${idStr(r._id)}`, {
        token,
        body: { reason: 'try update' },
      });
      assert.equal(res.status, 409);
      assert.equal(res.body.error.code, 'INVALID_STATE');
    });

    it('Employee cannot update someone else\'s record → 404', async () => {
      const { user: worker } = await makeEmployeeUser();
      const token = await issueTokenFor(worker);
      const otherEmployee = await makeEmployeeDoc();
      const r = await createLeave(otherEmployee._id);
      const res = await http('PATCH', `/api/leave-requests/${idStr(r._id)}`, {
        token,
        body: { reason: 'hostile' },
      });
      assert.equal(res.status, 404);
    });

    it('Admin cannot PATCH (must use /approve or /reject)', async () => {
      const { user: admin } = await makeAdmin();
      const token = await issueTokenFor(admin);
      const e = await makeEmployeeDoc();
      const r = await createLeave(e._id);
      const res = await http('PATCH', `/api/leave-requests/${idStr(r._id)}`, {
        token,
        body: { reason: 'try' },
      });
      assert.equal(res.status, 403);
    });

    it('Rejects system fields on update', async () => {
      const { user: worker } = await makeEmployeeUser();
      const token = await issueTokenFor(worker);
      const myEmployee = await makeEmployeeDoc({ userId: worker._id });
      const r = await createLeave(myEmployee._id);
      const res = await http('PATCH', `/api/leave-requests/${idStr(r._id)}`, {
        token,
        body: { status: 'approved' },
      });
      assert.equal(res.status, 400);
    });

    it('Rejects empty body (no allowed fields)', async () => {
      const { user: worker } = await makeEmployeeUser();
      const token = await issueTokenFor(worker);
      const myEmployee = await makeEmployeeDoc({ userId: worker._id });
      const r = await createLeave(myEmployee._id);
      const res = await http('PATCH', `/api/leave-requests/${idStr(r._id)}`, {
        token,
        body: {},
      });
      assert.equal(res.status, 400);
    });

    it('Update triggers overlap check (excluding itself)', async () => {
      const { user: worker } = await makeEmployeeUser();
      const token = await issueTokenFor(worker);
      const myEmployee = await makeEmployeeDoc({ userId: worker._id });
      // Tạo 2 đơn pending không overlap ban đầu.
      const r1 = await createLeave(myEmployee._id, {
        startDate: new Date(Date.UTC(2026, 11, 1)),
        endDate: new Date(Date.UTC(2026, 11, 5)),
        reason: 'first leave',
      });
      await createLeave(myEmployee._id, {
        startDate: new Date(Date.UTC(2026, 11, 10)),
        endDate: new Date(Date.UTC(2026, 11, 15)),
        reason: 'second leave',
      });
      // Cập nhật r1 để overlap với đơn 2 → 409.
      const res = await http('PATCH', `/api/leave-requests/${idStr(r1._id)}`, {
        token,
        body: { startDate: '2026-12-12', endDate: '2026-12-20', reason: 'updated reason here' },
      });
      assert.equal(res.status, 409);
      assert.equal(res.body.error.code, 'LEAVE_OVERLAP');
    });
  });

  // ==================================================================
  // PATCH /api/leave-requests/:id/cancel
  // ==================================================================
  describe('PATCH /api/leave-requests/:id/cancel', () => {
    it('Employee cancels own pending → 200', async () => {
      const { user: worker } = await makeEmployeeUser();
      const token = await issueTokenFor(worker);
      const myEmployee = await makeEmployeeDoc({ userId: worker._id });
      const r = await createLeave(myEmployee._id);
      const res = await http('PATCH', `/api/leave-requests/${idStr(r._id)}/cancel`, {
        token,
      });
      assert.equal(res.status, 200);
      assert.equal(res.body.data.status, 'cancelled');
    });

    it('Cancel is idempotent: second call returns alreadyCancelled', async () => {
      const { user: worker } = await makeEmployeeUser();
      const token = await issueTokenFor(worker);
      const myEmployee = await makeEmployeeDoc({ userId: worker._id });
      const r = await createLeave(myEmployee._id);
      await http('PATCH', `/api/leave-requests/${idStr(r._id)}/cancel`, { token });
      const res = await http('PATCH', `/api/leave-requests/${idStr(r._id)}/cancel`, {
        token,
      });
      assert.equal(res.status, 200);
      assert.equal(res.body.meta && res.body.meta.alreadyCancelled, true);
    });

    it('Cannot cancel approved request → 409', async () => {
      const { user: admin } = await makeAdmin();
      const adminToken = await issueTokenFor(admin);
      const { user: worker } = await makeEmployeeUser();
      const token = await issueTokenFor(worker);
      const myEmployee = await makeEmployeeDoc({ userId: worker._id });
      const r = await createLeave(myEmployee._id, {
        status: 'approved',
        reviewedBy: admin._id,
        reviewedAt: new Date(),
      });
      const res = await http('PATCH', `/api/leave-requests/${idStr(r._id)}/cancel`, {
        token,
      });
      assert.equal(res.status, 409);
      assert.equal(res.body.error.code, 'INVALID_STATE');
    });

    it('Employee cannot cancel someone else\'s request → 404', async () => {
      const { user: worker } = await makeEmployeeUser();
      const token = await issueTokenFor(worker);
      const otherEmployee = await makeEmployeeDoc();
      const r = await createLeave(otherEmployee._id);
      const res = await http('PATCH', `/api/leave-requests/${idStr(r._id)}/cancel`, {
        token,
      });
      assert.equal(res.status, 404);
    });

    it('Admin cannot cancel (use reject) → 403', async () => {
      const { user: admin } = await makeAdmin();
      const token = await issueTokenFor(admin);
      const e = await makeEmployeeDoc();
      const r = await createLeave(e._id);
      const res = await http('PATCH', `/api/leave-requests/${idStr(r._id)}/cancel`, {
        token,
      });
      assert.equal(res.status, 403);
    });
  });

  // ==================================================================
  // PATCH /api/leave-requests/:id/approve
  // ==================================================================
  describe('PATCH /api/leave-requests/:id/approve', () => {
    it('Admin approves pending request → 200 with reviewedBy/reviewedAt', async () => {
      const { user: admin } = await makeAdmin();
      const token = await issueTokenFor(admin);
      const e = await makeEmployeeDoc();
      const r = await createLeave(e._id);
      const res = await http('PATCH', `/api/leave-requests/${idStr(r._id)}/approve`, {
        token,
        body: { reviewNote: 'OK' },
      });
      assert.equal(res.status, 200);
      assert.equal(res.body.data.status, 'approved');
      assert.equal(res.body.data.reviewedBy, idStr(admin._id));
      assert.ok(res.body.data.reviewedAt);
      assert.equal(res.body.data.reviewNote, 'OK');
    });

    it('Approving non-pending → 409', async () => {
      const { user: admin } = await makeAdmin();
      const token = await issueTokenFor(admin);
      const e = await makeEmployeeDoc();
      const r = await createLeave(e._id, { status: 'rejected' });
      const res = await http('PATCH', `/api/leave-requests/${idStr(r._id)}/approve`, {
        token,
        body: {},
      });
      assert.equal(res.status, 409);
      assert.equal(res.body.error.code, 'INVALID_STATE');
    });

    it('Approve checks overlap → 409 if another blocking request overlaps', async () => {
      const { user: admin } = await makeAdmin();
      const token = await issueTokenFor(admin);
      const e = await makeEmployeeDoc();
      // Tạo 2 đơn pending ở 2 khoảng KHÁC NHAU.
      const r1 = await createLeave(e._id, {
        startDate: new Date(Date.UTC(2026, 11, 1)),
        endDate: new Date(Date.UTC(2026, 11, 5)),
        reason: 'leave r1',
      });
      const r3 = await createLeave(e._id, {
        startDate: new Date(Date.UTC(2026, 11, 10)),
        endDate: new Date(Date.UTC(2026, 11, 15)),
        reason: 'leave r3',
      });

      // Duyệt r1 OK.
      const approve1 = await http('PATCH', `/api/leave-requests/${idStr(r1._id)}/approve`, {
        token,
        body: {},
      });
      assert.equal(approve1.status, 200);

      // Cập nhật r3 để overlap với r1 (đã approved) thông qua DB. Admin
      // không thể PATCH qua API, nên dùng mongoose để simulate việc sửa
      // ngày thủ công trước khi approve.
      await LeaveRequest.updateOne(
        { _id: r3._id },
        {
          startDate: new Date(Date.UTC(2026, 11, 1)),
          endDate: new Date(Date.UTC(2026, 11, 5)),
        },
      );

      // Approve r3 → service check overlap với r1 (approved) → 409.
      const res = await http('PATCH', `/api/leave-requests/${idStr(r3._id)}/approve`, {
        token,
        body: {},
      });
      assert.equal(res.status, 409);
      assert.equal(res.body.error.code, 'LEAVE_OVERLAP');
    });

    it('Rejects system fields in review body', async () => {
      const { user: admin } = await makeAdmin();
      const token = await issueTokenFor(admin);
      const e = await makeEmployeeDoc();
      const r = await createLeave(e._id);
      const res = await http('PATCH', `/api/leave-requests/${idStr(r._id)}/approve`, {
        token,
        body: { status: 'rejected' },
      });
      assert.equal(res.status, 400);
    });

    it('Admin can approve without reviewNote', async () => {
      const { user: admin } = await makeAdmin();
      const token = await issueTokenFor(admin);
      const e = await makeEmployeeDoc();
      const r = await createLeave(e._id);
      const res = await http('PATCH', `/api/leave-requests/${idStr(r._id)}/approve`, {
        token,
        body: {},
      });
      assert.equal(res.status, 200);
      assert.equal(res.body.data.reviewNote, '');
    });
  });

  // ==================================================================
  // PATCH /api/leave-requests/:id/reject
  // ==================================================================
  describe('PATCH /api/leave-requests/:id/reject', () => {
    it('Admin rejects pending request → 200', async () => {
      const { user: admin } = await makeAdmin();
      const token = await issueTokenFor(admin);
      const e = await makeEmployeeDoc();
      const r = await createLeave(e._id);
      const res = await http('PATCH', `/api/leave-requests/${idStr(r._id)}/reject`, {
        token,
        body: { reviewNote: 'no thanks' },
      });
      assert.equal(res.status, 200);
      assert.equal(res.body.data.status, 'rejected');
      assert.equal(res.body.data.reviewedBy, idStr(admin._id));
      assert.equal(res.body.data.reviewNote, 'no thanks');
    });

    it('Rejecting non-pending → 409', async () => {
      const { user: admin } = await makeAdmin();
      const token = await issueTokenFor(admin);
      const e = await makeEmployeeDoc();
      const r = await createLeave(e._id, { status: 'cancelled' });
      const res = await http('PATCH', `/api/leave-requests/${idStr(r._id)}/reject`, {
        token,
        body: {},
      });
      assert.equal(res.status, 409);
    });
  });

  // ==================================================================
  // Soft-deleted Employee (R1, R2, R3)
  // ==================================================================
  describe('Soft-deleted Employee', () => {
    it('POST / returns 404 if the linked Employee has been soft-deleted', async () => {
      const { user: worker } = await makeEmployeeUser();
      const token = await issueTokenFor(worker);
      const e = await makeEmployeeDoc({ userId: worker._id, isDeleted: true });
      const res = await http('POST', '/api/leave-requests', {
        token,
        body: baseBody({ employeeId: idStr(e._id) }),
      });
      assert.equal(res.status, 404);
      assert.equal(res.body.error.code, 'EMPLOYEE_NOT_FOUND');
    });

    it('GET /me returns 404 if the linked Employee has been soft-deleted', async () => {
      const { user: worker } = await makeEmployeeUser();
      const token = await issueTokenFor(worker);
      await makeEmployeeDoc({ userId: worker._id, isDeleted: true });
      const res = await http('GET', '/api/leave-requests/me', { token });
      assert.equal(res.status, 404);
      assert.equal(res.body.error.code, 'EMPLOYEE_NOT_FOUND');
    });

    it('PATCH /:id returns 404 if owner Employee has been soft-deleted', async () => {
      const { user: worker } = await makeEmployeeUser();
      const token = await issueTokenFor(worker);
      const e = await makeEmployeeDoc({ userId: worker._id, isDeleted: true });
      // Tạo đơn thẳng DB (giả lập trạng thái trước khi soft-delete).
      const r = await createLeave(e._id);
      const res = await http('PATCH', `/api/leave-requests/${idStr(r._id)}`, {
        token,
        body: { reason: 'try to update' },
      });
      assert.equal(res.status, 404);
    });

    it('PATCH /:id/cancel returns 404 if owner Employee has been soft-deleted', async () => {
      const { user: worker } = await makeEmployeeUser();
      const token = await issueTokenFor(worker);
      const e = await makeEmployeeDoc({ userId: worker._id, isDeleted: true });
      const r = await createLeave(e._id);
      const res = await http('PATCH', `/api/leave-requests/${idStr(r._id)}/cancel`, {
        token,
      });
      assert.equal(res.status, 404);
    });

    it('GET /:id returns 404 if owner Employee has been soft-deleted', async () => {
      const { user: worker } = await makeEmployeeUser();
      const token = await issueTokenFor(worker);
      const e = await makeEmployeeDoc({ userId: worker._id, isDeleted: true });
      const r = await createLeave(e._id);
      const res = await http('GET', `/api/leave-requests/${idStr(r._id)}`, { token });
      assert.equal(res.status, 404);
    });

    it('Admin POST on soft-deleted Employee → 400 (existing active check)', async () => {
      const { user: admin } = await makeAdmin();
      const token = await issueTokenFor(admin);
      const e = await makeEmployeeDoc({ isDeleted: true });
      const res = await http('POST', '/api/leave-requests', {
        token,
        body: { ...baseBody(), employeeId: idStr(e._id) },
      });
      assert.equal(res.status, 400);
      assert.equal(res.body.error.field, 'employeeId');
    });
  });

  // ==================================================================
  // Date filter edge cases (R4)
  // ==================================================================
  describe('Date range filter (R4)', () => {
    it('returns request whose startDate is before filter window but endDate inside', async () => {
      const { user: admin } = await makeAdmin();
      const token = await issueTokenFor(admin);
      const e = await makeEmployeeDoc();
      // Đơn kéo dài 2026-11-15 .. 2026-12-15, user filter 2026-12-01..2026-12-31
      await createLeave(e._id, {
        startDate: new Date(Date.UTC(2026, 10, 15)),
        endDate: new Date(Date.UTC(2026, 11, 15)),
        reason: 'long leave',
      });
      const res = await http(
        'GET',
        '/api/leave-requests?startDate=2026-12-01&endDate=2026-12-31',
        { token },
      );
      assert.equal(res.status, 200);
      assert.equal(res.body.data.length, 1);
    });

    it('excludes request that ends before filter window', async () => {
      const { user: admin } = await makeAdmin();
      const token = await issueTokenFor(admin);
      const e = await makeEmployeeDoc();
      // Đơn kết thúc 2026-11-10, user filter từ 2026-12-01 trở đi
      await createLeave(e._id, {
        startDate: new Date(Date.UTC(2026, 10, 1)),
        endDate: new Date(Date.UTC(2026, 10, 10)),
        reason: 'past leave',
      });
      const res = await http(
        'GET',
        '/api/leave-requests?startDate=2026-12-01',
        { token },
      );
      assert.equal(res.status, 200);
      assert.equal(res.body.data.length, 0);
    });

    it('includes request touching filter boundary (inclusive)', async () => {
      const { user: admin } = await makeAdmin();
      const token = await issueTokenFor(admin);
      const e = await makeEmployeeDoc();
      // Đơn endDate = filter startDate
      await createLeave(e._id, {
        startDate: new Date(Date.UTC(2026, 10, 1)),
        endDate: new Date(Date.UTC(2026, 11, 1)),
        reason: 'boundary',
      });
      const res = await http(
        'GET',
        '/api/leave-requests?startDate=2026-12-01',
        { token },
      );
      assert.equal(res.status, 200);
      assert.equal(res.body.data.length, 1);
    });
  });

  // ==================================================================
  // Pagination edge cases (R6)
  // ==================================================================
  describe('Pagination edge cases', () => {
    it('rejects page = 0', async () => {
      const { user: admin } = await makeAdmin();
      const token = await issueTokenFor(admin);
      const res = await http('GET', '/api/leave-requests?page=0', { token });
      assert.equal(res.status, 400);
      assert.equal(res.body.error.field, 'page');
    });

    it('rejects negative page', async () => {
      const { user: admin } = await makeAdmin();
      const token = await issueTokenFor(admin);
      const res = await http('GET', '/api/leave-requests?page=-1', { token });
      assert.equal(res.status, 400);
    });

    it('returns empty data on page beyond total', async () => {
      const { user: admin } = await makeAdmin();
      const token = await issueTokenFor(admin);
      const e = await makeEmployeeDoc();
      await createLeave(e._id);
      const res = await http('GET', '/api/leave-requests?page=99&limit=10', { token });
      assert.equal(res.status, 200);
      assert.equal(res.body.data.length, 0);
      assert.equal(res.body.pagination.total, 1);
    });

    it('rejects non-numeric limit', async () => {
      const { user: admin } = await makeAdmin();
      const token = await issueTokenFor(admin);
      const res = await http('GET', '/api/leave-requests?limit=abc', { token });
      assert.equal(res.status, 400);
      assert.equal(res.body.error.field, 'limit');
    });
  });

  // ==================================================================
  // Sensitive data leak guard
  // ==================================================================
  describe('Sensitive data leak guard', () => {
    it('response never includes __v (mongoose internals)', async () => {
      const { user: admin } = await makeAdmin();
      const token = await issueTokenFor(admin);
      const e = await makeEmployeeDoc();
      const r = await createLeave(e._id);
      const res = await http('GET', `/api/leave-requests/${idStr(r._id)}`, { token });
      assert.equal(res.status, 200);
      assert.ok(!('__v' in res.body.data), '__v must not appear in response');
    });

    it('error response never includes stack trace', async () => {
      const { user: admin } = await makeAdmin();
      const token = await issueTokenFor(admin);
      const res = await http('GET', '/api/leave-requests/not-an-id', { token });
      assert.equal(res.status, 400);
      const body = JSON.stringify(res.body);
      assert.ok(!/at .*\.js:\d+/.test(body), 'stack trace should not appear in error body');
    });
  });

  // ==================================================================
  // Regression: Phase 1–6 endpoints still work
  // ==================================================================
  describe('Regression — other endpoints still work', () => {
    it('GET /api/health responds 200', async () => {
      const res = await http('GET', '/api/health');
      assert.equal(res.status, 200);
    });

    it('GET /api/employees requires auth → 401', async () => {
      const res = await http('GET', '/api/employees');
      assert.equal(res.status, 401);
    });

    it('GET /api/departments requires auth → 401', async () => {
      const res = await http('GET', '/api/departments');
      assert.equal(res.status, 401);
    });

    it('GET /api/positions requires auth → 401', async () => {
      const res = await http('GET', '/api/positions');
      assert.equal(res.status, 401);
    });

    it('GET /api/attendance requires auth → 401', async () => {
      const res = await http('GET', '/api/attendance');
      assert.equal(res.status, 401);
    });
  });
});
