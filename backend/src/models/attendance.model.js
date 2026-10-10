// Attendance model — bản ghi chấm công cho một Employee trong một ngày.
//
// Quyết định thiết kế cho Phase 6:
// - Một bản ghi duy nhất cho mỗi cặp (employeeId, workDate). Enforce
//   bằng unique compound index. Nếu nghiệp vụ sau này cần nhiều phiên
//   chấm công / ngày (in/out nhiều lần), sẽ tách thành collection
//   `attendance_sessions` và giữ collection này làm daily aggregate.
// - `workDate` lưu thời điểm 00:00:00 UTC của ngày làm việc. Validator
//   service chuẩn hoá date string `YYYY-MM-DD` thành UTC midnight trước
//   khi lưu để tránh lệch ngày do timezone.
// - `checkInAt` / `checkOutAt` lưu Date đầy đủ (timestamp). Khi lưu
//   không tự ý suy ra `status` từ giờ vào — không có quy định giờ
//   bắt đầu làm việc chính thức. Client/Admin chịu trách nhiệm cung
//   cấp `status` rõ ràng.
// - `checkOutAt` nếu có thì phải >= `checkInAt` (validate ở schema).
// - KHÔNG cascade từ Employee: nếu Employee bị soft-delete thì KHÔNG
//   tự xóa bản ghi chấm công. Bản ghi vẫn giữ để audit. Tuy nhiên
//   service sẽ từ chối tạo mới cho Employee đã soft-delete.
// - KHÔNG tự thêm soft-delete cho Attendance trong Phase 6 — chưa có
//   yêu cầu nghiệp vụ, sẽ bổ sung sau nếu cần.

import mongoose from 'mongoose';

const { Schema } = mongoose;

export const ATTENDANCE_STATUSES = Object.freeze([
  'present',
  'late',
  'absent',
  'leave',
  'half_day',
]);

const attendanceSchema = new Schema(
  {
    employeeId: {
      type: Schema.Types.ObjectId,
      ref: 'Employee',
      required: [true, 'employeeId is required'],
      index: true,
    },
    workDate: {
      type: Date,
      required: [true, 'workDate is required'],
      // Validator ở service chuẩn hoá thành UTC midnight trước khi save.
      // Schema chỉ yêu cầu là Date hợp lệ.
      validate: {
        validator: function (v) {
          return v instanceof Date && !Number.isNaN(v.getTime());
        },
        message: 'workDate is not a valid date',
      },
    },
    checkInAt: {
      type: Date,
      default: null,
      validate: {
        validator: function (v) {
          if (v === null || v === undefined) return true;
          return v instanceof Date && !Number.isNaN(v.getTime());
        },
        message: 'checkInAt is not a valid date',
      },
    },
    checkOutAt: {
      type: Date,
      default: null,
      validate: {
        validator: function (v) {
          if (v === null || v === undefined) return true;
          return v instanceof Date && !Number.isNaN(v.getTime());
        },
        message: 'checkOutAt is not a valid date',
      },
    },
    status: {
      type: String,
      enum: {
        values: ATTENDANCE_STATUSES,
        message: 'status must be one of: ' + ATTENDANCE_STATUSES.join(', '),
      },
      required: [true, 'status is required'],
    },
    note: {
      type: String,
      trim: true,
      maxlength: [500, 'note must be at most 500 characters'],
      default: '',
    },
    createdBy: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      default: null,
    },
    updatedBy: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      default: null,
    },
  },
  {
    timestamps: true,
  },
);

// Cross-field validation: nếu cả checkInAt và checkOutAt đều có thì
// checkOutAt phải >= checkInAt. Áp dụng khi cả hai đều là Date.
attendanceSchema.pre('validate', function (next) {
  if (
    this.checkInAt instanceof Date &&
    this.checkOutAt instanceof Date &&
    !Number.isNaN(this.checkInAt.getTime()) &&
    !Number.isNaN(this.checkOutAt.getTime())
  ) {
    if (this.checkOutAt.getTime() < this.checkInAt.getTime()) {
      this.invalidate(
        'checkOutAt',
        'checkOutAt must be greater than or equal to checkInAt',
      );
    }
  }
  next();
});

// Compound unique index: một bản ghi duy nhất cho mỗi cặp
// (employeeId, workDate). Nếu trùng, Mongo sẽ trả E11000 và service
// sẽ chuyển thành 409.
attendanceSchema.index(
  { employeeId: 1, workDate: 1 },
  { unique: true, name: 'employee_workDate_unique' },
);

// Hỗ trợ truy vấn list: sắp xếp theo workDate mới nhất + employeeId.
attendanceSchema.index({ employeeId: 1, workDate: -1 });

function sanitize(doc, ret) {
  if (ret && Object.prototype.hasOwnProperty.call(ret, '__v')) {
    delete ret.__v;
  }
  return ret;
}

attendanceSchema.set('toJSON', {
  virtuals: true,
  versionKey: false,
  transform: sanitize,
});

attendanceSchema.set('toObject', {
  virtuals: true,
  versionKey: false,
  transform: sanitize,
});

const Attendance = mongoose.model('Attendance', attendanceSchema);

export default Attendance;
