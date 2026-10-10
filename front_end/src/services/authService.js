/**
 * authService — Phase 18.
 *
 * Behaviour switches on `VITE_USE_MOCK`:
 *   - `VITE_USE_MOCK=true`  → keep using the in-memory DEMO_USERS
 *     fixture so the UI can still be developed without a backend.
 *   - any other value (or unset) → call the real backend through
 *     `httpClient`. This is the default and the recommended path.
 *
 * The export shape is intentionally stable so that AuthContext and
 * the LoginPage do not change between modes.
 */

import { DEMO_USERS } from '../data/demoUsers'
import httpClient from './httpClient.js'
import tokenStore from './tokenStore.js'
import { endpoints } from './endpoints.js'

const DEMO_LATENCY_MS = 350
const USE_MOCK = String(import.meta.env.VITE_USE_MOCK || '').toLowerCase() === 'true'

export const ERROR_CODES = {
  INVALID_CREDENTIALS: 'INVALID_CREDENTIALS',
  MISSING_FIELDS: 'MISSING_FIELDS',
  WRONG_CURRENT: 'WRONG_CURRENT',
  PASSWORD_TOO_SHORT: 'PASSWORD_TOO_SHORT',
  EMAIL_ALREADY_EXISTS: 'EMAIL_ALREADY_EXISTS',
  REGISTRATION_DISABLED: 'REGISTRATION_DISABLED',
  PASSWORD_MISMATCH: 'PASSWORD_MISMATCH',
  NETWORK_ERROR: 'NETWORK_ERROR',
  TOKEN_INVALID: 'TOKEN_INVALID',
  SERVER_ERROR: 'SERVER_ERROR',
}

function buildAuthError(code, message) {
  const err = new Error(message)
  err.code = code
  return err
}

function delay(ms) {
  return new Promise((resolve) => window.setTimeout(resolve, ms))
}

function stripUserForSession(user) {
  // Tuyệt đối không lưu mật khẩu vào session/localStorage.
  const { password: _password, ...safe } = user
  return safe
}

/**
 * Normalize a backend user payload into the shape the UI expects.
 * Backend: { _id, email, fullName, role, status, avatarUrl, ... }.
 * UI:      { id, email, name, role, avatarUrl }.
 */
function normalizeUser(raw) {
  if (!raw || typeof raw !== 'object') return null
  return {
    id: String(raw._id || raw.id || ''),
    email: raw.email || '',
    name: raw.fullName || raw.name || '',
    role: raw.role || 'employee',
    avatarUrl: raw.avatarUrl || null,
    status: raw.status || 'active',
  }
}

// ---------------------------------------------------------------------------
// MOCK implementations (preserved for offline development)
// ---------------------------------------------------------------------------

async function mockLogin(email, password) {
  await delay(DEMO_LATENCY_MS)
  const normalizedEmail = String(email ?? '').trim().toLowerCase()
  const normalizedPassword = String(password ?? '')

  if (!normalizedEmail || !normalizedPassword) {
    throw buildAuthError(
      ERROR_CODES.MISSING_FIELDS,
      'Vui lòng nhập đầy đủ email và mật khẩu.',
    )
  }
  const match = DEMO_USERS.find(
    (u) => u.email.toLowerCase() === normalizedEmail && u.password === normalizedPassword,
  )
  if (!match) {
    throw buildAuthError(
      ERROR_CODES.INVALID_CREDENTIALS,
      'Email hoặc mật khẩu không đúng.',
    )
  }
  return stripUserForSession(match)
}

