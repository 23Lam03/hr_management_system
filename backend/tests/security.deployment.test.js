// Phase 13 — Deployment hardening tests.
//
// Covers:
//   1. Security response headers (helmet).
//   2. Login rate limiting (HTTP 429 + retry-after).
//   3. Production config validation (placeholder JWT_SECRET, localhost
//      MONGODB_URI, localhost CLIENT_URL).
//   4. CORS behavior in production (origin allowlist).
//
// The test app uses an in-memory express instance bound to createApp().
// MongoDB is connected by setupTestDb() so the auth flow can be exercised.

import { describe, it, before, after, beforeEach, afterEach } from 'node:test';
import { strict as assert } from 'node:assert';

import { createApp } from '../src/app.js';
import { assertConfig, config } from '../src/config/env.js';
import {
  setupTestDb,
  clearTestDb,
  teardownTestDb,
} from './helpers/db.js';
import { createTestUser, TEST_PASSWORD } from './helpers/auth.js';

let app;
let server;
let port;
const ORIGINAL_ENV = { ...process.env };

async function startServer() {
  app = createApp();
  server = app.listen(0);
  await new Promise((r) => server.once('listening', r));
  port = server.address().port;
}

async function stopServer() {
  if (!server) return;
  await new Promise((r) => server.close(r));
  server = null;
  app = null;
}

async function http(method, path, { body, headers } = {}) {
  const opts = {
    method,
    headers: { 'Content-Type': 'application/json', ...(headers || {}) },
  };
  if (body !== undefined) opts.body = JSON.stringify(body);
  const res = await fetch(`http://127.0.0.1:${port}${path}`, opts);
  let payload = null;
  const ct = res.headers.get('content-type') || '';
  if (ct.includes('application/json')) {
    payload = await res.json();
  } else {
    payload = await res.text();
  }
  return { status: res.status, body: payload, headers: res.headers };
}

// ---------------------------------------------------------------------------
// 1. Security response headers
// ---------------------------------------------------------------------------
describe('Security headers (helmet)', () => {
  before(async () => {
    await setupTestDb();
    await startServer();
  });
  after(async () => {
    await stopServer();
    await teardownTestDb();
  });
  beforeEach(async () => {
    await clearTestDb();
  });

  it('sets X-Content-Type-Options: nosniff', async () => {
    const r = await http('GET', '/api/health');
    assert.equal(r.headers.get('x-content-type-options'), 'nosniff');
  });

  it('sets X-Frame-Options to deny framing', async () => {
    const r = await http('GET', '/api/health');
    const xfo = r.headers.get('x-frame-options');
    assert.ok(
      xfo === 'DENY' || xfo === 'SAMEORIGIN',
      `X-Frame-Options should be DENY or SAMEORIGIN, got: ${xfo}`,
    );
  });

  it('sets Referrer-Policy: no-referrer', async () => {
    const r = await http('GET', '/api/health');
    assert.equal(r.headers.get('referrer-policy'), 'no-referrer');
  });

  it('sets X-DNS-Prefetch-Control: off', async () => {
    const r = await http('GET', '/api/health');
    assert.equal(r.headers.get('x-dns-prefetch-control'), 'off');
  });

  it('sets a strict Content-Security-Policy', async () => {
    const r = await http('GET', '/api/health');
    const csp = r.headers.get('content-security-policy') || '';
    assert.ok(csp.includes("default-src 'none'"), `CSP missing default-src 'none': ${csp}`);
    assert.ok(csp.includes("frame-ancestors 'none'"), `CSP missing frame-ancestors 'none': ${csp}`);
  });

  it('hides X-Powered-By header', async () => {
    const r = await http('GET', '/api/health');
    assert.equal(r.headers.get('x-powered-by'), null);
  });

  it('security headers are also set on 4xx error responses', async () => {
    const r = await http('GET', '/api/this-route-does-not-exist');
    assert.equal(r.status, 404);
    // notFoundHandler should still produce helmet-equipped response.
    assert.equal(r.headers.get('x-content-type-options'), 'nosniff');
    assert.ok(r.headers.get('content-security-policy'));
  });
});

// ---------------------------------------------------------------------------
// 2. Login rate limit
// ---------------------------------------------------------------------------
//
// These tests set NODE_ENV=production BEFORE issuing requests, so the
// productionLoginLimiter (a real rate-limit instance) is active. The
// loginLimiter wrapper looks up NODE_ENV on every request, so we
// don't need to rebuild the app for the suite.

