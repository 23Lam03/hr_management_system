# Phase 16 — Production Observability, Alerting & Load Testing

> Status: implemented. Phase 16 builds on Phase 12 → 15 and does
> not modify any of their public contracts. Scope: `backend/` only.

This document is the operator + developer reference for the
observability layer added in Phase 16.

---

## 1. Architecture

```
                        ┌────────────────────────────┐
                        │   src/lib/logger.js        │ ── stdout (json|text)
                        └─────────────┬──────────────┘
                                      │ shared by everything
   request ──▶ Express ──▶ metrics.middleware.js
   context     middleware  (in-flight, request log, status)
                │
                ├─▶ requestContext (Phase 15) → req.context.requestId
                │
                ├─▶ routes/health.routes.js
                │      /api/health            (aggregate, DB-aware)
                │      /api/health/livez      (liveness only)
                │      /api/health/readyz     (readiness, DB-aware)
                │
                ├─▶ routes/metrics.routes.js
                │      /api/metrics           (admin-only, Prom text)
                │
                ├─▶ lib/alertSink.js
                │      sink: noop | in-memory | http
                │      wired from recordEvent() (Phase 15)
                │
                └─▶ services/auditLog.service.js → forwardEvent()
                                                   ↓
                                              alert sink

   scripts/
     load-test.js             — native Node load test (no deps)
     seed-loadtest-user.js    — seeds a load-test user (test DB only)
     cleanup-audit-logs.js    — Phase 15
```

---

## 2. Logging

### Output format

Two modes, controlled by `LOG_FORMAT`:

- `json` (default in production): one JSON object per line on
  stdout. Each record has at minimum:
  ```json
  {
    "timestamp": "2026-10-10T17:00:00.000Z",
    "level": "info",
    "msg": "http.request",
    "requestId": "5db5de6a-1187-45b0-997b-114a364703f6",
    "method": "GET",
    "route": "/api/health/livez",
    "status": 200,
    "durationMs": 3.18
  }
  ```
- `text` (default in dev): single line per record, human-friendly.
  ```text
  2026-10-10T17:00:00.000Z INFO http.request requestId=... method=GET route=/api/health/livez status=200 durationMs=3.18
  ```

### Field safety

The logger (`src/lib/logger.js`) carries an **independent** deny list
of forbidden keys. The list mirrors the audit log's
`METADATA_FORBIDDEN_KEYS` but is maintained in the logger so that a
caller that accidentally passes `{ password: '...' }` is filtered
out at the log boundary, not at the audit boundary.

Forbidden keys (any value is silently dropped):

- Credentials: `password`, `passwordHash`, `oldPassword`,
  `newPassword`, `currentPassword`, `passwordResetToken`,
  `token`, `accessToken`, `refreshToken`, `tokenHash`, `jwt`,
  `authorization`, `cookie`, `set-cookie`
- Secrets: `secret`, `clientSecret`, `mongoUri`, `dbUri`,
  `connectionString`
- Payroll amounts: `baseSalary`, `allowances`, `bonuses`,
  `deductions`, `grossSalary`, `netSalary`
- PII: `email`, `phone`, `fullName`, `address`
- Financial: `creditCard`, `bankAccount`, `ssn`, `taxId`

Any key starting with `password`, `secret`, `token`, `jwt`,
`authorization`, `cookie`, `mongo`, `db`, or `connection` is also
stripped (defense in depth against typos like `password_h`).

String values longer than 500 chars are truncated and suffixed
with `…`. Object children are limited to 32 keys.

### Level filter

`LOG_LEVEL` controls which records are emitted. `debug` is the
most verbose. Default is `info` in production.

### Where logs are written

`process.stdout.write` for the `json` path (so the log stream is
separable from stderr). `console.log` for `text` mode.

### Correlation

Every request gets a `X-Request-Id` response header (UUID v4) from
`src/middlewares/requestContext.middleware.js` (Phase 15). The
request log middleware copies the same `requestId` into the log
record. The audit log's `requestId` field is the same value (see
Phase 15). This makes the chain:

