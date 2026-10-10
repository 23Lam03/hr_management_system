/**
 * tokenStore.js — in-memory token storage (Phase 18).
 *
 * Stores the access token and refresh token ONLY in the JavaScript
 * runtime. Nothing is persisted to localStorage, sessionStorage,
 * IndexedDB, cookies, or any other storage that survives a page
 * reload.
 *
 * Trade-offs:
 *   - Pros: not vulnerable to XSS-driven persistent exfiltration
 *     (a long-lived token cannot be lifted from disk and re-used
 *     later), and not vulnerable to physical-access token theft
 *     from a developer's machine after closing the tab.
 *   - Cons: a page refresh logs the user out (they must re-login
 *     or trigger a silent refresh). For SPA workflows where users
 *     expect to stay signed in across reloads, this is a UX cost.
 *
 * Security note: the refresh token is also stored here, even though
 * the original Phase 18 plan preferred HttpOnly cookies. The current
 * backend (Phase 14) returns the refresh token in the JSON body, so
 * we have no choice but to keep it in JS memory. This means BOTH
 * tokens are exposed to the page's JavaScript context; an active
 * XSS could exfiltrate them. Operators wanting HttpOnly cookies
 * must extend the backend to set them on the login/refresh
 * response (out of Phase 18 scope).
 *
 * The store is a plain singleton; no React state, no context.
 * Components that need to know "are we authenticated?" should read
 * the AuthContext value (which is updated by login/logout), not
 * poll this module.
 */

let accessToken = null;
let refreshToken = null;
let expiresAt = 0; // epoch ms; 0 = unknown / no token

export const tokenStore = {
  getAccessToken() {
    return accessToken;
  },
  getRefreshToken() {
    return refreshToken;
  },
  getExpiresAt() {
    return expiresAt;
  },
  isAuthenticated() {
    return Boolean(accessToken);
  },
  /**
   * Replace both tokens in one atomic call. `expiresIn` is the
   * access-token lifetime in seconds (matches the backend response).
   * If `expiresIn` is missing, the store treats the token as
   * long-lived (no proactive refresh).
   */
  setTokens({ accessToken: a, refreshToken: r, expiresIn } = {}) {
    accessToken = a || null;
    refreshToken = r || null;
    if (typeof expiresIn === 'number' && Number.isFinite(expiresIn) && expiresIn > 0) {
      // Refresh slightly before the server-side expiry to avoid
      // a race. 30 seconds is a safe margin.
      const SAFETY_MS = 30_000;
      expiresAt = Date.now() + expiresIn * 1000 - SAFETY_MS;
    } else {
      expiresAt = 0;
    }
  },
  clear() {
    accessToken = null;
    refreshToken = null;
    expiresAt = 0;
  },
  /**
   * Return ms until the access token should be proactively
   * refreshed. Returns Infinity if no token / no known expiry.
   */
  msUntilRefresh() {
    if (!accessToken || !expiresAt) return Infinity;
    return Math.max(0, expiresAt - Date.now());
  },
};

export default tokenStore;
