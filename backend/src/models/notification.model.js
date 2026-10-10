// Notification model — Phase 11.
//
// Nguyên tắc thiết kế:
// - Mỗi notification gắn với một recipientUserId (ref User).
// - `type` là enum allowlist; service từ chối nếu nằm ngoài.
// - `title` / `message` KHÔNG chứa password, token, secret, số tiền lương.
// - Client KHÔNG có endpoint tạo/sửa/xoá notification.
// - `isRead` mặc định false. `readAt` mặc định null. Chỉ server
//   cập nhật qua service markRead.

import mongoose from 'mongoose';

const { Schema } = mongoose;

export const NOTIFICATION_TYPES = Object.freeze([
  // Leave request
  'leave_request_created',
  'leave_request_approved',
  'leave_request_rejected',
  'leave_request_cancelled',
  // Payroll
  'payroll_created',
  'payroll_approved',
  'payroll_marked_paid',
]);

export const NOTIFICATION_RESOURCE_TYPES = Object.freeze([
  'leave_request',
  'payroll',
]);

const notificationSchema = new Schema(
  {
    recipientUserId: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: [true, 'recipientUserId is required'],
      index: true,
    },
    type: {
      type: String,
      required: [true, 'type is required'],
      enum: {
        values: NOTIFICATION_TYPES,
        message: 'type must be one of: ' + NOTIFICATION_TYPES.join(', '),
      },
      maxlength: [64, 'type must be at most 64 characters'],
    },
    title: {
      type: String,
      required: [true, 'title is required'],
      trim: true,
      maxlength: [120, 'title must be at most 120 characters'],
    },
    message: {
      type: String,
      required: [true, 'message is required'],
      trim: true,
      maxlength: [500, 'message must be at most 500 characters'],
    },
    resourceType: {
      type: String,
      enum: {
        values: NOTIFICATION_RESOURCE_TYPES,
        message:
          'resourceType must be one of: ' + NOTIFICATION_RESOURCE_TYPES.join(', '),
      },
      default: null,
    },
    resourceId: {
      type: String,
      default: null,
    },
    isRead: {
      type: Boolean,
      default: false,
      required: true,
      index: true,
    },
    readAt: {
      type: Date,
      default: null,
    },
  },
  {
    timestamps: true,
  },
);

// Hỗ trợ list mặc định (recipient + mới nhất trước).
notificationSchema.index({ recipientUserId: 1, createdAt: -1 });
// Hỗ trợ unread count.
notificationSchema.index({ recipientUserId: 1, isRead: 1, createdAt: -1 });

function sanitize(doc, ret) {
  if (ret && Object.prototype.hasOwnProperty.call(ret, '__v')) {
    delete ret.__v;
  }
  return ret;
}

notificationSchema.set('toJSON', {
  virtuals: true,
  versionKey: false,
  transform: sanitize,
});

notificationSchema.set('toObject', {
  virtuals: true,
  versionKey: false,
  transform: sanitize,
});

const Notification = mongoose.model('Notification', notificationSchema);

export default Notification;