> client reports "I got 500 on request X-Request-Id=abcd" →
> grep `requestId=abcd` in stdout → find the http.request log →
> cross-reference the audit log for the same `requestId` →
> find the controller code path.

### Failure isolation

The logger NEVER throws. A serialization failure is replaced with
a single `console.error` line and the original log is dropped. The
metrics collector is wrapped in `try/catch` for the same reason.

### Stack traces

The `error.middleware.js` writes a full stack trace to the
**server** log (json mode) but only when `NODE_ENV !== production`.
In production the stack is dropped server-side too — the
`INTERNAL_SERVER_ERROR` response body is just `Internal server
error`. The client NEVER sees a stack trace, regardless of env.

---

## 3. Health, liveness, readiness

Three distinct endpoints:

| Endpoint | Auth | Touches DB? | Used for |
|---|---|---|---|
| `GET /api/health` | none | yes (state read) | human / dashboard |
| `GET /api/health/livez` | none | **no** | k8s livenessProbe |
| `GET /api/health/readyz` | none | only when state is "connecting" | k8s readinessProbe |

`/livez` is intentionally a no-op. It must succeed even when the
database is unreachable; the orchestrator should restart a stuck
pod, not a pod that just lost its DB connection.

`/readyz` returns 503 if:
1. The shutdown flag is set (`markShuttingDown(true)`). This is
   wired to SIGINT / SIGTERM in `server.js`, so the load balancer
   starts draining the pod as soon as the shutdown signal
   arrives, BEFORE the actual `server.close()` completes.
2. The DB is in a non-`connected` state. If the state is
   `connecting` (startup), it issues a single bounded `ping` with
   a 1500 ms timeout; if that succeeds it returns 200, otherwise
   503 with the actual state.

The original `/api/health` endpoint is preserved (backward
compatible) and now also reflects the shutdown flag.

The response body of every health endpoint is minimal — `service`,
`uptime`, `timestamp`, `database.status`, `database.connected`,
`shuttingDown`. No environment dump, no secrets.

---

## 4. Metrics

### Endpoint

`GET /api/metrics` — Prometheus-compatible text format.

Authorization: `protect` + `authorize('admin')`. There is no IP
bypass, no token-bypass, no path-based exception. The intent is
that the metrics are only visible to operators who already have
admin credentials.

### Cardinality

The allowed label set is intentionally small:

| Label | Bounded by |
|---|---|
| `method` | 7 HTTP verbs |
| `route` | route template (`/api/employees/:id`) — bounded by code |
| `status` | HTTP status code (max ~60) |
| `status_class` | `2xx` \| `3xx` \| `4xx` \| `5xx` |
| `code` | 16-element allowlist + `other` (see below) |
| `kind` | `db-error` / `auth-*` / `rate-limit` / `process-error` |
| `action` | `AUDIT_ACTIONS` enum |
| `le` | latency histogram bucket boundary |

Crucially, NO user ID, NO email, NO request ID, NO URL with
dynamic ID, NO IP is used as a label. This protects against
unbounded cardinality (Prometheus would otherwise refuse to
ingest a series whose label set grows over time).

Unknown error codes are bucketed into the `code="other"`
category. The bucket list is in `src/lib/metrics.js`.

### Metrics exposed

| Metric | Type | Notes |
|---|---|---|
| `hrm_http_requests_total{method,route,status,status_class}` | counter | every response |
| `hrm_http_request_errors_total{method,route,status,code}` | counter | status >= 400 |
| `hrm_http_request_duration_ms_*` | histogram | buckets: 5,10,25,50,100,250,500,1000,2500,5000, +Inf |
| `hrm_http_in_flight` | gauge | current in-flight |
| `hrm_http_in_flight_max_observed` | gauge | peak since boot |
| `hrm_db_errors_total{kind}` | counter | reserved for future direct hooks |
| `hrm_auth_events_total{action,status}` | counter | reserved for future direct hooks |
| `hrm_rate_limit_events_total{route,kind}` | counter | triggered by 429 |
| `hrm_audit_events_total{action,status}` | counter | written to audit log |
| `hrm_process_errors_total{kind}` | counter | `unhandledRejection`, `uncaughtException` |

