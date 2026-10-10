// Auth middleware: `protect` and `authorize`.
//
// protect:
//   1. Reads Authorization header.
//   2. Requires "Bearer <token>" format.
//   3. Verifies the JWT with JWT_SECRET.
//   4. Re-loads the user from the database to ensure the account
//      still exists and is still active. This means changing role or
//      status in the database takes effect on the next request, even
//      if the token is still valid.
//   5. Attaches the user to req.user (no passwordHash, by virtue of
//      the User schema's toJSON).
//
// authorize(...roles):
//   - Must be used AFTER `protect`.
//   - Returns 401 if req.user is missing (defensive; protect normally
//     rejects first).
//   - Returns 403 if the user's role is not in the allow list.
//
// Errors thrown here carry `status` and `code` so the centralized
// error handler formats the response consistently.

import {
  verifyAuthToken,
  loadActiveUserById,
} from '../services/auth.service.js';
import { USER_ROLES } from '../models/user.model.js';

const BEARER_RE = /^Bearer\s+(.+)$/i;

/**
 * Middleware factory: require a valid Bearer token and load the user.
 */
export async function protect(req, res, next) {
  try {
    const authHeader = req.headers && req.headers.authorization;
    if (!authHeader || typeof authHeader !== 'string') {
      return res.status(401).json({
        success: false,
        error: { code: 'AUTH_MISSING', message: 'Authorization header is required' },
      });
    }

    const match = BEARER_RE.exec(authHeader.trim());
    if (!match) {
      return res.status(401).json({
        success: false,
        error: {
          code: 'AUTH_FORMAT',
          message: 'Authorization header must be in the form: Bearer <token>',
        },
      });
    }
    const token = match[1].trim();
    if (token.length === 0) {
      return res.status(401).json({
        success: false,
        error: { code: 'AUTH_MISSING', message: 'Bearer token is empty' },
      });
    }

    const { payload, error: verifyError } = verifyAuthToken(token);
    if (verifyError) {
      return res.status(401).json({
        success: false,
        error: { code: verifyError.code, message: verifyError.message },
      });
    }
    if (!payload || !payload.sub) {
      return res.status(401).json({
        success: false,
        error: { code: 'TOKEN_INVALID', message: 'Token payload is missing subject' },
      });
    }

    const { user, error: loadError } = await loadActiveUserById(payload.sub);
    if (loadError) {
      return res.status(loadError.status || 401).json({
        success: false,
        error: { code: loadError.code, message: loadError.message },
      });
    }

    // Attach user. We use a plain object so req.user is JSON-serializable
    // and contains no passwordHash. toJSON() is the single source of
    // truth for what's safe to expose.
    req.user = user.toJSON();

    // Phase 14: also expose the JWT claims (sub, role, jti) so
    // controllers (e.g. logout) can locate the session without
    // re-decoding the token. We do NOT trust any of these fields
    // for authorization — the role check still uses req.user.role,
    // which is loaded fresh from the database.
    req.auth = {
      sub: payload.sub,
      role: payload.role,
      jti: payload.jti || null,
      iat: payload.iat,
      exp: payload.exp,
    };
    return next();
  } catch (err) {
    // Defensive: any unexpected error in the middleware itself.
    return next(err);
  }
}

/**
 * Middleware factory: allow only listed roles.
 *
 * Usage:
 *   router.get('/admin-only', protect, authorize('admin'), handler);
 *
 * The role check uses req.user.role, which was loaded fresh from
 * the database by the `protect` middleware. This means a role
 * change in the database takes effect immediately, even if the
 * token is still valid.
 */
export function authorize(...allowedRoles) {
  // Defensive copy + filter to known enum values.
  const validRoles = USER_ROLES;
  const allow = allowedRoles.filter((r) => validRoles.includes(r));

  return function authorizeMiddleware(req, res, next) {
    if (!req.user) {
      return res.status(401).json({
        success: false,
        error: { code: 'AUTH_REQUIRED', message: 'Authentication is required' },
      });
    }
    if (allow.length === 0) {
      // Misconfiguration: no valid roles listed. Fail closed.
      return res.status(403).json({
        success: false,
        error: { code: 'FORBIDDEN', message: 'Access denied' },
      });
    }
    if (!allow.includes(req.user.role)) {
      return res.status(403).json({
        success: false,
        error: {
          code: 'FORBIDDEN',
          message: 'You do not have permission to access this resource',
        },
      });
    }
    return next();
  };
}