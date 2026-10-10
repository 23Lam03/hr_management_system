# Production Deployment Guide — HRM Backend

**Audience:** operators / DevOps who deploy the HRM backend to production.

This document describes how to deploy `backend/` so that it satisfies
the security baseline established in **Phase 12 (Security & Performance
Audit)** and **Phase 13 (Deployment Hardening)**.

It does NOT prescribe a specific cloud provider, container orchestrator,
or reverse proxy. It is intentionally generic so it can be adapted to
nginx, ALB, Cloudflare, nginx-ingress, etc.

If a section says "verify" or "confirm", it means the operator must
validate that the condition holds for the actual deployment
environment. Code cannot check those conditions.

---

## 1. Environment requirements

| Requirement | Minimum | Notes |
|---|---|---|
| Node.js | 18.x or 20.x | Match `package.json` `engines.node` |
| MongoDB | 5.0+ (6.x recommended) | Replica set in production. Atlas M10+ for HA |
| RAM | 512 MB (1 GB+ recommended) | Node + Mongoose + bcrypt baseline |
| Outbound HTTPS | required | npm install during build phase |
| Process supervisor | required | systemd / PM2 / k8s — must restart on crash |
| Reverse proxy (optional) | recommended | nginx / ALB / Cloudflare for TLS + WAF |

---

## 2. Environment variables

All configuration is read from `process.env`. Copy `.env.example` to
`.env` and fill in real values. **Do not commit `.env`.**

| Variable | Required | Production rule |
|---|---|---|
| `NODE_ENV` | yes | MUST be `production`. `assertConfig()` will refuse to start otherwise. |
| `PORT` | optional | Default `5000`. Whatever the proxy / orchestrator expects. |
| `MONGODB_URI` | yes | Full Atlas / self-hosted URI. `assertConfig()` refuses `localhost` in production. |
| `JWT_SECRET` | yes | ≥ 16 chars, NOT a placeholder. `assertConfig()` rejects known placeholder fragments. |
| `JWT_EXPIRES_IN` | optional | Default `2h`. Short-lived access tokens. |
| `CLIENT_URL` | yes (production) | Comma-separated HTTPS origins. `assertConfig()` refuses `localhost` in production. |
| `TRUST_PROXY` | optional | See §6 (Trust Proxy). Leave empty if unsure. |

### 2.1 Generating a JWT secret

```bash
node -e "console.log(require('crypto').randomBytes(48).toString('hex'))"
```

This produces a 96-character hex string. Store the output in your
secret manager (AWS Secrets Manager, GCP Secret Manager, HashiCorp
Vault, 1Password, etc.) — **never** in the repository or in `.env`
that gets committed to a container image.

### 2.2 Rotating a JWT secret

Rotating `JWT_SECRET` invalidates every outstanding JWT. Plan a
maintenance window if you cannot tolerate forced re-login. To rotate
without downtime, see §10 (Refresh tokens, future work).

---

## 3. Atlas credential setup

This section MUST be performed by the operator. Code cannot verify it.

1. Log in to the MongoDB Atlas dashboard.
2. **Database Access** → create a new database user.
   - Username: a unique value (NOT the same as the one previously
     stored in `.env`).
   - Password: a strong, randomly generated string. Use a password
     manager to store it.
   - Built-in role: `readWrite` on the **production database only**.
     Do not grant `readWriteAnyDatabase` or `atlasAdmin` to a
     application-level user.
3. **Network Access** → restrict the IP allowlist.
   - Production: list the exact egress IPs of the deployment
     environment. Do NOT keep `0.0.0.0/0` (anywhere) enabled.
   - If the backend runs behind a NAT or a load balancer, allow
     that NAT/load balancer's outbound IP range only.
4. **Clusters** → "Connect" → "Connect your application" → Node.js →
   copy the connection string.
5. Replace the password placeholder in the connection string with
   the new user password, URL-encoded if it contains special
   characters (`@`, `:`, `/`, `?`, `#`).
