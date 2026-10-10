// Auth routes.
//
// Wires URL → middleware chain → controller.
//
//   POST /api/auth/login                public (rate-limited, Phase 13)
//   POST /api/auth/refresh              public (rate-limited — refresh is a
//                                                credential operation)
//   GET  /api/auth/me                   protect
//   POST /api/auth/logout               protect (Phase 14: revokes session)
//   GET  /api/auth/sessions             protect
//   DELETE /api/auth/sessions/:id       protect
//   POST /api/auth/sessions/revoke-all  protect
//   GET  /api/auth/admin-check          protect + authorize('admin')
//
// The /admin-check endpoint exists for Phase 3 to verify the
// authorize middleware end-to-end. It is intentionally minimal and
// does not expose sensitive data.

import express from 'express';
import {
  login,
  refresh,
  me,
  logout,
  listMySessions,
  revokeMySession,
  revokeAllMySessions,
  adminCheck,
} from '../controllers/auth.controller.js';
import { protect, authorize } from '../middlewares/auth.middleware.js';
import { loginLimiter } from '../middlewares/security.middleware.js';

const router = express.Router();

// Rate limit login + refresh. Both are credential operations and
// should be throttled the same way (Phase 13 limiter is wired to
// per-process state; acceptable for a single-instance deployment).
router.post('/login', loginLimiter, login);
router.post('/refresh', loginLimiter, refresh);

router.get('/me', protect, me);
router.post('/logout', protect, logout);

// Session management for the authenticated user.
router.get('/sessions', protect, listMySessions);
router.delete('/sessions/:id', protect, revokeMySession);
router.post('/sessions/revoke-all', protect, revokeAllMySessions);

router.get('/admin-check', protect, authorize('admin'), adminCheck);

export default router;