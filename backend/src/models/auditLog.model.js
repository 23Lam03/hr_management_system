// AuditLog model — ghi nhận các thao tác nghiệp vụ quan trọng.
//
// Quyết định thiết kế cho Phase 10:
// - KHÔNG cho phép client tạo log qua API. Tất cả audit record do
//   server tạo từ `auditLogService.recordEvent()`.
// - Metadata cho phép linh hoạt (mixed), nhưng service sẽ filter qua
//   allowlist và chặn các key nhạy cảm (password, token, secret, ...).
// - `actorUserId` optional: cho phép log hệ thống nếu có. Tuy nhiên
//   trong Phase 10, tất cả event đều có actor (vì audit chỉ chèn
//   sau middleware `protect`).
// - KHÔNG có endpoint sửa/xoá log.

import mongoose from 'mongoose';

const { Schema } = mongoose;

// Allowlist các action hợp lệ. Service từ chối nếu nằm ngoài.
// Phase 15: extended with auth failure / refresh / session events.
export const AUDIT_ACTIONS = Object.freeze([
  // Authentication
  'auth.login.success',
  'auth.login.failure',
  'auth.logout',
  'auth.refresh.success',
  'auth.refresh.failure',
  'auth.refresh.reuse_detected',
  'auth.session.revoked',
  'auth.sessions.revoked_all',
  // Employee
  'employee.create',
  'employee.update',
  'employee.softDelete',
  // Department
  'department.create',
  'department.update',
  'department.deactivate',
  // Position
  'position.create',
  'position.update',
  'position.deactivate',
  // Attendance
  'attendance.create',
  'attendance.update',
  // Leave
  'leave.create',
  'leave.update',
  'leave.cancel',
  'leave.approve',
  'leave.reject',
  // Payroll
  'payroll.create',
  'payroll.update',
  'payroll.approve',
  'payroll.markPaid',
  'payroll.cancel',
  // Retention / system
  'auditlog.cleanup',
]);

export const AUDIT_RESOURCE_TYPES = Object.freeze([
  'user',
  'employee',
  'department',
  'position',
  'attendance',
  'leave_request',
  'payroll',
  'auth',
  'auditlog',
  'session',
]);

export const AUDIT_STATUSES = Object.freeze(['success', 'failure']);

// ObjectId hex 24 chars (validation light, không check cast).
const OBJECT_ID_RE = /^[a-fA-F0-9]{24}$/;

// Danh sách key cấm trong metadata. Service lọc trước khi ghi.
// Phase 15: thêm `tokenHash` (refresh token hash không được phép log),
// nhóm key đã được tổ chức lại theo chủ đề.
export const METADATA_FORBIDDEN_KEYS = Object.freeze([
  // Credentials / secrets
  'password',
  'passwordHash',
  'token',
  'accessToken',
  'refreshToken',
  'tokenHash',
  'jwt',
  'authorization',
  'cookie',
  'set-cookie',
  'secret',
  'clientSecret',
  'mongoUri',
  'dbUri',
  'connectionString',
  'passwordResetToken',
  'oldPassword',
  'newPassword',
  'currentPassword',
  // Payroll sensitive amounts
  'baseSalary',
  'allowances',
  'bonuses',
  'deductions',
  'grossSalary',
  'netSalary',
  // PII not appropriate for metadata
  'email', // không log email nhân viên vào metadata
  'phone',
  'fullName',
  'address',
  'reason',
  'reviewNote',
  'note',
  // Financial identifiers
  'creditCard',
  'bankAccount',
  'ssn',
  'taxId',
]);

const auditLogSchema = new Schema(
  {
    actorUserId: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      default: null,
    },
    actorRole: {
      type: String,
      enum: {
        values: ['admin', 'employee', 'system'],
        message: 'actorRole must be one of: admin, employee, system',
      },
      default: null,
    },
    action: {
      type: String,
      required: [true, 'action is required'],
      enum: {
        values: AUDIT_ACTIONS,
        message: 'action must be one of: ' + AUDIT_ACTIONS.join(', '),
      },
      maxlength: [64, 'action must be at most 64 characters'],
    },
    resourceType: {
      type: String,
      required: [true, 'resourceType is required'],
      enum: {
        values: AUDIT_RESOURCE_TYPES,
        message:
          'resourceType must be one of: ' + AUDIT_RESOURCE_TYPES.join(', '),
      },
      maxlength: [32, 'resourceType must be at most 32 characters'],
    },
    resourceId: {
      type: String,
      default: null,
      validate: {
        validator: function (v) {
          if (v === null || v === undefined || v === '') return true;
          return typeof v === 'string' && OBJECT_ID_RE.test(v);
        },
        message: 'resourceId must be a 24-character hex ObjectId string',
      },
    },
    description: {
      type: String,
      default: '',
      maxlength: [500, 'description must be at most 500 characters'],
    },
    metadata: {
      type: Schema.Types.Mixed,
      default: {},
    },
    status: {
      type: String,
      enum: {
        values: AUDIT_STATUSES,
        message: 'status must be one of: ' + AUDIT_STATUSES.join(', '),
      },
      default: 'success',
      required: true,
    },
    // Phase 15: optional context fields. The service applies
    // strict length and type validation. None of these may be
    // trusted as authorization inputs.
    requestId: {
      type: String,
      default: null,
      maxlength: [64, 'requestId must be at most 64 characters'],
    },
    ip: {
      type: String,
      default: null,
      maxlength: [64, 'ip must be at most 64 characters'],
    },
    userAgent: {
      type: String,
      default: null,
      maxlength: [512, 'userAgent must be at most 512 characters'],
    },
  },
  {
    timestamps: true,
  },
);

// Hỗ trợ list filter.
auditLogSchema.index({ createdAt: -1 });
auditLogSchema.index({ actorUserId: 1, createdAt: -1 });
auditLogSchema.index({ action: 1, createdAt: -1 });
auditLogSchema.index({ resourceType: 1, resourceId: 1, createdAt: -1 });

function sanitize(doc, ret) {
  if (ret && Object.prototype.hasOwnProperty.call(ret, '__v')) {
    delete ret.__v;
  }
  return ret;
}

auditLogSchema.set('toJSON', {
  virtuals: true,
  versionKey: false,
  transform: sanitize,
});

auditLogSchema.set('toObject', {
  virtuals: true,
  versionKey: false,
  transform: sanitize,
});

const AuditLog = mongoose.model('AuditLog', auditLogSchema);

export default AuditLog;