### Renderer safety

`safeRenderMetricsText()` is the version mounted on the route. It
wraps the raw renderer in a try/catch and emits a single-line
fallback if the renderer itself fails. The HTTP request still
succeeds (200) so a metrics bug cannot break the admin UI.

---

## 5. Alerting

The `lib/alertSink.js` module is a thin forwarding layer over the
audit log. The audit log remains the source of truth (Phase 15).

### Event filter

`shouldForward(event)` is the chokepoint. The default allowlist
is:

```
auth.login.failure
auth.refresh.failure
auth.refresh.reuse_detected
auth.sessions.revoked_all
auditlog.cleanup
```

Everything else is dropped at the filter. The list is intentionally
small. Adding more events is a one-line change in the source
file; doing so without operator review is not recommended.

### Forwarding pipeline

```
recordEvent() (Phase 15)
  └─ writes to DB
  └─ recordAuditEvent (metric)
  └─ forwardEvent (alert sink)
        └─ shouldForward filter
        └─ sanitizeForForward (strip sensitive keys)
        └─ sink.send(event) on microtask queue
              └─ noop | in-memory | http
```

Forwarding happens AFTER the DB write succeeds. The forwarding
call runs on the microtask queue and never blocks the request.
A sink that hangs is dropped at the next request boundary (the
underlying `fetch` has its own timeout).

### Sanitization

`forwardEvent` strips everything except:
`action`, `status`, `actorRole`, `resourceType`, `requestId`.
Metadata is dropped (the sink does not need it). This is in
addition to the audit log's own sanitization. Two layers of
defense.

### Sink implementations

- `createNoopAlertSink()` (default): success unconditionally.
- `createInMemoryAlertSink()`: records every call. Test only.
- `createHttpAlertSink({ url, timeoutMs=2000, headers })`:
  posts the JSON event to `url` with a hard `timeoutMs`
  abort. **No retries.** On failure: returns `{ ok: false, error }`.
  The script does not call `await` in the request path, so a slow
  sink cannot hold up the request.

### Wiring a real receiver

`scripts/load-test.js` and `src/lib/alertSink.js` do NOT auto-wire
any external system. To enable a real receiver, an operator
must:

1. Implement an HTTP receiver (Slack incoming webhook, Datadog
   logs intake, generic SIEM intake).
2. Add a small bootstrap (e.g. `src/server.js` extension or
   a dedicated `src/bootstrap/alertSink.js`) that calls
   `setAlertSink(createHttpAlertSink({ url: process.env.ALERT_WEBHOOK_URL }))`
   on boot.
3. Configure `ALERT_WEBHOOK_URL` in the environment, and make
   sure the URL value never gets logged.

Phase 16 ships the interface + a tested in-memory sink. The
**real receiver is not wired** by default and the suite does
NOT make any external network calls.

### Rate-limit alerting

When the production login limiter returns 429, it now also calls
`forwardRateLimitHit({ route, kind: 'login' })`. The metric
`hrm_rate_limit_events_total{route,kind}` increments, and a
synthetic `auth.refresh.failure` event is forwarded (so the
existing alert filter handles it). This means an operator who
configures an HTTP sink for `auth.refresh.failure` will also get
notified of brute-force attempts at the login endpoint.

---

## 6. Rate limiter at scale

### Current state

`src/middlewares/security.middleware.js` uses
`express-rate-limit` with its **default in-memory store**. This
means:

- Each Node process keeps its own counter.
- Two pods behind a load balancer each allow 10 attempts per
  window per IP. An attacker rotating IPs (or sitting on a
  residential proxy pool) can effectively get 20 attempts.
- The login endpoint AND the refresh endpoint share the same
  limiter (mounted on both routes). This is by design — both
  are credential operations. Sharing a counter means a refresh
  flood reduces the budget available for logins, which is the
  conservative direction.

### What to do at scale

1. **Single instance**: the current setup is correct. Document
   the multi-instance caveat in the deployment runbook.
