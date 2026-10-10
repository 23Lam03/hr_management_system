// Notification controller — Phase 11.
//
// Endpoints:
//   GET    /api/notifications             - list của chính mình
//   GET    /api/notifications/unread-count
//   GET    /api/notifications/:id
//   PATCH  /api/notifications/:id/read
//   PATCH  /api/notifications/read-all
//
// KHÔNG có POST/PUT/DELETE public.

import {
  listNotifications,
  getUnreadCount,
  getNotificationById,
  markRead,
  markAllRead,
} from '../services/notification.service.js';
import {
  validateListQuery,
  validateIdParam,
} from '../validators/notification.validator.js';

function isServiceError(result) {
  return result && result.error && typeof result.error.status === 'number';
}

function sendError(res, err) {
  return res.status(err.status).json({
    success: false,
    error: {
      code: err.code,
      message: err.message,
      ...(err.field ? { field: err.field } : {}),
    },
  });
}

export async function list(req, res, next) {
  try {
    const v = validateListQuery(req.query);
    if (v.error) return sendError(res, v.error);
    const result = await listNotifications(req.user._id, v.value);
    if (isServiceError(result)) return sendError(res, result.error);
    return res.status(200).json({
      success: true,
      data: result.data,
      pagination: result.pagination,
    });
  } catch (err) {
    return next(err);
  }
}

export async function unreadCount(req, res, next) {
  try {
    const result = await getUnreadCount(req.user._id);
    if (isServiceError(result)) return sendError(res, result.error);
    return res.status(200).json({
      success: true,
      data: { count: result.count },
    });
  } catch (err) {
    return next(err);
  }
}

export async function detail(req, res, next) {
  try {
    const id = validateIdParam(req.params.id);
    if (id.error) return sendError(res, id.error);
    const result = await getNotificationById(id.value, req.user._id);
    if (isServiceError(result)) return sendError(res, result.error);
    return res.status(200).json({ success: true, data: result.data });
  } catch (err) {
    return next(err);
  }
}

export async function markOneRead(req, res, next) {
  try {
    const id = validateIdParam(req.params.id);
    if (id.error) return sendError(res, id.error);
    const result = await markRead(id.value, req.user._id);
    if (isServiceError(result)) return sendError(res, result.error);
    return res.status(200).json({ success: true, data: result.data });
  } catch (err) {
    return next(err);
  }
}

export async function markAllReadHandler(req, res, next) {
  try {
    const result = await markAllRead(req.user._id);
    if (isServiceError(result)) return sendError(res, result.error);
    return res.status(200).json({
      success: true,
      data: {
        count: result.count,
        readAt: result.readAt,
      },
    });
  } catch (err) {
    return next(err);
  }
}
