// Input validation for auth endpoints.
//
// Design notes:
// - All validators are pure functions that return either a sanitized
//   payload or an Error with a `status` and `code`. They never throw
//   unexpected exceptions; controllers can map them to HTTP responses
//   in a single place.
// - Email is normalized the same way the User schema normalizes it
//   (trim + lowercase) so the login lookup matches unique index.
// - We do NOT leak details about which field is wrong for security-
//   sensitive endpoints (login). The login controller can decide to
//   return a generic message; the validator still surfaces the
//   field-level error for development/test purposes.

const EMAIL_RE = /^\S+@\S+\.\S+$/;

/**
 * Validate login payload.
 * @param {unknown} payload
 * @returns {{ value: { email: string, password: string } } | { error: { status, code, message, field? } }}
 */
export function validateLoginPayload(payload) {
  if (!payload || typeof payload !== 'object') {
    return {
      error: { status: 400, code: 'BAD_REQUEST', message: 'Request body must be an object' },
    };
  }
  const body = payload;
  const rawEmail = body.email;
  const rawPassword = body.password;

  if (typeof rawEmail !== 'string' || rawEmail.trim().length === 0) {
    return {
      error: { status: 400, code: 'VALIDATION_ERROR', field: 'email', message: 'email is required' },
    };
  }
  if (!EMAIL_RE.test(rawEmail.trim())) {
    return {
      error: { status: 400, code: 'VALIDATION_ERROR', field: 'email', message: 'email is not valid' },
    };
  }
  if (typeof rawPassword !== 'string' || rawPassword.length === 0) {
    return {
      error: { status: 400, code: 'VALIDATION_ERROR', field: 'password', message: 'password is required' },
    };
  }

  return {
    value: {
      email: rawEmail.trim().toLowerCase(),
      password: rawPassword,
    },
  };
}

/**
 * Validate refresh-token payload.
 * @param {unknown} payload
 * @returns {{ value: { refreshToken: string } } | { error: { status, code, message, field? } }}
 */
export function validateRefreshPayload(payload) {
  if (!payload || typeof payload !== 'object') {
    return {
      error: { status: 400, code: 'BAD_REQUEST', message: 'Request body must be an object' },
    };
  }
  const body = payload;
  const raw = body.refreshToken;
  if (typeof raw !== 'string' || raw.trim().length === 0) {
    return {
      error: {
        status: 400,
        code: 'VALIDATION_ERROR',
        field: 'refreshToken',
        message: 'refreshToken is required',
      },
    };
  }
  // The refresh token is a 64-char hex string (32 random bytes).
  // We do a soft format check here; the service still re-hashes and
  // checks against the database.
  if (!/^[a-f0-9]{64}$/i.test(raw.trim())) {
    return {
      error: {
        status: 400,
        code: 'VALIDATION_ERROR',
        field: 'refreshToken',
        message: 'refreshToken is not in the expected format',
      },
    };
  }
  return { value: { refreshToken: raw.trim() } };
}