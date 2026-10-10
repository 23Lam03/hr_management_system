/**
 * notificationService - quản lý thông báo (Phần 14).
 *
 * Nguyên tắc:
 * - Mock data in-memory, pub-sub để UI bump tick.
 * - Mọi thao tác đều trả Promise (mô phỏng REST API).
 * - Thiết kế giống các service khác trong dự án (payroll, training...).
 */

import {
  NOTIFICATIONS as SEED_NOTIFICATIONS,
  NOTIFICATION_TYPES,
  NOTIFICATION_PRIORITIES,
  NOTIFICATION_TYPE_LABEL,
  NOTIFICATION_PRIORITY_LABEL,
  NOTIFICATION_PRIORITY_TONE,
} from '../data/notifications'

let notifications = SEED_NOTIFICATIONS.map((n) => ({ ...n }))

const listeners = new Set()
function notify(eventType, payload) {
  for (const cb of listeners) {
    try { cb({ type: eventType, payload }) } catch (_e) { void _e }
  }
}

export function subscribeNotifications(cb) {
  listeners.add(cb)
  return () => listeners.delete(cb)
}

// ---------- Lookups -------------------------------------------------------

export function getNotificationTypes() {
  return [
    { value: 'system',     label: 'Hệ thống' },
    { value: 'leave',      label: 'Nghỉ phép' },
    { value: 'payroll',    label: 'Bảng lương' },
    { value: 'evaluation', label: 'Đánh giá' },
    { value: 'training',   label: 'Đào tạo' },
    { value: 'benefit',    label: 'Phúc lợi' },
    { value: 'contract',   label: 'Hợp đồng' },
    { value: 'attendance', label: 'Chấm công' },
  ]
}

export function getNotificationPriorities() {
  return [
    { value: 'low',    label: 'Thấp' },
    { value: 'normal', label: 'Bình thường' },
    { value: 'high',   label: 'Cao' },
  ]
}

export function getNotificationTypeLabel(v) {
  return NOTIFICATION_TYPE_LABEL[v] ?? v
}

export function getNotificationPriorityLabel(v) {
  return NOTIFICATION_PRIORITY_LABEL[v] ?? v
}

export function getNotificationPriorityTone(v) {
  return NOTIFICATION_PRIORITY_TONE[v] ?? 'neutral'
}

void NOTIFICATION_TYPES
void NOTIFICATION_PRIORITIES

// ---------- Reads ---------------------------------------------------------

export function getNotifications() {
  return notifications
    .map((n) => ({ ...n }))
    .sort((a, b) => (b.createdAt || '').localeCompare(a.createdAt || ''))
}

export function getNotificationsByUser(userId) {
  return getNotifications().filter((n) => n.recipientId === userId)
}

export function getUnreadNotifications(userId) {
  return getNotificationsByUser(userId).filter((n) => !n.isRead)
}

export function getUnreadCount(userId) {
  return getUnreadNotifications(userId).length
}

export function getNotificationById(id) {
  return notifications.find((n) => n.id === id) ? { ...notifications.find((n) => n.id === id) } : null
}

// ---------- Mutations -----------------------------------------------------

export function createNotification(payload) {
  const errors = validateNotification(payload)
  if (Object.keys(errors).length) {
    return Promise.resolve({ ok: false, errors })
  }
  const id = makeId()
  const now = new Date().toISOString()
  const record = {
    id,
    title: payload.title.trim(),
    message: payload.message.trim(),
    type: payload.type,
    priority: payload.priority,
    recipientType: payload.recipientType ?? 'employee',
    recipientId: payload.recipientId,
    relatedEntityType: payload.relatedEntityType || null,
    relatedEntityId: payload.relatedEntityId || null,
    isRead: false,
    createdAt: now,
    readAt: null,
  }
  notifications = [record, ...notifications]
  notify('notification.create', { notification: record })
  return Promise.resolve({ ok: true, notification: record })
}

export function updateNotification(id, payload) {
  const existing = notifications.find((n) => n.id === id)
  if (!existing) {
    return Promise.resolve({ ok: false, errors: { _form: 'Không tìm thấy thông báo.' } })
  }
  const errors = validateNotification({ ...existing, ...payload })
  if (Object.keys(errors).length) return Promise.resolve({ ok: false, errors })
  const updated = {
    ...existing,
    title: payload.title.trim(),
    message: payload.message.trim(),
    type: payload.type,
    priority: payload.priority,
    recipientType: payload.recipientType ?? existing.recipientType,
    recipientId: payload.recipientId,
    relatedEntityType: payload.relatedEntityType || null,
    relatedEntityId: payload.relatedEntityId || null,
  }
  notifications = notifications.map((n) => (n.id === id ? updated : n))
  notify('notification.update', { notification: updated })
  return Promise.resolve({ ok: true, notification: updated })
}

