#!/usr/bin/env node
// scripts/load-test.js — Phase 16
//
// Native Node load test. Uses the built-in `http` module and
// `node:worker_threads` so the test does not require any extra
// dependency (no autocannon, k6, or axios). It is intentionally
// simple: each worker opens a single connection and fires requests
// in a tight loop for a fixed duration.
//
// Usage:
//   node scripts/load-test.js --url=http://127.0.0.1:5000 \
//     --route=/api/health/livez --duration=10 --concurrency=8
//
//   # Or with login + a single protected endpoint:
//   node scripts/load-test.js --url=http://127.0.0.1:5000 \
//     --route=/api/auth/login --method=POST \
//     --body='{"email":"loadtest@example.com","password":"loadtest"}' \
//     --duration=10 --concurrency=4
//
// IMPORTANT:
//   - The script NEVER uses production credentials.
//   - The script targets localhost / staging only by default.
//   - The default URL is 127.0.0.1, which is the standard loopback
//     address; the script refuses to target any non-loopback host
//     unless the operator passes --allow-public explicitly.

import http from 'node:http';
import { Worker, isMainThread, parentPort, workerData } from 'node:worker_threads';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

function parseArgs(argv) {
  const out = {};
  for (let i = 2; i < argv.length; i += 1) {
    const a = argv[i];
    if (!a.startsWith('--')) continue;
    const k = a.slice(2);
    const eq = k.indexOf('=');
    if (eq >= 0) out[k.slice(0, eq)] = k.slice(eq + 1);
    else if (i + 1 < argv.length && !argv[i + 1].startsWith('--')) {
      out[k] = argv[i + 1];
      i += 1;
    } else {
      out[k] = true;
    }
  }
  return out;
}

const args = parseArgs(process.argv);
const URL_STR = String(args.url || 'http://127.0.0.1:5000');
const ROUTE = String(args.route || '/api/health/livez');
const METHOD = String(args.method || 'GET').toUpperCase();
const BODY = args.body ? String(args.body) : null;
const DURATION_S = Number(args.duration || 10);
const CONCURRENCY = Math.max(1, Math.min(64, Number(args.concurrency || 4)));
const ALLOW_PUBLIC = Boolean(args['allow-public']);

const u = new URL(URL_STR);
const HOST = u.hostname;
const PORT = Number(u.port || (u.protocol === 'https:' ? 443 : 80));
const PATH_AND_QUERY = (ROUTE.startsWith('/') ? ROUTE : `/${ROUTE}`) +
  (u.pathname && u.pathname !== '/' ? u.pathname : '') +
  (u.search || '');

if (!ALLOW_PUBLIC && HOST !== '127.0.0.1' && HOST !== 'localhost' && HOST !== '::1') {
  // eslint-disable-next-line no-console
  console.error(
    `[load-test] refusing to target non-loopback host "${HOST}". ` +
      'Pass --allow-public to override. This is a safety guard.',
  );
  process.exit(2);
}

if (ROUTE.includes('/api/auth/refresh')) {
  // eslint-disable-next-line no-console
  console.error(
    '[load-test] refusing to call /api/auth/refresh from a load test. ' +
      'It would create real sessions and risk triggering reuse detection.',
  );
  process.exit(2);
}

if (BODY && (BODY.includes('refreshToken') || BODY.includes('passwordHash'))) {
  // eslint-disable-next-line no-console
  console.error(
    '[load-test] refusing to send refreshToken or passwordHash in a load test body. ' +
      'Use a non-credential test endpoint.',
  );
  process.exit(2);
}

// ---------------------------------------------------------------------------
// Worker
// ---------------------------------------------------------------------------

if (!isMainThread) {
  const { startTime, durationMs } = workerData;
  let count = 0;
  let errors = 0;
  const latencies = [];

  // Persistent agent per worker so connections are reused.
  const agent = new http.Agent({ keepAlive: true, maxSockets: 1 });

  function fire() {
    const t0 = process.hrtime.bigint();
    const req = http.request(
      {
        host: HOST,
        port: PORT,
        method: METHOD,
        path: PATH_AND_QUERY,
        agent,
        headers: BODY
          ? { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(BODY) }
          : {},
      },
      (res) => {
        res.on('data', () => {});
        res.on('end', () => {
          const dt = Number(process.hrtime.bigint() - t0) / 1e6;
          latencies.push(dt);
          if (res.statusCode >= 500) errors += 1;
          count += 1;
          loop();
        });
      },
    );
    req.on('error', () => {
      errors += 1;
      count += 1;
      loop();
    });
    if (BODY) req.write(BODY);
    req.end();
  }

  function loop() {
    const elapsed = Date.now() - startTime;
    if (elapsed >= durationMs) {
      const sorted = latencies.slice().sort((a, b) => a - b);
      const p = (q) => (sorted.length === 0 ? 0 : sorted[Math.floor((sorted.length - 1) * q)]);
      parentPort.postMessage({
        count,
        errors,
        latencies: sorted,
        p50: p(0.5),
        p95: p(0.95),
        p99: p(0.99),
      });
      return;
    }
    fire();
  }

  // Kick off.
  loop();
} else {
  // -------------------------------------------------------------------------
  // Main thread
  // -------------------------------------------------------------------------

  (async () => {
    const startTime = Date.now();
    const durationMs = DURATION_S * 1000;

    // eslint-disable-next-line no-console
    console.log(
      `[load-test] starting: url=${URL_STR} path=${PATH_AND_QUERY} method=${METHOD} ` +
        `concurrency=${CONCURRENCY} duration=${DURATION_S}s`,
    );

    const workers = [];
    for (let i = 0; i < CONCURRENCY; i += 1) {
      const w = new Worker(__filename, {
        workerData: { startTime, durationMs },
      });
      workers.push(w);
    }

    let total = 0;
    let totalErrors = 0;
    const allLatencies = [];

    await Promise.all(
      workers.map(
        (w) =>
          new Promise((resolve) => {
            w.on('message', (m) => {
              total += m.count;
              totalErrors += m.errors;
              for (const l of m.latencies) allLatencies.push(l);
              resolve();
            });
            w.on('error', () => resolve());
            w.on('exit', () => resolve());
          }),
      ),
    );

    const elapsed = (Date.now() - startTime) / 1000;
    const rps = total / elapsed;
    allLatencies.sort((a, b) => a - b);
    const p = (q) =>
      allLatencies.length === 0
        ? 0
        : allLatencies[Math.floor((allLatencies.length - 1) * q)];

    // eslint-disable-next-line no-console
    console.log(`[load-test] done in ${elapsed.toFixed(2)}s`);
    // eslint-disable-next-line no-console
    console.log(
      `[load-test] requests=${total} errors=${totalErrors} rps=${rps.toFixed(1)} ` +
        `p50=${p(0.5).toFixed(1)}ms p95=${p(0.95).toFixed(1)}ms p99=${p(0.99).toFixed(1)}ms`,
    );

    if (process.env.LOAD_TEST_LOG_BODY === 'true' && BODY) {
      // eslint-disable-next-line no-console
      console.log(`[load-test] body=${BODY}`);
    }
  })();
}
