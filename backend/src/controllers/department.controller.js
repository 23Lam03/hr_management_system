// Department controller — thin HTTP adapter for the Department Management API.
//
// Status code policy:
//   200 — list / detail / update / deactivate
//   201 — successful create
//   400 — validation error
//   401 — auth missing/invalid (handled by `protect` middleware)
//   403 — insufficient role (handled by `authorize` middleware)
//   404 — department not found
//   409 — duplicate key

import {
  validateListQuery,
  validateCreatePayload,
  validateUpdatePayload,
  validateIdParam,
} from '../validators/department.validator.js';
import {
  listDepartments,
  getDepartmentById,
  createDepartment,
  updateDepartment,
  deactivateDepartment,
} from '../services/department.service.js';
import { recordEvent } from '../services/auditLog.service.js';

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
 * GET /api/departments
 * Admin only.
 */
export async function list(req, res, next) {
  try {
    const v = validateListQuery(req.query);
    if (v.error) return sendError(res, v.error);

    const result = await listDepartments(v.value);
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
 * GET /api/departments/:id
 * Admin only.
 */
export async function detail(req, res, next) {
  try {
    const v = validateIdParam(req.params.id);
    if (v.error) return sendError(res, v.error);

    const result = await getDepartmentById(v.id);
    if (isServiceError(result)) return sendError(res, result.error);

    return res.status(200).json({ success: true, data: result.data });
  } catch (err) {
    return next(err);
  }
}

/**
 * POST /api/departments
 * Admin only.
 */
export async function create(req, res, next) {
  try {
    const v = validateCreatePayload(req.body);
    if (v.error) return sendError(res, v.error);

    const result = await createDepartment(v.value);
    if (isServiceError(result)) return sendError(res, result.error);

    recordEvent({
      actor: req.user,
      action: 'department.create',
      resourceType: 'department',
      resourceId: result.data && result.data._id,
      description: 'Department created',
    });

    return res.status(201).json({ success: true, data: result.data });
  } catch (err) {
    return next(err);
  }
}

/**
 * PATCH /api/departments/:id
 * Admin only. Partial update.
 */
export async function update(req, res, next) {
  try {
    const v = validateIdParam(req.params.id);
    if (v.error) return sendError(res, v.error);

    const body = validateUpdatePayload(req.body);
    if (body.error) return sendError(res, body.error);

    const result = await updateDepartment(v.id, body.value);
    if (isServiceError(result)) return sendError(res, result.error);

    recordEvent({
      actor: req.user,
      action: 'department.update',
      resourceType: 'department',
      resourceId: v.id,
      description: 'Department updated',
      metadata: { changedFields: Object.keys(body.value || {}) },
    });

    return res.status(200).json({ success: true, data: result.data });
  } catch (err) {
    return next(err);
  }
}

/**
 * PATCH /api/departments/:id/deactivate
 * Admin only. Idempotent soft-deactivation via status: inactive.
 */
export async function deactivate(req, res, next) {
  try {
    const v = validateIdParam(req.params.id);
    if (v.error) return sendError(res, v.error);

    const result = await deactivateDepartment(v.id);
    if (isServiceError(result)) return sendError(res, result.error);

    recordEvent({
      actor: req.user,
      action: 'department.deactivate',
      resourceType: 'department',
      resourceId: v.id,
      description: result.alreadyDeactivated
        ? 'Department deactivate (idempotent — already inactive)'
        : 'Department deactivated',
      metadata: { alreadyDeactivated: !!result.alreadyDeactivated },
    });

    return res.status(200).json({
      success: true,
      data: result.data,
      meta: {
        alreadyDeactivated: result.alreadyDeactivated,
        message: result.alreadyDeactivated
          ? 'Department was already inactive'
          : 'Department deactivated successfully',
      },
    });
  } catch (err) {
    return next(err);
  }
}
