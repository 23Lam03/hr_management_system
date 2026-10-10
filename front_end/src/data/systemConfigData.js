/**
 * Mock default configuration cho System Configuration (AD-HRM13).
 *
 * Lưu ý:
 * - Đây là cấu hình mock phục cho UI frontend.
 * - KHÔNG đặt business rule nào tại đây (tax/insurance/salary/leave/policy).
 * - KHÔNG chứa thông tin nhạy cảm (password, token, secret, apiKey).
 */

export const DEFAULT_SYSTEM_CONFIG = Object.freeze({
  id: 'system-config-001',

  general: {
    companyName: 'HR Management System',
    companyEmail: 'hr@example.com',
    companyPhone: '',
    address: '',
  },

  localization: {
    language: 'vi',
    timezone: 'Asia/Ho_Chi_Minh',
    dateFormat: 'DD/MM/YYYY',
    currency: 'VND',
  },

  appearance: {
    theme: 'light',
    compactMode: false,
    sidebarCollapsed: false,
  },

  notifications: {
    inAppEnabled: true,
    emailEnabled: false,
  },

  system: {
    allowEmployeeRegistration: true,
    maintenanceMode: false,
  },

  // metadata
  updatedAt: '2026-01-01T08:00:00+07:00',
  updatedBy: 'admin-001',
})

/** Section metadata - thứ tự, label, icon, mô tả */
export const CONFIG_SECTIONS = [
  {
    id: 'general',
    label: 'General',
    description: 'Thông tin chung của doanh nghiệp.',
  },
  {
    id: 'localization',
    label: 'Localization',
    description: 'Ngôn ngữ, múi giờ, định dạng ngày và tiền tệ.',
  },
  {
    id: 'appearance',
    label: 'Appearance',
    description: 'Giao diện, theme của hệ thống.',
  },
  {
    id: 'notifications',
    label: 'Notifications',
    description: 'Các kênh nhận thông báo.',
  },
  {
    id: 'system',
    label: 'System',
    description: 'Thiết lập hành vi hệ thống.',
  },
]

/** Localized labels cho UI */
export const LANGUAGES = [
  { value: 'vi', label: 'Tiếng Việt' },
  { value: 'en', label: 'English' },
]

export const TIMEZONES = [
  { value: 'Asia/Ho_Chi_Minh', label: 'Asia/Ho_Chi_Minh (GMT+7)' },
  { value: 'UTC', label: 'UTC (GMT+0)' },
]

export const DATE_FORMATS = [
  { value: 'DD/MM/YYYY', label: 'DD/MM/YYYY' },
  { value: 'MM/DD/YYYY', label: 'MM/DD/YYYY' },
  { value: 'YYYY-MM-DD', label: 'YYYY-MM-DD' },
]

export const CURRENCIES = [
  { value: 'VND', label: 'VND - Việt Nam Đồng' },
  { value: 'USD', label: 'USD - US Dollar' },
]

export const THEMES = [
  { value: 'light', label: 'Light' },
  { value: 'dark', label: 'Dark' },
]