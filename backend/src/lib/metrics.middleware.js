// lib/metrics.middleware.js — Phase 16
//
// Two middlewares that work together:
//   - `requestLogMiddleware` logs each request once it completes
//     and updates the request metrics.
//   - `inflightMiddleware` updates the in-flight gauge.
//
// Both are wrapped in try/catch so a metrics bug can never bring
// down a request.

import logger from './logger.js';
import {
  recordRequest,
  incInFlight,
  decInFlight,
} from './metrics.js';

function safeRoute(req) {
  // Prefer the matched route template (e.g. '/api/employees/:id')
  // because the raw URL contains dynamic IDs. Fall back to a
  // short path-only string for unmatched routes.
  if (req.route && typeof req.route.path === 'string') {
    return req.baseUrl ? req.baseUrl + req.route.path : req.route.path;
  }
  return req.path && req.path.startsWith('/') ? req.path.split('?')[0] : 'unknown';
}

export function inflightMiddleware(req, res, next) {
  try {
    incInFlight();
    res.on('finish', () => {
      try {
        decInFlight();
      } catch (_) {
        // ignore
      }
    });
    res.on('close', () => {
      try {
        decInFlight();
      } catch (_) {
        // ignore
      }
    });
  } catch (err) {
    logger.warn('metrics.inflight_error', { error: err && err.message });
  }
  return next();
}

export function requestLogMiddleware(req, res, next) {
  const startNs = process.hrtime.bigint();
  const ctx = (req && req.context) || {};
  const child = logger.withContext({
    requestId: ctx.requestId,
    method: req.method,
  });

  res.on('finish', () => {
    const durationMs = Number(process.hrtime.bigint() - startNs) / 1e6;
    const route = safeRoute(req);
    const errorCode = (res.locals && res.locals.errorCode) || null;
    try {
      recordRequest({
        method: req.method,
        route,
        status: res.statusCode,
        durationMs,
      });
    } catch (err) {
      logger.warn('metrics.request_record_error', { error: err && err.message });
    }
    try {
      child.info('http.request', {
        route,
        status: res.statusCode,
        durationMs: Math.round(durationMs * 100) / 100,
        ...(errorCode ? { errorCode } : {}),
      });
    } catch (err) {
      logger.warn('logger.request_log_error', { error: err && err.message });
    }
  });

  return next();
}
