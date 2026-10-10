/**
 * Helpers dùng cho route guards và LoginPage. Tách ra file riêng để oxlint
 * Fast-Refresh rule không cảnh báo khi file route vừa export component vừa
 * export helper.
 */

export const ROLE_HOME = Object.freeze({
  admin: '/admin',
  employee: '/employee',
})

/**
 * Chỉ chấp nhận path nội bộ bắt đầu bằng "/" và KHÔNG phải "//" để chặn
 * open-redirect. Trả về null nếu không hợp lệ.
 */
export function safeRedirectTarget(state) {
  const candidate = state?.from
  if (typeof candidate !== 'string') return null
  if (!candidate.startsWith('/')) return null
  if (candidate.startsWith('//')) return null
  if (candidate === '/login' || candidate === '/access-denied') return null
  return candidate
}

/** Helper điều hướng về home theo role, có fallback khi role lạ. */
export function homeForRole(role) {
  return ROLE_HOME[role] ?? '/login'
}