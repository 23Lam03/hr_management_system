// Employee routes.
//
//   GET    /api/employees          protect + authorize('admin')      list
//   POST   /api/employees          protect + authorize('admin')      create
//   GET    /api/employees/:id      protect                            detail
//   PATCH  /api/employees/:id      protect + authorize('admin')      update
//   DELETE /api/employees/:id      protect + authorize('admin')      soft-delete
//
// Note: GET /:id allows employees (not just admin) so that an employee
// can read their own profile. Authorization at the data layer (in
// `detail` controller) enforces that they can only see themselves.

import express from 'express';
import { protect, authorize } from '../middlewares/auth.middleware.js';
import {
  list,
  detail,
  create,
  update,
  softDelete,
} from '../controllers/employee.controller.js';

const router = express.Router();

router.get('/', protect, authorize('admin'), list);
router.post('/', protect, authorize('admin'), create);
router.get('/:id', protect, detail);
router.patch('/:id', protect, authorize('admin'), update);
router.delete('/:id', protect, authorize('admin'), softDelete);

export default router;
