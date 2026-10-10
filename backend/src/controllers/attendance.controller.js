// Attendance controller — thin HTTP adapter for the Attendance Management API.
//
// Status code policy:
//   200 — list / detail / update / self-history
//   201 — successful create
//   400 — validation error
//   401 — auth missing/invalid (handled by `protect` middleware)
//   403 — insufficient role (handled by `authorize` middleware)
//   404 — resource not found / no access (per anti-leak policy)
//   409 — duplicate (employeeId, workDate)
//
// The `/me` endpoint derives the linked Employee from
// `req.user._id` — it does NOT accept an `employeeId` query param.
// If the authenticated user has no linked Employee, returns 404.

import {
  validateListQuery,
  validateCreatePayload,
  validateUpdatePayload,
  validateIdParam,
} from '../validators/attendance.validator.js';
import {
  listAttendance,
  listAttendanceForEmployee,
  getAttendanceById,
  createAttendance,
  updateAttendance,
} from '../services/attendance.service.js';
import { Employee } from '../models/index.js';
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
 * GET /api/attendance
 * Admin only.
 */
export async function list(req, res, next) {
  try {
    const v = validateListQuery(req.query);
    if (v.error) return sendError(res, v.error);

    const result = await listAttendance(v.value);
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
 * GET /api/attendance/me
 * Returns attendance history of the authenticated user's linked
 * Employee. If the user has no linked Employee, returns 404.
 *
 * The endpoint does NOT accept an `employeeId` query parameter.
 * Admins who want to view another employee's records should use
 * the main `/api/attendance?employeeId=...` endpoint.
 */
export async function me(req, res, next) {
  try {
    const employee = await Employee.findOne({ userId: req.user._id })
      .select('_id isDeleted')
      .lean();

    if (!employee) {
      return res.status(404).json({
        success: false,
        error: {
          code: 'EMPLOYEE_NOT_FOUND',
          message: 'No employee profile is linked to the current user',
        },
      });
    }

    // Build a synthetic query with employeeId locked to the linked employee.
    // The validator's filters object is reused, but we strip out any
    // employeeId the client might have sent (defensive).
    const v = validateListQuery(req.query);
    if (v.error) return sendError(res, v.error);
    v.value.filters.employeeId = employee._id.toString();

    const result = await listAttendanceForEmployee(employee._id, v.value);
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
 * GET /api/attendance/:id
 * - Admin: any record.
 * - Employee: only records belonging to the linked Employee. Mismatch
 *   returns 404 (not 403) to avoid leaking ID existence.
 */
export async function detail(req, res, next) {
  try {
    const v = validateIdParam(req.params.id);
    if (v.error) return sendError(res, v.error);

    const result = await getAttendanceById(v.id, req.user);
    if (isServiceError(result)) return sendError(res, result.error);

    return res.status(200).json({ success: true, data: result.data });
  } catch (err) {
    return next(err);
  }
}

/**
 * POST /api/attendance
 * Admin only.
 */
export async function create(req, res, next) {
  try {
    const v = validateCreatePayload(req.body);
    if (v.error) return sendError(res, v.error);

    const result = await createAttendance(v.value, req.user);
    if (isServiceError(result)) return sendError(res, result.error);

    recordEvent({
      actor: req.user,
      action: 'attendance.create',
      resourceType: 'attendance',
      resourceId: result.data && result.data._id,
      description: 'Attendance record created',
    });

    return res.status(201).json({ success: true, data: result.data });
  } catch (err) {
    return next(err);
  }
}

/**
 * PATCH /api/attendance/:id
 * Admin only. Partial update.
 */
export async function update(req, res, next) {
  try {
    const v = validateIdParam(req.params.id);
    if (v.error) return sendError(res, v.error);

    const body = validateUpdatePayload(req.body);
    if (body.error) return sendError(res, body.error);

    const result = await updateAttendance(v.id, body.value, req.user);
    if (isServiceError(result)) return sendError(res, result.error);

    recordEvent({
      actor: req.user,
      action: 'attendance.update',
      resourceType: 'attendance',
      resourceId: v.id,
      description: 'Attendance record updated',
      metadata: { changedFields: Object.keys(body.value || {}) },
    });

    return res.status(200).json({ success: true, data: result.data });
  } catch (err) {
    return next(err);
  }
}
