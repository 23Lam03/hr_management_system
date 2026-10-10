// Health check routes — Phase 16.
//
// Three endpoints, intentionally distinct:
//
//   GET /api/health          — backward-compatible aggregate. Checks DB.
//                              200 if healthy, 503 if degraded.
//   GET /api/health/livez    — liveness. 200 if the process is running.
//                              NEVER touches the database. Used by k8s
//                              livenessProbe to decide whether to kill
//                              and restart the pod.
//   GET /api/health/readyz   — readiness. 200 if the app is ready to
//                              accept traffic. Includes DB connectivity
//                              AND the process's shutdown flag. Used by
//                              k8s readinessProbe to decide whether to
//                              route traffic to this instance.
//
// All three are PUBLIC (no auth) so external systems (load balancer,
// monitoring) can hit them without credentials. The bodies are
// minimal and contain no secrets.

import express from 'express';
import mongoose from 'mongoose';
import { getConnectionState } from '../config/database.js';

const router = express.Router();

// ---------------------------------------------------------------------------
// Process shutdown flag (Phase 16)
// ---------------------------------------------------------------------------
// Set by server.js when SIGINT/SIGTERM arrives. While true, /readyz
// returns 503 so a load balancer drains the instance before the
// actual shutdown completes.

let shuttingDown = false;
export function markShuttingDown(value = true) {
  shuttingDown = Boolean(value);
}
export function isShuttingDown() {
  return shuttingDown;
}

// ---------------------------------------------------------------------------
// /api/health — original aggregate endpoint
// ---------------------------------------------------------------------------

router.get('/', (req, res) => {
  const dbState = getConnectionState();
  const isDbConnected = dbState === 'connected';
  const status = isDbConnected && !shuttingDown ? 200 : 503;
  res.status(status).json({
    success: isDbConnected && !shuttingDown,
    message: isDbConnected
      ? shuttingDown
        ? 'Service is shutting down'
        : 'Service is healthy'
      : 'Service is running but the database is not connected',
    data: {
      service: 'hrm-backend',
      uptime: process.uptime(),
      timestamp: new Date().toISOString(),
      database: {
        status: dbState,
        connected: isDbConnected,
      },
      shuttingDown,
    },
  });
});

// ---------------------------------------------------------------------------
// /api/health/livez — liveness only
// ---------------------------------------------------------------------------
// We deliberately do NOT touch the database here. The whole point
// of liveness is to answer "is the process responsive?". If the DB
// is down, that's a readiness issue, not a liveness issue — the
// process can still be restarted by an orchestrator if it becomes
// unresponsive for another reason.

router.get('/livez', (req, res) => {
  res.status(200).json({
    success: true,
    message: 'ok',
    data: {
      service: 'hrm-backend',
      uptime: process.uptime(),
      timestamp: new Date().toISOString(),
    },
  });
});

// ---------------------------------------------------------------------------
// /api/health/readyz — readiness with bounded DB check
// ---------------------------------------------------------------------------
// We honor the connection state that Mongoose already maintains.
// We do NOT issue a ping here on every probe because that would
// amplify load on Mongo when many probes arrive. The connection
// state is updated by mongoose's internal events (disconnected,
// connected, error).

function withTimeout(promise, ms, label) {
  return new Promise((resolve, reject) => {
    const t = setTimeout(() => reject(new Error(`${label} timeout`)), ms);
    promise.then(
      (v) => {
        clearTimeout(t);
        resolve(v);
      },
      (err) => {
        clearTimeout(t);
        reject(err);
      },
    );
  });
}

router.get('/readyz', async (req, res) => {
  if (shuttingDown) {
    return res.status(503).json({
      success: false,
      message: 'shutting down',
    });
  }
  const state = getConnectionState();
  if (state === 'connected') {
    return res.status(200).json({ success: true, message: 'ready' });
  }
  // If we are 'connecting' (e.g. just started up), allow a short
  // bounded ping to confirm. If the ping succeeds OR times out, we
  // report the actual state.
  try {
    await withTimeout(
      mongoose.connection.db.admin().ping(),
      1500,
      'readyz.ping',
    );
    return res.status(200).json({ success: true, message: 'ready' });
  } catch (_err) {
    return res.status(503).json({
      success: false,
      message: 'database not ready',
      data: { state },
    });
  }
});

export default router;
