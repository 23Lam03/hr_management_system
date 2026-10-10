// notificationService — Phase 11.
//
// Service tập trung cho mọi thao tác liên quan đến Notification.
//
// Quy ước:
// - KHÔNG có endpoint public tạo notification; chỉ server-side tạo.
// - Recipient được derive từ server context (req.user._id hoặc
//   Employee.userId từ resource). KHÔNG nhận recipientUserId từ client.
// - `title` / `message` do service build sẵn theo `type`; controller
//   không tự do tuỳ biến nội dung từ input bên ngoài.
// - Tạo notification là best-effort: nếu thất bại, nuốt lỗi + console.error.
// - Đọc notification: User chỉ thấy của mình.

import mongoose from 'mongoose';
import Notification, {
  NOTIFICATION_TYPES,
  NOTIFICATION_RESOURCE_TYPES,
} from '../models/notification.model.js';
import { User, Employee } from '../models/index.js';

const { Types } = mongoose;

const MAX_TITLE = 120;
const MAX_MESSAGE = 500;
const MAX_LIMIT = 100;
const ALLOWED_SORT_FIELDS = ['createdAt', 'isRead', 'type'];

function truncate(s, max) {
  if (typeof s !== 'string') return '';
  if (s.length <= max) return s;
  return s.slice(0, max);
}

function isValidObjectId(v) {
  if (typeof v !== 'string') return false;
  return Types.ObjectId.isValid(v);
}

// ===== Templates cho phép tạo notification =====

const TEMPLATES = Object.freeze({
  leave_request_created: {
    title: 'New leave request',
    message: 'A new leave request is awaiting your review.',
  },
  leave_request_approved: {
    title: 'Leave request approved',
    message: 'Your leave request has been approved.',
  },
  leave_request_rejected: {
    title: 'Leave request rejected',
    message: 'Your leave request has been rejected.',
  },
  leave_request_cancelled: {
    title: 'Leave request cancelled',
    message: 'A leave request has been cancelled by the employee.',
  },
  payroll_created: {
    title: 'Payroll record created',
    message: 'A new payroll record has been created for you.',
  },
  payroll_approved: {
    title: 'Payroll approved',
    message: 'Your payroll record has been approved.',
  },
  payroll_marked_paid: {
    title: 'Payroll marked as paid',
    message: 'Your payroll record has been marked as paid (internal status change).',
  },
});

function getTemplate(type) {
  if (!NOTIFICATION_TYPES.includes(type)) return null;
  return TEMPLATES[type];
}

// ===== Helpers: tìm người nhận từ resource =====

/**
 * Lấy tất cả admin active. Dùng cho "leave_request_created" và
 * "leave_request_cancelled". Trả về mảng ObjectId.
 */
export async function findActiveAdminUserIds() {
  const docs = await User.find({ role: 'admin', status: 'active' })
    .select('_id')
    .lean();
  return docs.map((d) => d._id);
}

/**
 * Lấy User._id của Employee sở hữu resource. Trả về null nếu
 * Employee không liên kết User (userId = null).
 */
export async function findUserIdForEmployee(employeeId) {
  if (!isValidObjectId(String(employeeId))) return null;
  // Use findOne with explicit query to avoid Mongoose ObjectId identity
  // quirks; the ID may be passed as ObjectId instance or string.
  const id = new Types.ObjectId(String(employeeId));
  const emp = await Employee.findOne({ _id: id, isDeleted: { $ne: true } })
    .select('userId isDeleted')
    .lean();
  if (!emp) return null;
  if (!emp.userId) return null;
  return emp.userId;
}

// ===== Create (best-effort) =====

/**
 * Tạo 1 notification cho 1 user.
 *
 * @param {object} args
 * @param {string|object} args.recipientUserId - ObjectId string | ObjectId
 * @param {string} args.type
 * @param {string} [args.title] - optional override; nếu không sẽ dùng template
 * @param {string} [args.message] - optional override; nếu không sẽ dùng template
 * @param {string} [args.resourceType] - 'leave_request' | 'payroll'
 * @param {string} [args.resourceId]
 * @returns {Promise<object|null>}
 */
