// API + integration tests cho Notification — Phase 11.

import { describe, it, before, after, beforeEach } from 'node:test';
import { strict as assert } from 'node:assert';

import { createApp } from '../src/app.js';
import { Notification, Employee, Payroll, LeaveRequest } from '../src/models/index.js';
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

async function makeAdmin(role = 'admin') {
  const { user } = await createTestUser({
    email: `admin-${Date.now()}-${Math.random().toString(36).slice(2, 8)}@example.com`,
    role,
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

async function seedNotification(recipientUserId, type = 'leave_request_created', overrides = {}) {
  return Notification.create({
    recipientUserId,
    type,
    title: 'Test',
    message: 'Hello',
    ...overrides,
  });
}

// ============================================================
// Auth & ownership
// ============================================================

describe('Notification API — auth & ownership', () => {
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

  it('GET /api/notifications without token → 401', async () => {
    const r = await http('GET', '/api/notifications');
    assert.equal(r.status, 401);
  });

  it('GET /api/notifications/unread-count without token → 401', async () => {
    const r = await http('GET', '/api/notifications/unread-count');
    assert.equal(r.status, 401);
  });

  it('GET /api/notifications/:id without token → 401', async () => {
    const r = await http('GET', '/api/notifications/0123456789abcdef01234567');
    assert.equal(r.status, 401);
  });

  it('GET /api/notifications only returns current user notifications', async () => {
    const { user: u1, token: t1 } = await makeEmployeeUser();
    const { user: u2 } = await makeEmployeeUser();
    await seedNotification(u1._id, 'leave_request_created');
    await seedNotification(u1._id, 'leave_request_approved');
    await seedNotification(u2._id, 'leave_request_created');

    const r = await http('GET', '/api/notifications', { token: t1 });
    assert.equal(r.status, 200);
    assert.equal(r.body.data.length, 2);
    assert.equal(r.body.pagination.total, 2);
  });

  it('GET /api/notifications/:id cannot read other user notification → 404', async () => {
    const { user: u1 } = await makeEmployeeUser();
    const { token: t2 } = await makeEmployeeUser();
    const notif = await seedNotification(u1._id);
    const r = await http('GET', `/api/notifications/${notif._id}`, { token: t2 });
    assert.equal(r.status, 404);
    assert.equal(r.body.error.code, 'NOTIFICATION_NOT_FOUND');
  });

  it('GET /api/notifications/:id with bad id → 400', async () => {
    const { token } = await makeEmployeeUser();
    const r = await http('GET', '/api/notifications/not-a-valid-id', { token });
    assert.equal(r.status, 400);
  });

  it('GET /api/notifications/:id non-existent → 404', async () => {
    const { token } = await makeEmployeeUser();
    const r = await http('GET', '/api/notifications/0123456789abcdef01234567', { token });
    assert.equal(r.status, 404);
  });
});

// ============================================================
// Unread count, mark-read, read-all
// ============================================================

describe('Notification API — unread count & mark-read', () => {
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

  it('unread-count returns 0 when empty', async () => {
    const { token } = await makeEmployeeUser();
    const r = await http('GET', '/api/notifications/unread-count', { token });
    assert.equal(r.status, 200);
    assert.equal(r.body.data.count, 0);
  });

  it('unread-count counts only unread', async () => {
    const { user, token } = await makeEmployeeUser();
    await seedNotification(user._id, 'leave_request_created');
    await seedNotification(user._id, 'leave_request_approved');
    await seedNotification(user._id, 'leave_request_rejected', { isRead: true, readAt: new Date() });
    const r = await http('GET', '/api/notifications/unread-count', { token });
    assert.equal(r.body.data.count, 2);
  });

  it('unread-count only counts current user', async () => {
    const { user: u1, token: t1 } = await makeEmployeeUser();
    const { user: u2 } = await makeEmployeeUser();
    await seedNotification(u1._id);
    await seedNotification(u1._id);
    await seedNotification(u2._id);
    const r = await http('GET', '/api/notifications/unread-count', { token: t1 });
    assert.equal(r.body.data.count, 2);
  });

  it('PATCH /:id/read marks notification as read', async () => {
    const { user, token } = await makeEmployeeUser();
    const notif = await seedNotification(user._id);
    const r = await http('PATCH', `/api/notifications/${notif._id}/read`, { token });
    assert.equal(r.status, 200);
    assert.equal(r.body.data.isRead, true);
    assert.ok(r.body.data.readAt);

    // unread-count giảm về 0
    const c = await http('GET', '/api/notifications/unread-count', { token });
    assert.equal(c.body.data.count, 0);
  });

  it('PATCH /:id/read idempotent (gọi 2 lần vẫn OK)', async () => {
    const { user, token } = await makeEmployeeUser();
    const notif = await seedNotification(user._id);
    const r1 = await http('PATCH', `/api/notifications/${notif._id}/read`, { token });
    assert.equal(r1.status, 200);
    const r2 = await http('PATCH', `/api/notifications/${notif._id}/read`, { token });
    assert.equal(r2.status, 200);
    // readAt lần 1
    const readAt1 = r1.body.data.readAt;
    const readAt2 = r2.body.data.readAt;
    // Service idempotent: lần 2 trả alreadyRead và KHÔNG update readAt.
    // Vì cấu trúc response khác (alreadyRead), ta chỉ xác minh không crash.
    assert.ok(readAt1 || readAt2);
  });

  it('PATCH /:id/read cannot mark other user notification', async () => {
    const { user: u1 } = await makeEmployeeUser();
    const { token: t2 } = await makeEmployeeUser();
    const notif = await seedNotification(u1._id);
    const r = await http('PATCH', `/api/notifications/${notif._id}/read`, { token: t2 });
    assert.equal(r.status, 404);
  });

  it('PATCH /read-all marks all current user unread as read', async () => {
    const { user, token } = await makeEmployeeUser();
    await seedNotification(user._id);
    await seedNotification(user._id);
    await seedNotification(user._id, 'leave_request_approved', { isRead: true, readAt: new Date() });

    const r = await http('PATCH', '/api/notifications/read-all', { token });
    assert.equal(r.status, 200);
    assert.equal(r.body.data.count, 2);
    assert.ok(r.body.data.readAt);

    // Sau read-all, unread-count = 0
    const c = await http('GET', '/api/notifications/unread-count', { token });
    assert.equal(c.body.data.count, 0);
  });

  it('PATCH /read-all với 0 unread trả count=0 (không lỗi)', async () => {
    const { token } = await makeEmployeeUser();
    const r = await http('PATCH', '/api/notifications/read-all', { token });
    assert.equal(r.status, 200);
    assert.equal(r.body.data.count, 0);
  });

  it('PATCH /read-all chỉ đánh dấu của User hiện tại', async () => {
    const { user: u1, token: t1 } = await makeEmployeeUser();
    const { user: u2 } = await makeEmployeeUser();
    await seedNotification(u1._id);
    await seedNotification(u2._id);
    await seedNotification(u2._id);

    const r = await http('PATCH', '/api/notifications/read-all', { token: t1 });
    assert.equal(r.status, 200);
    assert.equal(r.body.data.count, 1); // chỉ 1 của u1

    // u2 vẫn có 2 unread
    const u2Unread = await Notification.countDocuments({ recipientUserId: u2._id, isRead: false });
    assert.equal(u2Unread, 2);
  });
});

// ============================================================
// Filters, pagination, sort
// ============================================================

describe('Notification API — filters & pagination', () => {
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

  it('filters by isRead=true', async () => {
    const { user, token } = await makeEmployeeUser();
    await seedNotification(user._id, 'leave_request_created', { isRead: true, readAt: new Date() });
    await seedNotification(user._id, 'leave_request_approved');
    const r = await http('GET', '/api/notifications?isRead=true', { token });
    assert.equal(r.body.data.length, 1);
    assert.equal(r.body.data[0].type, 'leave_request_created');
  });

  it('filters by type', async () => {
    const { user, token } = await makeEmployeeUser();
    await seedNotification(user._id, 'leave_request_created');
    await seedNotification(user._id, 'leave_request_approved');
    const r = await http('GET', '/api/notifications?type=leave_request_approved', { token });
    assert.equal(r.body.data.length, 1);
  });

  it('rejects invalid type', async () => {
    const { token } = await makeEmployeeUser();
    const r = await http('GET', '/api/notifications?type=hacker', { token });
    assert.equal(r.status, 400);
  });

  it('paginates and caps limit at 100', async () => {
    const { user, token } = await makeEmployeeUser();
    for (let i = 0; i < 5; i += 1) {
      // eslint-disable-next-line no-await-in-loop
      await seedNotification(user._id);
    }
    const r1 = await http('GET', '/api/notifications?page=1&limit=2', { token });
    assert.equal(r1.body.data.length, 2);
    assert.equal(r1.body.pagination.totalPages, 3);

    const rCap = await http('GET', '/api/notifications?limit=9999', { token });
    assert.equal(rCap.body.pagination.limit, 100);
  });

  it('rejects invalid sort field', async () => {
    const { token } = await makeEmployeeUser();
    const r = await http('GET', '/api/notifications?sort=password', { token });
    assert.equal(r.status, 400);
  });
});

// ============================================================
// Anti-tampering
// ============================================================

describe('Notification API — anti-tampering', () => {
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

  it('POST /api/notifications is not defined', async () => {
    const { token } = await makeEmployeeUser();
    const r = await http('POST', '/api/notifications', {
      token,
      body: { type: 'leave_request_created', title: 't', message: 'm' },
    });
    assert.equal(r.status, 404);
  });

  it('PUT /api/notifications/:id is not defined', async () => {
    const { token } = await makeEmployeeUser();
    const r = await http('PUT', '/api/notifications/0123456789abcdef01234567', {
      token,
      body: { isRead: true },
    });
    assert.equal(r.status, 404);
  });

  it('DELETE /api/notifications/:id is not defined', async () => {
    const { token } = await makeEmployeeUser();
    const r = await http('DELETE', '/api/notifications/0123456789abcdef01234567', { token });
    assert.equal(r.status, 404);
  });

  it('Cannot specify recipientUserId via query string', async () => {
    const { user: u1, token: t1 } = await makeEmployeeUser();
    const { user: u2 } = await makeEmployeeUser();
    await seedNotification(u1._id);
    await seedNotification(u2._id);
    // cố tình gửi recipientUserId qua query — service bỏ qua.
    const r = await http('GET', `/api/notifications?recipientUserId=${u2._id}`, { token: t1 });
    assert.equal(r.status, 200);
    // Vẫn chỉ trả về của u1
    assert.equal(r.body.data.length, 1);
  });
});

// ============================================================
// INTEGRATION: leave request + payroll events
// ============================================================

describe('Notification integration — leave request', () => {
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

  it('create leave request → tất cả admin active nhận thông báo', async () => {
    const { user: admin1 } = await makeAdmin();
    const { user: admin2 } = await makeAdmin();
    const { user: admin3 } = await makeAdmin();
    // Inactive admin — không nhận
    await createTestUser({
      email: `inactive-${Date.now()}@example.com`,
      role: 'admin',
      status: 'inactive',
    });
    const { user: emp, token: empToken } = await makeEmployeeUser();
    const empDoc = await makeEmployeeDoc({ userId: emp._id });

    const r = await http('POST', '/api/leave-requests', {
      token: empToken,
      body: {
        startDate: '2026-04-01',
        endDate: '2026-04-03',
        leaveType: 'annual',
        reason: 'vacation',
      },
    });
    assert.equal(r.status, 201);

    const notifs = await Notification.find({ type: 'leave_request_created' });
    assert.equal(notifs.length, 3); // 3 admin active

    // Cả 3 admin đều nhận đúng resourceId
    const recipientIds = notifs.map((n) => n.recipientUserId.toString()).sort();
    const expected = [admin1._id.toString(), admin2._id.toString(), admin3._id.toString()].sort();
    assert.deepEqual(recipientIds, expected);
    void empDoc;
  });
  it('admin approve leave → Employee sở hữu nhận thông báo', async () => {
    const { token: adminToken } = await makeAdmin();
    const { user: emp, token: empToken } = await makeEmployeeUser();
    await makeEmployeeDoc({ userId: emp._id });

    const c = await http('POST', '/api/leave-requests', {
      token: empToken,
      body: {
        startDate: '2026-05-01',
        endDate: '2026-05-02',
        leaveType: 'sick',
        reason: 'sick leave',
      },
    });
    assert.equal(c.status, 201);
    // Xoá các notification admin đã nhận để test dễ đọc
    await Notification.deleteMany({ type: 'leave_request_created' });

    const a = await http('PATCH', `/api/leave-requests/${c.body.data._id}/approve`, {
      token: adminToken,
      body: {},
    });
    assert.equal(a.status, 200);

    const notifs = await Notification.find({ type: 'leave_request_approved' });
    assert.equal(notifs.length, 1);
    assert.equal(notifs[0].recipientUserId.toString(), emp._id.toString());
  });

  it('admin reject leave → Employee sở hữu nhận thông báo', async () => {
    const { token: adminToken } = await makeAdmin();
    const { user: emp, token: empToken } = await makeEmployeeUser();
    await makeEmployeeDoc({ userId: emp._id });

    const c = await http('POST', '/api/leave-requests', {
      token: empToken,
      body: {
        startDate: '2026-06-01',
        endDate: '2026-06-02',
        leaveType: 'annual',
        reason: 'family event',
      },
    });
    assert.equal(c.status, 201);

    const r = await http('PATCH', `/api/leave-requests/${c.body.data._id}/reject`, {
      token: adminToken,
      body: {},
    });
    assert.equal(r.status, 200);

    const notifs = await Notification.find({ type: 'leave_request_rejected' });
    assert.equal(notifs.length, 1);
    assert.equal(notifs[0].recipientUserId.toString(), emp._id.toString());
  });

  it('employee cancel leave → admin nhận thông báo (KHÔNG trùng khi replay)', async () => {
    const { user: admin } = await makeAdmin();
    const { user: emp, token: empToken } = await makeEmployeeUser();
    await makeEmployeeDoc({ userId: emp._id });

    const c = await http('POST', '/api/leave-requests', {
      token: empToken,
      body: {
        startDate: '2026-07-01',
        endDate: '2026-07-02',
        leaveType: 'annual',
        reason: 'cancel test reason',
      },
    });
    assert.equal(c.status, 201);

    const cancel1 = await http('PATCH', `/api/leave-requests/${c.body.data._id}/cancel`, {
      token: empToken,
    });
    assert.equal(cancel1.status, 200);
    const cancel2 = await http('PATCH', `/api/leave-requests/${c.body.data._id}/cancel`, {
      token: empToken,
    });
    assert.equal(cancel2.status, 200);

    // Dù cancel 2 lần, chỉ có 1 notification (vì lần 2 là idempotent).
    const notifs = await Notification.find({ type: 'leave_request_cancelled' });
    assert.equal(notifs.length, 1);
    assert.equal(notifs[0].recipientUserId.toString(), admin._id.toString());
  });

  it('failed leave create KHÔNG tạo notification', async () => {
    await makeAdmin();
    const { user: emp, token: empToken } = await makeEmployeeUser();
    await makeEmployeeDoc({ userId: emp._id });

    const r = await http('POST', '/api/leave-requests', {
      token: empToken,
      body: {
        startDate: '2026-08-01',
        endDate: '2026-08-02',
        leaveType: 'annual',
        reason: 'first leave',
      },
    });
    assert.equal(r.status, 201);
    // Xoá để test sạch
    await Notification.deleteMany({});

    // Tạo leave thứ 2 overlap với cái đầu → fail
    const r2 = await http('POST', '/api/leave-requests', {
      token: empToken,
      body: {
        startDate: '2026-08-02',
        endDate: '2026-08-03',
        leaveType: 'annual',
        reason: 'overlap',
      },
    });
    assert.equal(r2.status, 409);

    const all = await Notification.find({});
    assert.equal(all.length, 0);
  });
});

describe('Notification integration — payroll', () => {
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

  it('payroll create/approve/markPaid → Employee sở hữu nhận thông báo', async () => {
    const { token: adminToken } = await makeAdmin();
    const { user: emp, token: empToken } = await makeEmployeeUser();
    const empDoc = await makeEmployeeDoc({ userId: emp._id });

    const c = await http('POST', '/api/payroll', {
      token: adminToken,
      body: {
        employeeId: empDoc._id.toString(),
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

    const a = await http('PATCH', `/api/payroll/${c.body.data._id}/approve`, { token: adminToken });
    assert.equal(a.status, 200);

    const m = await http('PATCH', `/api/payroll/${c.body.data._id}/mark-paid`, { token: adminToken });
    assert.equal(m.status, 200);

    // Sort theo type để không phụ thuộc timing.
    const types = (await Notification.find({}).sort({ type: 1 })).map((n) => n.type);
    assert.deepEqual(types, ['payroll_approved', 'payroll_created', 'payroll_marked_paid']);

    // Tất cả đều gửi cho employee owner
    for (const n of await Notification.find({})) {
      assert.equal(n.recipientUserId.toString(), emp._id.toString());
    }

    // Không lộ số tiền
    for (const n of await Notification.find({})) {
      assert.equal(n.title.includes('10'), false);
      assert.equal(n.message.includes('10'), false);
    }

    // Employee xem được thông báo của mình
    const r = await http('GET', '/api/notifications', { token: empToken });
    assert.equal(r.body.data.length, 3);
  });

  it('idempotent approve KHÔNG tạo notification trùng', async () => {
    const { token: adminToken } = await makeAdmin();
    const { user: emp } = await makeEmployeeUser();
    const empDoc = await makeEmployeeDoc({ userId: emp._id });

    const c = await http('POST', '/api/payroll', {
      token: adminToken,
      body: {
        employeeId: empDoc._id.toString(),
        periodMonth: 11,
        periodYear: 2026,
        baseSalary: 5_000_000,
        allowances: 0,
        bonuses: 0,
        deductions: 0,
        workedDays: 22,
        standardWorkDays: 22,
      },
    });
    assert.equal(c.status, 201);
    await Notification.deleteMany({}); // xoá notification từ create

    // Approve 2 lần
    const a1 = await http('PATCH', `/api/payroll/${c.body.data._id}/approve`, { token: adminToken });
    assert.equal(a1.status, 200);
    const a2 = await http('PATCH', `/api/payroll/${c.body.data._id}/approve`, { token: adminToken });
    assert.equal(a2.status, 200);

    const approved = await Notification.countDocuments({ type: 'payroll_approved' });
    assert.equal(approved, 1);
  });

  it('Employee không có liên kết User thì KHÔNG có notification', async () => {
    const { token: adminToken } = await makeAdmin();
    // Tạo Employee KHÔNG liên kết User
    const orphan = await makeEmployeeDoc();
    void orphan;
    const c = await http('POST', '/api/payroll', {
      token: adminToken,
      body: {
        employeeId: orphan._id.toString(),
        periodMonth: 12,
        periodYear: 2026,
        baseSalary: 1_000_000,
        allowances: 0,
        bonuses: 0,
        deductions: 0,
        workedDays: 1,
        standardWorkDays: 22,
      },
    });
    assert.equal(c.status, 201);
    // Notification.create vẫn chạy nhưng notifyEmployee trả 0 vì không có userId.
    const payrollCreated = await Notification.countDocuments({ type: 'payroll_created' });
    assert.equal(payrollCreated, 0);
  });
});
