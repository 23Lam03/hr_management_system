// Server bootstrap.
// Responsibilities:
// 1. Validate environment configuration.
// 2. Connect to MongoDB BEFORE accepting requests.
// 3. If the DB fails to connect, exit with a clear error instead of
//    pretending the service is ready.
// 4. Handle process signals (SIGINT, SIGTERM) gracefully.
// 5. Mark the readiness endpoint as 503 while shutting down so the
//    load balancer drains the instance (Phase 16).

import { createApp } from './app.js';
import { config, assertConfig } from './config/env.js';
import {
  connectDatabase,
  disconnectDatabase,
  getConnectionState,
} from './config/database.js';
import logger from './lib/logger.js';
import { recordProcessError } from './lib/metrics.js';
import { markShuttingDown } from './routes/health.routes.js';

async function start() {
  // Step 1 — validate required configuration.
  try {
    assertConfig();
  } catch (err) {
    logger.error('boot.config_error', { error: err.message });
    process.exit(1);
  }

  // Step 2 — connect to the database first.
  try {
    await connectDatabase();
  } catch (err) {
    logger.error('boot.db_connect_failed', { error: err.message });
    process.exit(1);
  }

  // Step 3 — start HTTP server only when the DB is actually connected.
  if (getConnectionState() !== 'connected') {
    logger.error('boot.db_not_connected', { state: getConnectionState() });
    process.exit(1);
  }

  const app = createApp();
  const server = app.listen(config.port, () => {
    logger.info('boot.listening', { port: config.port, env: config.env });
  });

  // Graceful shutdown.
  const shutdown = async (signal) => {
    logger.info('boot.shutdown.begin', { signal });
    // Stop readiness immediately so the LB drains us.
    markShuttingDown(true);

    // Stop accepting new connections.
    server.close(async () => {
      try {
        await disconnectDatabase();
        logger.info('boot.shutdown.complete');
        process.exit(0);
      } catch (err) {
        logger.error('boot.shutdown.db_close_failed', { error: err.message });
        process.exit(1);
      }
    });

    // Force-exit if shutdown takes too long.
    setTimeout(() => {
      logger.error('boot.shutdown.forced');
      process.exit(1);
    }, 10_000).unref();
  };

  process.on('SIGINT', () => shutdown('SIGINT'));
  process.on('SIGTERM', () => shutdown('SIGTERM'));

  // Last-resort safety net for unexpected errors.
  process.on('unhandledRejection', (reason) => {
    recordProcessError({ kind: 'unhandledRejection' });
    logger.error('process.unhandled_rejection', {
      error: reason && reason.message ? reason.message : String(reason),
    });
  });
  process.on('uncaughtException', (err) => {
    recordProcessError({ kind: 'uncaughtException' });
    logger.error('process.uncaught_exception', {
      error: err && err.message,
    });
    shutdown('uncaughtException');
  });
}

start();