export async function createNotification(args) {
  if (!args || typeof args !== 'object') return null;
  const {
    recipientUserId,
    type,
    title,
    message,
    resourceType = null,
    resourceId = null,
  } = args;

  if (!recipientUserId) return null;
  if (!NOTIFICATION_TYPES.includes(type)) {
    // eslint-disable-next-line no-console
    console.error(`[notification] rejected: type "${type}" not in allowlist`);
    return null;
  }
  if (resourceType && !NOTIFICATION_RESOURCE_TYPES.includes(resourceType)) {
    // eslint-disable-next-line no-console
    console.error(
      `[notification] rejected: resourceType "${resourceType}" not in allowlist`,
    );
    return null;
  }
  if (resourceId && !isValidObjectId(String(resourceId))) {
    // eslint-disable-next-line no-console
    console.error(`[notification] rejected: resourceId is not ObjectId`);
    return null;
  }

  const tpl = getTemplate(type);
  if (!tpl) return null;
  const finalTitle = truncate(
    title && title.trim() ? title.trim() : tpl.title,
    MAX_TITLE,
  );
  const finalMessage = truncate(
    message && message.trim() ? message.trim() : tpl.message,
    MAX_MESSAGE,
  );

  let rid;
  try {
    rid =
      typeof recipientUserId === 'string'
        ? new Types.ObjectId(recipientUserId)
        : recipientUserId;
  } catch (err) {
    // eslint-disable-next-line no-console
    console.error('[notification] invalid recipientUserId:', err.message);
    return null;
  }

  try {
    const doc = await Notification.create({
      recipientUserId: rid,
      type,
      title: finalTitle,
      message: finalMessage,
      resourceType,
      resourceId: resourceId ? String(resourceId) : null,
    });
    return doc.toJSON();
  } catch (err) {
    // eslint-disable-next-line no-console
    console.error(
      `[notification] failed to create (type=${type}, resourceType=${resourceType}):`,
      err && err.message,
    );
    return null;
  }
}

/**
 * Tạo nhiều notification (cho nhiều user). Best-effort.
 * Trả về số lượng đã tạo thành công.
 */
export async function createNotificationForUsers(recipientUserIds, baseArgs) {
  if (!Array.isArray(recipientUserIds) || recipientUserIds.length === 0) {
    return 0;
  }
  let ok = 0;
  for (const uid of recipientUserIds) {
    // eslint-disable-next-line no-await-in-loop
    const result = await createNotification({ ...baseArgs, recipientUserId: uid });
    if (result) ok += 1;
  }
  return ok;
}

/**
 * Helper dùng bởi các controller: tạo notification cho admin.
 * Trả về 0 nếu không có admin active.
 */
export async function notifyAdmins(args) {
  const ids = await findActiveAdminUserIds();
  if (ids.length === 0) {
    // eslint-disable-next-line no-console
    console.warn(
      '[notification] no active admin user; skipping notification',
      args && args.type,
    );
    return 0;
  }
  return createNotificationForUsers(ids, args);
}

/**
 * Helper dùng bởi các controller: tạo notification cho Employee
 * sở hữu resource. Trả về 0 nếu Employee không liên kết User.
 */
export async function notifyEmployee(employeeId, args) {
  const uid = await findUserIdForEmployee(employeeId);
  if (!uid) {
    return 0;
  }
  const result = await createNotification({ ...args, recipientUserId: uid });
  return result ? 1 : 0;
}

// ===== Read (cho API) =====

function buildListFilter(filters = {}, recipientUserId) {
  const and = [{ recipientUserId }];
  if (typeof filters.isRead === 'boolean') {
    and.push({ isRead: filters.isRead });
  }
  if (filters.type) and.push({ type: filters.type });
  if (and.length === 1) return and[0];
  return { $and: and };
}

function buildSort(sortStr) {
  const descending = typeof sortStr === 'string' && sortStr.startsWith('-');
  const field = typeof sortStr === 'string' ? sortStr.replace(/^[-+]/, '') : 'createdAt';
  if (!ALLOWED_SORT_FIELDS.includes(field)) return { createdAt: -1 };
  return { [field]: descending ? -1 : 1 };
}

function serialize(doc) {
  if (!doc) return doc;
  const { __v, ...rest } = doc;
  return rest;
}

