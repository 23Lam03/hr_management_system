#!/usr/bin/env node
// scripts/cleanup-audit-logs.js
//
// Phase 15 — Operator entrypoint for the audit log cleanup service.
//
// Usage:
//   AUDIT_LOG_RETENTION_DAYS=365 \
//   AUDIT_LOG_CLEANUP_BATCH_SIZE=1000 \
//   MONGODB_URI=mongodb://... \
//   node scripts/cleanup-audit-logs.js
//
// Exits 0 on success (including "nothing to delete") and non-zero
// on a configuration / DB error so that cron supervisors can detect
// failures.
//
// IMPORTANT: This script is intentionally minimal. It does NOT
// auto-schedule itself; an external cron / k8s CronJob is required
// to invoke it on a schedule. See docs/AUDIT_LOG_RETENTION_AND_MONITORING.md
// for the operational runbook.

import { connect, disconnect } from 'mongoose';
import {
  cleanupExpiredLogs,
  validateCleanupParams,
  recordEvent,
} from '../src/services/auditLog.service.js';
import { assertConfig } from '../src/config/env.js';

async function main() {
  assertConfig();
  const retentionDays = Number(process.env.AUDIT_LOG_RETENTION_DAYS || 365);
  const batchSize = Number(process.env.AUDIT_LOG_CLEANUP_BATCH_SIZE || 1000);

  const v = validateCleanupParams({ retentionDays, batchSize });
  if (v.error) {
    // eslint-disable-next-line no-console
    console.error(`[cleanup-audit-logs] invalid params: ${v.error}`);
    process.exitCode = 2;
    return;
  }

  const mongoUri = process.env.MONGODB_URI;
  await connect(mongoUri);

  try {
    // Run a single bounded batch. Operators should call this in a
    // loop until `hasMore === false`.
    const result = await cleanupExpiredLogs({
      retentionDays: v.retentionDays,
      batchSize: v.batchSize,
    });
    // eslint-disable-next-line no-console
    console.log(
      `[cleanup-audit-logs] deletedCount=${result.deletedCount} ` +
        `hasMore=${result.hasMore} ` +
        `retentionDays=${result.retentionDays} ` +
        `cutoff=${result.cutoff.toISOString()}`,
    );

    // Audit the cleanup itself.
    await recordEvent({
      actor: { role: 'system' },
      action: 'auditlog.cleanup',
      resourceType: 'auditlog',
      description: 'Operator-initiated audit log cleanup',
      status: 'success',
      metadata: {
        deletedCount: result.deletedCount,
        hasMore: result.hasMore,
        retentionDays: result.retentionDays,
      },
    });
  } finally {
    await disconnect();
  }
}

main().catch((err) => {
  // eslint-disable-next-line no-console
  console.error('[cleanup-audit-logs] failed:', err && err.message);
  process.exitCode = 1;
});
