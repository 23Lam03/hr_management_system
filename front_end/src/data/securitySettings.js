/**
 * Mock Security Settings cho AD-HRM11 (Phần 16).
 *
 * LƯU Ý QUAN TRỌNG:
 * - Đây chỉ là mock configuration để demo UI.
 * - KHÔNG áp dụng vào authentication backend.
 * - KHÔNG tạo password, token, OTP hay bất kỳ dữ liệu nhạy cảm nào.
 */

export const SECURITY_SETTINGS = {
  id: 'security-settings-001',

  passwordPolicy: {
    minLength: 8,
    requireUppercase: true,
    requireLowercase: true,
    requireNumber: true,
    requireSpecialCharacter: true,
    passwordExpiryEnabled: false,
    passwordExpiryDays: 90,
  },

  loginSecurity: {
    failedLoginLimitEnabled: true,
    failedLoginLimit: 5,
    accountLockoutEnabled: true,
    lockoutDurationMinutes: 15,
  },

  sessionSecurity: {
    sessionTimeoutEnabled: true,
    sessionTimeoutMinutes: 30,
  },

  twoFactorAuthentication: {
    enabled: false,
  },

  notifications: {
    securityNotificationEnabled: true,
  },

  updatedAt: '2026-10-02T08:30:00',
  updatedBy: 'usr-admin-001',
}

export const SECURITY_ACTIVITY_TYPES = [
  { value: 'login',                   label: 'Đăng nhập' },
  { value: 'logout',                  label: 'Đăng xuất' },
  { value: 'password_change',         label: 'Thay đổi mật khẩu' },
  { value: 'security_setting_update', label: 'Thay đổi thiết lập bảo mật' },
  { value: 'account_lock',            label: 'Khóa tài khoản' },
  { value: 'account_unlock',          label: 'Mở khóa tài khoản' },
]

export const SECURITY_ACTIVITY_TYPE_LABEL = SECURITY_ACTIVITY_TYPES.reduce((acc, t) => {
  acc[t.value] = t.label
  return acc
}, {})

export const SECURITY_ACTIVITY_STATUSES = [
  { value: 'success', label: 'Thành công', tone: 'success' },
  { value: 'failed',  label: 'Thất bại',   tone: 'danger' },
]

export const SECURITY_ACTIVITY_STATUS_LABEL = SECURITY_ACTIVITY_STATUSES.reduce((acc, s) => {
  acc[s.value] = s.label
  return acc
}, {})

export const SECURITY_ACTIVITY_STATUS_TONE = SECURITY_ACTIVITY_STATUSES.reduce((acc, s) => {
  acc[s.value] = s.tone
  return acc
}, {})