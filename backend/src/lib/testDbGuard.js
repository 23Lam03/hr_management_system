// lib/testDbGuard.js — Phase 17
//
// Pure-function validator for the test MongoDB URI. Phase 17 makes
// this an explicit gate: the CI workflow, the local `npm test`,
// and the operator's release-gate script ALL run this guard
// before any database connection is opened.
//
// Rules (in evaluation order):
//   1. The URI must start with `mongodb://` or `mongodb+srv://`.
//   2. The database name (path component) must look like a test
//      database. We use a small allowlist of safe patterns. This
//      is safer than "contains the word 'test'" because the word
//      test is too easy to misconfigure.
//   3. The hostname must NOT be a public DNS pattern. Anything
//      that looks like Atlas / MongoDB Cloud / non-loopback
//      public IP is rejected.
//   4. The URI must NOT carry credentials. A test connection
//      string with a username/password is a strong signal that
//      someone is pointing at a real database.
//   5. The `srv` scheme (`mongodb+srv://`) is rejected by default
//      because that scheme is what Atlas uses; the loopback
//      `mongodb://` form is preferred for CI.
//
// The function returns `{ ok: true }` or
// `{ ok: false, reason, code }`. It never throws and never
// logs the URI (callers must not log the URI either).
//
// This module has zero dependencies and is safe to import from
// any environment.

import { URL } from 'node:url';

// Patterns that we consider "safe" for the database name. Keep
// the list short and explicit so accidental typos are caught.
const SAFE_DB_PATTERNS = Object.freeze([
  /^_?test_?\w*$/i,            // test, _test_, test_db, _test_xyz
  /^_?hrm_test_?\w*$/i,        // hrm_test, hrm_test_db, hrm_testing
  /^_?integration_?\w*$/i,     // integration, _integration_test
  /^_?e2e_?\w*$/i,             // e2e, _e2e_run
  /^_?ci_?\w*$/i,              // ci, ci_db
  /^_?tmp_?\w*$/i,             // tmp, tmp_db (some operators use this)
  /^_?ephemeral_?\w*$/i,       // ephemeral
  /^_?scratch_?\w*$/i,         // scratch
]);

// Hostname patterns that we consider safe (loopback or test
// service hostnames). Public DNS names, IPv6 global addresses,
// and obvious Atlas / Cloud hostnames are NOT in this list.
const SAFE_HOSTNAMES = Object.freeze([
  '127.0.0.1',
  'localhost',
  '::1',
  '0.0.0.0',
]);

// Hostname substring / regex patterns that are ALWAYS rejected.
// These detect Atlas / MongoDB Cloud / public-looking services.
const PUBLIC_HOSTNAME_PATTERNS = Object.freeze([
  /\.mongodb\.net$/i,
  /\.mongodb\.com$/i,
  /\.mongodb\.cloud$/i,
  /\.atlas\./i,
  /mongodb\+srv/i,
  /\.amazonaws\.com$/i,
  /\.azure\.com$/i,
  /\.googleapis\.com$/i,
  /\.digitalocean\.com$/i,
]);

// Public IPv4 ranges (very rough — enough to flag obvious
// "this is a public host" cases while still allowing private
// 10.x, 192.168.x, 172.16-31.x and link-local).
function isPublicIPv4(host) {
  if (!/^\d+\.\d+\.\d+\.\d+$/.test(host)) return false;
  const parts = host.split('.').map(Number);
  const [a, b] = parts;
  if (a === 10) return false; // private
  if (a === 127) return false; // loopback
  if (a === 172 && b >= 16 && b <= 31) return false; // private
  if (a === 192 && b === 168) return false; // private
  if (a === 169 && b === 254) return false; // link-local
  if (a === 0) return false; // reserved
  if (a >= 224) return false; // multicast / reserved
  return true;
}

/**
 * Validate a MongoDB URI for use as a test connection string.
 *
 * @param {string} uri
 * @returns {{ok: true, scheme: string, host: string, port: string, db: string} | {ok: false, code: string, reason: string}}
 */
