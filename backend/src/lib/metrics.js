// lib/metrics.js — Phase 16
//
// Lightweight, in-memory metrics registry. Counters + labelled
// counters + a fixed-bucket histogram (latency). The output is a
// Prometheus-compatible text format so the operator can plug a
// scraper in later, but we do NOT start a metrics HTTP server —
// the metrics are exposed via an authenticated route (see
// routes/metrics.routes.js).
//
// Design constraints:
//   1. NO high-cardinality labels. The only allowed labels are:
//        - method (GET, POST, ...)         — bounded
//        - route (e.g. '/api/employees/:id') — bounded
//        - status (HTTP status as a string) — bounded (≤ 600)
//        - statusClass ('2xx'|'3xx'|'4xx'|'5xx') — 4 values
//        - code (app error code)            — bounded (allowlist of
//          known codes; unknown codes are bucketed into 'other')
//      Anything else is intentionally NOT a label.
//   2. NO high-cardinality fields in the rendered output. We
//      expose only the totals + the route template, not the URL.
//   3. The registry is module-singleton. Importing this module
//      from multiple test files is safe (state is reset only on
//      explicit `resetForTests()` call).
//   4. The registry NEVER throws. A failed update is silently
//      dropped and (optionally) logged via the application logger.

import logger from './logger.js';

// ---------------------------------------------------------------------------
// Cardinality guard for the `code` label
// ---------------------------------------------------------------------------

const KNOWN_CODES = Object.freeze([
  'AUTH_MISSING',
  'AUTH_FORMAT',
  'TOKEN_INVALID',
  'TOKEN_EXPIRED',
  'AUTH_REQUIRED',
  'FORBIDDEN',
  'NOT_FOUND',
  'VALIDATION_ERROR',
  'BAD_REQUEST',
  'DUPLICATE_KEY',
  'RATE_LIMITED',
  'INTERNAL_SERVER_ERROR',
  'SESSION_NOT_FOUND',
  'SESSION_CREATE_FAILED',
  'AUDIT_LOG_NOT_FOUND',
  'other',
]);

function normalizeCode(code) {
  if (typeof code !== 'string' || code.length === 0) return 'other';
  if (KNOWN_CODES.includes(code)) return code;
  return 'other';
}

function statusClass(status) {
  if (status >= 500) return '5xx';
  if (status >= 400) return '4xx';
  if (status >= 300) return '3xx';
  if (status >= 200) return '2xx';
  return '1xx';
}

// ---------------------------------------------------------------------------
// Counters
// ---------------------------------------------------------------------------

// Each entry: Map<labelKey, value>
// labelKey format: method|route|status|code
const httpRequestsTotal = new Map();
const httpErrorsTotal = new Map();
const dbErrorsTotal = new Map();
const authEventsTotal = new Map();
const rateLimitEventsTotal = new Map();
const auditEventsTotal = new Map();
const processErrorsTotal = new Map();

function bump(map, parts) {
  const key = parts.join('|');
  map.set(key, (map.get(key) || 0) + 1);
}

export function recordRequest({ method, route, status, durationMs }) {
  if (!method || !route) return;
  bump(httpRequestsTotal, [method, route, String(status), statusClass(status)]);
  if (status >= 500) {
    bump(httpErrorsTotal, [method, route, String(status), '5xx']);
  } else if (status >= 400) {
    bump(httpErrorsTotal, [method, route, String(status), statusClass(status)]);
  }
  if (typeof durationMs === 'number' && Number.isFinite(durationMs) && durationMs >= 0) {
    observeDuration(route, durationMs);
  }
}

export function recordAppError({ method, route, status, code }) {
  bump(httpErrorsTotal, [
    method || 'unknown',
    route || 'unknown',
    String(status || 500),
    normalizeCode(code),
  ]);
}

export function recordDbError({ kind }) {
  bump(dbErrorsTotal, [String(kind || 'unknown')]);
}

export function recordAuthEvent({ action, status }) {
  bump(authEventsTotal, [String(action), String(status || 'success')]);
}

