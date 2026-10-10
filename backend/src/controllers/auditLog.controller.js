// AuditLog controller — Phase 10.
// Đọc audit logs (Admin-only). Ghi log từ controllers khác thông qua
// `auditLogService.recordEvent()` (best-effort).

import { listAuditLogs, getAuditLogById } from '../services/auditLog.service.js';
import { validateListQuery } from '../validators/auditLog.validator.js';

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
    const result = await listAuditLogs(v.value);
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

export async function detail(req, res, next) {
  try {
    const result = await getAuditLogById(req.params.id);
    if (isServiceError(result)) return sendError(res, result.error);
    return res.status(200).json({ success: true, data: result.data });
  } catch (err) {
    return next(err);
  }
}
