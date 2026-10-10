// Dashboard & Reports controller (Phase 9).
// Service trả về data đã tính sẵn. Controller chỉ chuyển sang HTTP.

import {
  getOverview,
  getAttendanceSummary,
  getLeaveSummary,
  getPayrollSummary,
  getEmployeesReport,
  getAttendanceReport,
  getLeaveRequestsReport,
  getPayrollReport,
} from '../services/dashboard.service.js';
import {
  validateAttendanceSummaryQuery,
  validateLeaveSummaryQuery,
  validateDashboardPayrollQuery,
  validateEmployeesReportQuery,
  validateAttendanceReportQuery,
  validateLeaveRequestsReportQuery,
  validatePayrollReportQuery,
} from '../validators/dashboard.validator.js';

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

function sendSuccess(res, data, status = 200) {
  return res.status(status).json({
    success: true,
    data,
    meta: { generatedAt: new Date().toISOString() },
  });
}

// ===== Dashboard =====

export async function dashboardOverview(req, res, next) {
  try {
    const data = await getOverview();
    return sendSuccess(res, data);
  } catch (err) {
    return next(err);
  }
}

export async function dashboardAttendanceSummary(req, res, next) {
  try {
    const v = validateAttendanceSummaryQuery(req.query || {});
    if (v.error) return sendError(res, v.error);
    const data = await getAttendanceSummary(v.value);
    return sendSuccess(res, data);
  } catch (err) {
    return next(err);
  }
}

export async function dashboardLeaveSummary(req, res, next) {
  try {
    const v = validateLeaveSummaryQuery(req.query || {});
    if (v.error) return sendError(res, v.error);
    const data = await getLeaveSummary(v.value);
    return sendSuccess(res, data);
  } catch (err) {
    return next(err);
  }
}

export async function dashboardPayrollSummary(req, res, next) {
  try {
    const v = validateDashboardPayrollQuery(req.query || {});
    if (v.error) return sendError(res, v.error);
    const data = await getPayrollSummary(v.value);
    return sendSuccess(res, data);
  } catch (err) {
    return next(err);
  }
}

// ===== Reports =====

export async function reportsEmployees(req, res, next) {
  try {
    const v = validateEmployeesReportQuery(req.query || {});
    if (v.error) return sendError(res, v.error);
    const data = await getEmployeesReport();
    return sendSuccess(res, data);
  } catch (err) {
    return next(err);
  }
}

export async function reportsAttendance(req, res, next) {
  try {
    const v = validateAttendanceReportQuery(req.query || {});
    if (v.error) return sendError(res, v.error);
    const data = await getAttendanceReport(v.value);
    return sendSuccess(res, data);
  } catch (err) {
    return next(err);
  }
}

export async function reportsLeaveRequests(req, res, next) {
  try {
    const v = validateLeaveRequestsReportQuery(req.query || {});
    if (v.error) return sendError(res, v.error);
    const data = await getLeaveRequestsReport(v.value);
    return sendSuccess(res, data);
  } catch (err) {
    return next(err);
  }
}

export async function reportsPayroll(req, res, next) {
  try {
    const v = validatePayrollReportQuery(req.query || {});
    if (v.error) return sendError(res, v.error);
    const data = await getPayrollReport(v.value);
    return sendSuccess(res, data);
  } catch (err) {
    return next(err);
  }
}
