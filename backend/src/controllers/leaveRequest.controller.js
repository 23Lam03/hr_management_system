// Leave request controller — thin HTTP adapter cho Leave Management API.
//
// Status code policy:
//   200 — list / detail / update / cancel / approve / reject
//   201 — create
//   400 — validation error (payload / id / query)
//   401 — auth missing/invalid (xử lý bởi middleware `protect`)
//   403 — không đủ quyền (xử lý bởi middleware `authorize` hoặc service)
//   404 — không tồn tại / không được xem (chống lộ ID)
//   409 — xung đột dữ liệu / trạng thái không cho phép thao tác

import {
  validateListQuery,
  validateCreatePayload,
  validateUpdatePayload,
  validateReviewPayload,
  validateIdParam,
} from '../validators/leaveRequest.validator.js';
import {
  listLeaveRequests,
  listLeaveRequestsForEmployee,
  getLeaveRequestById,
  createLeaveRequest,
  updateLeaveRequest,
  cancelLeaveRequest,
  approveLeaveRequest,
  rejectLeaveRequest,
  findLinkedEmployeeForUser,
} from '../services/leaveRequest.service.js';
import { Employee } from '../models/index.js';
import { recordEvent } from '../services/auditLog.service.js';
import { notifyAdmins, notifyEmployee } from '../services/notification.service.js';

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

/**
 * GET /api/leave-requests
 * Admin only.
 */
