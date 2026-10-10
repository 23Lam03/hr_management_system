// Department model — phòng ban.
//
// Nguyên tắc thiết kế:
// - `name` và `code` đều unique về mặt ngữ nghĩa nhưng chỉ enforce
//   unique index trên `code` (mã ngắn, dễ tra cứu). `name` chỉ
//   trim + uppercase first-letter để hiển thị nhất quán.
// - `managerEmployeeId` tham chiếu Employee — để trống khi phòng ban
//   chưa có quản lý. Không bắt buộc.
// - KHÔNG tự xoá Employee / Position khi Department bị inactive.
// - KHÔNG cascade delete.

import mongoose from 'mongoose';

const { Schema } = mongoose;

export const DEPARTMENT_STATUSES = Object.freeze(['active', 'inactive']);

const departmentSchema = new Schema(
  {
    name: {
      type: String,
      required: [true, 'name is required'],
      trim: true,
      minlength: [2, 'name must be at least 2 characters'],
      maxlength: [120, 'name must be at most 120 characters'],
    },
    code: {
      type: String,
      required: [true, 'code is required'],
      unique: true,
      trim: true,
      uppercase: true,
      minlength: [2, 'code must be at least 2 characters'],
      maxlength: [32, 'code must be at most 32 characters'],
      // Mã phòng ban thường là chữ in hoa + số + gạch ngang: HR, IT, FIN-01...
      match: [/^[A-Z0-9_-]+$/, 'code must be uppercase letters, digits, _ or -'],
    },
    description: {
      type: String,
      trim: true,
      maxlength: [500, 'description must be at most 500 characters'],
      default: '',
    },
    managerEmployeeId: {
      type: Schema.Types.ObjectId,
      ref: 'Employee',
      default: null,
      // Không required — phòng ban có thể chưa có manager.
      // Không unique — trong tương lai 1 manager có thể quản lý nhiều
      // phòng ban (matrix org). Index cho query/list.
      index: true,
    },
    status: {
      type: String,
      enum: {
        values: DEPARTMENT_STATUSES,
        message: 'status must be one of: ' + DEPARTMENT_STATUSES.join(', '),
      },
      default: 'active',
      required: true,
    },
  },
  {
    timestamps: true,
  },
);

// Chuẩn hoá name trước validate: trim và nén khoảng trắng thừa.
departmentSchema.pre('validate', function (next) {
  if (typeof this.name === 'string') {
    this.name = this.name.trim().replace(/\s+/g, ' ');
  }
  if (typeof this.code === 'string') {
    this.code = this.code.trim().toUpperCase();
  }
  if (typeof this.description === 'string') {
    this.description = this.description.trim();
  }
  next();
});

// Dọn dẹp __v cho client.
function sanitize(doc, ret) {
  if (ret && Object.prototype.hasOwnProperty.call(ret, '__v')) {
    delete ret.__v;
  }
  return ret;
}

departmentSchema.set('toJSON', {
  virtuals: true,
  versionKey: false,
  transform: sanitize,
});

departmentSchema.set('toObject', {
  virtuals: true,
  versionKey: false,
  transform: sanitize,
});

const Department = mongoose.model('Department', departmentSchema);

export default Department;