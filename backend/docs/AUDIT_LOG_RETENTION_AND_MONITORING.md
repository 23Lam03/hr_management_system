# Phase 15 — Audit Log, Data Retention & Security Monitoring

> Status: implemented. Status: experimental but covered by automated tests.
> Scope: `backend/` only. The `front_end/` is untouched.

This document is the operator + developer reference for the audit
log subsystem added / hardened in Phase 15. It complements the
earlier `PRODUCTION_DEPLOYMENT.md` and `AUTH_SESSION_MANAGEMENT.md`.

---

## 1. Architecture

```
┌───────────────┐
│ controllers   │  recordEvent()  ─┐
│  (auth, etc.) │                  │
└───────────────┘                  ▼
                          ┌─────────────────────┐
                          │ auditLog.service    │
                          │  recordEvent        │──► AuditLog  (Mongo)
                          │  cleanupExpiredLogs │
                          │  validateParams     │
                          └─────────────────────┘
                                  ▲
                                  │ (queries / pagination)
                          ┌───────┴────────┐
                          │ auditLog       │
                          │  .controller   │
                          │  + validator   │
                          └────────────────┘

┌───────────────┐
│ requestContext│  attaches {requestId, ip, userAgent} to req.context
│  middleware   │  → controllers propagate these into audit records
└───────────────┘

┌────────────────────────────┐
│ scripts/cleanup-audit-logs │  single-batch operator entrypoint;
│         .js                │  external scheduler invokes in a loop
└────────────────────────────┘
```

Key invariants:

- The audit service is the **only** code path that writes to
  `auditlogs`. There is no public POST endpoint to create logs.
- `recordEvent()` is **best-effort**: a write failure logs
  `console.error` and returns `null`. It never throws to the
  caller, so a DB outage cannot turn a successful login into a
  500.
- `recordEvent()` derives `actorUserId` and `actorRole` from the
  server-side `actor` argument (i.e. `req.user` or `{ role:
  'system' }`). It never reads these from the request body.

---

## 2. Audit event catalog

All events have a stable string code in `AUDIT_ACTIONS`.

### Authentication
- `auth.login.success` — successful password login.
- `auth.login.failure` — wrong password / unknown user / account
  in a non-active state. Recorded server-side; the client response
  remains a single 401 with a generic code.
- `auth.logout` — user-initiated logout (single-session).
- `auth.refresh.success` — refresh token rotated, new pair issued.
- `auth.refresh.failure` — refresh token rejected (malformed,
  expired, etc.). Client response: 401 generic.
- `auth.refresh.reuse_detected` — already-revoked refresh token
  was replayed; the entire token family is killed.
- `auth.session.revoked` — single session revoked by the user.
- `auth.sessions.revoked_all` — all sessions for the user revoked.

### Business operations
Already wired in earlier phases: `employee.create/update/softDelete`,
`department.create/update/deactivate`,
`position.create/update/deactivate`,
`attendance.create/update`,
`leave.create/update/cancel/approve/reject`,
`payroll.create/update/approve/markPaid/cancel`.

### Retention / system
- `auditlog.cleanup` — emitted by the operator script after a
  cleanup batch. `actor.role = 'system'`.

### Event sources
| File | Events recorded |
|---|---|
| `controllers/auth.controller.js` | `auth.login.success`, `auth.login.failure`, `auth.logout`, `auth.refresh.success`, `auth.refresh.failure`, `auth.refresh.reuse_detected`, `auth.session.revoked`, `auth.sessions.revoked_all` |
| `controllers/employee.controller.js` | `employee.*` |
| `controllers/department.controller.js` | `department.*` |
| `controllers/position.controller.js` | `position.*` |
| `controllers/attendance.controller.js` | `attendance.*` |
| `controllers/leaveRequest.controller.js` | `leave.*` |
| `controllers/payroll.controller.js` | `payroll.*` |
| `scripts/cleanup-audit-logs.js` | `auditlog.cleanup` |

---

## 3. Schema

```js
{
  _id: ObjectId,
  actorUserId: ObjectId | null,   // server-derived
  actorRole:   'admin' | 'employee' | 'system' | null,
  action:      String,            // from AUDIT_ACTIONS
  resourceType:String,            // from AUDIT_RESOURCE_TYPES
  resourceId:  String(24-hex) | null,
  description: String,            // ≤ 500 chars
  metadata:    Mixed,             // sanitized, ≤ 32 keys
  status:      'success' | 'failure',
  requestId:   String | null,     // ≤ 64 chars
  ip:          String | null,     // ≤ 64 chars
  userAgent:   String | null,     // ≤ 512 chars
  createdAt:   Date,
  updatedAt:   Date,
}
```

### Fields that MUST NEVER be written
- `password`, `passwordHash`, `oldPassword`, `newPassword`,
  `currentPassword`, `passwordResetToken`
- `token`, `accessToken`, `refreshToken`, `tokenHash`
- `jwt`, `authorization`, `cookie`, `set-cookie`
- `secret`, `clientSecret`, `mongoUri`, `dbUri`, `connectionString`
- `baseSalary`, `allowances`, `bonuses`, `deductions`,
  `grossSalary`, `netSalary`
