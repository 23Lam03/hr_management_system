// Test helper: cung cấp một kết nối MongoDB riêng cho test
// (DB `hrm_test_db`) để không ảnh hưởng dữ liệu development.
//
// Sử dụng:
//   import { setupTestDb, teardownTestDb, clearTestDb } from './helpers/db.js';
//   before(setupTestDb);
//   after(teardownTestDb);
//   beforeEach(clearTestDb);

import mongoose from 'mongoose';
import { resolveAndValidateTestUri } from '../../src/lib/testDbGuard.js';

// Dùng DB riêng cho test. PHẢI có TEST_MONGODB_URI — KHÔNG tự suy ra
// từ MONGODB_URI để tránh vô tình kết nối nhầm vào production-shaped URI
// (đặc biệt là Atlas) khi chạy test mà không set env.
//
// Lý do: MONGODB_URI có thể là Atlas URI chứa credentials. Regex cũ
// chỉ thay tên DB nhưng vẫn giữ credentials trong URI — đủ để tạo
// connection (dù tên DB khác), gây side-effect ngoài ý muốn.
// Mục tiêu: chạy test phải luôn dùng DB local MongoDB riêng.
// Được tính mỗi lần gọi (không cache) để test có thể thay đổi env
// giữa chừng và quan sát hành vi.
export function resolveTestUri() {
  // Phase 17: route through the safety gate. The gate will
  // throw if the resolved URI is unsafe (Atlas hostname,
  // credentials, public IP, prod-shaped DB name, etc.).
  return resolveAndValidateTestUri();
}

// Backward-compat: TEST_URI vẫn là một string lúc module load,
// dùng làm default cho setupTestDb. Code mới nên gọi resolveTestUri().
const TEST_URI = resolveTestUri();

let connected = false;
let modelsInited = false;

async function ensureIndexes() {
  // Force Mongoose build indexes cho tất cả model đã đăng ký.
  // Gọi ngay sau khi connect — quan trọng cho test unique.
  if (modelsInited) return;
  // Lazy import để Mongoose đăng ký model với connection hiện tại.
  const {
    User,
    Employee,
    Department,
    Position,
    Attendance,
    LeaveRequest,
    Payroll,
    AuditLog,
    Notification,
    Session,
  } = await import('../../src/models/index.js');
  for (const Model of [
    User,
    Employee,
    Department,
    Position,
    Attendance,
    LeaveRequest,
    Payroll,
    AuditLog,
    Notification,
    Session,
  ]) {
    // createCollection trước (idempotent: nếu collection đã tồn tại
    // thì bỏ qua), sau đó syncIndexes để đảm bảo index tồn tại.
    try {
      await Model.createCollection();
    } catch (err) {
      // "namespace exists" là OK
      if (err && err.codeName !== 'NamespaceExists') throw err;
    }
    await Model.syncIndexes();
  }
  modelsInited = true;
}

export async function setupTestDb() {
  if (connected) return;
  await mongoose.connect(resolveTestUri(), {
    serverSelectionTimeoutMS: 5000,
  });
  connected = true;
  await ensureIndexes();
}

export async function clearTestDb() {
  if (!connected) return;
  // Rather than dropping the entire DB (which races with any
  // in-flight index build from syncIndexes, leading to
  // IndexBuildAborted on the next ensureIndexes call), delete all
  // documents from every registered collection. Indexes stay
  // intact and tests remain deterministic.
  const {
    User,
    Employee,
    Department,
    Position,
    Attendance,
    LeaveRequest,
    Payroll,
    AuditLog,
    Notification,
    Session,
  } = await import('../../src/models/index.js');
  await Promise.all([
    User.deleteMany({}),
    Employee.deleteMany({}),
    Department.deleteMany({}),
    Position.deleteMany({}),
    Attendance.deleteMany({}),
    LeaveRequest.deleteMany({}),
    Payroll.deleteMany({}),
    AuditLog.deleteMany({}),
    Notification.deleteMany({}),
    Session.deleteMany({}),
  ]);
}

export async function teardownTestDb() {
  if (!connected) return;
  await mongoose.disconnect();
  connected = false;
  modelsInited = false;
}

export { TEST_URI };