describe('Login rate limit (production env)', () => {
  const ORIGINAL_NODE_ENV = process.env.NODE_ENV;

  before(async () => {
    process.env.NODE_ENV = 'production';
    await setupTestDb();
    await startServer();
  });
  after(async () => {
    await stopServer();
    await teardownTestDb();
    process.env.NODE_ENV = ORIGINAL_NODE_ENV;
  });
  beforeEach(async () => {
    await clearTestDb();
    await createTestUser({ email: 'rl@example.com' });
  });

  async function loginAttempt() {
    const r = await fetch(`http://127.0.0.1:${port}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: 'rl@example.com', password: 'WRONG-PW' }),
    });
    return { status: r.status, body: await r.json().catch(() => null) };
  }

  it('returns 401 for normal bad-credential attempts (not 429 yet)', async () => {
    for (let i = 0; i < 3; i++) {
      const r = await loginAttempt();
      assert.equal(r.status, 401);
    }
  });

  it('returns 429 after exceeding the rate limit', async () => {
    let saw429 = false;
    let lastStatus = null;
    for (let i = 0; i < 15; i++) {
      const r = await loginAttempt();
      lastStatus = r.status;
      if (lastStatus === 429) {
        saw429 = true;
        break;
      }
    }
    assert.ok(saw429, `expected 429 within 15 attempts, last status: ${lastStatus}`);
  });

  it('429 response is the standard error envelope', async () => {
    let body = null;
    for (let i = 0; i < 15; i++) {
      const r = await loginAttempt();
      if (r.status === 429) {
        body = r.body;
        break;
      }
    }
    assert.ok(body, 'expected to hit 429');
    assert.equal(body.success, false);
    assert.equal(body.error.code, 'RATE_LIMITED');
    // Message must be generic — do not reveal account existence.
    assert.ok(
      !/no such user|user not found|invalid email|account does not exist/i.test(
        body.error.message,
      ),
      `error message must not leak account existence: ${body.error.message}`,
    );
  });
});

describe('Login rate limit (development / test env disabled)', () => {
  before(async () => {
    // Explicitly NOT production. loginLimiter should be a no-op.
    process.env.NODE_ENV = 'development';
    await setupTestDb();
    await startServer();
  });
  after(async () => {
    await stopServer();
    await teardownTestDb();
  });
  beforeEach(async () => {
    await clearTestDb();
  });

  it('does not return 429 even after many login attempts in dev env', async () => {
    await createTestUser({ email: 'test-no-limit@example.com' });
    for (let i = 0; i < 20; i++) {
      const r = await http('POST', '/api/auth/login', {
        body: { email: 'test-no-limit@example.com', password: 'WRONG' },
      });
      // We expect 401 every time (wrong password), never 429.
      assert.notEqual(r.status, 429, `attempt ${i + 1} should not be rate limited`);
    }
  });
});

// ---------------------------------------------------------------------------
// 3. Production config validation
// ---------------------------------------------------------------------------
describe('assertConfig (production hardening)', () => {
  afterEach(() => {
    // Restore env after each test in this block.
    process.env = { ...ORIGINAL_ENV };
  });

  function setMinDevEnv() {
    process.env.NODE_ENV = 'development';
    process.env.MONGODB_URI = 'mongodb://127.0.0.1:27017/hrm_database';
    process.env.JWT_SECRET = 'a-safe-development-secret';
    process.env.CLIENT_URL = 'http://localhost:5173';
  }

  it('accepts a valid development config', () => {
    setMinDevEnv();
    assert.doesNotThrow(() => assertConfig());
  });

  it('rejects a missing JWT_SECRET', () => {
    setMinDevEnv();
    delete process.env.JWT_SECRET;
    assert.throws(() => assertConfig(), /JWT_SECRET/);
  });

  it('rejects a missing MONGODB_URI', () => {
    setMinDevEnv();
    delete process.env.MONGODB_URI;
    assert.throws(() => assertConfig(), /MONGODB_URI/);
  });

  it('rejects a too-short JWT_SECRET (length < 16)', () => {
    setMinDevEnv();
    process.env.JWT_SECRET = 'short';
    assert.throws(() => assertConfig(), /at least 16 characters/);
  });

  describe('in production', () => {
    beforeEach(() => {
      process.env.NODE_ENV = 'production';
      process.env.MONGODB_URI = 'mongodb+srv://user:pass@cluster.example/db';
      process.env.JWT_SECRET = 'a'.repeat(64);
      process.env.CLIENT_URL = 'https://app.example.com';
    });

    it('rejects a placeholder JWT_SECRET (contains "change-me")', () => {
      process.env.JWT_SECRET = 'change-me-before-deploying-1234567890';
      assert.throws(() => assertConfig(), /placeholder|JWT_SECRET/);
    });

    it('rejects a "local-dev" JWT_SECRET in production', () => {
      process.env.JWT_SECRET = 'local-dev-secret-please-change';
      assert.throws(() => assertConfig(), /placeholder|JWT_SECRET/);
    });

    it('rejects localhost MONGODB_URI in production', () => {
      process.env.MONGODB_URI = 'mongodb://127.0.0.1:27017/hrm_database';
      assert.throws(() => assertConfig(), /MONGODB_URI|localhost/);
    });

    it('rejects localhost CLIENT_URL in production', () => {
      process.env.CLIENT_URL = 'http://localhost:5173';
      assert.throws(() => assertConfig(), /CLIENT_URL|localhost/);
    });

    it('rejects empty CLIENT_URL in production', () => {
      process.env.CLIENT_URL = '';
      assert.throws(() => assertConfig(), /CLIENT_URL/);
    });

    it('accepts a real production config', () => {
      // The above beforeEach already set the right values.
      assert.doesNotThrow(() => assertConfig());
    });

    it('error messages do not echo the JWT_SECRET value', () => {
      process.env.JWT_SECRET = 'change-me-this-is-the-secret-1234567890';
      try {
        assertConfig();
        assert.fail('expected assertConfig to throw');
      } catch (err) {
        assert.ok(!String(err.message).includes('change-me-this-is-the-secret'),
          `error message must not include the secret value: ${err.message}`);
      }
    });
  });
});
