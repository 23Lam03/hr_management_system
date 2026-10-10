// Payroll routes — mount at /api/payroll in app.js.

import express from 'express';
import { protect, authorize } from '../middlewares/auth.middleware.js';
import {
  adminListPayrolls,
  getMyPayrolls,
  getPayroll,
  createPayrollHandler,
  updatePayrollHandler,
  approvePayrollHandler,
  markPaidPayrollHandler,
  cancelPayrollHandler,
} from '../controllers/payroll.controller.js';

const router = express.Router();

// Tất cả endpoint đều yêu cầu đăng nhập.
router.use(protect);

// Self-list phải đặt TRƯỚC /:id để tránh 'me' bị parse là :id.
router.get('/me', getMyPayrolls);

// Admin list.
router.get('/', authorize('admin'), adminListPayrolls);

// Chi tiết — admin hoặc employee (service kiểm ownership).
router.get('/:id', getPayroll);

// Admin write/state-transition.
router.post('/', authorize('admin'), createPayrollHandler);
router.patch('/:id', authorize('admin'), updatePayrollHandler);
router.patch('/:id/approve', authorize('admin'), approvePayrollHandler);
router.patch('/:id/mark-paid', authorize('admin'), markPaidPayrollHandler);
router.patch('/:id/cancel', authorize('admin'), cancelPayrollHandler);

export default router;
