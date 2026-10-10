// Position controller — thin HTTP adapter for the Position Management API.

import {
  validateListQuery,
  validateCreatePayload,
  validateUpdatePayload,
  validateIdParam,
} from '../validators/position.validator.js';
import {
  listPositions,
  getPositionById,
  createPosition,
  updatePosition,
  deactivatePosition,
} from '../services/position.service.js';
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
 * GET /api/positions
 * Admin only.
 */
export async function list(req, res, next) {
  try {
    const v = validateListQuery(req.query);
    if (v.error) return sendError(res, v.error);

    const result = await listPositions(v.value);
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
 * GET /api/positions/:id
 * Admin only.
 */
export async function detail(req, res, next) {
  try {
    const v = validateIdParam(req.params.id);
    if (v.error) return sendError(res, v.error);

    const result = await getPositionById(v.id);
    if (isServiceError(result)) return sendError(res, result.error);

    return res.status(200).json({ success: true, data: result.data });
  } catch (err) {
    return next(err);
  }
}

/**
 * POST /api/positions
 * Admin only.
 */
export async function create(req, res, next) {
  try {
    const v = validateCreatePayload(req.body);
    if (v.error) return sendError(res, v.error);

    const result = await createPosition(v.value);
    if (isServiceError(result)) return sendError(res, result.error);

    recordEvent({
      actor: req.user,
      action: 'position.create',
      resourceType: 'position',
      resourceId: result.data && result.data._id,
      description: 'Position created',
    });

    return res.status(201).json({ success: true, data: result.data });
  } catch (err) {
    return next(err);
  }
}

/**
 * PATCH /api/positions/:id
 * Admin only. Partial update.
 */
export async function update(req, res, next) {
  try {
    const v = validateIdParam(req.params.id);
    if (v.error) return sendError(res, v.error);

    const body = validateUpdatePayload(req.body);
    if (body.error) return sendError(res, body.error);

    const result = await updatePosition(v.id, body.value);
    if (isServiceError(result)) return sendError(res, result.error);

    recordEvent({
      actor: req.user,
      action: 'position.update',
      resourceType: 'position',
      resourceId: v.id,
      description: 'Position updated',
      metadata: { changedFields: Object.keys(body.value || {}) },
    });

    return res.status(200).json({ success: true, data: result.data });
  } catch (err) {
    return next(err);
  }
}

/**
 * PATCH /api/positions/:id/deactivate
 * Admin only. Idempotent soft-deactivation via status: inactive.
 */
export async function deactivate(req, res, next) {
  try {
    const v = validateIdParam(req.params.id);
    if (v.error) return sendError(res, v.error);

    const result = await deactivatePosition(v.id);
    if (isServiceError(result)) return sendError(res, result.error);

    recordEvent({
      actor: req.user,
      action: 'position.deactivate',
      resourceType: 'position',
      resourceId: v.id,
      description: result.alreadyDeactivated
        ? 'Position deactivate (idempotent — already inactive)'
        : 'Position deactivated',
      metadata: { alreadyDeactivated: !!result.alreadyDeactivated },
    });

    return res.status(200).json({
      success: true,
      data: result.data,
      meta: {
        alreadyDeactivated: result.alreadyDeactivated,
        message: result.alreadyDeactivated
          ? 'Position was already inactive'
          : 'Position deactivated successfully',
      },
    });
  } catch (err) {
    return next(err);
  }
}