2. **Two or more instances**: switch to a shared store. Two
   options are documented below; we did NOT add a hard
   dependency on either one.

#### Option A — Redis store

`express-rate-limit` has a `rate-limit-redis` adapter. Wiring it
in would look like:

```js
import RedisStore from 'rate-limit-redis';
import { createClient } from 'redis';

const client = createClient({ url: process.env.REDIS_URL });
await client.connect();

const productionLoginLimiter = rateLimit({
  store: new RedisStore({ sendCommand: (...args) => client.sendCommand(args) }),
  // ...same options as before
});
```

The catch: the application now depends on Redis for the login
flow to be safe. If Redis is down, the limiter fails open or
closed depending on configuration. We do NOT enable this
dependency automatically — `REDIS_URL` must be set explicitly.

#### Option B — Sticky-IP load balancer

A simpler alternative: configure the load balancer to forward
all requests from the same source IP to the same pod. This
keeps the in-memory counter effective without a shared store.
Trade-off: if a pod is replaced, the in-memory counter is lost.

#### Option C — Accept the limitation

For low-stakes deployments, document that the rate limit is per
instance and is a defense-in-depth measure, not the only one.
The login flow still does bcrypt (slow) and the audit log still
records every failure. An attacker who gets past the in-memory
limiter is still rate-limited by bcrypt cost.

### What we did NOT do

We did NOT add Redis, did NOT add a third-party rate-limit
service, did NOT change the default store. The in-memory store
remains the default; multi-instance is a documented operational
choice. There is no `npm install` of new dependencies.

---

## 7. Load testing

### Tool

`scripts/load-test.js` — native Node load test, no third-party
dependencies. Uses `http.Agent` with `keepAlive: true` per worker
and `node:worker_threads` for concurrency.

### Safety guards

The script REFUSES to:

- Target a non-loopback host unless `--allow-public` is passed.
- Call `/api/auth/refresh` (it would create real sessions and
  might trigger reuse detection on a real user).
- Send a body containing `refreshToken` or `passwordHash`.

### Usage

```bash
# Liveness — fastest, no DB, no auth.
node scripts/load-test.js --url=http://127.0.0.1:5000 \
  --route=/api/health/livez --duration=10 --concurrency=8

# Readiness — DB-aware via the connection state.
node scripts/load-test.js --url=http://127.0.0.1:5000 \
  --route=/api/health/readyz --duration=10 --concurrency=4

# Login — DB-backed, bcrypt involved. Seeding required:
node scripts/seed-loadtest-user.js   # only seeds the test DB
node scripts/load-test.js --url=http://127.0.0.1:5000 \
  --route=/api/auth/login --method=POST \
  --body='{"email":"loadtest@example.com","password":"loadtest-pwd-12345"}' \
  --duration=10 --concurrency=4
```

The login limiter does NOT activate in development mode
(`NODE_ENV !== production`). To exercise the production limiter,
set `NODE_ENV=production` on the server and re-run.

### Baseline (local, no DB)

Measured on macOS / Node 22 against the livez endpoint, keep-alive:

| Endpoint | Concurrency | Duration | Requests | Errors | RPS | p50 | p95 | p99 |
|---|---|---|---|---|---|---|---|---|
| `/api/health/livez` | 8 | 8 s | 773,046 | 0 | 95,994 | 0.1 ms | 0.1 ms | 0.2 ms |
| `/api/health/readyz` | 4 | 8 s | 737,120 | 0 | 91,386 | 0.0 ms | 0.1 ms | 0.1 ms |
| `/api/auth/login` | 4 | 8 s | 740,853 | 0 | 91,848 | 0.0 ms | 0.1 ms | 0.1 ms |

These are localhost, in-memory, keep-alive numbers. They tell us:

- The HTTP layer can sustain ~90k RPS for trivial endpoints.
- The p50/p95/p99 of the login endpoint is dominated by network
  and bcrypt — the script does not measure these in isolation.
- A realistic production ceiling on a single instance will be
  far below 90k RPS because the wire latency and the bcrypt cost
  (>50ms) are the actual bottlenecks.

