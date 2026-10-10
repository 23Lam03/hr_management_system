// Notification routes — Phase 11.
//
// Tất cả endpoints yêu cầu `protect` (JWT). User chỉ truy cập
// thông báo của chính mình. Service đã enforce ownership.

import express from 'express';
import { protect } from '../middlewares/auth.middleware.js';
import * as notificationController from '../controllers/notification.controller.js';

const router = express.Router();

router.use(protect);

router.get('/unread-count', notificationController.unreadCount);
router.get('/', notificationController.list);
router.get('/:id', notificationController.detail);
router.patch('/read-all', notificationController.markAllReadHandler);
router.patch('/:id/read', notificationController.markOneRead);

export default router;