async function mockChangePassword(userId, currentPassword, newPassword) {
  await delay(DEMO_LATENCY_MS)
  const cur = String(currentPassword ?? '')
  const next = String(newPassword ?? '')
  if (!cur || !next) {
    throw buildAuthError(ERROR_CODES.MISSING_FIELDS, 'Vui lòng nhập đầy đủ thông tin.')
  }
  if (next.length < 6) {
    throw buildAuthError(ERROR_CODES.PASSWORD_TOO_SHORT, 'Mật khẩu mới phải có ít nhất 6 ký tự.')
  }
  const idx = DEMO_USERS.findIndex((u) => u.id === userId)
  if (idx === -1) {
    throw buildAuthError(ERROR_CODES.INVALID_CREDENTIALS, 'Không tìm thấy tài khoản.')
  }
  if (DEMO_USERS[idx].password !== cur) {
    throw buildAuthError(ERROR_CODES.WRONG_CURRENT, 'Mật khẩu hiện tại không đúng.')
  }
  DEMO_USERS[idx] = { ...DEMO_USERS[idx], password: next }
  return stripUserForSession(DEMO_USERS[idx])
}

async function mockRegisterEmployee(payload) {
  await delay(DEMO_LATENCY_MS)
  const name = String(payload?.name ?? '').trim()
  const email = String(payload?.email ?? '').trim().toLowerCase()
  const password = String(payload?.password ?? '')
  const confirmPassword = String(payload?.confirmPassword ?? '')
  const phone = String(payload?.phone ?? '').trim()

  if (!name || !email || !password || !confirmPassword) {
    throw buildAuthError(ERROR_CODES.MISSING_FIELDS, 'Vui lòng nhập đầy đủ thông tin.')
  }
  if (password !== confirmPassword) {
    throw buildAuthError(ERROR_CODES.PASSWORD_MISMATCH, 'Mật khẩu xác nhận không khớp.')
  }
  if (password.length < 6) {
    throw buildAuthError(ERROR_CODES.PASSWORD_TOO_SHORT, 'Mật khẩu phải có ít nhất 6 ký tự.')
  }
  const emailExists = DEMO_USERS.some((u) => u.email.toLowerCase() === email)
  if (emailExists) {
    throw buildAuthError(ERROR_CODES.EMAIL_ALREADY_EXISTS, 'Email đã được đăng ký.')
  }
  const newUser = {
    id: `usr-emp-${String(DEMO_USERS.length + 1).padStart(3, '0')}`,
    email,
    password,
    name,
    role: 'employee',
    avatarUrl: null,
  }
  if (phone) newUser.phone = phone
  DEMO_USERS.push(newUser)
  return stripUserForSession(newUser)
}

// ---------------------------------------------------------------------------
// REAL backend implementations
// ---------------------------------------------------------------------------

function mapHttpError(err) {
  if (!err) return buildAuthError(ERROR_CODES.NETWORK_ERROR, 'Lỗi không xác định.')
  if (err.status === 401) {
    return buildAuthError(ERROR_CODES.INVALID_CREDENTIALS, err.message || 'Email hoặc mật khẩu không đúng.')
  }
  if (err.status === 400) {
    return buildAuthError(ERROR_CODES.MISSING_FIELDS, err.message || 'Thiếu thông tin.')
  }
  if (err.status === 429) {
    return buildAuthError(ERROR_CODES.SERVER_ERROR, 'Quá nhiều yêu cầu. Vui lòng thử lại sau.')
  }
  if (err.status >= 500) {
    return buildAuthError(ERROR_CODES.SERVER_ERROR, 'Máy chủ gặp sự cố. Vui lòng thử lại sau.')
  }
  // network/abort → fetch throws TypeError
  if (err.name === 'TypeError' || err.name === 'AbortError') {
    return buildAuthError(
      ERROR_CODES.NETWORK_ERROR,
      'Không thể kết nối máy chủ. Kiểm tra mạng hoặc VITE_API_BASE_URL.',
    )
  }
  return buildAuthError(err.code || ERROR_CODES.SERVER_ERROR, err.message || 'Lỗi không xác định.')
}

async function realLogin(email, password) {
  try {
    const res = await httpClient.post(endpoints.auth.login, { email, password })
    if (!res || !res.success || !res.data) {
      throw buildAuthError(ERROR_CODES.SERVER_ERROR, 'Phản hồi không hợp lệ từ máy chủ.')
    }
    const { accessToken, refreshToken, expiresIn, user } = res.data
    if (!accessToken) {
      throw buildAuthError(ERROR_CODES.SERVER_ERROR, 'Máy chủ không trả access token.')
    }
    tokenStore.setTokens({ accessToken, refreshToken, expiresIn })
    return normalizeUser(user)
  } catch (err) {
    throw mapHttpError(err)
  }
}

