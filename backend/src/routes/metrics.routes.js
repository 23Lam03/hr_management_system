// Metrics route — Phase 16.
//
//   GET /api/metrics   — Prometheus-compatible text format.
//
// Authorization:
//   The router EXPORTS the handler, but the route is mounted
//   behind `protect` and `authorize('admin')` in app.js. We
//   deliberately do NOT start a separate metrics server. Operators
//   who want Prometheus to scrape this endpoint should configure a
//   sidecar / pull with the admin token. We deliberately do NOT
//   expose a public, unauthenticated metrics endpoint to avoid
//   leaking cardinality to anonymous clients.

import express from 'express';
import { safeRenderMetricsText } from '../lib/metrics.js';
import { protect, authorize } from '../middlewares/auth.middleware.js';

const router = express.Router();

router.get('/', protect, authorize('admin'), (req, res) => {
  res.set('Content-Type', 'text/plain; version=0.0.4; charset=utf-8');
  res.status(200).send(safeRenderMetricsText());
});

export default router;