export function recordRateLimitEvent({ route, kind }) {
  bump(rateLimitEventsTotal, [String(route || 'unknown'), String(kind || 'login')]);
}

export function recordAuditEvent({ action, status }) {
  bump(auditEventsTotal, [String(action), String(status || 'success')]);
}

export function recordProcessError({ kind }) {
  bump(processErrorsTotal, [String(kind || 'unknown')]);
}

// ---------------------------------------------------------------------------
// Histogram (fixed buckets, in milliseconds)
// ---------------------------------------------------------------------------

// Buckets in ms: 5, 10, 25, 50, 100, 250, 500, 1000, 2500, 5000, +Inf
const LATENCY_BUCKETS_MS = Object.freeze([5, 10, 25, 50, 100, 250, 500, 1000, 2500, 5000]);

// Map<route, { counts: [n+1 buckets], sum, count }>
const httpDuration = new Map();

function ensureRouteStats(route) {
  let s = httpDuration.get(route);
  if (!s) {
    s = {
      counts: new Array(LATENCY_BUCKETS_MS.length + 1).fill(0), // last = +Inf
      sum: 0,
      count: 0,
    };
    httpDuration.set(route, s);
  }
  return s;
}

export function observeDuration(route, durationMs) {
  if (typeof route !== 'string' || route.length === 0) return;
  if (typeof durationMs !== 'number' || !Number.isFinite(durationMs) || durationMs < 0) {
    return;
  }
  const s = ensureRouteStats(route);
  let placed = false;
  for (let i = 0; i < LATENCY_BUCKETS_MS.length; i += 1) {
    if (durationMs <= LATENCY_BUCKETS_MS[i]) {
      s.counts[i] += 1;
      placed = true;
      break;
    }
  }
  if (!placed) s.counts[s.counts.length - 1] += 1; // +Inf
  s.sum += durationMs;
  s.count += 1;
}

// In-flight gauge
let inFlight = 0;
let inFlightMax = 0;

export function incInFlight() {
  inFlight += 1;
  if (inFlight > inFlightMax) inFlightMax = inFlight;
}
export function decInFlight() {
  inFlight = Math.max(0, inFlight - 1);
}
export function getInFlight() {
  return { inFlight, inFlightMax };
}

// ---------------------------------------------------------------------------
// Renderer — Prometheus text format
// ---------------------------------------------------------------------------