export function validateTestUri(uri) {
  if (typeof uri !== 'string' || uri.length === 0) {
    return { ok: false, code: 'INVALID_URI', reason: 'URI is empty or not a string' };
  }

  let scheme = null;
  if (uri.startsWith('mongodb://')) {
    scheme = 'mongodb';
  } else if (uri.startsWith('mongodb+srv://')) {
    scheme = 'mongodb+srv';
  } else {
    return {
      ok: false,
      code: 'INVALID_URI',
      reason: 'URI must start with mongodb:// or mongodb+srv://',
    };
  }

  // Try to parse the URL. We strip credentials first because
  // some Node URL parsers refuse to parse userinfo-shaped URIs.
  const stripped = uri.replace(/^mongodb(\+srv)?:\/\/[^@/]*@/, `${scheme}://`);

  let u;
  try {
    u = new URL(stripped);
  } catch (_err) {
    return { ok: false, code: 'INVALID_URI', reason: 'URI is not a valid URL' };
  }

  // Reject credentials (we already stripped them above, so a
  // non-empty userinfo here means the regex didn't catch it).
  if (u.username || u.password) {
    return {
      ok: false,
      code: 'URI_HAS_CREDENTIALS',
      reason: 'Test URIs must not carry credentials',
    };
  }

  // Re-derive by parsing the original URI for userinfo.
  try {
    const orig = new URL(uri);
    if (orig.username || orig.password) {
      return {
        ok: false,
        code: 'URI_HAS_CREDENTIALS',
        reason: 'Test URIs must not carry credentials',
      };
    }
  } catch (_err) {
    return {
      ok: false,
      code: 'INVALID_URI',
      reason: 'URI is not a valid URL',
    };
  }

  const host = u.hostname;
  const port = u.port || (scheme === 'mongodb+srv' ? '27017' : '27017');
  const dbRaw = (u.pathname || '').replace(/^\//, '').split('?')[0];

  if (!host) {
    return { ok: false, code: 'INVALID_HOST', reason: 'URI has no host' };
  }

  // Reject Atlas / cloud patterns regardless of scheme.
  for (const pat of PUBLIC_HOSTNAME_PATTERNS) {
    if (pat.test(host)) {
      return {
        ok: false,
        code: 'PUBLIC_HOSTNAME',
        reason: `Test URIs must not point at public hostnames (matched ${pat})`,
      };
    }
  }

  // mongodb+srv is heavily associated with Atlas; reject unless
  // the host is explicitly loopback (which doesn't actually
  // make sense for srv but we check anyway).
  if (scheme === 'mongodb+srv' && !SAFE_HOSTNAMES.includes(host)) {
    return {
      ok: false,
      code: 'SRV_NOT_ALLOWED',
      reason: 'mongodb+srv:// is reserved for Atlas; test URIs must use mongodb://',
    };
  }

  // Public IPv4? Reject.
  if (isPublicIPv4(host)) {
    return {
      ok: false,
      code: 'PUBLIC_IP',
      reason: `Test URIs must not point at a public IP (${host})`,
    };
  }

  // Database name. Check this BEFORE we accept the host so that
  // a missing / unsafe DB name always wins over a "looks safe"
  // host.
  if (!dbRaw) {
    return {
      ok: false,
      code: 'NO_DB_NAME',
      reason: 'URI has no database name',
    };
  }
  if (!SAFE_DB_PATTERNS.some((p) => p.test(dbRaw))) {
    return {
      ok: false,
      code: 'UNSAFE_DB_NAME',
      reason: `Database name "${dbRaw}" is not in the test-DB allowlist`,
    };
  }

  // Numeric IPv4 in private ranges? Allowed (10.x, 192.168.x,
  // 172.16-31.x, 127.x, 169.254.x). They are RFC1918 / link-
  // local and we already filtered out public IPs above.
  if (/^\d+\.\d+\.\d+\.\d+$/.test(host)) {
    return { ok: true, scheme, host, port, db: dbRaw };
  }

  // Hostname allowlist. Allow loopback names, .local, .internal,
  // and the standard reserved `localhost` family.
  if (
    !SAFE_HOSTNAMES.includes(host) &&
    !host.endsWith('.local') &&
    !host.endsWith('.internal')
  ) {
    // Be conservative: reject.
    return {
      ok: false,
      code: 'HOST_NOT_ALLOWED',
      reason: `Host "${host}" is not in the test-URI allowlist`,
    };
  }

  return { ok: true, scheme, host, port, db: dbRaw };
}

/**
 * Convenience: resolve the test URI from the environment and
 * validate it. Throws a clear error if the URI is unsafe. This
 * is the function CI / `npm test` should call before any DB
 * connection is opened.
 *
 * @param {object} [opts]
 * @param {string} [opts.fallback] Override the default fallback.
 * @param {NodeJS.ProcessEnv} [opts.env] Override process.env (for tests).
 * @returns {string} the validated URI
 * @throws {Error} if validation fails
 */
export function resolveAndValidateTestUri(opts = {}) {
  const env = opts.env || process.env;
  const fallback =
    opts.fallback || 'mongodb://127.0.0.1:27017/hrm_test_db';
  const raw = (env.TEST_MONGODB_URI && env.TEST_MONGODB_URI.trim().length > 0)
    ? env.TEST_MONGODB_URI
    : fallback;

  const result = validateTestUri(raw);
  if (!result.ok) {
    // We deliberately do NOT echo the URI in the error. The
    // caller can add the URI to their own redacted log if they
    // want; we just say what was wrong.
    const err = new Error(
      `Refusing to use TEST_MONGODB_URI: ${result.reason} (code=${result.code})`,
    );
    err.code = result.code;
    err.publicReason = result.reason;
    throw err;
  }
  return raw;
}

// Exposed for tests only.
export const _internal = {
  SAFE_DB_PATTERNS,
  SAFE_HOSTNAMES,
  PUBLIC_HOSTNAME_PATTERNS,
  isPublicIPv4,
};