6. Set `MONGODB_URI` in the production environment.
7. The previous Atlas user (and any credential previously stored in
   `.env`) MUST be deleted in Atlas.

If you are not using Atlas and run a self-hosted MongoDB, the same
principles apply: dedicated application user with `readWrite` on
the HRM database only, network ACLs, TLS required.

### 3.1 Verifying after rotation

- `GET /api/health` should return `database.status: 'connected'`.
- The application logs `[db] MongoDB connected` at startup.
- A login attempt with a known user succeeds (200 + token).

---

## 4. CORS allowlist

`CLIENT_URL` is the single source of truth for allowed origins in
production. The CORS middleware in `app.js` matches the request
`Origin` header against this list and **rejects** anything else.

### 4.1 Configuring for one origin

```
CLIENT_URL=https://app.example.com
```

### 4.2 Configuring for multiple origins

```
CLIENT_URL=https://app.example.com,https://admin.example.com
```

### 4.3 What you must NOT do

- Do not set `CLIENT_URL=*` — the code does not implement wildcard
  matching and `assertConfig()` will not catch it, but it is a
  configuration mistake.
- Do not include a trailing slash (`https://app.example.com/` ≠
  `https://app.example.com`).
- Do not include `http://` origins in production. The check only
  blocks `localhost`; an `http://` origin pointing at a real
  production domain is still allowed by code but you should not
  ship a setup that allows plaintext HTTP for browser clients.

### 4.4 Verification

From a browser console or curl with an `Origin` header:

- `Origin: https://app.example.com` → 200 with
  `Access-Control-Allow-Origin: https://app.example.com`.
- `Origin: https://evil.example.com` → 500 with CORS error
  (the CORS middleware throws, the error handler catches it).

---

## 5. Reverse proxy and HTTPS

This guide does not assume a particular proxy. The minimum
production setup is:

1. Terminate TLS at the proxy (nginx, ALB, Cloudflare, etc.).
2. Forward traffic to the Node process over plain HTTP on
   `127.0.0.1:<port>` (do not expose the Node port publicly).
3. Set the `X-Forwarded-Proto: https` header.
4. Set `TRUST_PROXY` in the Node environment to match the proxy
   topology (see §6).
5. Set the following proxy-level security headers (the Node app
   already sets its own via helmet, but defense in depth is fine):
   - `Strict-Transport-Security: max-age=15552000; includeSubDomains`
   - `X-Forwarded-For` is added by the proxy (required for `trust proxy`).

### 5.1 Why TLS at the proxy

- Cert rotation is independent of application deploys.
- TLS termination at Node requires managing certificates inside the
  process, with hot-reload on renewal. This is more complex than
  the proxy approach and not supported out of the box by Express.
- A reverse proxy can apply WAF rules, rate limits, and IP
  allowlists without code changes.

### 5.2 Cipher suites

Out of scope for this document. Use the proxy's default profile or
Mozilla's "Intermediate" TLS configuration.

---

## 6. Trust proxy

The Node app starts with `app.set('trust proxy', ...)` UNSET (i.e.
the default `false`). The deployment environment variable
`TRUST_PROXY` controls this:

