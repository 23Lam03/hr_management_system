// Employee controller — thin HTTP adapter for the Employee Management API.
//
// Holds no business logic. Translates validated request data into
// service calls, and maps service results to the standard response
// shape:
//   { success: true,  data: ... }
//   { success: true,  data: ..., pagination: { page, limit, total, totalPages } }
//   { success: false, error: { code, message, field? } }
//
// Status code policy:
//   201 — successful create
//   200 — list / detail / update / soft-delete
//   400 — validation error (validator or service)
//   401 — auth missing/invalid (handled by `protect` middleware)
//   403 — insufficient role (handled by `authorize` middleware)
//   404 — employee not found
//   409 — duplicate key
//   422 — business rule violation (e.g. position/department mismatch)

import {
  validateListQuery,
  validateCreatePayload,
  validateUpdatePayload,
  validateIdParam,
} from '../validators/employee.validator.js';
import {
  listEmployees,
  getEmployeeById,
  createEmployee,
  updateEmployee,
  softDeleteEmployee,
} from '../services/employee.service.js';
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
 * GET /api/employees
 * Admin only. Supports pagination, search, filters, sort.
 */
export async function list(req, res, next) {
  try {
    const v = validateListQuery(req.query);
    if (v.error) return sendError(res, v.error);

    const result = await listEmployees(v.value, req.user);
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
 * GET /api/employees/:id
 * - Admin: any employee.
 * - Employee: only their own (matched on Employee.userId == req.user._id).
 *   A non-owner attempt returns 404 (not 403) to avoid leaking
 *   existence of IDs. See docs/EMPLOYEE_API.md for the rationale.
 */
export async function detail(req, res, next) {
  try {
    const v = validateIdParam(req.params.id);
    if (v.error) return sendError(res, v.error);

    const result = await getEmployeeById(v.id, req.user);
    if (isServiceError(result)) {
      return sendError(res, result.error);
    }

    // Non-admin: must be the owner. Compare Employee.userId to req.user._id.
    if (req.user.role !== 'admin') {
      const ownerId =
        result.data.userId && typeof result.data.userId === 'object'
          ? result.data.userId.toString()
          : result.data.userId;
      if (!ownerId || ownerId !== req.user._id.toString()) {
        // 404 (not 403) on purpose: do not leak existence of other IDs.
        return res.status(404).json({
          success: false,
          error: {
            code: 'EMPLOYEE_NOT_FOUND',
            message: 'Employee not found',
          },
        });
      }
    }

    return res.status(200).json({ success: true, data: result.data });
  } catch (err) {
    return next(err);
  }
}

/**
 * POST /api/employees
 * Admin only.
 */
export async function create(req, res, next) {
  try {
    const v = validateCreatePayload(req.body);
    if (v.error) return sendError(res, v.error);

    const result = await createEmployee(v.value);
    if (isServiceError(result)) return sendError(res, result.error);

    // Audit (best-effort)
    recordEvent({
      actor: req.user,
      action: 'employee.create',
      resourceType: 'employee',
      resourceId: result.data && result.data._id,
      description: 'Employee created',
    });

    return res.status(201).json({ success: true, data: result.data });
  } catch (err) {
    return next(err);
  }
}

/**
 * PATCH /api/employees/:id
 * Admin only. Partial update.
 */
export async function update(req, res, next) {
  try {
    const v = validateIdParam(req.params.id);
    if (v.error) return sendError(res, v.error);

    const body = validateUpdatePayload(req.body);
    if (body.error) return sendError(res, body.error);

    const result = await updateEmployee(v.id, body.value);
    if (isServiceError(result)) return sendError(res, result.error);

    // Audit (best-effort) — chỉ ghi tên field đã đổi, KHÔNG log giá trị.
    recordEvent({
      actor: req.user,
      action: 'employee.update',
      resourceType: 'employee',
      resourceId: v.id,
      description: 'Employee updated',
      metadata: { changedFields: Object.keys(body.value || {}) },
    });

    return res.status(200).json({ success: true, data: result.data });
  } catch (err) {
    return next(err);
  }
}

/**
 * DELETE /api/employees/:id
 * Admin only. Soft-delete. Idempotent — repeated calls return 200 with
 * the same shape and an `alreadyDeleted` flag.
 */
export async function softDelete(req, res, next) {
  try {
    const v = validateIdParam(req.params.id);
    if (v.error) return sendError(res, v.error);

    const result = await softDeleteEmployee(v.id, req.user);
    if (isServiceError(result)) return sendError(res, result.error);

    // Audit (best-effort)
    recordEvent({
      actor: req.user,
      action: 'employee.softDelete',
      resourceType: 'employee',
      resourceId: v.id,
      description: result.alreadyDeleted
        ? 'Employee soft-delete (idempotent — already deleted)'
        : 'Employee soft-deleted',
      metadata: { alreadyDeleted: !!result.alreadyDeleted },
    });

    return res.status(200).json({
      success: true,
      data: result.data,
      meta: {
        alreadyDeleted: result.alreadyDeleted,
        message: result.alreadyDeleted
          ? 'Employee was already soft-deleted'
          : 'Employee soft-deleted successfully',
      },
    });
  } catch (err) {
    return next(err);
  }
}
