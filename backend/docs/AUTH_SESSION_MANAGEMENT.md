# Authentication & Session Management

**Audience:** backend developers and operators integrating with or
operating the HRM backend.

This document describes the full authentication lifecycle introduced
in **Phase 14** (token lifecycle & session management). It supersedes
the pre-Phase-14 stateless JWT design.

---

## 1. Lifecycle at a glance

```
                     +-------------------------+
                     |  POST /api/auth/login   |
                     |  (email + password)     |
                     +-----------+-------------+
                                 |
                  verify credentials
                                 |
                       +---------v---------+
                       |   creates Session  |  <-- tokenHash = SHA-256(plaintext)
                       |   signs access JWT |  <-- jti = session._id
                       +---------+---------+
                                 |
                  returns { accessToken, refreshToken,
                            expiresIn, refreshExpiresIn, sessionId }
                                 |
                                 v
                     +-------------------------+
                     |  client uses            |
                     |  Authorization: Bearer  |
                     |  <accessToken>          |
                     +-----------+-------------+
                                 |
                                 v
            access token exp < now ?  ----yes---> 401 TOKEN_EXPIRED
                                 | no
                                 v
                     +-------------------------+
                     |  POST /api/auth/refresh |
                     |  { refreshToken }       |
                     +-----------+-------------+
                                 |
                  hash + lookup + atomic rotate
                                 |
                  revoke OLD session + create NEW session
                                 |
                  return new pair (or 401 if reused / expired / user locked)
                                 |
                                 v
                     +-------------------------+
                     |  POST /api/auth/logout  |
                     |  Authorization: Bearer  |
                     |  { refreshToken }       |
                     +-----------+-------------+
                                 |
                  revoke session (by tokenHash OR by jti)
                                 |
                  returns 200 — refresh path is now closed
                  (access token still valid until exp — Plan A)
```

---

## 2. Access token vs refresh token

| Property | Access token | Refresh token |
|---|---|---|
| Format | JWT (3-part base64url) | Opaque random hex |
| Generator | `jsonwebtoken` | `crypto.randomBytes(32).toString('hex')` |
| Length | ~200-300 chars | 64 chars (256 bits) |
| Default TTL | 2h | 14d |
| Configured by | `JWT_EXPIRES_IN` | `REFRESH_TOKEN_EXPIRES_IN` |
| Storage on server | None (stateless) | SHA-256 hash in `Session` collection |
| Used by client as | `Authorization: Bearer <token>` | `POST /api/auth/refresh` body |
| Revocable before exp? | **No** (Plan A) | **Yes** — by deleting/updating the Session |
| Visible in logs? | No | No (only the hash) |

The access token's payload includes:

```json
{
  "sub": "<userId>",
  "role": "admin" | "employee",
  "jti": "<sessionId>",
  "iat": 1731270000,
  "exp": 1731277200
}
```

The refresh token is **opaque** — the server does not need to parse
it. The client never has access to `tokenHash`.

---

## 3. Environment variables

| Variable | Default | Production guidance |
|---|---|---|
| `JWT_SECRET` | (required) | 48+ random bytes hex. `assertConfig()` rejects placeholders. |
| `JWT_EXPIRES_IN` | `2h` | 15m-2h. Shorter is safer; longer is friendlier. |
| `REFRESH_TOKEN_EXPIRES_IN` | `14d` | 7d-30d. Rotating this invalidates every existing refresh token. |

`REFRESH_TOKEN_EXPIRES_IN` accepts the same formats as `JWT_EXPIRES_IN`:

- a number (interpreted as seconds),
- a number followed by a unit: `ms`, `s`, `m`, `h`, `d`,
- e.g. `900`, `15m`, `12h`, `30d`.

Invalid values cause the server to fail at startup with a clear error
that names the variable.

---

## 4. Endpoints

### 4.1 `POST /api/auth/login`

Public, rate-limited (10 requests / 15 min / IP — Phase 13).

Request:

```json
{ "email": "alice@example.com", "password": "..." }
```

Response `200`:

```json
{
  "success": true,
  "data": {
    "accessToken": "eyJ...",
    "refreshToken": "5e8d...64hex",
    "expiresIn": 7200,
    "refreshExpiresIn": 1209600,
    "sessionId": "64f0a1b2c3d4e5f6a7b8c9d0",
    "user": { "fullName": "Alice", "email": "alice@example.com", "role": "admin", "...": "..." }
  }
}
```

Errors:

