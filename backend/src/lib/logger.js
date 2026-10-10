// lib/logger.js — Phase 16
//
// Structured logger with two output modes:
//   - 'json'  — single-line JSON per record (production / SIEM-friendly)
//   - 'text'  — pretty, color-free single-line for local dev
//
// The logger is intentionally tiny. It is NOT a pino/winston replacement
// and does not aim to be. We only need:
//   - Per-level filter (debug/info/warn/error)
//   - Per-record fixed fields (timestamp, level, msg, ...)
//   - Safe serialization: a "deny" list of forbidden keys (passwords,
//     tokens, secrets, full URLs with secrets, etc.)
//   - A request-bound child logger that automatically attaches
//     requestId / route / etc.
//
// IMPORTANT invariants:
//   1. The logger NEVER throws. A serialization failure is swallowed
//      and replaced with a single console.error line.
//   2. The logger NEVER echoes back fields whose key matches the
//      METADATA_FORBIDDEN_KEYS list (see auditLog.model.js). This is
//      a defense-in-depth: a caller that accidentally passes
//      { password: '...' } will not see that key in the output.
//   3. The logger NEVER prints the full URL when it includes a
//      token / password / secret. We use req.route?.path (the route
//      TEMPLATE) instead of req.originalUrl.
//   4. Performance: the JSON.stringify path only runs when the
//      log level is enabled.

import { isProd } from '../config/env.js';

// ---------------------------------------------------------------------------
// Configuration
// ---------------------------------------------------------------------------

const LEVELS = Object.freeze({
  debug: 10,
  info: 20,
  warn: 30,
  error: 40,
});

function readLevel() {
  const raw = String(process.env.LOG_LEVEL || (isProd ? 'info' : 'debug')).toLowerCase();
  if (LEVELS[raw] !== undefined) return LEVELS[raw];
  return isProd ? LEVELS.info : LEVELS.debug;
}

function readFormat() {
  const raw = String(process.env.LOG_FORMAT || (isProd ? 'json' : 'text')).toLowerCase();
  return raw === 'json' ? 'json' : 'text';
}

// ---------------------------------------------------------------------------
// Forbidden keys (defense in depth). Mirrors the audit-log list but
// is independently maintained so that the logger is not coupled to
// the audit log model.
// ---------------------------------------------------------------------------

const FORBIDDEN_KEYS = Object.freeze([
  'password',
  'passwordHash',
  'oldPassword',
  'newPassword',
  'currentPassword',
  'passwordResetToken',
  'token',
  'accessToken',
  'refreshToken',
  'tokenHash',
  'jwt',
  'authorization',
  'cookie',
  'set-cookie',
  'secret',
  'clientSecret',
  'mongoUri',
  'dbUri',
  'connectionString',
  // PII / payroll
  'baseSalary',
  'allowances',
  'bonuses',
  'deductions',
  'grossSalary',
  'netSalary',
  'email',
  'phone',
  'fullName',
  'address',
  'ssn',
  'taxId',
  'creditCard',
  'bankAccount',
]);

// Strings that indicate "this field probably contains a credential".
// We strip any value whose key matches one of these prefixes too.
const FORBIDDEN_KEY_PREFIXES = Object.freeze([
  'password',
  'secret',
  'token',
  'jwt',
  'authorization',
  'cookie',
  'mongo',
  'db',
  'connection',
]);

const MAX_STRING_VALUE = 500;
const MAX_OBJECT_KEYS = 32;

function isForbiddenKey(key) {
  if (FORBIDDEN_KEYS.includes(key)) return true;
  const lower = String(key).toLowerCase();
  return FORBIDDEN_KEY_PREFIXES.some((p) => lower.startsWith(p));
}

function safeStringifyValue(v) {
  if (v === null || v === undefined) return v;
  if (typeof v === 'string') {
    return v.length > MAX_STRING_VALUE ? `${v.slice(0, MAX_STRING_VALUE)}…` : v;
  }
  if (typeof v === 'number' || typeof v === 'boolean') return v;
  if (v instanceof Date) return v.toISOString();
  if (v instanceof Error) {
    return { name: v.name, message: v.message, code: v.code };
  }
  // For arbitrary objects, we do a shallow filter on the top level.
  if (typeof v === 'object') {
    if (Array.isArray(v)) return v.map(safeStringifyValue);
    const out = {};
    let count = 0;
    for (const [k, val] of Object.entries(v)) {
      if (count >= MAX_OBJECT_KEYS) break;
      if (isForbiddenKey(k)) continue;
      out[k] = safeStringifyValue(val);
      count += 1;
    }
    return out;
  }
  return String(v);
}

function safeSerialize(meta) {
  if (!meta || typeof meta !== 'object') return {};
  const out = {};
  for (const [k, v] of Object.entries(meta)) {
    if (isForbiddenKey(k)) continue;
    out[k] = safeStringifyValue(v);
  }
  return out;
}

// ---------------------------------------------------------------------------
// Core emit
// ---------------------------------------------------------------------------

function emit(levelName, msg, meta) {
  if (LEVELS[levelName] < readLevel()) return;

  const timestamp = new Date().toISOString();
  const record = {
    timestamp,
    level: levelName,
    msg: typeof msg === 'string' ? msg : 'log',
    ...safeSerialize(meta),
  };

  const format = readFormat();
  if (format === 'json') {
    try {
      // Use stdout via process.stdout.write so the output is
      // not interleaved with stderr.
      process.stdout.write(`${JSON.stringify(record)}\n`);
    } catch (_) {
      // Swallow serialization errors — we promised never to throw.
      // eslint-disable-next-line no-console
      console.error('[logger] failed to serialize record');
    }
    return;
  }
  // text mode: "ts LEVEL msg key=value key=value"
  const parts = [timestamp, levelName.toUpperCase(), record.msg];
  for (const [k, v] of Object.entries(record)) {
    if (k === 'timestamp' || k === 'level' || k === 'msg') continue;
    if (typeof v === 'object' && v !== null) {
      try {
        parts.push(`${k}=${JSON.stringify(v)}`);
      } catch (_) {
        parts.push(`${k}=[unserializable]`);
      }
    } else {
      parts.push(`${k}=${v}`);
    }
  }
  // eslint-disable-next-line no-console
  console.log(parts.join(' '));
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

export const logger = {
  debug: (msg, meta) => emit('debug', msg, meta),
  info: (msg, meta) => emit('info', msg, meta),
  warn: (msg, meta) => emit('warn', msg, meta),
  error: (msg, meta) => emit('error', msg, meta),

  /**
   * Build a child logger that always includes the given context.
   * Fields in `ctx` are sanitized the same way as per-call metadata.
   */
  withContext(ctx) {
    const base = safeSerialize(ctx || {});
    return {
      debug: (msg, meta) => emit('debug', msg, { ...base, ...safeSerialize(meta) }),
      info: (msg, meta) => emit('info', msg, { ...base, ...safeSerialize(meta) }),
      warn: (msg, meta) => emit('warn', msg, { ...base, ...safeSerialize(meta) }),
      error: (msg, meta) => emit('error', msg, { ...base, ...safeSerialize(meta) }),
    };
  },

  // Test-only / introspection helpers. Do not call from app code.
  _readLevel: readLevel,
  _readFormat: readFormat,
  _forbiddenKeys: FORBIDDEN_KEYS,
};

export default logger;
