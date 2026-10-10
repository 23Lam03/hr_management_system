// AuditLog routes — Phase 10.
// Admin-only. KHÔNG có POST/PATCH/DELETE.

import express from 'express';
import { protect, authorize } from '../middlewares/auth.middleware.js';
import * as auditLogController from '../controllers/auditLog.controller.js';

const router = express.Router();

router.use(protect, authorize('admin'));

router.get('/', auditLogController.list);
router.get('/:id', auditLogController.detail);

export default router;
