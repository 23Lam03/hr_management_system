/**
 * securityService - mock service cho Security Management (Phần 16).
 *
 * - In-memory mock, pub-sub để UI bump tick.
 * - Không gọi API thật.
 * - KHÔNG lưu password / token / OTP.
 * - Thiết kế để có thể thay sang REST API sau này.
 */

import {
  SECURITY_SETTINGS as SEED_SETTINGS,
  SECURITY_ACTIVITY_TYPES,
  SECURITY_ACTIVITY_STATUSES,
  SECURITY_ACTIVITY_TYPE_LABEL,
  SECURITY_ACTIVITY_STATUS_LABEL,
  SECURITY_ACTIVITY_STATUS_TONE,
} from '../data/securitySettings'
import { SECURITY_ACTIVITIES as SEED_ACTIVITIES } from '../data/securityActivities'
import { createNotification } from './notificationService'

let settings = cloneSettings(SEED_SETTINGS)
let activities = SEED_ACTIVITIES.map((a) => ({ ...a }))

const listeners = new Set()
function notify(eventType, payload) {
  for (const cb of listeners) {
    try { cb({ type: eventType, payload }) } catch (_e) { void _e }
  }
}

export function subscribeSecurity(cb) {
  listeners.add(cb)
  return () => listeners.delete(cb)
}

function cloneSettings(s) {
  return {
    ...s,
    passwordPolicy: { ...s.passwordPolicy },
    loginSecurity: { ...s.loginSecurity },
    sessionSecurity: { ...s.sessionSecurity },
    twoFactorAuthentication: { ...s.twoFactorAuthentication },
    notifications: { ...s.notifications },
  }
}

// ---------- Lookups -------------------------------------------------------

export function getSecurityActivityTypes() {
  return [
    { value: 'login',                   label: 'Đăng nhập' },
    { value: 'logout',                  label: 'Đăng xuất' },
    { value: 'password_change',         label: 'Thay đổi mật khẩu' },
    { value: 'security_setting_update', label: 'Thay đổi thiết lập bảo mật' },
    { value: 'account_lock',            label: 'Khóa tài khoản' },
    { value: 'account_unlock',          label: 'Mở khóa tài khoản' },
  ]
}

export function getSecurityActivityStatuses() {
  return [
    { value: 'success', label: 'Thành công' },
    { value: 'failed',  label: 'Thất bại' },
  ]
}

export function getSecurityActivityTypeLabel(v) {
  return SECURITY_ACTIVITY_TYPE_LABEL[v] ?? v
}

export function getSecurityActivityStatusLabel(v) {
  return SECURITY_ACTIVITY_STATUS_LABEL[v] ?? v
}

export function getSecurityActivityStatusTone(v) {
  return SECURITY_ACTIVITY_STATUS_TONE[v] ?? 'neutral'
}

void SECURITY_ACTIVITY_TYPES
void SECURITY_ACTIVITY_STATUSES

// ---------- Reads ---------------------------------------------------------

export function getSecuritySettings() {
  return cloneSettings(settings)
}

export function getSecurityActivities() {
  return activities
    .map((a) => ({ ...a }))
    .sort((a, b) => (b.createdAt || '').localeCompare(a.createdAt || ''))
}

export function getSecurityActivityById(id) {
  const found = activities.find((a) => a.id === id)
  return found ? { ...found } : null
}

export function getRecentSecurityActivities(limit = 5) {
  return getSecurityActivities().slice(0, limit)
}

// ---------- Query / Filter ------------------------------------------------

export function querySecurityActivities(q = {}) {
  const {
    search = '',
    type = '',
    status = '',
    sortBy = 'createdAt',
    sortDir = 'desc',
    page = 1,
    pageSize = 10,
  } = q
  const searchLow = String(search ?? '').trim().toLowerCase()
  let rows = getSecurityActivities()
  if (type) rows = rows.filter((r) => r.type === type)
  if (status) rows = rows.filter((r) => r.status === status)
  if (searchLow) {
    rows = rows.filter((r) => {
      const haystack = [
        r.actorName,
        r.actorId,
        r.description,
        r.ipAddress,
        r.type,
      ]
      return haystack.some((s) => String(s ?? '').toLowerCase().includes(searchLow))
    })
  }

  const SORTABLE = ['createdAt', 'type', 'status']
  if (SORTABLE.includes(sortBy)) {
    const sign = sortDir === 'desc' ? -1 : 1
    rows.sort((a, b) => {
      const av = a[sortBy] || ''
      const bv = b[sortBy] || ''
      return av.localeCompare(bv) * sign
    })
  }

  const total = rows.length
  const size = Math.max(1, Number(pageSize) || 10)
  const totalPages = Math.max(1, Math.ceil(total / size))
  const currentPage = Math.min(Math.max(1, Number(page) || 1), totalPages)
  const start = (currentPage - 1) * size
  return {
    items: rows.slice(start, start + size),
    total,
    page: currentPage,
    pageSize: size,
    totalPages,
  }
}

// ---------- KPI ----------------------------------------------------------