async function realRefresh() {
  const refreshToken = tokenStore.getRefreshToken()
  if (!refreshToken) {
    throw buildAuthError(ERROR_CODES.TOKEN_INVALID, 'Không có refresh token.')
  }
  // POST /api/auth/refresh with the refresh token in the BODY.
  // We bypass the httpClient wrapper to avoid attaching the
  // (about-to-expire) access token or triggering a refresh loop.
  const res = await httpClient.post(
    endpoints.auth.refresh,
    { refreshToken },
    { skipAuth: true },
  )
  if (!res || !res.success || !res.data || !res.data.accessToken) {
    throw buildAuthError(ERROR_CODES.TOKEN_INVALID, 'Refresh token không hợp lệ.')
  }
  return {
    accessToken: res.data.accessToken,
    refreshToken: res.data.refreshToken || refreshToken,
    expiresIn: res.data.expiresIn,
  }
}

async function realLogout() {
  const refreshToken = tokenStore.getRefreshToken()
  if (!refreshToken) {
    tokenStore.clear()
    return { refreshSessionRevoked: false }
  }
  try {
    const res = await httpClient.post(endpoints.auth.logout, { refreshToken })
    tokenStore.clear()
    return res && res.data ? res.data : { refreshSessionRevoked: true }
  } catch (err) {
    // Even on error, clear the in-memory tokens so the UI logs out.
    tokenStore.clear()
    return { refreshSessionRevoked: false, error: err.message }
  }
}

async function realChangePassword(userId, currentPassword, newPassword) {
  // Backend does NOT expose a "change password while logged in"
  // endpoint in Phase 14. We surface this as a known limitation
  // rather than silently calling a wrong endpoint.
  void userId
  void currentPassword
  void newPassword
  throw buildAuthError(
    'NOT_IMPLEMENTED',
    'Đổi mật khẩu qua API chưa được triển khai ở backend (sẽ bổ sung ở phase sau).',
  )
}

async function realRegisterEmployee(payload) {
  // Backend does NOT expose a public registration endpoint in the
  // current Phase. Surfacing this prevents silent failures.
  void payload
  throw buildAuthError(
    'NOT_IMPLEMENTED',
    'Đăng ký tài khoản qua API chưa được triển khai ở backend (sẽ bổ sung ở phase sau).',
  )
}

// ---------------------------------------------------------------------------
// Public API (same shape for both modes)
// ---------------------------------------------------------------------------

export async function login(email, password) {
  return USE_MOCK ? mockLogin(email, password) : realLogin(email, password)
}

/**
 * Refresh the current session. Returns the new access token shape.
 * Throws on failure (caller should log the user out).
 */
export async function refreshSession() {
  if (USE_MOCK) {
    // No refresh flow in mock mode; just return whatever we have.
    return null
  }
  return realRefresh()
}

export async function logout() {
  if (USE_MOCK) return null
  return realLogout()
}

export async function changePassword(userId, currentPassword, newPassword) {
  return USE_MOCK
    ? mockChangePassword(userId, currentPassword, newPassword)
    : realChangePassword(userId, currentPassword, newPassword)
}

export async function registerEmployee(payload) {
  return USE_MOCK ? mockRegisterEmployee(payload) : realRegisterEmployee(payload)
}

/**
 * Dev helper: return demo accounts for the "fill credentials" button.
 * Only available when USE_MOCK=true; in real mode we return an empty
 * array so the UI button is hidden.
 */
export function getDemoAccounts() {
  if (!USE_MOCK) return []
  return DEMO_USERS.map((u) => ({
    email: u.email,
    password: u.password,
    role: u.role,
    name: u.name,
  }))
}

export { USE_MOCK }