export async function list(req, res, next) {
  try {
    const v = validateListQuery(req.query);
    if (v.error) return sendError(res, v.error);

    const result = await listLeaveRequests(v.value);
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

/**
 * GET /api/leave-requests/me
 * Trả về đơn của Employee liên kết với user hiện tại. Không nhận
 * `employeeId` để tránh spoofing. Nếu user không có Employee liên kết → 404.
 */
export async function me(req, res, next) {
  try {
    const linked = await findLinkedEmployeeForUser(req.user._id);
    if (!linked) {
      return res.status(404).json({
        success: false,
        error: {
          code: 'EMPLOYEE_NOT_FOUND',
          message: 'No employee profile is linked to the current user',
        },
      });
    }

    const v = validateListQuery(req.query);
    if (v.error) return sendError(res, v.error);
    // Ép employeeId về linked employee, bỏ qua giá trị client gửi (nếu có).
    v.value.filters.employeeId = linked._id.toString();

    const result = await listLeaveRequestsForEmployee(linked._id, v.value);
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

/**
 * GET /api/leave-requests/:id
 * Admin: any. Employee: only own.
 */
export async function detail(req, res, next) {
  try {
    const v = validateIdParam(req.params.id);
    if (v.error) return sendError(res, v.error);

    const result = await getLeaveRequestById(v.value, req.user);
    if (isServiceError(result)) return sendError(res, result.error);

    return res.status(200).json({ success: true, data: result.data });
  } catch (err) {
    return next(err);
  }
}

/**
 * POST /api/leave-requests
 * Employee tạo cho chính mình. Admin tạo thay (cần `employeeId`).
 */
export async function create(req, res, next) {
  try {
    const adminCreate = req.user.role === 'admin';
    const v = validateCreatePayload(req.body, { adminCreate });
    if (v.error) return sendError(res, v.error);

    const result = await createLeaveRequest(v.value, req.user);
    if (isServiceError(result)) return sendError(res, result.error);

    recordEvent({
      actor: req.user,
      action: 'leave.create',
      resourceType: 'leave_request',
      resourceId: result.data && result.data._id,
      description: 'Leave request created',
    });

    // Notify: chỉ gửi khi create thành công.
    // recipient = tất cả admin active (server context).
    await notifyAdmins({
      type: 'leave_request_created',
      resourceType: 'leave_request',
      resourceId: result.data && result.data._id,
    });

    return res.status(201).json({ success: true, data: result.data });
  } catch (err) {
    return next(err);
  }
}

/**
 * PATCH /api/leave-requests/:id
 * Employee cập nhật đơn `pending` của mình.
 */
export async function update(req, res, next) {
  try {
    const id = validateIdParam(req.params.id);
    if (id.error) return sendError(res, id.error);

    const body = validateUpdatePayload(req.body);
    if (body.error) return sendError(res, body.error);

    const result = await updateLeaveRequest(id.value, body.value, req.user);
    if (isServiceError(result)) return sendError(res, result.error);

    recordEvent({
      actor: req.user,
      action: 'leave.update',
      resourceType: 'leave_request',
      resourceId: id.value,
      description: 'Leave request updated',
      metadata: { changedFields: Object.keys(body.value || {}) },
    });

    return res.status(200).json({ success: true, data: result.data });
  } catch (err) {
    return next(err);
  }
}

/**
 * PATCH /api/leave-requests/:id/cancel
 * Employee hủy đơn `pending` của mình. Idempotent.
 */
export async function cancel(req, res, next) {
  try {
    const id = validateIdParam(req.params.id);
    if (id.error) return sendError(res, id.error);

    const result = await cancelLeaveRequest(id.value, req.user);
    if (isServiceError(result)) return sendError(res, result.error);

    recordEvent({
      actor: req.user,
      action: 'leave.cancel',
      resourceType: 'leave_request',
      resourceId: id.value,
      description: 'Leave request cancelled',
    });

    // Notification: chỉ gửi khi status thực sự chuyển (không idempotent replay).
    // Service đã trả `meta.alreadyCancelled === true` nếu trạng thái không đổi.
    if (!result.meta || !result.meta.alreadyCancelled) {
      await notifyAdmins({
        type: 'leave_request_cancelled',
        resourceType: 'leave_request',
        resourceId: id.value,
      });
    }

    return res.status(200).json({
      success: true,
      data: result.data,
      ...(result.meta ? { meta: result.meta } : {}),
    });
  } catch (err) {
    return next(err);
  }
}

/**
 * PATCH /api/leave-requests/:id/approve
 * Admin only.
 */
export async function approve(req, res, next) {
  try {
    const id = validateIdParam(req.params.id);
    if (id.error) return sendError(res, id.error);

    const body = validateReviewPayload(req.body);
    if (body.error) return sendError(res, body.error);

    const result = await approveLeaveRequest(id.value, body.value, req.user);
    if (isServiceError(result)) return sendError(res, result.error);

    recordEvent({
      actor: req.user,
      action: 'leave.approve',
      resourceType: 'leave_request',
      resourceId: id.value,
      description: 'Leave request approved',
      metadata: { fromStatus: 'pending', toStatus: 'approved' },
    });

    // Notification: gửi cho Employee sở hữu đơn.
    // Lấy employeeId từ data trả về (service đã populate).
    const employeeId =
      result.data && (result.data.employeeId._id || result.data.employeeId);
    await notifyEmployee(employeeId, {
      type: 'leave_request_approved',
      resourceType: 'leave_request',
      resourceId: id.value,
    });

    return res.status(200).json({ success: true, data: result.data });
  } catch (err) {
    return next(err);
  }
}

/**
 * PATCH /api/leave-requests/:id/reject
 * Admin only.
 */
export async function reject(req, res, next) {
  try {
    const id = validateIdParam(req.params.id);
    if (id.error) return sendError(res, id.error);

    const body = validateReviewPayload(req.body);
    if (body.error) return sendError(res, body.error);

    const result = await rejectLeaveRequest(id.value, body.value, req.user);
    if (isServiceError(result)) return sendError(res, result.error);

    recordEvent({
      actor: req.user,
      action: 'leave.reject',
      resourceType: 'leave_request',
      resourceId: id.value,
      description: 'Leave request rejected',
      metadata: { fromStatus: 'pending', toStatus: 'rejected' },
    });

    // Notification: gửi cho Employee sở hữu đơn.
    const employeeId =
      result.data && (result.data.employeeId._id || result.data.employeeId);
    await notifyEmployee(employeeId, {
      type: 'leave_request_rejected',
      resourceType: 'leave_request',
      resourceId: id.value,
    });

    return res.status(200).json({ success: true, data: result.data });
  } catch (err) {
    return next(err);
  }
}

// Make linter happy nếu Employee chưa dùng trực tiếp trong file này.
void Employee;
