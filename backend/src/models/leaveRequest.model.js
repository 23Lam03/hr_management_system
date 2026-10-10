// LeaveRequest model — đơn xin nghỉ phép của Employee.
//
// Quyết định thiết kế cho Phase 7:
// - Một đơn gắn với một Employee, có khoảng ngày nghỉ [startDate, endDate].
// - `startDate` / `endDate` lưu UTC midnight (giống Phase 6 Attendance).
//   Date string `YYYY-MM-DD` được validator chuẩn hoá.
// - `status` enum: `pending | approved | rejected | cancelled`.
//   Mặc định `pending`. Client không tự set được khi tạo.
// - `leaveType` enum: `annual | sick | unpaid | other`.
// - `reviewedBy` / `reviewedAt` / `reviewNote` chỉ set bởi server
//   khi Admin approve/reject. Client không gửi được.
// - Không cascade từ Employee: nếu Employee bị soft-delete thì KHÔNG
//   tự xóa đơn. Đơn vẫn còn để audit. Tuy nhiên service sẽ từ chối
//   tạo mới cho Employee đã soft-delete.
// - KHÔNG có unique index `(employeeId, startDate)` — khoảng ngày là
//   range, không phải equality. Việc chống trùng thực hiện ở service
//   (overlap check giữa các đơn `pending` / `approved`).

import mongoose from 'mongoose';

const { Schema } = mongoose;

export const LEAVE_TYPES = Object.freeze([
  'annual',
  'sick',
  'unpaid',
  'other',
]);

export const LEAVE_STATUSES = Object.freeze([
  'pending',
  'approved',
  'rejected',
  'cancelled',
]);

const leaveRequestSchema = new Schema(
  {
    employeeId: {
      type: Schema.Types.ObjectId,
      ref: 'Employee',
      required: [true, 'employeeId is required'],
      index: true,
    },
    leaveType: {
      type: String,
      enum: {
        values: LEAVE_TYPES,
        message: 'leaveType must be one of: ' + LEAVE_TYPES.join(', '),
      },
      required: [true, 'leaveType is required'],
    },
    startDate: {
      type: Date,
      required: [true, 'startDate is required'],
      validate: {
        validator: function (v) {
          return v instanceof Date && !Number.isNaN(v.getTime());
        },
        message: 'startDate is not a valid date',
      },
    },
    endDate: {
      type: Date,
      required: [true, 'endDate is required'],
      validate: {
        validator: function (v) {
          return v instanceof Date && !Number.isNaN(v.getTime());
        },
        message: 'endDate is not a valid date',
      },
    },
    reason: {
      type: String,
      required: [true, 'reason is required'],
      trim: true,
      minlength: [3, 'reason must be at least 3 characters'],
      maxlength: [500, 'reason must be at most 500 characters'],
    },
    status: {
      type: String,
      enum: {
        values: LEAVE_STATUSES,
        message: 'status must be one of: ' + LEAVE_STATUSES.join(', '),
      },
      default: 'pending',
      required: true,
    },
    reviewedBy: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      default: null,
    },
    reviewedAt: {
      type: Date,
      default: null,
    },
    reviewNote: {
      type: String,
      trim: true,
      maxlength: [500, 'reviewNote must be at most 500 characters'],
      default: '',
    },
  },
  {
    timestamps: true,
  },
);

// Cross-field validation: endDate >= startDate.
leaveRequestSchema.pre('validate', function (next) {
  if (
    this.startDate instanceof Date &&
    this.endDate instanceof Date &&
    !Number.isNaN(this.startDate.getTime()) &&
    !Number.isNaN(this.endDate.getTime())
  ) {
    if (this.endDate.getTime() < this.startDate.getTime()) {
      this.invalidate('endDate', 'endDate must be greater than or equal to startDate');
    }
  }
  next();
});

// Hỗ trợ truy vấn list: sort theo createdAt desc (mặc định).
leaveRequestSchema.index({ employeeId: 1, createdAt: -1 });
leaveRequestSchema.index({ status: 1, createdAt: -1 });

function sanitize(doc, ret) {
  if (ret && Object.prototype.hasOwnProperty.call(ret, '__v')) {
    delete ret.__v;
  }
  return ret;
}

leaveRequestSchema.set('toJSON', {
  virtuals: true,
  versionKey: false,
  transform: sanitize,
});

leaveRequestSchema.set('toObject', {
  virtuals: true,
  versionKey: false,
  transform: sanitize,
});

const LeaveRequest = mongoose.model('LeaveRequest', leaveRequestSchema);

export default LeaveRequest;
