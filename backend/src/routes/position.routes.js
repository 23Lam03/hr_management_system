// Position routes.
//
//   GET    /api/positions                   protect + authorize('admin')   list
//   POST   /api/positions                   protect + authorize('admin')   create
//   GET    /api/positions/:id               protect + authorize('admin')   detail
//   PATCH  /api/positions/:id               protect + authorize('admin')   update
//   PATCH  /api/positions/:id/deactivate    protect + authorize('admin')   deactivate

import express from 'express';
import { protect, authorize } from '../middlewares/auth.middleware.js';
import {
  list,
  detail,
  create,
  update,
  deactivate,
} from '../controllers/position.controller.js';

const router = express.Router();

router.get('/', protect, authorize('admin'), list);
router.post('/', protect, authorize('admin'), create);
router.get('/:id', protect, authorize('admin'), detail);
router.patch('/:id', protect, authorize('admin'), update);
router.patch('/:id/deactivate', protect, authorize('admin'), deactivate);

export default router;