- `400 VALIDATION_ERROR` — missing / malformed email or password.
- `401 INVALID_CREDENTIALS` — wrong email, wrong password, or the
  account is not `active`. Same code/message in all three cases so
  attackers cannot enumerate accounts.
- `429 RATE_LIMITED` — too many attempts from this IP.
- `500 SESSION_CREATE_FAILED` — server-side DB failure while writing
  the session. The response is deliberately generic.

### 4.2 `POST /api/auth/refresh`

Public, rate-limited (same bucket as login).

Request:

```json
{ "refreshToken": "5e8d...64hex" }
```

Response `200`:

```json
{
  "success": true,
  "data": {
    "accessToken": "eyJ...",
    "refreshToken": "7f9c...64hex",
    "expiresIn": 7200,
    "refreshExpiresIn": 1209600
  }
}
```

Behavior:

- The OLD refresh token is **revoked** (single-use).
- A NEW session is created in the same `familyId`.
- The response contains the new pair; the client must replace both.

Errors (all `401 TOKEN_INVALID` to avoid leaking which case it is):

- `400 VALIDATION_ERROR` — `refreshToken` missing or not 64 hex chars.
- `401 TOKEN_INVALID` — token not found, expired, already revoked,
  or user is no longer `active`. In every case the response code
  is the same.
- Reuse detection: presenting an already-revoked token triggers a
  **family kill** — every session in the same family is revoked.
- Race: if two requests with the same refresh token arrive at the
  same time, exactly one wins (atomic `findOneAndUpdate`). The
  loser sees `401 TOKEN_INVALID`.

### 4.3 `POST /api/auth/logout`

Requires `Authorization: Bearer <accessToken>`. The body may include
`{ "refreshToken": "..." }`. If the body is empty, the server tries
to revoke the session matching the access token's `jti` claim.

Response `200`:

```json
{
  "success": true,
  "data": {
    "revoked": true,
    "revokedTarget": "refresh_session",
    "message": "Refresh session has been revoked. ...",
    "accessTokenTtl": "2h",
    "refreshSessionRevoked": true
  }
}
```

Behavior:

- Refresh session is **revoked server-side**.
- The currently-issued access token is **NOT** revoked (Plan A — see §6).
  The user can keep using it until `exp`, but cannot mint new tokens.
- The user can no longer use the refresh token (returns 401).
- Audit: `auth.logout` event is recorded with the user id and role.

### 4.4 `GET /api/auth/me`

Requires `Authorization: Bearer <accessToken>`. Returns the caller's
profile plus the linked Employee document (if any). Unchanged from
Phase 3.

### 4.5 `GET /api/auth/sessions`

Requires `Authorization: Bearer <accessToken>`. Lists the caller's
**active** refresh sessions (not revoked, not expired).

Response `200`:

```json
{
  "success": true,
  "data": {
    "sessions": [
      {
        "_id": "64f0...",
        "userId": "64ef...",
        "familyId": "5a3b...",
        "createdAt": "...",
        "lastUsedAt": "...",
        "expiresAt": "...",
        "userAgent": "Mozilla/5.0 ...",
        "ip": "10.0.0.1"
      }
    ]
  }
}
```

The `tokenHash` field is **never** returned. There is no admin
override — admins can only manage their own sessions here.

### 4.6 `DELETE /api/auth/sessions/:id`

Requires `Authorization: Bearer <accessToken>`. Revokes the session
with the given id, **if and only if** it belongs to the caller.

- `200` — `{ revoked: true, sessionId: <id> }`.
- `400 VALIDATION_ERROR` — `id` is not a valid ObjectId.
- `404 SESSION_NOT_FOUND` — the session does not exist for the
  caller. We deliberately return 404 (not 403) to avoid leaking
  the existence of other users' sessions.

### 4.7 `POST /api/auth/sessions/revoke-all`

Requires `Authorization: Bearer <accessToken>`. Body:

```json
{ "exceptCurrent": true }
```

`exceptCurrent: true` keeps the caller's current access token's
session alive (so the user is not logged out of the device they
are using to issue the request). `exceptCurrent: false` revokes
all sessions, including the current one.

Response `200`:

```json
{ "success": true, "data": { "revokedCount": 3, "excludedCurrent": true } }
```

---

## 5. Token rotation & reuse detection

### 5.1 Rotation flow

Each `POST /api/auth/refresh` call:

1. SHA-256 hashes the incoming refresh token.
2. Looks up the matching Session by `tokenHash` (unique index, O(log n)).
3. Verifies: session exists, `revokedAt === null`, `expiresAt > now`,
   user is still `active`.