- `email`, `phone`, `fullName`, `address`
- `reason`, `reviewNote`, `note`
- `creditCard`, `bankAccount`, `ssn`, `taxId`

Enforcement has **two** layers:
1. The service-side `METADATA_FORBIDDEN_KEYS` list in
   `src/models/auditLog.model.js` (canonical source of truth).
2. The schema-level `maxlength` validators on every free-text field
   to defend against oversized strings.
3. Metadata keys are capped at 32 and string values are truncated
   to 500 characters.

### Server-side vs. client-derived fields
| Field | Source |
|---|---|
| `actorUserId` | `req.user._id` from `protect` middleware, or `null` |
| `actorRole` | `req.user.role` from `protect`, or `'system'` |
| `requestId` | server-generated UUID via `requestContext` middleware |
| `ip` | `req.ip` (Express; honors `trust proxy` setting) |
| `userAgent` | request header (truncated to 512 chars) |

The service never reads these from the request body.

### Metadata bounds
- Max 32 keys.
- Each string value is truncated to 500 characters and suffixed
  with `…` if it was too long.
- Forbidden keys are silently dropped.
- Functions and symbols are ignored.

---

## 4. Retention policy

### Environment variables

| Variable | Default | Meaning |
|---|---|---|
| `AUDIT_LOG_RETENTION_DAYS` | `365` | Number of days logs are kept. Used by the operator script. |
| `AUDIT_LOG_CLEANUP_ENABLED` | `false` | Reserved. The Phase 15 release does **not** auto-enable cleanup. Operators must still invoke the script. |

The application refuses to run with a non-integer, negative, or
otherwise invalid `AUDIT_LOG_RETENTION_DAYS`; the value falls back
to `365` in that case (the operator script validates explicitly
and exits non-zero).

### Cleanup service

```js
import { cleanupExpiredLogs, validateCleanupParams } from './services/auditLog.service.js';

const v = validateCleanupParams({ retentionDays: 365, batchSize: 1000 });
if (v.error) throw new Error(v.error);
const result = await cleanupExpiredLogs({ retentionDays: v.retentionDays, batchSize: v.batchSize });
// → { deletedCount, hasMore, retentionDays, batchSize, cutoff }
```

Properties:

- **Idempotent**: running it twice in a row with the same params
  deletes 0 records the second time.
- **Batch-bounded**: the service finds the oldest N records that
  match `createdAt < cutoff` and deletes them by `_id`. It never
  runs a single unbounded `deleteMany` on the collection.
- **Safe parameter validation**: `validateCleanupParams` rejects
  non-integer / negative / oversized values and returns an error
  instead of silently using a default.
- **No destructive default**: if the env var is missing or
  malformed, the service falls back to `365` days. The destructive
  call still requires an explicit invocation by an operator.
- **No TTL index**: Phase 15 deliberately does NOT add a MongoDB
  TTL index to `auditlogs`. TTL indexes cannot be batch-bounded
  and are harder to reason about in a regulated environment.

### Index strategy

The model defines these indexes (unchanged from Phase 10):

```js
auditLogSchema.index({ createdAt: -1 });
auditLogSchema.index({ actorUserId: 1, createdAt: -1 });
auditLogSchema.index({ action: 1, createdAt: -1 });
auditLogSchema.index({ resourceType: 1, resourceId: 1, createdAt: -1 });
```

The cleanup service uses the `createdAt: -1` index to find the
oldest records, and the default `_id` index for the delete.

---

## 5. Running cleanup

### One-shot, manual

```bash
cd backend
MONGODB_URI="mongodb+srv://..." \
AUDIT_LOG_RETENTION_DAYS=365 \
AUDIT_LOG_CLEANUP_BATCH_SIZE=1000 \
node scripts/cleanup-audit-logs.js
```

The script exits:
- `0` — successful run (including "nothing to delete")
- `2` — invalid parameters (refused to run)
- `1` — DB or other runtime error

### Scheduled (cron / k8s)

Recommended pattern: a wrapper loop that re-invokes the script
until `hasMore === false`.

```sh
#!/bin/sh
# crontab entry — daily at 03:15 server time
15 3 * * * \
  cd /srv/hrm/backend && \
  MONGODB_URI="..." \
  AUDIT_LOG_RETENTION_DAYS=365 \
  AUDIT_LOG_CLEANUP_BATCH_SIZE=2000 \
  while :; do
    out=$(node scripts/cleanup-audit-logs.js 2>&1)
    echo "$out"
    echo "$out" | grep -q 'hasMore=false' && break
  done
```

The script's `hasMore` flag drives the loop. If the underlying
service is changed in the future, the loop continues to work as
long as the `hasMore` semantic is preserved.

> We deliberately did **not** add a `setInterval`-style scheduler
> inside the application process. Doing so would (a) require every
> deployment to opt in/out, (b) cause timer leaks in test suites
> that import the service, and (c) conflate runtime concerns
> with retention concerns.

---

## 6. Authorization

