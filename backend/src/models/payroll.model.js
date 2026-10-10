// Payroll model — bảng lương nhân viên theo kỳ (tháng/năm).
//
// Quyết định thiết kế cho Phase 8:
// - Một bản ghi Payroll gắn với một Employee và một kỳ lương `(periodMonth, periodYear)`.
// - Enforce unique bằng compound index `(employeeId, periodMonth, periodYear)` để
//   tránh 2 bảng lương cùng kỳ cho cùng Employee. Trùng → E11000 → 409.
// - `grossSalary` và `netSalary` là **server-computed** (do service tính từ
//   baseSalary + allowances + bonuses, trừ deductions). Validator chặn client
//   gửi 2 trường này. Service gán lại sau khi merge payload.
// - `workedDays` / `standardWorkDays` KHÔNG tự tính từ Attendance hay
//   LeaveRequest. Phase 8 chưa có đủ quy tắc nghiệp vụ (giờ làm chuẩn, OT,
//   holiday policy). Admin nhập tay thông qua POST / PATCH (chỉ khi draft).
// - State machine: `draft → approved → paid`. `cancelled` từ `draft` hoặc
//   `approved`. Sau khi `paid` là terminal — không thể chỉnh sửa / cancel.
// - KHÔNG cascade từ Employee. Nếu Employee bị soft-delete, các bản ghi
//   Payroll cũ vẫn giữ để audit. Tuy nhiên service sẽ từ chối tạo mới cho
//   Employee đã soft-delete (giống LeaveRequest / Attendance).
// - KHÔNG có DELETE endpoint. Payroll là dữ liệu tài chính cần kiểm toán.

import mongoose from 'mongoose';

const { Schema } = mongoose;

export const PAYROLL_STATUSES = Object.freeze([
  'draft',
  'approved',
  'paid',
  'cancelled',
]);

// Status mà service cho phép chỉnh sửa các trường tiền.
export const PAYROLL_EDITABLE_STATUSES = Object.freeze(['draft']);

// Status mà từ đó có thể cancel.
export const PAYROLL_CANCELLABLE_STATUSES = Object.freeze(['draft', 'approved']);

// Giới hạn số tiền. Chống overflow khi serialize/JSON.
const MONEY_MAX = 1e15;

// Số ngày tối đa hợp lệ trong một tháng (theo Gregorian).
const WORKED_DAYS_MAX = 31;
const STANDARD_WORK_DAYS_MAX = 31;

const payrollSchema = new Schema(
  {
    employeeId: {
      type: Schema.Types.ObjectId,
      ref: 'Employee',
      required: [true, 'employeeId is required'],
      index: true,
    },
    periodMonth: {
      type: Number,
      required: [true, 'periodMonth is required'],
      min: [1, 'periodMonth must be between 1 and 12'],
      max: [12, 'periodMonth must be between 1 and 12'],
    },
    periodYear: {
      type: Number,
      required: [true, 'periodYear is required'],
      min: [2000, 'periodYear must be at least 2000'],
      max: [2100, 'periodYear must be at most 2100'],
    },
    baseSalary: {
      type: Number,
      required: [true, 'baseSalary is required'],
      min: [0, 'baseSalary must be at least 0'],
      max: [MONEY_MAX, `baseSalary must be at most ${MONEY_MAX}`],
      validate: {
        validator: Number.isFinite,
        message: 'baseSalary must be a finite number',
      },
    },
    allowances: {
      type: Number,
      default: 0,
      min: [0, 'allowances must be at least 0'],
      max: [MONEY_MAX, `allowances must be at most ${MONEY_MAX}`],
      validate: {
        validator: Number.isFinite,
        message: 'allowances must be a finite number',
      },
    },
    bonuses: {
      type: Number,
      default: 0,
      min: [0, 'bonuses must be at least 0'],
      max: [MONEY_MAX, `bonuses must be at most ${MONEY_MAX}`],
      validate: {
        validator: Number.isFinite,
        message: 'bonuses must be a finite number',
      },
    },
    deductions: {
      type: Number,
      default: 0,
      min: [0, 'deductions must be at least 0'],
      max: [MONEY_MAX, `deductions must be at most ${MONEY_MAX}`],
      validate: {
        validator: Number.isFinite,
        message: 'deductions must be a finite number',
      },
    },
    // Server-computed.
    grossSalary: {
      type: Number,
      required: true,
      min: [0, 'grossSalary must be at least 0'],
      validate: {
        validator: Number.isFinite,
        message: 'grossSalary must be a finite number',
      },
    },
    netSalary: {
      type: Number,
      required: true,
      min: [0, 'netSalary must be at least 0'],
      validate: {
        validator: Number.isFinite,
        message: 'netSalary must be a finite number',
      },
    },
    workedDays: {
      type: Number,
      default: null,
      min: [0, 'workedDays must be at least 0'],
      max: [WORKED_DAYS_MAX, `workedDays must be at most ${WORKED_DAYS_MAX}`],
      validate: {
        validator: function (v) {
          if (v === null || v === undefined) return true;
          return Number.isInteger(v) && v >= 0 && v <= WORKED_DAYS_MAX;
        },
        message: 'workedDays must be an integer between 0 and 31',
      },
    },
    standardWorkDays: {
      type: Number,
      default: null,
      min: [0, 'standardWorkDays must be at least 0'],
      max: [STANDARD_WORK_DAYS_MAX, `standardWorkDays must be at most ${STANDARD_WORK_DAYS_MAX}`],
      validate: {
        validator: function (v) {
          if (v === null || v === undefined) return true;
          return Number.isInteger(v) && v >= 0 && v <= STANDARD_WORK_DAYS_MAX;
        },
        message: 'standardWorkDays must be an integer between 0 and 31',
      },
    },
    note: {
      type: String,
      trim: true,
      maxlength: [500, 'note must be at most 500 characters'],
      default: '',
    },
    status: {
      type: String,
      enum: {
        values: PAYROLL_STATUSES,
        message: 'status must be one of: ' + PAYROLL_STATUSES.join(', '),
      },
      default: 'draft',
      required: true,
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
    approvedBy: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      default: null,
    },
    approvedAt: {
      type: Date,
      default: null,
    },
    paidBy: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      default: null,
    },
    paidAt: {
      type: Date,
      default: null,
    },
  },
  {
    timestamps: true,
  },
);

// Compound unique: một bản ghi lương duy nhất cho mỗi
// (employeeId, periodMonth, periodYear). E11000 → 409 ở service.
payrollSchema.index(
  { employeeId: 1, periodMonth: 1, periodYear: 1 },
  { unique: true, name: 'payroll_employee_period_unique' },
);

// Hỗ trợ list filter: status + sort createdAt desc.
payrollSchema.index({ status: 1, createdAt: -1 });
// Hỗ trợ filter theo kỳ lương cụ thể (admin list).
payrollSchema.index({ periodYear: 1, periodMonth: 1, createdAt: -1 });

function sanitize(doc, ret) {
  if (ret && Object.prototype.hasOwnProperty.call(ret, '__v')) {
    delete ret.__v;
  }
  return ret;
}

payrollSchema.set('toJSON', {
  virtuals: true,
  versionKey: false,
  transform: sanitize,
});

payrollSchema.set('toObject', {
  virtuals: true,
  versionKey: false,
  transform: sanitize,
});

const Payroll = mongoose.model('Payroll', payrollSchema);

export default Payroll;
