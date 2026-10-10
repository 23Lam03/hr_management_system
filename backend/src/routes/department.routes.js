// Department routes.
//
//   GET    /api/departments                   protect + authorize('admin')   list
//   POST   /api/departments                   protect + authorize('admin')   create
//   GET    /api/departments/:id               protect + authorize('admin')   detail
//   PATCH  /api/departments/:id               protect + authorize('admin')   update
//   PATCH  /api/departments/:id/deactivate    protect + authorize('admin')   deactivate
//
// Note: the deactivate endpoint is a soft deactivation (status: inactive)
// rather than a hard delete, to preserve the historical links from
// employees and positions.

import express from 'express';
import { protect, authorize } from '../middlewares/auth.middleware.js';
import {
  list,
  detail,
  create,
  update,
  deactivate,
} from '../controllers/department.controller.js';

const router = express.Router();

router.get('/', protect, authorize('admin'), list);
router.post('/', protect, authorize('admin'), create);
router.get('/:id', protect, authorize('admin'), detail);
router.patch('/:id', protect, authorize('admin'), update);
router.patch('/:id/deactivate', protect, authorize('admin'), deactivate);

export default router;
