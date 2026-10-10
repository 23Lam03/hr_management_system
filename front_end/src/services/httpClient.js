/**
 * httpClient - thin wrapper around fetch.
 * Phase 18: real backend integration.
 *
 * Responsibilities:
 *   1. JSON encode/decode, default headers, configurable timeout.
 *   2. Attach `Authorization: Bearer <accessToken>` from tokenStore
 *      (skipped for auth endpoints to avoid stale-token loops).
 *   3. On 401, attempt exactly ONE silent refresh; if that fails,
 *      surface the 401 to the caller.
 *   4. Always send `credentials: 'include'` so future HttpOnly-
 *      cookie support is drop-in.
 *
 * The module is intentionally framework-agnostic: no React, no
 * router. Callers (services) do `httpClient.post('/foo', body)`.
 */

import tokenStore from './tokenStore.js';
import { refreshSession as refreshSessionCall } from './authService.js';

const DEFAULT_TIMEOUT_MS = 15000;

// Endpoints that must NEVER receive an Authorization header. Sending
// one with a stale token during /login is harmless but verbose; we
// skip it for clarity and to avoid edge cases in audit logs.
const AUTH_BYPASS_PATHS = new Set(['/api/auth/login', '/api/auth/refresh']);

function shouldAttachAuth(url) {
  try {
    // Normalize: allow absolute or relative URLs.
    const path = typeof url === 'string' && url.startsWith('http')
      ? new URL(url).pathname
      : url;
    return !AUTH_BYPASS_PATHS.has(path);
  } catch {
    return true;
  }
}

async function rawRequest(url, {
  method = 'GET',
  body,
  headers,
  signal,
  timeout = DEFAULT_TIMEOUT_MS,
  skipAuth = false,
} = {}) {
  const controller = new AbortController();
  const timeoutId = window.setTimeout(() => controller.abort(), timeout);

  // Compose headers. We never overwrite caller-provided values
  // other than Content-Type / Accept.
  const finalHeaders = {
    'Content-Type': 'application/json',
    Accept: 'application/json',
    ...(headers || {}),
  };
  if (!skipAuth) {
    const token = tokenStore.getAccessToken();
    if (token && shouldAttachAuth(url)) {
      finalHeaders.Authorization = `Bearer ${token}`;
    }
  }

  try {
    const response = await fetch(url, {
      method,
      headers: finalHeaders,
      body: body ? JSON.stringify(body) : undefined,
      signal: signal ?? controller.signal,
      credentials: 'include',
    });
    return response;
  } finally {
    window.clearTimeout(timeoutId);
  }
}

async function parseBody(response) {
  const ct = response.headers.get('content-type') || '';
  if (ct.includes('application/json')) {
    try {
      return await response.json();
    } catch {
      return null;
    }
  }
  try {
    return await response.text();
  } catch {
    return null;
  }
}

/**
 * Build a normalized Error with status + payload.
 */
function buildHttpError(response, payload) {
  const apiCode =
    (payload && typeof payload === 'object' && payload.error && payload.error.code) ||
    null;
  const apiMessage =
    (payload && typeof payload === 'object' && payload.error && payload.error.message) ||
    `Request failed with status ${response.status}`;
  const err = new Error(apiMessage);
  err.status = response.status;
  err.code = apiCode;
  err.payload = payload;
  return err;
}

/**
 * Single-flight refresh: if multiple 401s happen at the same time,
 * only the first one triggers a refresh; the others wait for it.
 */
let inflightRefresh = null;

async function tryRefresh() {
  if (inflightRefresh) return inflightRefresh;
  const refreshToken = tokenStore.getRefreshToken();
  if (!refreshToken) return null;
  inflightRefresh = (async () => {
    try {
      const result = await refreshSessionCall();
      if (result && result.accessToken) {
        tokenStore.setTokens({
          accessToken: result.accessToken,
          refreshToken: result.refreshToken || refreshToken,
          expiresIn: result.expiresIn,
        });
        return true;
      }
      return false;
    } catch {
      return false;
    } finally {
      inflightRefresh = null;
    }
  })();
  return inflightRefresh;
}

async function request(url, options = {}) {
  // First attempt (with auth unless the caller skipped it).
  let response = await rawRequest(url, options);
  if (response.status === 401 && !options.skipAuth) {
    // Try a silent refresh, then retry once.
    const ok = await tryRefresh();
    if (ok) {
      response = await rawRequest(url, options);
    } else {
      // Refresh failed: clear tokens so AuthContext can react.
      tokenStore.clear();
      // Dispatch a custom event so the AuthProvider can update
      // its state without a circular import.
      if (typeof window !== 'undefined') {
        window.dispatchEvent(new CustomEvent('hrm:auth:expired'));
      }
    }
  }
  const payload = await parseBody(response);
  if (!response.ok) {
    throw buildHttpError(response, payload);
  }
  return payload;
}

export const httpClient = {
  get: (url, options) => request(url, { ...options, method: 'GET' }),
  post: (url, body, options) => request(url, { ...options, method: 'POST', body }),
  put: (url, body, options) => request(url, { ...options, method: 'PUT', body }),
  patch: (url, body, options) => request(url, { ...options, method: 'PATCH', body }),
  delete: (url, options) => request(url, { ...options, method: 'DELETE' }),
  /** Escape hatch for callers that need the raw Response. */
  raw: rawRequest,
};

export default httpClient;