function escapeLabelValue(v) {
  return String(v)
    .replace(/\\/g, '\\\\')
    .replace(/\n/g, '\\n')
    .replace(/"/g, '\\"');
}

function renderLabelKV(parts) {
  return parts.map((p) => `"${escapeLabelValue(p)}"`).join(',');
}

export function renderMetricsText() {
  const lines = [];
  lines.push('# HELP hrm_http_requests_total Total HTTP requests handled.');
  lines.push('# TYPE hrm_http_requests_total counter');
  for (const [key, value] of httpRequestsTotal.entries()) {
    const [method, route, status, sc] = key.split('|');
    lines.push(
      `hrm_http_requests_total{method="${escapeLabelValue(
        method,
      )}",route="${escapeLabelValue(route)}",status="${escapeLabelValue(
        status,
      )}",status_class="${escapeLabelValue(sc)}"} ${value}`,
    );
  }

  lines.push('# HELP hrm_http_request_errors_total Total HTTP responses with status >= 400.');
  lines.push('# TYPE hrm_http_request_errors_total counter');
  for (const [key, value] of httpErrorsTotal.entries()) {
    const [method, route, status, code] = key.split('|');
    lines.push(
      `hrm_http_request_errors_total{method="${escapeLabelValue(
        method,
      )}",route="${escapeLabelValue(route)}",status="${escapeLabelValue(
        status,
      )}",code="${escapeLabelValue(code)}"} ${value}`,
    );
  }

  lines.push('# HELP hrm_http_request_duration_ms HTTP request duration histogram (ms).');
  lines.push('# TYPE hrm_http_request_duration_ms histogram');
  for (const [route, s] of httpDuration.entries()) {
    let cumulative = 0;
    for (let i = 0; i < LATENCY_BUCKETS_MS.length; i += 1) {
      cumulative += s.counts[i];
      lines.push(
        `hrm_http_request_duration_ms_bucket{route="${escapeLabelValue(
          route,
        )}",le="${LATENCY_BUCKETS_MS[i]}"} ${cumulative}`,
      );
    }
    cumulative += s.counts[s.counts.length - 1];
    lines.push(
      `hrm_http_request_duration_ms_bucket{route="${escapeLabelValue(
        route,
      )}",le="+Inf"} ${cumulative}`,
    );
    lines.push(
      `hrm_http_request_duration_ms_sum{route="${escapeLabelValue(route)}"} ${s.sum.toFixed(2)}`,
    );
    lines.push(
      `hrm_http_request_duration_ms_count{route="${escapeLabelValue(route)}"} ${s.count}`,
    );
  }

  lines.push('# HELP hrm_http_in_flight Current in-flight HTTP requests.');
  lines.push('# TYPE hrm_http_in_flight gauge');
  lines.push(`hrm_http_in_flight ${inFlight}`);
  lines.push(`hrm_http_in_flight_max_observed ${inFlightMax}`);

  lines.push('# HELP hrm_db_errors_total Database errors by kind.');
  lines.push('# TYPE hrm_db_errors_total counter');
  for (const [kind, value] of dbErrorsTotal.entries()) {
    lines.push(
      `hrm_db_errors_total{kind="${escapeLabelValue(kind)}"} ${value}`,
    );
  }

  lines.push('# HELP hrm_auth_events_total Authentication events.');
  lines.push('# TYPE hrm_auth_events_total counter');
  for (const [key, value] of authEventsTotal.entries()) {
    const [action, status] = key.split('|');
    lines.push(
      `hrm_auth_events_total{action="${escapeLabelValue(action)}",status="${escapeLabelValue(status)}"} ${value}`,
    );
  }

  lines.push('# HELP hrm_rate_limit_events_total Rate-limit hits.');
  lines.push('# TYPE hrm_rate_limit_events_total counter');
  for (const [key, value] of rateLimitEventsTotal.entries()) {
    const [route, kind] = key.split('|');
    lines.push(
      `hrm_rate_limit_events_total{route="${escapeLabelValue(route)}",kind="${escapeLabelValue(kind)}"} ${value}`,
    );
  }

  lines.push('# HELP hrm_audit_events_total Audit events written.');
  lines.push('# TYPE hrm_audit_events_total counter');
  for (const [key, value] of auditEventsTotal.entries()) {
    const [action, status] = key.split('|');
    lines.push(
      `hrm_audit_events_total{action="${escapeLabelValue(action)}",status="${escapeLabelValue(status)}"} ${value}`,
    );
  }

  lines.push('# HELP hrm_process_errors_total Process-level errors.');
  lines.push('# TYPE hrm_process_errors_total counter');
  for (const [kind, value] of processErrorsTotal.entries()) {
    lines.push(
      `hrm_process_errors_total{kind="${escapeLabelValue(kind)}"} ${value}`,
    );
  }

  return lines.join('\n') + '\n';
}

// ---------------------------------------------------------------------------
// Reset (test only)
// ---------------------------------------------------------------------------

export function resetForTests() {
  httpRequestsTotal.clear();
  httpErrorsTotal.clear();
  dbErrorsTotal.clear();
  authEventsTotal.clear();
  rateLimitEventsTotal.clear();
  auditEventsTotal.clear();
  processErrorsTotal.clear();
  httpDuration.clear();
  inFlight = 0;
  inFlightMax = 0;
}

export const _internal = {
  KNOWN_CODES,
  LATENCY_BUCKETS_MS,
};

// Defensive: never let a renderer error escape.
const _origRender = renderMetricsText;
export function safeRenderMetricsText() {
  try {
    return _origRender();
  } catch (err) {
    logger.error('metrics.render_failed', { error: err.message });
    return '# metrics renderer failed\n';
  }
}
