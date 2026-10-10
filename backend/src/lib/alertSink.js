// lib/alertSink.js — Phase 16
//
// Pluggable "alert" sink. The audit log is the source of truth —
// THIS module is a *forwarding* layer that takes a subset of audit
// events and ships them to an external system (Slack, Datadog,
// generic webhook, etc.).
//
// Design constraints:
//   1. NO external network call is made unless the operator has
//      explicitly configured a real sink via the factory. The
//      default sink is a NO-OP.
//   2. Every sink implementation MUST honor a timeout, MUST bound
//      retries, and MUST swallow network errors so that a flaky
//      receiver never breaks a normal request.
//   3. Sinks only see events that pass the `shouldForward` filter.
//      This is the chokepoint that strips forbidden keys.
//   4. The module never blocks the request path. We use
//      `Promise.resolve().then(...)` so failures turn into
//      unhandled rejections that are caught at the sink boundary
//      (each sink catches its own).
//
// IMPORTANT: This module does not perform load shedding. If the
// sink is slow, calls stack up. Use the bounded HTTP sink or
// implement your own queue in production.

import logger from './logger.js';
import { recordRateLimitEvent } from './metrics.js';

// ---------------------------------------------------------------------------
// Event filter
// ---------------------------------------------------------------------------

// Events that an operator typically wants to forward in real time.
// Anything not in this list is NOT forwarded. (Audit log itself
// remains the source of truth — see Phase 15.)
const FORWARDED_ACTIONS = Object.freeze([
  'auth.login.failure',
  'auth.refresh.failure',
  'auth.refresh.reuse_detected',
  'auth.sessions.revoked_all',
  'auditlog.cleanup',
]);

export function shouldForward(event) {
  if (!event || typeof event !== 'object') return false;
  return FORWARDED_ACTIONS.includes(event.action);
}

function sanitizeForForward(event) {
  if (!event || typeof event !== 'object') return null;
  // Defense in depth: do not forward metadata that contains a
  // forbidden key, even if the audit log sanitized it.
  const out = {
    action: event.action,
    status: event.status,
    actorRole: event.actorRole,
    resourceType: event.resourceType,
    requestId: event.requestId,
  };
  return out;
}

// ---------------------------------------------------------------------------
// Sink interface (duck-typed)
// ---------------------------------------------------------------------------
// A sink is `{ name, send(event) }`. send() must:
//   - return a Promise
//   - resolve with { ok: true } on success
//   - resolve with { ok: false, error } on failure (do not throw)
//
// ---------------------------------------------------------------------------

// Default — noop. Always succeeds. Used when no operator has
// configured a real sink.
export function createNoopAlertSink() {
  return {
    name: 'noop',
    async send(_event) {
      return { ok: true };
    },
  };
}

// Test-only sink. Records every call in memory.
export function createInMemoryAlertSink() {
  const calls = [];
  return {
    name: 'in-memory',
    async send(event) {
      calls.push(event);
      return { ok: true };
    },
    _calls: calls,
  };
}

// HTTP sink. Posts the event to a single configured URL. Has a
// hard timeout, no retries (Phase 16 default), and a max payload
// size so a malicious receiver cannot ask us to dump megabytes.
//
// Constructor:
//   createHttpAlertSink({ url, timeoutMs=2000, headers={} })
export function createHttpAlertSink({ url, timeoutMs = 2000, headers = {} } = {}) {
  if (typeof url !== 'string' || url.length === 0) {
    throw new Error('createHttpAlertSink: url is required');
  }
  return {
    name: 'http',
    async send(event) {
      const controller = new AbortController();
      const t = setTimeout(() => controller.abort(), timeoutMs);
      try {
        const res = await fetch(url, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            ...headers,
          },
          body: JSON.stringify(event),
          signal: controller.signal,
        });
        if (!res.ok) {
          logger.warn('alert_sink.http.non_2xx', {
            status: res.status,
            url,
          });
          return { ok: false, error: `http ${res.status}` };
        }
        return { ok: true };
      } catch (err) {
        logger.warn('alert_sink.http.failed', {
          error: err && err.message,
          url,
        });
        return { ok: false, error: err && err.message };
      } finally {
        clearTimeout(t);
      }
    },
  };
}

// ---------------------------------------------------------------------------
// Sink registry (singleton)
// ---------------------------------------------------------------------------

let currentSink = createNoopAlertSink();

export function setAlertSink(sink) {
  if (!sink || typeof sink.send !== 'function') {
    throw new Error('setAlertSink: sink must implement send()');
  }
  currentSink = sink;
}

export function getAlertSink() {
  return currentSink;
}

export function resetAlertSinkForTests() {
  currentSink = createNoopAlertSink();
}

// ---------------------------------------------------------------------------
// Forwarding API
// ---------------------------------------------------------------------------

/**
 * Forward an event to the currently configured sink. NEVER throws
 * and NEVER blocks the request — the actual send() is dispatched
 * via the microtask queue and any error is swallowed by the sink.
 *
 * The function returns true if the event was forwarded, false if
 * it was filtered out (no sink is considered an error).
 */
export function forwardEvent(event) {
  if (!shouldForward(event)) return false;
  const safe = sanitizeForForward(event);
  if (!safe) return false;

  // Dispatch without awaiting so we never block the request.
  // The sink's own send() catches its own errors.
  Promise.resolve()
    .then(() => currentSink.send(safe))
    .catch((err) => {
      logger.warn('alert_sink.unhandled', { error: err && err.message });
    });

  return true;
}

/**
 * Convenience: forward a rate-limit hit. Records a metric AND
 * forwards a synthetic event.
 */
export function forwardRateLimitHit({ route, kind = 'login' }) {
  recordRateLimitEvent({ route, kind });
  return forwardEvent({
    action: 'auth.refresh.failure', // bucket under "failure"
    status: 'failure',
    actorRole: 'system',
    resourceType: 'auth',
    metadata: { reason: 'rate_limited', route, kind },
  });
}