| `TRUST_PROXY` value | Effect |
|---|---|
| unset / empty | `trust proxy` is not set. `req.ip` = the immediate client (or the proxy's IP if you have one). |
| `false` | Explicit "do not trust any proxy". `req.ip` = the immediate client. |
| `true` | Trust every hop. `req.ip` = the leftmost IP in `X-Forwarded-For`. **Do not set this unless you are directly behind a known L7 proxy that always sets `X-Forwarded-For`.** |
| `1`, `2`, `3` | Trust the first N hops. Typical for nginx: `1`. |
| `loopback` | Trust `127.0.0.1`, `::1`. |
| `10.0.0.0/8` | Trust a specific subnet (CIDR). |

### 6.1 Why this matters for rate limiting

`express-rate-limit` uses `req.ip` as the bucket key by default.
- If the app is **not** behind a proxy, the default is safe —
  `req.ip` is the real client IP.
- If the app is behind a proxy and `TRUST_PROXY` is not set, the
  rate limiter buckets all traffic under the proxy's IP — meaning
  one shared 10-attempt limit for the entire user base. That is
  too restrictive.
- If the app is behind an **untrusted** proxy and `TRUST_PROXY=true`
  is set, a client can spoof `X-Forwarded-For` and avoid the rate
  limit.

### 6.2 Recommended configuration

If you are behind nginx with the standard `proxy_set_header
X-Forwarded-For $remote_addr;` directive:

```
TRUST_PROXY=1
```

If you have multiple proxies (e.g. Cloudflare in front of an
ALB), set `TRUST_PROXY=2` and verify that neither layer lets
clients set their own `X-Forwarded-For`.

### 6.3 What to verify after deployment

```bash
# Replace $PUBLIC_IP with the real client IP behind the proxy.
curl -H "X-Forwarded-For: $PUBLIC_IP" https://api.example.com/api/health
```

Then make 11 login attempts and confirm a `429 RATE_LIMITED`
response on the 11th. If you see a 401 on all 11 attempts, the
rate limiter is bucketing on a single key (proxy IP) — set
`TRUST_PROXY` correctly and re-test.

---

## 7. Running the application

### 7.1 Using the scripts in `package.json`

| Script | Use |
|---|---|
| `npm start` | Production start. Runs `node src/server.js`. |
| `npm run dev` | Local development with `nodemon` for hot-reload. **Do not use in production.** |
| `npm test` | Local test suite. Requires MongoDB on `127.0.0.1:27017`. |
| `npm run syntax-check` | Verifies every source file is parseable. Safe to run in CI. |

### 7.2 Recommended process supervisor

Pick one:

- **systemd** — service file, `Restart=on-failure`, limit
  `RestartSec=5s`, `TimeoutStopSec=15s`.
- **PM2** — `pm2 start src/server.js --name hrm-backend --time`.
- **Docker / k8s** — `CMD ["node", "src/server.js"]`, with
  `restartPolicy: Always` and a liveness probe pointing at
  `GET /api/health`.

### 7.3 Graceful shutdown

`src/server.js` handles `SIGINT`, `SIGTERM`, and `uncaughtException`:

- Stops accepting new connections via `server.close()`.
- Disconnects the Mongoose client via `mongoose.disconnect()`.
- Force-exits after a 10-second timeout to avoid hanging.

This means `kubectl delete pod` (which sends `SIGTERM` and waits
30 s) will drain in-flight requests. Set the orchestrator's
`terminationGracePeriodSeconds` to at least 15 to be safe.

---

## 8. Health check

```
GET /api/health
```

Returns:

- `200 OK` with `data.database.connected: true` if the service
  AND the database are both ready.
- `503 Service Unavailable` with `data.database.connected: false`
  if the database is not currently connected. The HTTP server is
  still responding.

For a Kubernetes liveness probe, use `GET /api/health` and treat
`status: 200` as healthy and `status: 503` as unhealthy. Do NOT
use a separate `/livez` or `/readyz` — the app does not currently
expose those.

For a readiness probe in a load-balancer, the same endpoint works
but the orchestrator should treat 503 as "remove from rotation".

---

## 9. Rate limiting — multi-instance

`express-rate-limit` is **in-memory** by default. When the app is
scaled out to N replicas behind a load balancer:

- Each replica has its own bucket.
- A determined attacker can rotate IPs across replicas to get
  N× the limit (10 × N per 15 min).

This is acceptable for the current single-instance deployment. To
scale out safely, switch to a shared store:

- Redis (`rate-limit-redis`)
- Memcached

To make the switch, edit `src/middlewares/security.middleware.js`
and follow the `express-rate-limit` documentation for the chosen
store. This is a code change — coordinate with the development team.

---

## 10. Backup and recovery

This section is the operator's responsibility. The application
exposes no backup APIs.

For MongoDB Atlas:

1. Enable **Continuous Backup** (Atlas M10+).
2. Configure **PIT (point-in-time) recovery** with a 7-day window.
3. Test the restore process at least quarterly by restoring to a
   scratch cluster and running a smoke test (`/api/health` +
   login).

For self-hosted MongoDB:

1. Run a 3-node replica set.
2. Use `mongodump` + offsite storage (S3, GCS, etc.) for nightly
   logical backups.
3. Capture oplog for PIT recovery.

### 10.1 Verifying backup integrity

The app itself does not provide a verification endpoint. Use
Atlas's "Snapshot" UI or restore to a sandbox and run
`GET /api/health` plus a login smoke test.

---

## 11. Post-deploy verification checklist

Run these in order after a fresh deployment. Any failure is a
blocker.

1. `GET /api/health` returns `200` with `data.database.connected: true`.
2. Application logs at startup show:
   - `[boot] hrm-backend listening on http://localhost:<port> (env: production)`
   - `[db] MongoDB connected`
3. A real login attempt with a known user returns `200` and a
   JWT. Save the JWT.
4. `GET /api/auth/me` with the JWT returns `200` and the user
   payload (no `passwordHash` field).
5. `POST /api/auth/login` with a wrong password 11 times in a row:
   the 11th response is `429 RATE_LIMITED` and the body matches
   the standard error envelope.
6. `curl -H "Origin: https://not-allowed.example.com" \
        -i https://api.example.com/api/health` shows the CORS
   rejection.
7. `curl -I https://api.example.com/api/health` shows
   `X-Content-Type-Options: nosniff`, `X-Frame-Options: DENY` (or
   `SAMEORIGIN`), `Referrer-Policy: no-referrer`,
   `Strict-Transport-Security: max-age=...` (only if the proxy
   sets HSTS).
8. The `.env` file (or equivalent secret store) is not present in
   the deployed image — only the resolved environment variables
   are.
9. Atlas Network Access shows the correct production IP, not
   `0.0.0.0/0`.
10. Logs are not being sent anywhere that includes password
    fields. (Search the deploy artifacts for `password` to confirm
    nothing accidentally captures the request body.)

---

## 12. Manual checklist for the operator

Things this document cannot do for you. Each item has a checkmark
to use as a one-pager for the deployment.

- [ ] New Atlas user created with `readWrite` on production DB only.
- [ ] Old Atlas user deleted.
- [ ] Atlas Network Access restricted to production IPs.
- [ ] `JWT_SECRET` generated with `crypto.randomBytes(48)`, stored
      in the secret manager, not in the repository.
- [ ] `MONGODB_URI` set to the new user/cluster.
- [ ] `CLIENT_URL` set to the real frontend origin(s).
- [ ] `NODE_ENV=production`.
- [ ] `TRUST_PROXY` set to the correct value (or left empty if
      there is no proxy).
- [ ] TLS terminated at the proxy with a valid certificate.
- [ ] Health check wired into the orchestrator.
- [ ] Process supervisor / orchestrator configured to restart on
      crash.
- [ ] Log shipping configured (CloudWatch, ELK, Datadog, etc.).
- [ ] Backup schedule verified.
- [ ] Post-deploy verification checklist (§11) executed end-to-end.
- [ ] Incident response runbook drafted (who to call, how to
      rotate secrets, how to roll back).

---

## 13. Known limitations (out of scope for this document)

These items are tracked separately and intentionally NOT
implemented in Phase 13:

- **JWT revocation / denylist** — see
  `docs/SECURITY_PERFORMANCE_AUDIT.md` finding M2. Logout is
  currently advisory.
- **Refresh tokens** — would shorten the impact of a leaked
  access token.
- **Per-user rate limiting** — current limit is per-IP. A
  determined attacker can rotate IPs. Future work: combine with
  per-account lockout after N consecutive failures.
- **Audit log retention** — `auditlog` grows indefinitely. Add a
  TTL index or an archive job in a follow-up phase.
- **Load testing** — no production-scale benchmark exists.
- **Application-layer WAF** — only proxy-level WAF today.
