// Position model — chức danh / vị trí công việc.
//
// Ghi chú thiết kế:
// - Frontend hiện tại đang dùng `position` dưới dạng chuỗi tự do
//   (vd. "Frontend Engineer", "Trưởng phòng Nhân sự"). Phần 2 vẫn tạo
//   collection Position đúng theo đề bài, và Employee sẽ tham chiếu
//   `positionId` (ObjectId). Khi migrate / seed, mỗi chuỗi position
//   trong mock sẽ được map sang một Position. Chi tiết xem
//   docs/DATABASE_DESIGN.md.
// - `departmentId` là optional: cho phép chức danh chung
//   (vd. "Intern") không gắn với phòng ban cụ thể.
// - KHÔNG thêm salary range / promotion level — chưa có đặc tả.

import mongoose from 'mongoose';

const { Schema } = mongoose;

export const POSITION_STATUSES = Object.freeze(['active', 'inactive']);

const positionSchema = new Schema(
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
      match: [/^[A-Z0-9_-]+$/, 'code must be uppercase letters, digits, _ or -'],
    },
    description: {
      type: String,
      trim: true,
      maxlength: [500, 'description must be at most 500 characters'],
      default: '',
    },
    departmentId: {
      type: Schema.Types.ObjectId,
      ref: 'Department',
      default: null,
      index: true,
    },
    status: {
      type: String,
      enum: {
        values: POSITION_STATUSES,
        message: 'status must be one of: ' + POSITION_STATUSES.join(', '),
      },
      default: 'active',
      required: true,
    },
  },
  {
    timestamps: true,
  },
);

positionSchema.pre('validate', function (next) {
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

function sanitize(doc, ret) {
  if (ret && Object.prototype.hasOwnProperty.call(ret, '__v')) {
    delete ret.__v;
  }
  return ret;
}

positionSchema.set('toJSON', {
  virtuals: true,
  versionKey: false,
  transform: sanitize,
});

positionSchema.set('toObject', {
  virtuals: true,
  versionKey: false,
  transform: sanitize,
});

const Position = mongoose.model('Position', positionSchema);

export default Position;