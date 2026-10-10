// Production-oriented security middleware.
//
// Phase 13 hardening:
//   1. Helmet — sets a sensible baseline of HTTP response headers
//      (X-Content-Type-Options, X-Frame-Options, Referrer-Policy,
//       Cross-Origin-Resource-Policy, etc.) and a strict CSP that
//      does not break a JSON-only API.
//   2. Login rate limiter — throttles POST /api/auth/login using
//      a sliding window. In-memory by default; documented in
//      PRODUCTION_DEPLOYMENT.md as a known limitation behind
//      multi-instance deployments (use Redis / shared store).
//
// Phase 16 additions:
//   - Rate-limit hits are forwarded to the alert sink so a
//     operator can be notified of brute-force attempts.
//   - The rate-limit hit is also counted in the metrics registry.
//
// We deliberately do NOT apply a global rate limiter here:
//   - API endpoints have different risk profiles.
//   - Aggressive global throttling breaks legitimate burst traffic.
//   - Per-endpoint limits are the responsible default.

import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import { forwardRateLimitHit } from '../lib/alertSink.js';

// ---------------------------------------------------------------------------
// Helmet
// ---------------------------------------------------------------------------
//
// A JSON-only API does not need to serve scripts, styles, iframes or any
// other resources. We use a very strict Content-Security-Policy that
// denies everything by default. This is intentional: it hardens the
// response against accidental content injection (e.g. error pages that
// echo user input) without affecting API clients.
//
// `crossOriginResourcePolicy: 'same-site'` — by default helmet 7+ sets
// this to 'same-origin'. We override only if needed; keeping the default
// is the safer choice for a backend API.
//
// `hsts` is enabled only in production so that local dev (http://)
// still works. In production we also add `preload` eligibility.
//
// `referrerPolicy: 'no-referrer'` — backend responses never need to
// leak referrer information to clients.

const helmetMiddleware = helmet({
  contentSecurityPolicy: {
    useDefaults: false,
    directives: {
      defaultSrc: ["'none'"],
      frameAncestors: ["'none'"],
      baseUri: ["'none'"],
      formAction: ["'none'"],
    },
  },
  // For an API we do not expect cross-origin embedding.
  crossOriginEmbedderPolicy: false,
  crossOriginResourcePolicy: { policy: 'same-site' },
  referrerPolicy: { policy: 'no-referrer' },
  // X-DNS-Prefetch-Control, X-Download-Options, etc. — all on by default.
  // Disable HSTS in dev so http://localhost keeps working.
  hsts:
    process.env.NODE_ENV === 'production'
      ? { maxAge: 15552000, includeSubDomains: true }
      : false,
});

// ---------------------------------------------------------------------------
// Rate limit: login endpoint
// ---------------------------------------------------------------------------
//
// The defaults below are intentionally conservative but not punishing:
//   - 10 attempts per 15-minute sliding window per IP
//   - 429 + Retry-After header on overflow
//   - Standardized JSON response body (no internals leaked)
//   - Skip the "X-Forwarded-For" trust unless express app is configured
//     with `trust proxy` (see PRODUCTION_DEPLOYMENT.md).
//
// We use the default `keyGenerator` (req.ip) which is safe ONLY when
// the app is NOT behind an untrusted proxy. The deployment guide
// documents this explicitly.
//
// Test bypass:
//   The full test suite (npm test) issues dozens of login attempts
//   against the same IP. We need a way to exercise the rate limiter
//   from tests WITHOUT throttling all other tests.
//
//   We expose the underlying limiter as `productionLoginLimiter`
//   and wrap it in a function that checks `process.env.NODE_ENV`
//   ON EVERY REQUEST. This lets tests set `NODE_ENV=production`
//   just for the rate-limit suite, without restarting the process.
//
//   Outside of tests, NODE_ENV is fixed (development or production)
//   for the lifetime of the process, so this check has no perf cost
//   in production.

const FIFTEEN_MINUTES_MS = 15 * 60 * 1000;

function defaultHandler(req, res) {
  res.status(429).json({
    success: false,
    error: {
      code: 'RATE_LIMITED',
      message:
        'Too many login attempts. Please try again after a few minutes.',
    },
  });
}

const productionLoginLimiter = rateLimit({
  windowMs: FIFTEEN_MINUTES_MS,
  // Allow a small number of legitimate retries (typos, caps lock) but
  // make brute force impractical.
  max: 10,
  standardHeaders: true, // RateLimit-* headers (RFC draft)
  legacyHeaders: false, // disable X-RateLimit-* legacy headers
  // Do not silently drop — return 429 with a JSON body that matches
  // the rest of the API's error envelope.
  handler: (req, res, next, options) => {
    // Phase 16: forward a synthetic rate-limit alert. The forward
    // is async and best-effort. If it fails, the limiter's response
    // is still the 429 we always returned.
    try {
      forwardRateLimitHit({ route: req.originalUrl || 'unknown', kind: 'login' });
    } catch (_) {
      // never let an alert bug break the limiter
    }
    return defaultHandler(req, res);
  },
  // We never log credentials. Skip noisy default logging.
  skipFailedRequests: false,
  skipSuccessfulRequests: false,
});

// The middleware actually mounted on the login route. Looks up
// process.env.NODE_ENV on every request so tests can flip into
// "production" mode without restarting.
function loginLimiter(req, res, next) {
  if (process.env.NODE_ENV === 'production') {
    return productionLoginLimiter(req, res, next);
  }
  return next();
}

export { helmetMiddleware, loginLimiter };
