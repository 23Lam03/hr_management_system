// Employee model — hồ sơ nhân viên.
//
// Quan hệ:
// - `userId` (1-1, optional, unique sparse) → User.
//   - sparse + unique cho phép nhiều Employee chưa có User tồn tại
//     (chỉ các bản ghi CÓ userId mới tham gia unique index).
//   - Một User chỉ liên kết được với một Employee — enforced bằng
//     unique index trên userId.
// - `departmentId` (n-1, optional) → Department.
// - `positionId` (n-1, optional) → Position. (Xem ghi chú trong
//   position.model.js về việc tích hợp với frontend hiện tại.)
// - `managerId` (n-1, optional) → Employee (self-reference).
//
// Quyết định thiết kế cần xác nhận:
// 1. `employmentStatus` enum dùng theo dữ liệu frontend hiện tại:
//    active | on_leave | inactive. KHÔNG dùng 'terminated' vì chưa
//    có trong mock. (Đề bài gợi ý enum tối thiểu.)
// 2. `position` (text) được giữ làm cache denormalized để tương thích
//    với frontend hiện tại đang dùng text. Khi FE chuyển sang dùng
//    positionId, có thể bỏ trường này. Hiện tại: tự populate từ
//    Position.name nếu không cung cấp.
// 3. KHÔNG tự cascade khi xoá User/Department/Position. Chỉ set
//    userId = null khi xoá User (qua service trong Phần CRUD).
// 4. `email` trên Employee là business email — có thể khác với
//    User.email trong tương lai (User có thể dùng email cá nhân).
//    Hiện tại enforce unique trên email Employee để match với
//    validateEmployee() trong frontend.

import mongoose from 'mongoose';

const { Schema } = mongoose;

export const EMPLOYMENT_STATUSES = Object.freeze([
  'active',
  'on_leave',
  'inactive',
]);

export const EMPLOYMENT_TYPES = Object.freeze([
  'full_time',
  'part_time',
  'contract',
  'intern',
]);

export const GENDERS = Object.freeze(['male', 'female', 'other']);

const employeeSchema = new Schema(
  {
    employeeCode: {
      type: String,
      required: [true, 'employeeCode is required'],
      unique: true,
      trim: true,
      uppercase: true,
      minlength: [2, 'employeeCode must be at least 2 characters'],
      maxlength: [32, 'employeeCode must be at most 32 characters'],
      // Mã NV0001..NV9999 theo frontend. Cho phép cả format khác
      // (vd. LEGACY-001) miễn là uppercase + digits + '-'/'_'.
      match: [/^[A-Z0-9_-]+$/, 'employeeCode must be uppercase letters, digits, _ or -'],
    },
    userId: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      default: null,
      // Không required — cho phép Employee chưa có tài khoản.
      // Unique sparse index được khai báo rõ ràng bằng schema.index()
      // bên dưới — khai báo inline đôi khi Mongoose 8 không tạo
      // sparse index đúng cách khi field mặc định null.
    },
    fullName: {
      type: String,
      required: [true, 'fullName is required'],
      trim: true,
      minlength: [2, 'fullName must be at least 2 characters'],
      maxlength: [120, 'fullName must be at most 120 characters'],
    },
    email: {
      type: String,
      required: [true, 'email is required'],
      unique: true,
      trim: true,
      lowercase: true,
      match: [/^\S+@\S+\.\S+$/, 'email is not valid'],
      maxlength: [254, 'email must be at most 254 characters'],
    },
    phone: {
      type: String,
      trim: true,
      default: '',
      maxlength: [20, 'phone must be at most 20 characters'],
    },
    avatar: {
      type: String,
      default: null,
    },
    gender: {
      type: String,
      enum: {
        values: GENDERS,
        message: 'gender must be one of: ' + GENDERS.join(', '),
      },
      default: 'other',
    },
    dateOfBirth: {
      type: Date,
      default: null,
    },
    departmentId: {
      type: Schema.Types.ObjectId,
      ref: 'Department',
      default: null,
      index: true,
    },
    positionId: {
      type: Schema.Types.ObjectId,
      ref: 'Position',
      default: null,
      index: true,
    },
    // Cache denormalized để FE hiện tại vẫn hiển thị được khi chưa
    // populate positionId. Xem ghi chú ở đầu file.
    position: {
      type: String,
      trim: true,
      maxlength: [120, 'position must be at most 120 characters'],
      default: '',
    },
    employmentType: {
      type: String,
      enum: {
        values: EMPLOYMENT_TYPES,
        message: 'employmentType must be one of: ' + EMPLOYMENT_TYPES.join(', '),
      },
      required: [true, 'employmentType is required'],
    },
    hireDate: {
      type: Date,
      required: [true, 'hireDate is required'],
      validate: {
        validator: function (v) {
          // Không cho phép ngày trong tương lai.
          return v instanceof Date && v.getTime() <= Date.now();
        },
        message: 'hireDate cannot be in the future',
      },
    },
    managerId: {
      type: Schema.Types.ObjectId,
      ref: 'Employee',
      default: null,
      index: true,
    },
    address: {
      type: String,
      trim: true,
      maxlength: [500, 'address must be at most 500 characters'],
      default: '',
    },
    employmentStatus: {
      type: String,
      enum: {
        values: EMPLOYMENT_STATUSES,
        message:
          'employmentStatus must be one of: ' + EMPLOYMENT_STATUSES.join(', '),
      },
      default: 'active',
      required: true,
    },
    // Soft-delete fields (Phase 4).
    // - isDeleted = true  → bản ghi đã bị xoá mềm, KHÔNG trả về danh sách
    //   / detail thông thường. Endpoint detail có thể truy cập lại với
    //   query ?includeDeleted=true (admin only) cho nghiệp vụ audit.
    // - deletedAt: thời điểm xoá mềm.
    // - deletedBy: id của User đã thực hiện xoá mềm.
    // - KHÔNG tự xoá User liên kết khi xoá mềm Employee.
    // - KHÔNG tự đổi status User khi Employee bị xoá mềm.
    isDeleted: {
      type: Boolean,
      default: false,
      required: true,
      index: true,
    },
    deletedAt: {
      type: Date,
      default: null,
    },
    deletedBy: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      default: null,
    },
  },
  {
    timestamps: true,
  },
);

