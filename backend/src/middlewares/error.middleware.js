// Centralized error handling middleware.
// Catches errors thrown from routes / middlewares and returns a sanitized
// JSON response. Never leaks stack traces or internal secrets to clients.

import { isProd } from '../config/env.js';
import logger from '../lib/logger.js';
import { recordAppError } from '../lib/metrics.js';

// 404 handler — for unmatched routes.
export function notFoundHandler(req, res, next) {
  res.locals.errorCode = 'NOT_FOUND';
  recordAppError({
    method: req.method,
    route: req.originalUrl || 'unknown',
    status: 404,
    code: 'NOT_FOUND',
  });
  res.status(404).json({
    success: false,
    error: {
      code: 'NOT_FOUND',
      message: `Route not found: ${req.method} ${req.originalUrl}`,
    },
  });
}

// Centralized error handler.
// eslint-disable-next-line no-unused-vars
export function errorHandler(err, req, res, next) {
  // Mongoose validation error → 400
  if (err && err.name === 'ValidationError') {
    res.locals.errorCode = 'VALIDATION_ERROR';
    recordAppError({
      method: req.method,
      route: (req.route && req.route.path) || req.path,
      status: 400,
      code: 'VALIDATION_ERROR',
    });
    return res.status(400).json({
      success: false,
      error: {
        code: 'VALIDATION_ERROR',
        message: err.message,
      },
    });
  }

  // Mongoose bad ObjectId → 400
  if (err && err.name === 'CastError') {
    res.locals.errorCode = 'BAD_REQUEST';
    recordAppError({
      method: req.method,
      route: (req.route && req.route.path) || req.path,
      status: 400,
      code: 'BAD_REQUEST',
    });
    return res.status(400).json({
      success: false,
      error: {
        code: 'BAD_REQUEST',
        message: `Invalid ${err.path}: ${err.value}`,
      },
    });
  }

  // Mongo duplicate key error → 409
  if (err && err.code === 11000) {
    res.locals.errorCode = 'DUPLICATE_KEY';
    recordAppError({
      method: req.method,
      route: (req.route && req.route.path) || req.path,
      status: 409,
      code: 'DUPLICATE_KEY',
    });
    return res.status(409).json({
      success: false,
      error: {
        code: 'DUPLICATE_KEY',
        message: 'Duplicate value for a unique field',
      },
    });
  }

  // Honor explicit status / statusCode on the error if present.
  const status = err.status || err.statusCode || 500;
  const code = err.code || 'INTERNAL_SERVER_ERROR';
  res.locals.errorCode = code;

  // Log full error server-side for debugging. Include requestId
  // so the operator can correlate with the audit log / client.
  const ctx = (req && req.context) || {};
  try {
    logger.error('http.error', {
      requestId: ctx.requestId,
      method: req.method,
      url: req.originalUrl,
      status,
      code,
      error: err && err.message,
      stack: isProd ? undefined : err && err.stack,
    });
  } catch (_) {
    // never let logger break the response
  }
  try {
    recordAppError({
      method: req.method,
      route: (req.route && req.route.path) || req.path,
      status,
      code,
    });
  } catch (_) {
    // ignore
  }

  return res.status(status).json({
    success: false,
    error: {
      code,
      // In production, do not leak internal error messages for 5xx.
      message:
        isProd && status >= 500 ? 'Internal server error' : err.message,
      // Stack traces are NEVER sent to the client.
    },
  });
}