The audit log API is admin-only.

```js
router.use(protect, authorize('admin'));
router.get('/',       auditLogController.list);
router.get('/:id',    auditLogController.detail);
```

There is no POST / PATCH / DELETE endpoint. A regular employee
token receives `403 Forbidden` even with a valid `Authorization`
header.

### Query parameters (all optional)

| Param | Type | Notes |
|---|---|---|
| `actorUserId` | ObjectId | 24-hex |
| `action` | enum | one of `AUDIT_ACTIONS` |
| `resourceType` | enum | one of `AUDIT_RESOURCE_TYPES` |
| `resourceId` | ObjectId | 24-hex |
| `status` | enum | `success` \| `failure` (added in Phase 15) |
| `startDate` | `YYYY-MM-DD` | inclusive |
| `endDate` | `YYYY-MM-DD` | inclusive (range ≤ 366 days) |
| `page` | int | 1 – 1,000,000 |
| `limit` | int | 1 – 100 (service hard-caps at 100) |
| `sort` | enum | `createdAt` \| `action` \| `resourceType` \| `actorRole`, optional `-` prefix |

MongoDB operators in any of these parameters are rejected by
the validator (no `$` or `.` is allowed in the parsed value).

---

## 7. Session metadata protection

The `Session` model (introduced in Phase 14) stores `ip` and
`userAgent`. Phase 15 hardens the input handling:

- Both fields are truncated on write:
  - `userAgent` ≤ 512 chars
  - `ip` ≤ 64 chars
- Both fields are treated as **operational metadata**, not as
  identity proof. The authentication logic does not validate the
  client against these values.
- Session documents are removed by the existing `Session.expiresAt`
  TTL index (Phase 14). This is independent from the audit log
  retention policy.
- Audit events deliberately do NOT include the plaintext refresh
  token or `tokenHash`. See §3.

---

## 8. Known limitations

- **No alert/forwarding pipeline.** The audit log is queryable via
  the admin API; we do not currently ship events to an external
  SIEM. Phase 15 only adds the data + a clean API surface. Forwarding
  to Slack / Datadog / etc. is a follow-up.
- **No "append-only" guarantee.** The MongoDB collection is not
  write-once. A user with DB write access (or a future bug) could
  mutate records. The cleanup service is the only routine that
  deletes records, and it only deletes by `createdAt`.
- **Cleanup is operator-driven.** There is no in-process scheduler.
  An external cron is required to enforce the policy.
- **Retention of session metadata is bound to session lifetime.**
  Active sessions can persist beyond the audit log retention
  window; that is intentional. Sessions with `expiresAt` in the
  past are removed by the existing TTL index.
- **The `auditlog.cleanup` event itself is subject to the same
  retention policy.** If you also need an immutable history of
  cleanup runs, export them to an external store.

---

## 9. Post-deploy verification

After deploying Phase 15 to a new environment, perform these
checks in order:

1. **Smoke**: `npm test` in `backend/` passes locally. (No
   production tests — see "Tests" below.)
2. **Schema check**: confirm the new fields exist on the
   `auditlogs` collection:
   ```js
   db.auditlogs.findOne({}, { requestId: 1, ip: 1, userAgent: 1 });
   ```
3. **Login audit**: log in once via the API. Confirm an
   `auth.login.success` record exists with the right `actorUserId`
   AND that no `password`, `token`, or `authorization` appears in
   the `metadata`.
4. **Refresh audit**: perform a successful refresh, then a
   **malformed** refresh. The response code must be the same
   `TOKEN_INVALID` for both. Internally you should see one
   `auth.refresh.success` and one `auth.refresh.failure`.
5. **Reuse detection**: replay a revoked refresh token. Confirm
   `auth.refresh.reuse_detected` was recorded and that the
   family was killed.
6. **Authorization**: hit `GET /api/audit-logs` with a non-admin
   token; expect `403`.
7. **Cleanup (dry-run)**: run the operator script with a tiny
   batch size on a non-production DB. Confirm it returns
   `deletedCount=0` on a fresh database.
8. **Cleanup (real)**: with the desired retention, run the script
   and confirm records older than `retentionDays` are removed.

---

## 10. Pre-production operations checklist

Before enabling destructive cleanup on a production cluster:

- [ ] Pick a retention value (e.g. 365 / 730 days) consistent with
      the compliance posture.
- [ ] Confirm that downstream systems (analytics, SIEM, backups)
      have already captured the data you are about to delete.
- [ ] Schedule the cleanup script at a low-traffic window.
- [ ] Wire the script's exit code into monitoring (fail the
      scheduler job if exit code ≠ 0).
- [ ] Verify the loop wrapper terminates (`hasMore=false`) within
      an acceptable time bound.
- [ ] Add a MongoDB backup of the `auditlogs` collection
      immediately before the first production cleanup run.
- [ ] Confirm the `auditLog.cleanup` event is written and visible
      in the admin audit log UI.
- [ ] Restrict production DB access so that no developer account
      can run `db.auditlogs.deleteMany({})` directly. The cleanup
      service is the only intended deletion path.
