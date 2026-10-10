// Dashboard & Reports routes (Phase 9).
//
// Tất cả endpoint đều Admin-only vì chứa số liệu tổng hợp nhạy cảm
// (lương, nhân sự, chấm công toàn công ty). Đề bài yêu cầu rõ: Employee
// không được xem các số liệu tổng hợp.

import express from 'express';
import { protect, authorize } from '../middlewares/auth.middleware.js';
import {
  dashboardOverview,
  dashboardAttendanceSummary,
  dashboardLeaveSummary,
  dashboardPayrollSummary,
  reportsEmployees,
  reportsAttendance,
  reportsLeaveRequests,
  reportsPayroll,
} from '../controllers/dashboard.controller.js';

const dashboardRouter = express.Router();
const reportsRouter = express.Router();

// Auth + role check áp dụng cho mọi route trong cả hai router.
const adminOnly = [protect, authorize('admin')];

dashboardRouter.use(...adminOnly);
reportsRouter.use(...adminOnly);

dashboardRouter.get('/overview', dashboardOverview);
dashboardRouter.get('/attendance-summary', dashboardAttendanceSummary);
dashboardRouter.get('/leave-summary', dashboardLeaveSummary);
dashboardRouter.get('/payroll-summary', dashboardPayrollSummary);

reportsRouter.get('/employees', reportsEmployees);
reportsRouter.get('/attendance', reportsAttendance);
reportsRouter.get('/leave-requests', reportsLeaveRequests);
reportsRouter.get('/payroll', reportsPayroll);

export { dashboardRouter, reportsRouter };