4. **Atomically** updates the OLD session: `findOneAndUpdate(
   { _id, revokedAt: null }, { $set: { revokedAt, revokedReason: 'refresh_rotation' } })`.
5. Creates a NEW session in the same `familyId` with a new
   `tokenHash`.
6. Signs a new JWT bound to the new session.

### 5.2 Atomicity

The rotation in step 4 uses MongoDB's atomic
`findOneAndUpdate`. If two requests with the same refresh token
arrive simultaneously, only one wins. The loser finds
`revokedAt !== null` and falls into the reuse branch (5.3).

This is verified by the `two concurrent refresh requests — only
one succeeds (atomicity)` test in `tests/auth.session.test.js`.

### 5.3 Reuse detection & family kill

If the OLD session is already revoked when step 3 runs, the
incoming refresh token is a **reuse attempt** — either:

- the legitimate user is racing themselves, or
- an attacker has stolen the OLD refresh token (e.g. from a
  compromised device that no longer trusts the network).

We cannot tell which. The safe action is the same in both cases:
**revoke every session in the same `familyId`**. This is the
standard pattern (see e.g. OWASP JWT cheat sheet).

A reuse-attempt response is `401 TOKEN_INVALID` — same code as
"token not found", so attackers cannot distinguish a successful
theft probe from a normal invalid token.

### 5.4 Why the family kill is safe

The family is bounded: it starts at a successful login and ends
at a logout / explicit revoke / reuse event. A user with N
devices has N parallel families, one per device. Killing one
family logs out one device, not all of them.

---

## 6. Plan A vs Plan B — what gets revoked when

There are two ways to design access-token revocation:

### 6.1 Plan A (implemented)

- Access tokens are JWT, **not** stored server-side. The `protect`
  middleware verifies the signature and the user status, but does
  not check the session on every request.
- Logout revokes only the **refresh session**. The access token
  remains valid until its natural `exp`.
- The maximum exposure of a stolen access token is the access-token
  TTL (default 2h).

Pros:

- Simple. No denylist, no extra DB lookup on every request.
- `protect` middleware stays fast (one bcrypt-style verify per request).
- No new failure modes (e.g. cache poisoning on the denylist).

Cons:

- A user who logs out is not fully logged out for up to 2 hours.
- An admin who locks an account cannot immediately invalidate
  outstanding access tokens.

### 6.2 Plan B (NOT implemented — out of scope)

- Add a per-session denylist (Redis or MongoDB).
- The `protect` middleware checks the denylist on every request.
- Logout adds the session's `jti` to the denylist with TTL =
  remaining time until `exp`.
- The denylist must survive restarts (so it cannot be in-memory
  only).

Plan B is the right choice if any of these become requirements:

- Sub-minute logout latency is a regulatory / SLA requirement.
- "Log out everywhere" must take effect within seconds.
- The application must support admin-initiated user-level session
  termination that takes effect immediately.

Until then, Plan A is the appropriate trade-off.

### 6.3 Why Plan A is documented honestly

The previous behavior (Phase 3) returned `revoked: false` from
logout. The current behavior returns `revoked: true` AND tells
the client exactly what was and was not revoked. There is no
longer a "the access token was not revoked, sorry" mystery.

---

## 7. Logout semantics — full table

| User action | Refresh session | Access token | Notes |
|---|---|---|---|
| `POST /logout` with refreshToken in body | Revoked | Still valid until `exp` | Most common path. |
| `POST /logout` without body | Revoked (by `jti`) | Still valid until `exp` | Server finds the session via the JWT's `jti` claim. |
| `POST /logout` for a session that was already revoked | No-op | n/a | Returns 200, `refreshSessionRevoked: false`. |
| `POST /sessions/revoke-all` with `exceptCurrent: true` | All other sessions revoked | Current still valid | Use case: "log out everywhere except this device". |
| `POST /sessions/revoke-all` with `exceptCurrent: false` | All sessions revoked | The current access token's `jti` is now revoked | User must log in again on next refresh. |
| `DELETE /sessions/:id` for own session | That session revoked | n/a (different session) | Other devices unaffected. |
| User marked `inactive` / `locked` | Family killed on next refresh | Still valid until `exp` | The `rotateRefreshToken` function checks user status atomically. |
| Password change (future) | Family / all sessions killed | TBD | Not implemented in this phase. |

---

## 8. Token transport

The backend returns tokens in the **JSON response body**. Cookies
are **not** used.

- **Access token** — sent by the client on every protected request
  as `Authorization: Bearer <accessToken>`.
