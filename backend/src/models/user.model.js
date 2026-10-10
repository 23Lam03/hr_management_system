// User model — tài khoản đăng nhập.
//
// Nguyên tắc thiết kế:
// - Không bao giờ trả về `passwordHash` khi serialize (toJSON).
// - Email được chuẩn hóa (lowercase + trim) trước khi lưu → đảm bảo
//   unique index phân biệt chính xác theo giá trị đã chuẩn hóa.
// - `role` chỉ có 2 giá trị: admin, employee. Mọi payload từ client
//   chỉ được phép 'employee' khi tạo; nâng cấp lên 'admin' phải do
//   admin khác thực hiện qua API (sẽ enforce ở controller, không ở đây).
// - `status`: active | inactive | locked. Locked dành cho tài khoản bị
//   khoá do vi phạm chính sách (sẽ dùng ở Phần Auth).
// - Một User liên kết tối đa một Employee qua Employee.userId
//   (unique sparse ở phía Employee).
// - KHÔNG có logic đăng ký / đăng nhập ở file này.

import mongoose from 'mongoose';
import bcrypt from 'bcrypt';

const { Schema } = mongoose;

export const USER_ROLES = Object.freeze(['admin', 'employee']);
export const USER_STATUSES = Object.freeze(['active', 'inactive', 'locked']);

const userSchema = new Schema(
  {
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
      // Email regex nhẹ; controller sẽ validate kỹ hơn nếu cần.
      match: [/^\S+@\S+\.\S+$/, 'email is not valid'],
      maxlength: [254, 'email must be at most 254 characters'],
    },
    passwordHash: {
      type: String,
      required: [true, 'passwordHash is required'],
      // Không validate độ dài ở đây — bcrypt tự quyết định.
      select: false, // không trả về theo mặc định khi query
    },
    role: {
      type: String,
      enum: {
        values: USER_ROLES,
        message: 'role must be one of: ' + USER_ROLES.join(', '),
      },
      required: [true, 'role is required'],
      default: 'employee',
      // Không immutable — admin có thể đổi, nhưng controller phải enforce.
    },
    status: {
      type: String,
      enum: {
        values: USER_STATUSES,
        message: 'status must be one of: ' + USER_STATUSES.join(', '),
      },
      default: 'active',
      required: true,
    },
    lastLoginAt: {
      type: Date,
      default: null,
    },
  },
  {
    timestamps: true,
    // Mặc định Mongoose trả passwordHash trong toJSON vì field không
    // có `select: false` chỉ chặn find(), không chặn toJSON. Ta xử lý
    // trong transform bên dưới để chắc chắn không bao giờ lộ.
  },
);

// Index cho email đã được tạo tự động bởi `unique: true` ở trên.
// Thêm index phụ để query nhanh theo role + status (admin list).
userSchema.index({ role: 1, status: 1 });

// Chuẩn hoá email trước khi validate để đảm bảo "Admin@Example.com "
// cũng bị coi là "admin@example.com" ở cả 2 phía (ghi và kiểm tra).
userSchema.pre('validate', function (next) {
  if (typeof this.email === 'string') {
    this.email = this.email.trim().toLowerCase();
  }
  if (typeof this.fullName === 'string') {
    this.fullName = this.fullName.trim();
  }
  next();
});

// Đảm bảo passwordHash KHÔNG BAO GIỜ xuất hiện trong JSON response.
// Kể cả khi caller cố tình gọi .toJSON() thủ công.
function sanitizeUser(doc, ret) {
  if (ret && Object.prototype.hasOwnProperty.call(ret, 'passwordHash')) {
    delete ret.passwordHash;
  }
  if (ret && Object.prototype.hasOwnProperty.call(ret, '__v')) {
    delete ret.__v; // Mongoose internal version key, không cần thiết cho client
  }
  return ret;
}

userSchema.set('toJSON', {
  virtuals: true,
  versionKey: false,
  transform: sanitizeUser,
});

userSchema.set('toObject', {
  virtuals: true,
  versionKey: false,
  transform: sanitizeUser,
});

/**
 * Hash một plaintext password bằng bcrypt.
 * Controller dùng hàm này TRƯỚC khi gán vào passwordHash.
 * Không có pre-save hook tự hash để tránh double-hash nếu caller
 * đã hash rồi.
 */
userSchema.statics.hashPassword = async function hashPassword(plain) {
  if (typeof plain !== 'string' || plain.length === 0) {
    throw new Error('plain password must be a non-empty string');
  }
  // cost=10 là mức phổ biến (Mongoose docs mặc định cũng là 10).
  return bcrypt.hash(plain, 10);
};

/**
 * So sánh plaintext với passwordHash.
 * Trả về false nếu user không có passwordHash (data lỗi).
 */
userSchema.methods.verifyPassword = async function verifyPassword(plain) {
  if (!this.passwordHash) return false;
  return bcrypt.compare(plain, this.passwordHash);
};

const User = mongoose.model('User', userSchema);

export default User;