// Leave request routes.
//
//   GET    /api/leave-requests              protect + authorize('admin')  list
//   GET    /api/leave-requests/me           protect                        self-list
//   GET    /api/leave-requests/:id          protect                        detail
//   POST   /api/leave-requests              protect                        create
//   PATCH  /api/leave-requests/:id          protect                        update (own pending)
//   PATCH  /api/leave-requests/:id/cancel   protect                        cancel (own pending)
//   PATCH  /api/leave-requests/:id/approve  protect + authorize('admin')  approve
//   PATCH  /api/leave-requests/:id/reject   protect + authorize('admin')  reject
//
// DELETE intentionally NOT implemented — leave records are
// preserved for audit; use `cancelled` to mark a request as no longer
// active. See docs/LEAVE_REQUEST_API.md.

import express from 'express';
import { protect, authorize } from '../middlewares/auth.middleware.js';
import {
  list,
  me,
  detail,
  create,
  update,
  cancel,
  approve,
  reject,
} from '../controllers/leaveRequest.controller.js';

const router = express.Router();

// Static /me phải đặt trước /:id để tránh bị match thành :id='me'.
router.get('/me', protect, me);

// Admin-only.
router.get('/', protect, authorize('admin'), list);

// Review actions (Admin only).
router.patch('/:id/approve', protect, authorize('admin'), approve);
router.patch('/:id/reject', protect, authorize('admin'), reject);

// Authenticated user (any role) — ownership enforced in service.
router.get('/:id', protect, detail);
router.post('/', protect, create);
router.patch('/:id', protect, update);
router.patch('/:id/cancel', protect, cancel);

export default router;
