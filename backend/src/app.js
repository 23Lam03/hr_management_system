// Express application factory.
// Wires middleware, CORS, routes, and error handling.
// Does NOT start the server or open the DB — that lives in server.js
// so the app is easy to test in isolation.

import express from 'express';
import cors from 'cors';
import { config } from './config/env.js';
import healthRoutes from './routes/health.routes.js';
import authRoutes from './routes/auth.routes.js';
import employeeRoutes from './routes/employee.routes.js';
import departmentRoutes from './routes/department.routes.js';
import positionRoutes from './routes/position.routes.js';
import attendanceRoutes from './routes/attendance.routes.js';
import leaveRequestRoutes from './routes/leaveRequest.routes.js';
import payrollRoutes from './routes/payroll.routes.js';
import { dashboardRouter, reportsRouter } from './routes/dashboard.routes.js';
import auditLogRoutes from './routes/auditLog.routes.js';
import notificationRoutes from './routes/notification.routes.js';
import {
  notFoundHandler,
  errorHandler,
} from './middlewares/error.middleware.js';
import {
  helmetMiddleware,
  loginLimiter,
} from './middlewares/security.middleware.js';
import { requestContext } from './middlewares/requestContext.middleware.js';
import {
  inflightMiddleware,
  requestLogMiddleware,
} from './lib/metrics.middleware.js';
import metricsRoutes from './routes/metrics.routes.js';

function createApp() {
  const app = express();

  // -------------------------------------------------------------------------
  // Security headers (Phase 13)
  // -------------------------------------------------------------------------
  // Helmet must be registered EARLY so that every response — including
  // 4xx/5xx from later middleware — carries the security headers.
  app.use(helmetMiddleware);

  // Request context (Phase 15) — must come after helmet so that the
  // X-Request-Id response header is not stripped, and before any
  // controller that wants to audit. This middleware does not log
  // anything; it only attaches `req.context` for downstream use.
  app.use(requestContext);

  // Phase 16: in-flight gauge + structured request log + metrics.
  // The order matters: in-flight is incremented BEFORE the request
  // log middleware so that the first request is correctly counted.
  app.use(inflightMiddleware);
  app.use(requestLogMiddleware);

  // Trust proxy when behind a reverse proxy (e.g. nginx) — kept off by
  // default. Enable explicitly via the TRUST_PROXY env variable when
  // deploying behind a known proxy. See docs/PRODUCTION_DEPLOYMENT.md
  // for guidance.
  //
  // When `trust proxy` is enabled, the rate limiter's req.ip correctly
  // reflects the real client IP. If you enable it without a trusted
  // proxy, clients can spoof their IP via the X-Forwarded-For header.
  if (
    typeof process.env.TRUST_PROXY === 'string' &&
    process.env.TRUST_PROXY.length > 0
  ) {
    // Accept either "true", "false", or a hop count / subnet.
    const v = process.env.TRUST_PROXY;
    if (v === 'true') {
      app.set('trust proxy', true);
    } else if (v === 'false') {
      app.set('trust proxy', false);
    } else if (/^\d+$/.test(v)) {
      app.set('trust proxy', parseInt(v, 10));
    } else {
      app.set('trust proxy', v);
    }
  }

  // Body parsers
  app.use(express.json({ limit: '1mb' }));
  app.use(express.urlencoded({ extended: true, limit: '1mb' }));

  // CORS — allow only configured origins, not "*".
  // In development we relax slightly; in production we strictly match the list.
  const allowAllInDev = config.env !== 'production';

  app.use(
    cors({
      origin: (origin, callback) => {
        // Same-origin / curl / server-to-server have no Origin header → allow.
        if (!origin) return callback(null, true);

        if (allowAllInDev) {
          return callback(null, true);
        }

        if (config.corsOrigins.includes(origin)) {
          return callback(null, true);
        }

        return callback(new Error(`CORS: origin ${origin} not allowed`));
      },
      credentials: true,
      methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
      allowedHeaders: ['Content-Type', 'Authorization'],
    }),
  );

  // Lightweight request logger removed in Phase 16 — the structured
  // request logger in `lib/metrics.middleware.js` replaces it. It
  // logs once per request (in `res.on('finish')`) with method,
  // route template, status, duration, and requestId. It does NOT
  // log bodies, authorization headers, or cookies.

  // Routes
  app.get('/', (req, res) => {
    res.json({
      success: true,
      message: 'HR Management System Backend API',
      data: {
        service: 'hrm-backend',
        env: config.env,
        docs: '/api/health',
      },
    });
  });

  app.use('/api/health', healthRoutes);
  app.use('/api/auth', authRoutes);
  app.use('/api/employees', employeeRoutes);
  app.use('/api/departments', departmentRoutes);
  app.use('/api/positions', positionRoutes);
  app.use('/api/attendance', attendanceRoutes);
  app.use('/api/leave-requests', leaveRequestRoutes);
  app.use('/api/payroll', payrollRoutes);
  app.use('/api/dashboard', dashboardRouter);
  app.use('/api/reports', reportsRouter);
  app.use('/api/audit-logs', auditLogRoutes);
  app.use('/api/notifications', notificationRoutes);
  // Phase 16: metrics endpoint. Admin-only.
  app.use('/api/metrics', metricsRoutes);

  // 404 + centralized error handler must be last.
  app.use(notFoundHandler);
  app.use(errorHandler);

  return app;
}

export { createApp };