export function markAsRead(id) {
  const existing = notifications.find((n) => n.id === id)
  if (!existing) return Promise.resolve({ ok: false, error: 'Không tìm thấy thông báo.' })
  if (existing.isRead) return Promise.resolve({ ok: true, notification: existing })
  const updated = { ...existing, isRead: true, readAt: new Date().toISOString() }
  notifications = notifications.map((n) => (n.id === id ? updated : n))
  notify('notification.read', { notification: updated })
  return Promise.resolve({ ok: true, notification: updated })
}

export function markAsUnread(id) {
  const existing = notifications.find((n) => n.id === id)
  if (!existing) return Promise.resolve({ ok: false, error: 'Không tìm thấy thông báo.' })
  if (!existing.isRead) return Promise.resolve({ ok: true, notification: existing })
  const updated = { ...existing, isRead: false, readAt: null }
  notifications = notifications.map((n) => (n.id === id ? updated : n))
  notify('notification.unread', { notification: updated })
  return Promise.resolve({ ok: true, notification: updated })
}

export function markAllAsRead(userId) {
  let count = 0
  const now = new Date().toISOString()
  notifications = notifications.map((n) => {
    if (n.recipientId === userId && !n.isRead) {
      count += 1
      return { ...n, isRead: true, readAt: now }
    }
    return n
  })
  notify('notification.read.all', { userId, count })
  return Promise.resolve({ ok: true, count })
}

export function deleteNotification(id) {
  const existing = notifications.find((n) => n.id === id)
  if (!existing) return Promise.resolve({ ok: false, error: 'Không tìm thấy thông báo.' })
  notifications = notifications.filter((n) => n.id !== id)
  notify('notification.delete', { notification: existing })
  return Promise.resolve({ ok: true })
}

// ---------- Query / Summary ----------------------------------------------

export function queryNotifications(q = {}) {
  const {
    search = '',
    type = '',
    priority = '',
    isRead = '',
    recipientId = '',
    sortBy = 'createdAt',
    sortDir = 'desc',
    page = 1,
    pageSize = 10,
  } = q
  const searchLow = search.trim().toLowerCase()
  let rows = getNotifications()
  if (searchLow) {
    rows = rows.filter((n) =>
      (n.title || '').toLowerCase().includes(searchLow) ||
      (n.message || '').toLowerCase().includes(searchLow) ||
      (n.recipientId || '').toLowerCase().includes(searchLow),
    )
  }
  if (type) rows = rows.filter((n) => n.type === type)
  if (priority) rows = rows.filter((n) => n.priority === priority)
  if (isRead === 'read') rows = rows.filter((n) => n.isRead)
  else if (isRead === 'unread') rows = rows.filter((n) => !n.isRead)
  if (recipientId) rows = rows.filter((n) => n.recipientId === recipientId)

  const SORTABLE = ['createdAt', 'priority']
  if (SORTABLE.includes(sortBy)) {
    const sign = sortDir === 'desc' ? -1 : 1
    const PRIORITY_RANK = { high: 0, normal: 1, low: 2 }
    rows.sort((a, b) => {
      if (sortBy === 'priority') {
        return ((PRIORITY_RANK[a.priority] ?? 9) - (PRIORITY_RANK[b.priority] ?? 9)) * sign
      }
      const av = a.createdAt || ''
      const bv = b.createdAt || ''
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

export function getNotificationsSummary() {
  const total = notifications.length
  const unread = notifications.filter((n) => !n.isRead).length
  const high = notifications.filter((n) => n.priority === 'high').length
  const today = new Date().toISOString().slice(0, 10)
  const todayCount = notifications.filter((n) => (n.createdAt || '').slice(0, 10) === today).length
  return { total, unread, high, today: todayCount }
}

// ---------- Validate ------------------------------------------------------

function validateNotification(payload) {
  const errors = {}
  if (!payload.title?.trim()) errors.title = 'Vui lòng nhập tiêu đề.'
  if (!payload.message?.trim()) errors.message = 'Vui lòng nhập nội dung.'
  if (!payload.type) errors.type = 'Vui lòng chọn loại thông báo.'
  if (!payload.priority) errors.priority = 'Vui lòng chọn mức độ.'
  if (!payload.recipientId?.trim()) errors.recipientId = 'Vui lòng chọn người nhận.'
  return errors
}

// ---------- ID gen --------------------------------------------------------

function makeId() {
  let max = 0
  for (const n of notifications) {
    const m = /^notification-(\d+)$/.exec(n.id || '')
    if (m) {
      const v = parseInt(m[1], 10)
      if (v > max) max = v
    }
  }
  return `notification-${String(max + 1).padStart(3, '0')}`
}