Phase 16 does NOT claim these numbers are production ceilings.
The numbers are a baseline; the SLA discussion is an
operator / business decision and is intentionally out of scope
for this document.

### What we did NOT measure

- True end-to-end latency under load (the script measures
  request/response time only).
- p99 under sustained load beyond 8 seconds (cluster
  warm-up effects may differ at 1m / 10m / 1h).
- Multi-instance behavior (no load balancer in the test rig).
- Memory growth / GC pause under sustained load.
- Behavior with the production rate limiter active.

The script can be reused for all of these — the operator just
adds `--duration=600` and a multi-host target. We did not run
those scenarios because they exceed the "local" / "staging"
scope of this phase.

---

## 8. Test regression

The Phase 16 test file (`tests/observability.phase16.test.js`) adds
33 tests across 7 suites. The full suite now runs:

- **851 tests** (was 818 after Phase 15)
- **135 suites** (was 128)
- **0 failures**

`npm run syntax-check` passes for all 55 source files (4 new).

---

## 9. Known limitations

1. **No external SIEM/alerting pipeline is wired.** The sink
   interface is in place but the default is `noop`. Configuring a
   real receiver is an operator task and requires code (or a
   small bootstrap) in `src/server.js`.
2. **No load-balancer-aware shared rate-limit store.** Multi-
   instance deployments have per-pod counters. See §6.
3. **The metrics endpoint is admin-only.** This is intentional
   but means Prometheus cannot scrape it without a sidecar that
   injects an admin token. The endpoint is NOT a public metrics
   server.
4. **Load test is single-process** (multi-worker via
   `node:worker_threads` but a single process). For a true
   multi-instance load test, point the script at a load balancer
   URL with `--allow-public` and run the script from each
   pod's machine in parallel.
5. **`/api/health/readyz` does a `ping` only when the connection
   state is `connecting`.** In steady state, it relies on
   Mongoose's connection-state events. If the Mongoose driver
   lags reporting a disconnect, so does `/readyz`. This is a
   deliberate trade-off against "amplify DB load with health
   probes".
6. **No graceful-shutdown deadline per request.** A request that
   takes > 10s after SIGTERM will be cut off by the force-exit
   timer. Phase 13 documented this; Phase 16 did not change it.

---

## 10. Post-deploy checklist

- [ ] `LOG_FORMAT=json` and `LOG_LEVEL=info` in production env.
- [ ] Confirm stdout is captured by the container log driver
      (Docker / k8s) and shipped to your central log store.
- [ ] Configure Prometheus to scrape `/api/metrics` (admin
      token sidecar).
- [ ] Configure a load balancer that respects
      `/api/health/livez` (livenessProbe) and
      `/api/health/readyz` (readinessProbe).
- [ ] If running > 1 instance, choose a rate-limit strategy
      (Redis store, sticky IP, or accept the limitation).
- [ ] If you need alerting, implement an HTTP receiver and wire
      it via `setAlertSink(createHttpAlertSink({ url }))` in
      `server.js`. The Phase 16 release does NOT do this
      automatically.
- [ ] Run `node scripts/load-test.js` against staging and
      record the baseline. Compare against §7.
- [ ] Verify the `X-Request-Id` response header is set on
      every response.

---

## 11. Pre-production operations checklist (carried over from Phase 15 + 16)

- [ ] Pick a retention value consistent with the compliance
      posture (Phase 15).
- [ ] Verify that downstream systems have already captured the
      data you are about to delete (Phase 15).
- [ ] Wire the cleanup script into cron (Phase 15).
- [ ] Wire the script's exit code into monitoring (Phase 15).
- [ ] Wire the metrics endpoint into Prometheus (Phase 16).
- [ ] Wire a real alert sink or document that alerting is a
      follow-up (Phase 16).
- [ ] Restrict production DB access — no developer account
      should be able to `db.auditlogs.deleteMany({})` (Phase 15).
- [ ] Confirm `LOG_FORMAT=json` is set and stdout is shipped
      to your central log store (Phase 16).
- [ ] Confirm the load balancer respects the new `/livez` and
      `/readyz` endpoints (Phase 16).
