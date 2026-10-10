// Attendance routes.
//
//   GET    /api/attendance              protect + authorize('admin')   list
//   GET    /api/attendance/me           protect                          self-history
//   GET    /api/attendance/:id          protect                          detail
//   POST   /api/attendance              protect + authorize('admin')   create
//   PATCH  /api/attendance/:id          protect + authorize('admin')   update
//
// DELETE intentionally NOT implemented in Phase 6 — see
// docs/ATTENDANCE_API.md for the rationale (preserve historical
// attendance data; no soft-delete scheme has been agreed yet).

import express from 'express';
import { protect, authorize } from '../middlewares/auth.middleware.js';
import {
  list,
  me,
  detail,
  create,
  update,
} from '../controllers/attendance.controller.js';

const router = express.Router();

router.get('/', protect, authorize('admin'), list);
router.get('/me', protect, me);
router.get('/:id', protect, detail);
router.post('/', protect, authorize('admin'), create);
router.patch('/:id', protect, authorize('admin'), update);

export default router;