- **Refresh token** — kept by the client (e.g. in memory, or in
  localStorage with appropriate XSS protections). Sent in the body
  of `POST /api/auth/refresh` and `POST /api/auth/logout`.

We deliberately did NOT switch to cookies because:

- The frontend is currently stateless (Bearer token); migrating to
  cookies requires changes on the client (CSRF token, SameSite
  policy, `withCredentials` flag, etc.).
- Cookies would expose us to CSRF risk that the current Bearer
  design does not have.
- The CORS configuration currently uses `credentials: true` but
  no cookies are set, so this is a forward-compat placeholder.

If the frontend needs cookie-based auth in the future, that is a
separate phase with its own CSRF and `SameSite` design.

---

## 9. Multi-instance deployment

The Session collection is in MongoDB, so the rate limiter
(in-memory) and the session storage (MongoDB) are independent.

| Concern | Single instance | Multi-instance |
|---|---|---|
| Refresh-token rotation | OK | OK — atomic in MongoDB |
| Reuse detection | OK | OK — atomic in MongoDB |
| Family kill | OK | OK — single `updateMany` |
| Login rate limit | OK (in-memory) | **Per-instance** — an attacker gets `N × max` attempts across N replicas. Use Redis (e.g. `rate-limit-redis`) before scaling out. |

---

## 10. Frontend migration plan

The API contract changed. The client must be updated to use the
new endpoints. **This phase does NOT modify the frontend.**

| Old (pre-Phase 14) | New (Phase 14) | Required client change |
|---|---|---|
| `data.token` (string) | `data.accessToken` + `data.refreshToken` | Rename + handle two tokens. |
| n/a | `data.expiresIn` (access TTL, seconds) | Use to schedule proactive refresh. |
| n/a | `data.refreshExpiresIn` (refresh TTL, seconds) | Display to user ("stay signed in for N days"). |
| n/a | `data.sessionId` | Use for per-device "log out this device". |
| `POST /logout` with empty body | Same, but optionally include `refreshToken` in body | Pass `refreshToken` in body for guaranteed revocation. |
| `data.revoked === false` | `data.revoked === true` | Stop checking this for "are we logged out". |
| n/a | `GET /api/auth/sessions` | Use for "active sessions" UI. |
| n/a | `DELETE /api/auth/sessions/:id` | Use for "log out this device". |
| n/a | `POST /api/auth/sessions/revoke-all` | Use for "log out everywhere". |

Recommended client behavior:

1. After login, store `accessToken` and `refreshToken` somewhere
   safe (memory is best, with a fallback to `sessionStorage` if
   page reloads are common).
2. On any `401 TOKEN_EXPIRED` from a protected endpoint, call
   `POST /api/auth/refresh` once. If it succeeds, retry the
   original request with the new access token. If it fails
   (401 TOKEN_INVALID), redirect to login.
3. Refresh proactively ~1 minute before `expiresIn` to avoid
   mid-request expiry.
4. On logout, send `POST /api/auth/logout` with the refresh
   token in the body. Discard both tokens regardless of the
   response (the network call may fail).

---

## 11. Known limitations

- **Access token cannot be revoked before `exp` (Plan A).** This
  is documented above. Plan B is intentionally out of scope.
- **No password-change / forgot-password flow.** When such an
  endpoint is added, it should call
  `revokeAllSessionsForUser(userId, { reason: 'password_change' })`.
- **In-memory rate limit.** Multi-instance deployments need a
  shared store (Redis). See `docs/PRODUCTION_DEPLOYMENT.md` §9.
- **Logout does not invalidate the access token's `jti` server-side.**
  The `jti` is only consulted when logout has no body and needs
  to find the session to revoke.
- **Audit log for refresh events is not yet recorded.** Login
  success is audited. Failed refresh attempts are not. This is a
  future improvement.

---

## 12. Testing

The Phase 14 tests live in `backend/tests/auth.session.test.js`
(29 tests, 5 suites). Existing auth tests in
`backend/tests/auth.api.test.js` and
`backend/tests/auth.service.test.js` were updated to reflect the
new contract. Total test count went from 759 to 788.

Run all tests:

```bash
cd backend && npm test
```

Run only the session tests:

```bash
cd backend && TEST_MONGODB_URI=mongodb://127.0.0.1:27017/hrm_test_db NODE_ENV=test \
  node --test --test-reporter=spec tests/auth.session.test.js
```

The test database is `hrm_test_db` on `127.0.0.1:27017` — the
same local instance as the rest of the test suite. **No production
or Atlas database is touched.**
