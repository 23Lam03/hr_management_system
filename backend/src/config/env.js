// Centralized configuration loaded from environment variables.
// Do not hard-code secrets in source code.

import dotenv from 'dotenv';

dotenv.config();

const isProd = process.env.NODE_ENV === 'production';

// Default TTL for access tokens. Short-lived access tokens are a
// security baseline; refresh tokens / revocation are out of scope
// for Phase 3 (see docs/DATABASE_DESIGN.md and Phase 3 spec §11).
const DEFAULT_JWT_EXPIRES_IN = '2h';

// Default TTL for refresh tokens. Phase 14 introduces a session
// model + opaque refresh tokens. The default (14 days) is a
// common balance between convenience and revocation latency.
const DEFAULT_REFRESH_TOKEN_EXPIRES_IN = '14d';

// Parse a TTL string ("2h", "30m", "7d", or seconds) to milliseconds.
// We accept only formats that the rest of the codebase already uses
// (jsonwebtoken's accepted formats), and a plain number-as-seconds.
function parseDurationMs(input) {
  if (typeof input === 'number' && Number.isFinite(input)) {
    return Math.max(0, Math.floor(input * 1000));
  }
  if (typeof input !== 'string' || input.trim().length === 0) {
    return null;
  }
  const s = input.trim();
  // Pure number → seconds.
  if (/^\d+$/.test(s)) {
    return parseInt(s, 10) * 1000;
  }
  const m = /^(\d+)\s*(ms|s|m|h|d)$/i.exec(s);
  if (!m) return null;
  const value = parseInt(m[1], 10);
  const unit = m[2].toLowerCase();
  switch (unit) {
    case 'ms':
      return value;
    case 's':
      return value * 1000;
    case 'm':
      return value * 60 * 1000;
    case 'h':
      return value * 60 * 60 * 1000;
    case 'd':
      return value * 24 * 60 * 60 * 1000;
    default:
      return null;
  }
}

// Minimum acceptable length for JWT_SECRET. The .env.example default
// placeholder is intentionally >= 16 chars so dev does not fail-fast
// by accident, but the production validator additionally rejects
// known placeholder strings.
const MIN_JWT_SECRET_LENGTH = 16;

// Strings that are NEVER acceptable as JWT_SECRET in production.
// These are the documented placeholders shipped in .env.example and
// common weak patterns. The check is case-insensitive and substring-based.
const FORBIDDEN_JWT_SECRET_FRAGMENTS = [
  'change-me',
  'change_me',
  'please-change',
  'please_change',
  'placeholder',
  'replace-me',
  'replace_me',
  'example-secret',
  'your-secret',
  'your_secret',
  'local-dev',
  'dev-secret',
  'test-secret',
];

const config = {
  env: process.env.NODE_ENV || 'development',
  port: parseInt(process.env.PORT, 10) || 5000,
  // The values below are read at import time. assertConfig() re-reads
  // them from process.env each time it runs so test setups and
  // runtime overrides take effect. Tests in tests/security.deployment.test.js
  // rely on this behavior.
  mongoUri: process.env.MONGODB_URI,
  jwtSecret: process.env.JWT_SECRET,
  // JWT_EXPIRES_IN follows jsonwebtoken's accepted formats:
  // number of seconds, or string like "2h", "30m", "7d".
  jwtExpiresIn: process.env.JWT_EXPIRES_IN || DEFAULT_JWT_EXPIRES_IN,
  // REFRESH_TOKEN_EXPIRES_IN is the lifetime of the opaque refresh
  // token stored in the Session collection. The TTL index on the
  // collection cleans up expired documents automatically.
  refreshTokenExpiresIn:
    process.env.REFRESH_TOKEN_EXPIRES_IN || DEFAULT_REFRESH_TOKEN_EXPIRES_IN,
  // CLIENT_URL may contain comma-separated origins.
  // In production, do not default to "*" — only allow configured origins.
  clientUrl: process.env.CLIENT_URL || 'http://localhost:5173',
  // Allowed CORS origins list (built from CLIENT_URL).
  corsOrigins: (process.env.CLIENT_URL || 'http://localhost:5173')
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean),
  // -------------------------------------------------------------------------
  // Phase 15: audit log retention
  // -------------------------------------------------------------------------
  // The retention value (in days) is read but the destructive
  // cleanup itself is NOT run automatically. Operators must run
  // `auditLogService.cleanupExpiredLogs({ retentionDays })` from a
  // separate task (cron job, k8s CronJob, etc.).
  //
  // Default 365 days — long enough for typical compliance windows
  // without indefinite growth.
  auditLogRetentionDays: readPositiveInt(
    process.env.AUDIT_LOG_RETENTION_DAYS,
    365,
  ),
  // Reserved for future use. The current Phase 15 release does NOT
  // auto-enable cleanup; this is documented as a forward-compat
  // flag. If the operator sets this to 'true' the service still
  // requires an explicit scheduler call — there is no internal
  // setInterval / setTimeout. Accepting 'true' | 'false'.
  auditLogCleanupEnabled:
    String(process.env.AUDIT_LOG_CLEANUP_ENABLED || 'false').toLowerCase() ===
    'true',
};