export async function listNotifications(recipientUserId, query = {}) {
  const { page = 1, limit = 20, filters = {}, sort = '-createdAt' } = query;
  const p = Math.max(1, Math.min(1_000_000, Number(page) || 1));
  const l = Math.min(MAX_LIMIT, Math.max(1, Number(limit) || 20));
  const filter = buildListFilter(filters, recipientUserId);
  const sortObj = buildSort(sort);
  const skip = (p - 1) * l;

  const [total, docs] = await Promise.all([
    Notification.countDocuments(filter),
    Notification.find(filter).sort(sortObj).skip(skip).limit(l).lean({ virtuals: true }),
  ]);

  return {
    data: docs.map(serialize),
    pagination: {
      page: p,
      limit: l,
      total,
      totalPages: total === 0 ? 0 : Math.ceil(total / l),
    },
  };
}

export async function getUnreadCount(recipientUserId) {
  if (!recipientUserId) {
    return { error: { status: 400, code: 'VALIDATION_ERROR', message: 'recipientUserId is required' } };
  }
  const count = await Notification.countDocuments({
    recipientUserId,
    isRead: false,
  });
  return { count };
}

export async function getNotificationById(id, recipientUserId) {
  if (!isValidObjectId(id)) {
    return {
      error: {
        status: 400,
        code: 'VALIDATION_ERROR',
        message: 'id must be a valid ObjectId',
        field: 'id',
      },
    };
  }
  const doc = await Notification.findById(id).lean({ virtuals: true });
  if (!doc) {
    return {
      error: {
        status: 404,
        code: 'NOTIFICATION_NOT_FOUND',
        message: 'Notification not found',
        field: 'id',
      },
    };
  }
  // Ownership: chỉ chủ sở hữu.
  if (doc.recipientUserId.toString() !== String(recipientUserId)) {
    // Che giấu sự tồn tại: trả 404 thay vì 403.
    return {
      error: {
        status: 404,
        code: 'NOTIFICATION_NOT_FOUND',
        message: 'Notification not found',
        field: 'id',
      },
    };
  }
  return { data: serialize(doc) };
}

/**
 * Mark 1 notification là đã đọc. Idempotent.
 * Trả về { data } nếu thành công, { error } nếu lỗi.
 */
export async function markRead(id, recipientUserId) {
  if (!isValidObjectId(id)) {
    return {
      error: {
        status: 400,
        code: 'VALIDATION_ERROR',
        message: 'id must be a valid ObjectId',
        field: 'id',
      },
    };
  }
  if (!recipientUserId) {
    return { error: { status: 400, code: 'VALIDATION_ERROR', message: 'recipientUserId is required' } };
  }
  // Ownership: nếu không phải chủ sở hữu, 404.
  const existing = await Notification.findById(id).select('recipientUserId isRead readAt').lean();
  if (!existing) {
    return { error: { status: 404, code: 'NOTIFICATION_NOT_FOUND', message: 'Notification not found', field: 'id' } };
  }
  if (existing.recipientUserId.toString() !== String(recipientUserId)) {
    return { error: { status: 404, code: 'NOTIFICATION_NOT_FOUND', message: 'Notification not found', field: 'id' } };
  }

  const now = new Date();
  // Idempotent: nếu đã đọc thì không update readAt.
  if (existing.isRead) {
    return { data: { id, alreadyRead: true, readAt: existing.readAt } };
  }
  const updated = await Notification.findByIdAndUpdate(
    id,
    { $set: { isRead: true, readAt: now } },
    { new: true },
  )
    .lean({ virtuals: true });
  return { data: serialize(updated) };
}

/**
 * Mark tất cả notification chưa đọc của User thành đã đọc.
 * Trả về số lượng đã update.
 */
export async function markAllRead(recipientUserId) {
  if (!recipientUserId) {
    return { error: { status: 400, code: 'VALIDATION_ERROR', message: 'recipientUserId is required' } };
  }
  const now = new Date();
  const res = await Notification.updateMany(
    { recipientUserId, isRead: false },
    { $set: { isRead: true, readAt: now } },
  );
  return { count: res.modifiedCount || 0, readAt: now };
}