export function getSecurityKpi() {
  const totalActivities = activities.length
  const loginSuccess = activities.filter((a) => a.type === 'login' && a.status === 'success').length
  const loginFailed = activities.filter((a) => a.type === 'login' && a.status === 'failed').length

  // Đếm số "thiết lập đang bật" dựa trên cờ enabled.
  const enabledCount = [
    settings.passwordPolicy.passwordExpiryEnabled,
    settings.loginSecurity.failedLoginLimitEnabled,
    settings.loginSecurity.accountLockoutEnabled,
    settings.sessionSecurity.sessionTimeoutEnabled,
    settings.twoFactorAuthentication.enabled,
    settings.notifications.securityNotificationEnabled,
  ].filter(Boolean).length

  return { totalActivities, loginSuccess, loginFailed, enabledCount }
}

// ---------- Mutations -----------------------------------------------------

export function updateSecuritySettings(payload, actor = null) {
  const merged = mergeSettings(settings, payload)
  const errors = validateSettings(merged)
  if (Object.keys(errors).length) return Promise.resolve({ ok: false, errors })
  settings = merged
  notify('security.settings.update', { settings })

  // Best-effort: tạo activity + notification mô phỏng.
  try {
    const id = makeActivityId()
    const now = new Date().toISOString()
    const record = {
      id,
      type: 'security_setting_update',
      actorId: actor?.id ?? 'usr-admin-001',
      actorName: actor?.name ?? 'Nguyễn Minh Anh',
      description: 'Admin đã cập nhật thiết lập bảo mật hệ thống.',
      status: 'success',
      ipAddress: '192.168.1.10',
      userAgent: 'Browser (mock)',
      createdAt: now,
    }
    activities = [record, ...activities]
    notify('security.activity.create', { activity: record })

    try {
      void createNotification({
        title: 'Thiết lập bảo mật đã được cập nhật',
        message: 'Thiết lập bảo mật hệ thống vừa được cập nhật bởi Admin.',
        type: 'system',
        priority: 'normal',
        recipientType: 'admin',
        recipientId: actor?.id ?? 'usr-admin-001',
        relatedEntityType: null,
        relatedEntityId: null,
      })
    } catch (_e) { void _e }
  } catch (_e) { void _e }

  return Promise.resolve({ ok: true, settings })
}

function mergeSettings(current, payload) {
  return cloneSettings({
    ...current,
    ...payload,
    id: current.id,
    passwordPolicy: { ...current.passwordPolicy, ...(payload.passwordPolicy ?? {}) },
    loginSecurity: { ...current.loginSecurity, ...(payload.loginSecurity ?? {}) },
    sessionSecurity: { ...current.sessionSecurity, ...(payload.sessionSecurity ?? {}) },
    twoFactorAuthentication: {
      ...current.twoFactorAuthentication,
      ...(payload.twoFactorAuthentication ?? {}),
    },
    notifications: { ...current.notifications, ...(payload.notifications ?? {}) },
    updatedAt: new Date().toISOString(),
    updatedBy: payload.updatedBy ?? current.updatedBy,
  })
}

// ---------- Validate ------------------------------------------------------

function validateSettings(s) {
  const errors = {}
  const pp = s.passwordPolicy
  if (!Number.isFinite(pp.minLength) || pp.minLength < 1) {
    errors['passwordPolicy.minLength'] = 'Độ dài tối thiểu phải lớn hơn 0.'
  }
  if (pp.passwordExpiryEnabled && (!Number.isFinite(pp.passwordExpiryDays) || pp.passwordExpiryDays < 1)) {
    errors['passwordPolicy.passwordExpiryDays'] = 'Số ngày hết hạn phải lớn hơn 0.'
  }
  const ls = s.loginSecurity
  if (ls.failedLoginLimitEnabled && (!Number.isFinite(ls.failedLoginLimit) || ls.failedLoginLimit < 1)) {
    errors['loginSecurity.failedLoginLimit'] = 'Số lần đăng nhập thất bại tối đa phải lớn hơn 0.'
  }
  if (ls.accountLockoutEnabled && (!Number.isFinite(ls.lockoutDurationMinutes) || ls.lockoutDurationMinutes < 1)) {
    errors['loginSecurity.lockoutDurationMinutes'] = 'Thời gian khóa phải lớn hơn 0 phút.'
  }
  const ss = s.sessionSecurity
  if (ss.sessionTimeoutEnabled && (!Number.isFinite(ss.sessionTimeoutMinutes) || ss.sessionTimeoutMinutes < 1)) {
    errors['sessionSecurity.sessionTimeoutMinutes'] = 'Thời gian phiên phải lớn hơn 0 phút.'
  }
  return errors
}

// ---------- ID gen --------------------------------------------------------

function makeActivityId() {
  let max = 0
  for (const a of activities) {
    const m = /^security-activity-(\d+)$/.exec(a.id || '')
    if (m) {
      const v = parseInt(m[1], 10)
      if (v > max) max = v
    }
  }
  return `security-activity-${String(max + 1).padStart(3, '0')}`
}