// Unique index cho userId (1 User ↔ 1 Employee).
// - Dùng partialFilterExpression thay cho sparse: true vì khi schema
//   khai báo `default: null`, Mongoose sẽ serialize `userId: null`
//   vào BSON, và sparse index sẽ VẪN coi null là một giá trị (tức là
//   vẫn áp dụng unique). Với partialFilterExpression giới hạn ở
//   `userId: { $exists: true, $type: 'objectId' }`, các document
//   không có userId HOẶC có userId = null sẽ bị loại khỏi index.
//   → nhiều Employee chưa có tài khoản có thể tồn tại cùng lúc.
employeeSchema.index(
  { userId: 1 },
  {
    unique: true,
    partialFilterExpression: { userId: { $exists: true, $type: 'objectId' } },
  },
);

// Tối ưu cho query list mặc định: isDeleted=false + sort theo createdAt.
employeeSchema.index({ isDeleted: 1, createdAt: -1 });
// Tối ưu cho search theo fullName kết hợp với isDeleted.
employeeSchema.index({ isDeleted: 1, fullName: 1 });

// Chuẩn hoá trước validate.
employeeSchema.pre('validate', function (next) {
  if (typeof this.email === 'string') {
    this.email = this.email.trim().toLowerCase();
  }
  if (typeof this.fullName === 'string') {
    this.fullName = this.fullName.trim().replace(/\s+/g, ' ');
  }
  if (typeof this.phone === 'string') {
    this.phone = this.phone.trim();
  }
  if (typeof this.address === 'string') {
    this.address = this.address.trim();
  }
  if (typeof this.employeeCode === 'string') {
    this.employeeCode = this.employeeCode.trim().toUpperCase();
  }
  if (typeof this.position === 'string') {
    this.position = this.position.trim();
  }
  next();
});

// Validation tham chiếu: managerId không được là chính employee này.
// Áp dụng khi document có _id (tức là update, không phải create).
employeeSchema.pre('validate', function (next) {
  if (
    this.managerId &&
    this._id &&
    this.managerId.toString() === this._id.toString()
  ) {
    this.invalidate('managerId', 'managerId cannot be the employee themselves');
  }
  next();
});

function sanitize(doc, ret) {
  if (ret && Object.prototype.hasOwnProperty.call(ret, '__v')) {
    delete ret.__v;
  }
  return ret;
}

employeeSchema.set('toJSON', {
  virtuals: true,
  versionKey: false,
  transform: sanitize,
});

employeeSchema.set('toObject', {
  virtuals: true,
  versionKey: false,
  transform: sanitize,
});

const Employee = mongoose.model('Employee', employeeSchema);

export default Employee;