function readPositiveInt(value, defaultValue) {
  if (value === undefined || value === null || value === '') {
    return defaultValue;
  }
  const n = Number(value);
  if (!Number.isFinite(n) || !Number.isInteger(n) || n <= 0) {
    return defaultValue;
  }
  return n;
}

// -------------------------------------------------------------------------
// Phase 16: logging / metrics configuration
// -------------------------------------------------------------------------
// The logger reads LOG_LEVEL / LOG_FORMAT directly from
// process.env on every emit (it must — log level can be changed
// at runtime). We still surface the values here for diagnostics
// and so test code can flip them.
function readLogLevel() {
  const raw = String(process.env.LOG_LEVEL || '').toLowerCase();
  if (['debug', 'info', 'warn', 'error'].includes(raw)) return raw;
  return isProdNow() ? 'info' : 'debug';
}

function readLogFormat() {
  const raw = String(process.env.LOG_FORMAT || '').toLowerCase();
  if (raw === 'json' || raw === 'text') return raw;
  return isProdNow() ? 'json' : 'text';
}

function isProdNow() {
  return process.env.NODE_ENV === 'production';
}

/**
 * Validate required values early. Throw with a clear message instead of
 * letting the app start with broken/missing configuration.
 *
 * Error messages intentionally:
 *   - List the VARIABLE NAME that is missing/invalid.
 *   - Do NOT echo the actual value (which could be a real secret).
 */
function assertConfig() {
  // Re-read at validation time so tests (and dynamic reloads) work.
  const mongoUri = process.env.MONGODB_URI;
  const jwtSecret = process.env.JWT_SECRET;
  const clientUrl = process.env.CLIENT_URL;
  const corsOrigins = (clientUrl || 'http://localhost:5173')
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);
  const isProductionNow = process.env.NODE_ENV === 'production';

  const missing = [];
  if (!mongoUri) missing.push('MONGODB_URI');
  if (!jwtSecret) missing.push('JWT_SECRET');
  if (missing.length > 0) {
    throw new Error(
      `Missing required environment variable(s): ${missing.join(', ')}`,
    );
  }

  // ----- Development-time minimums -------------------------------------
  if (typeof jwtSecret !== 'string' || jwtSecret.length < MIN_JWT_SECRET_LENGTH) {
    throw new Error(
      `JWT_SECRET must be at least ${MIN_JWT_SECRET_LENGTH} characters (current length: ${jwtSecret.length})`,
    );
  }

  // ----- Production-only hardening -------------------------------------
  if (isProductionNow) {
    // (a) Reject any JWT_SECRET that looks like a placeholder / weak default.
    const lowered = jwtSecret.toLowerCase();
    for (const fragment of FORBIDDEN_JWT_SECRET_FRAGMENTS) {
      if (lowered.includes(fragment)) {
        throw new Error(
          `JWT_SECRET appears to be a placeholder or example value (contains "${fragment}"). ` +
            'Generate a fresh secret with: node -e "console.log(require(\'crypto\').randomBytes(48).toString(\'hex\'))"',
        );
      }
    }

    // (b) MONGODB_URI must not be the local development URI.
    if (mongoUri.startsWith('mongodb://127.0.0.1') || mongoUri.startsWith('mongodb://localhost')) {
      throw new Error(
        'MONGODB_URI points to localhost in production. ' +
          'Configure a real MongoDB cluster (Atlas / self-hosted) before starting.',
      );
    }

    // (c) CORS must be explicitly configured in production. The dev
    // default of "http://localhost:5173" is a development-only origin.
    if (
      !clientUrl ||
      corsOrigins.length === 0 ||
      corsOrigins.some((o) =>
        o.startsWith('http://localhost') || o.startsWith('http://127.0.0.1'),
      )
    ) {
      throw new Error(
        'CLIENT_URL must be set to a non-localhost origin in production. ' +
          'Example: CLIENT_URL=https://app.example.com',
      );
    }
  }
}

export { config, assertConfig, isProd, FORBIDDEN_JWT_SECRET_FRAGMENTS, MIN_JWT_SECRET_LENGTH, parseDurationMs };