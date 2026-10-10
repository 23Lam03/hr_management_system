// Payroll controller — thin HTTP adapter.
// Service trả về { error: { status, code, message, field? } } hoặc
// { data, meta? }. Controller map sang HTTP response.

import {
  listPayrolls,
  listPayrollsForEmployee,
  getPayrollById,
  createPayroll,
  updatePayroll,
  approvePayroll,
  markPaidPayroll,
  cancelPayroll,
  findLinkedEmployeeForUser,
} from '../services/payroll.service.js';
import {
  validateListQuery,
  validateCreatePayload,
  validateUpdatePayload,
} from '../validators/payroll.validator.js';
import { recordEvent } from '../services/auditLog.service.js';
import { notifyEmployee } from '../services/notification.service.js';

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

function sendSuccess(res, data, status = 200, meta) {
  const body = { success: true, data };
  if (meta) body.meta = meta;
  return res.status(status).json(body);
}

// GET /api/payroll/me — Employee self-list
export async function getMyPayrolls(req, res, next) {
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

    const v = validateListQuery(req.query || {});
    if (v.error) return sendError(res, v.error);

    const result = await listPayrollsForEmployee(linked._id, v.value);
    return sendSuccess(res, result.data, 200, { pagination: result.pagination });
  } catch (err) {
    return next(err);
  }
}

// GET /api/payroll — Admin list
export async function adminListPayrolls(req, res, next) {
  try {
    const v = validateListQuery(req.query || {});
    if (v.error) return sendError(res, v.error);

    const result = await listPayrolls(v.value);
    return sendSuccess(res, result.data, 200, { pagination: result.pagination });
  } catch (err) {
    return next(err);
  }
}

// GET /api/payroll/:id
export async function getPayroll(req, res, next) {
  try {
    const result = await getPayrollById(req.params.id, req.user);
    if (result.error) return sendError(res, result.error);
    return sendSuccess(res, result.data);
  } catch (err) {
    return next(err);
  }
}

// POST /api/payroll — Admin only
export async function createPayrollHandler(req, res, next) {
  try {
    const v = validateCreatePayload(req.body || {});
    if (v.error) return sendError(res, v.error);

    const result = await createPayroll(v.value, req.user);
    if (result.error) return sendError(res, result.error);

    recordEvent({
      actor: req.user,
      action: 'payroll.create',
      resourceType: 'payroll',
      resourceId: result.data && result.data._id,
      description: 'Payroll record created',
    });

    // Notification: gửi cho Employee sở hữu payroll. Best-effort, await
    // để đảm bảo persist trước khi response về client.
    await notifyEmployee(v.value.employeeId, {
      type: 'payroll_created',
      resourceType: 'payroll',
      resourceId: result.data && result.data._id,
    });

    return sendSuccess(res, result.data, 201);
  } catch (err) {
    return next(err);
  }
}

// PATCH /api/payroll/:id — Admin only
export async function updatePayrollHandler(req, res, next) {
  try {
    const v = validateUpdatePayload(req.body || {});
    if (v.error) return sendError(res, v.error);

    const result = await updatePayroll(req.params.id, v.value, req.user);
    if (result.error) return sendError(res, result.error);

    recordEvent({
      actor: req.user,
      action: 'payroll.update',
      resourceType: 'payroll',
      resourceId: req.params.id,
      description: 'Payroll updated',
      metadata: { changedFields: Object.keys(v.value || {}) },
    });

    return sendSuccess(res, result.data);
  } catch (err) {
    return next(err);
  }
}

// PATCH /api/payroll/:id/approve — Admin only
export async function approvePayrollHandler(req, res, next) {
  try {
    const result = await approvePayroll(req.params.id, req.user);
    if (result.error) return sendError(res, result.error);

    recordEvent({
      actor: req.user,
      action: 'payroll.approve',
      resourceType: 'payroll',
      resourceId: req.params.id,
      description: 'Payroll approved',
      metadata: { fromStatus: 'draft', toStatus: 'approved' },
    });

    // Notification: chỉ gửi khi thực sự chuyển trạng thái (không idempotent replay).
    if (!result.meta || !result.meta.alreadyApproved) {
      const employeeId =
        result.data && (result.data.employeeId._id || result.data.employeeId);
      await notifyEmployee(employeeId, {
        type: 'payroll_approved',
        resourceType: 'payroll',
        resourceId: req.params.id,
      });
    }

    return sendSuccess(res, result.data, 200, result.meta);
  } catch (err) {
    return next(err);
  }
}

// PATCH /api/payroll/:id/mark-paid — Admin only
export async function markPaidPayrollHandler(req, res, next) {
  try {
    const result = await markPaidPayroll(req.params.id, req.user);
    if (result.error) return sendError(res, result.error);

    recordEvent({
      actor: req.user,
      action: 'payroll.markPaid',
      resourceType: 'payroll',
      resourceId: req.params.id,
      description: 'Payroll marked as paid (internal status change)',
      metadata: { fromStatus: 'approved', toStatus: 'paid' },
    });

    // Notification: chỉ gửi khi thực sự chuyển trạng thái.
    if (!result.meta || !result.meta.alreadyPaid) {
      const employeeId =
        result.data && (result.data.employeeId._id || result.data.employeeId);
      await notifyEmployee(employeeId, {
        type: 'payroll_marked_paid',
        resourceType: 'payroll',
        resourceId: req.params.id,
      });
    }

    return sendSuccess(res, result.data, 200, result.meta);
  } catch (err) {
    return next(err);
  }
}

// PATCH /api/payroll/:id/cancel — Admin only
export async function cancelPayrollHandler(req, res, next) {
  try {
    const result = await cancelPayroll(req.params.id, req.user);
    if (result.error) return sendError(res, result.error);

    recordEvent({
      actor: req.user,
      action: 'payroll.cancel',
      resourceType: 'payroll',
      resourceId: req.params.id,
      description: 'Payroll cancelled',
      metadata: { toStatus: 'cancelled' },
    });

    return sendSuccess(res, result.data, 200, result.meta);
  } catch (err) {
    return next(err);
  }
}
