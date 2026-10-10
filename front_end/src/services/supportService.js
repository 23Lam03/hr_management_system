/**
 * supportService - quản lý yêu cầu hỗ trợ (Phần 15).
 *
 * - Mock data in-memory, pub-sub để UI bump tick.
 * - Thiết kế giống các service khác (notification, training...).
 * - Hỗ trợ thay sang REST API sau này.
 */

import {
  SUPPORT_REQUESTS as SEED,
  SUPPORT_STATUSES,
  SUPPORT_CATEGORIES,
  SUPPORT_PRIORITIES,
  SUPPORT_STATUS_LABEL,
  SUPPORT_CATEGORY_LABEL,
  SUPPORT_PRIORITY_LABEL,
  SUPPORT_PRIORITY_TONE,
  SUPPORT_STATUS_TONE,
} from '../data/supportRequests'
import { EMPLOYEES } from '../data/employeeMockData'
import { createNotification } from './notificationService'

let requests = SEED.map((r) => ({ ...r, messages: [...r.messages] }))

const listeners = new Set()
function notify(eventType, payload) {
  for (const cb of listeners) {
    try { cb({ type: eventType, payload }) } catch (_e) { void _e }
  }
}

export function subscribeSupportRequests(cb) {
  listeners.add(cb)
  return () => listeners.delete(cb)
}

// ---------- Lookups -------------------------------------------------------

export function getSupportCategories() {
  return [
    { value: 'account',    label: 'Tài khoản' },
    { value: 'attendance', label: 'Chấm công' },
    { value: 'leave',      label: 'Nghỉ phép' },
    { value: 'payroll',    label: 'Bảng lương' },
    { value: 'benefit',    label: 'Phúc lợi' },
    { value: 'contract',   label: 'Hợp đồng' },
    { value: 'training',   label: 'Đào tạo' },
    { value: 'evaluation', label: 'Đánh giá' },
    { value: 'technical',  label: 'Kỹ thuật' },
    { value: 'other',      label: 'Khác' },
  ]
}

export function getSupportPriorities() {
  return [
    { value: 'low',    label: 'Thấp' },
    { value: 'normal', label: 'Bình thường' },
    { value: 'high',   label: 'Cao' },
  ]
}

export function getSupportStatuses() {
  return [
    { value: 'open',                  label: 'Mới' },
    { value: 'in_progress',           label: 'Đang xử lý' },
    { value: 'waiting_for_employee',  label: 'Chờ nhân viên phản hồi' },
    { value: 'resolved',              label: 'Đã giải quyết' },
    { value: 'closed',                label: 'Đã đóng' },
    { value: 'cancelled',             label: 'Đã hủy' },
  ]
}

export function getSupportCategoryLabel(v) {
  return SUPPORT_CATEGORY_LABEL[v] ?? v
}

export function getSupportPriorityLabel(v) {
  return SUPPORT_PRIORITY_LABEL[v] ?? v
}

export function getSupportPriorityTone(v) {
  return SUPPORT_PRIORITY_TONE[v] ?? 'neutral'
}

export function getSupportStatusLabel(v) {
  return SUPPORT_STATUS_LABEL[v] ?? v
}

export function getSupportStatusTone(v) {
  return SUPPORT_STATUS_TONE[v] ?? 'neutral'
}

void SUPPORT_STATUSES
void SUPPORT_CATEGORIES
void SUPPORT_PRIORITIES

// ---------- Reads ---------------------------------------------------------

export function getSupportRequests() {
  return requests
    .map((r) => ({ ...r, messages: [...r.messages] }))
    .sort((a, b) => (b.createdAt || '').localeCompare(a.createdAt || ''))
}

export function getSupportRequestById(id) {
  const found = requests.find((r) => r.id === id)
  if (!found) return null
  return { ...found, messages: [...found.messages] }
}

export function getSupportRequestsByUser(userId) {
  return getSupportRequests().filter((r) => r.requesterId === userId)
}

export function getSupportRequestsByStatus(status) {
  return getSupportRequests().filter((r) => r.status === status)
}

export function getSupportRequestsByCategory(category) {
  return getSupportRequests().filter((r) => r.category === category)
}

export function getSupportRequestsByPriority(priority) {
  return getSupportRequests().filter((r) => r.priority === priority)
}

export function getSupportSummary() {
  const total = requests.length
  const open = requests.filter((r) => r.status === 'open').length
  const inProgress = requests.filter((r) => r.status === 'in_progress').length
  const resolved = requests.filter((r) => r.status === 'resolved').length
  const waiting = requests.filter((r) => r.status === 'waiting_for_employee').length
  const high = requests.filter((r) => r.priority === 'high').length
  return { total, open, inProgress, resolved, waiting, high }
}

export function getSupportSummaryForUser(userId) {
  const userRequests = requests.filter((r) => r.requesterId === userId)
  return {
    total: userRequests.length,
    inProgress: userRequests.filter((r) => r.status === 'in_progress').length,
    resolved: userRequests.filter((r) => r.status === 'resolved').length,
    waiting: userRequests.filter((r) => r.status === 'waiting_for_employee').length,
    open: userRequests.filter((r) => r.status === 'open').length,
  }
}

// ---------- Query / Filter ------------------------------------------------

export function querySupportRequests(q = {}) {
  const {
    search = '',
    status = '',
    category = '',
    priority = '',
    requesterId = '',
    sortBy = 'createdAt',
    sortDir = 'desc',
    page = 1,
    pageSize = 10,
  } = q

  const searchLow = String(search ?? '').trim().toLowerCase()
  let rows = getSupportRequests()
  if (requesterId) rows = rows.filter((r) => r.requesterId === requesterId)
  if (status) rows = rows.filter((r) => r.status === status)
  if (category) rows = rows.filter((r) => r.category === category)
  if (priority) rows = rows.filter((r) => r.priority === priority)
  if (searchLow) {
    rows = rows.filter((r) => {
      const haystack = [
        r.id,
        r.subject,
        r.description,
        r.requesterId,
      ]
      return haystack.some((s) => String(s ?? '').toLowerCase().includes(searchLow))
    })
  }

  const SORTABLE = ['createdAt', 'updatedAt', 'priority', 'status']
  if (SORTABLE.includes(sortBy)) {
    const sign = sortDir === 'desc' ? -1 : 1
    const PRIORITY_RANK = { high: 0, normal: 1, low: 2 }
    rows.sort((a, b) => {
      if (sortBy === 'priority') {
        return ((PRIORITY_RANK[a.priority] ?? 9) - (PRIORITY_RANK[b.priority] ?? 9)) * sign
      }
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

// ---------- Mutations -----------------------------------------------------

export function createSupportRequest(payload) {
  const errors = validateRequest(payload)
  if (Object.keys(errors).length) return Promise.resolve({ ok: false, errors })
  const id = makeRequestId()
  const now = new Date().toISOString()
  const messageId = makeMessageId()
  const firstMessage = {
    id: messageId,
    senderId: payload.requesterId,
    senderRole: 'employee',
    message: payload.description.trim(),
    createdAt: now,
  }
  const record = {
    id,
    subject: payload.subject.trim(),
    description: payload.description.trim(),
    category: payload.category,
    priority: payload.priority,
    status: 'open',
    requesterId: payload.requesterId,
    assignedTo: null,
    createdAt: now,
    updatedAt: now,
    resolvedAt: null,
    messages: [firstMessage],
  }
  requests = [record, ...requests]
  notify('support.create', { request: record })

  // Best-effort notification cho Admin (mock).
  try {
    const emp = EMPLOYEES.find((e) => e.id === payload.requesterId) || null
    void createNotification({
      title: `Yêu cầu hỗ trợ mới: ${record.subject}`,
      message: `${emp?.fullName ?? payload.requesterId} vừa tạo yêu cầu hỗ trợ mới.`,
      type: 'system',
      priority: record.priority === 'high' ? 'high' : 'normal',
      recipientType: 'admin',
      recipientId: 'usr-admin-001',
      relatedEntityType: null,
      relatedEntityId: null,
    })
  } catch (_e) { void _e }

  return Promise.resolve({ ok: true, request: record })
}

export function updateSupportRequest(id, payload) {
  const existing = requests.find((r) => r.id === id)
  if (!existing) {
    return Promise.resolve({ ok: false, errors: { _form: 'Không tìm thấy yêu cầu.' } })
  }
  const merged = {
    ...existing,
    subject: payload.subject ?? existing.subject,
    description: payload.description ?? existing.description,
    category: payload.category ?? existing.category,
    priority: payload.priority ?? existing.priority,
    status: payload.status ?? existing.status,
    assignedTo: payload.assignedTo !== undefined ? payload.assignedTo : existing.assignedTo,
  }
  const errors = validateRequest(merged)
  if (Object.keys(errors).length) return Promise.resolve({ ok: false, errors })

  const now = new Date().toISOString()
  const updated = {
    ...merged,
    subject: merged.subject.trim(),
    description: merged.description.trim(),
    updatedAt: now,
    resolvedAt:
      merged.status === 'resolved'
        ? now
        : merged.status === 'resolved'
          ? existing.resolvedAt
          : merged.status === 'closed' || merged.status === 'cancelled'
            ? existing.resolvedAt
            : existing.resolvedAt,
  }
  requests = requests.map((r) => (r.id === id ? updated : r))
  notify('support.update', { request: updated })
  return Promise.resolve({ ok: true, request: updated })
}

export function updateSupportStatus(id, status) {
  const existing = requests.find((r) => r.id === id)
  if (!existing) {
    return Promise.resolve({ ok: false, errors: { _form: 'Không tìm thấy yêu cầu.' } })
  }
  const now = new Date().toISOString()
  const updated = {
    ...existing,
    status,
    updatedAt: now,
    resolvedAt: status === 'resolved' ? now : existing.resolvedAt,
  }
  requests = requests.map((r) => (r.id === id ? updated : r))
  notify('support.status', { request: updated })

  // Best-effort notification cho Employee.
  try {
    void createNotification({
      title: `Cập nhật trạng thái: ${updated.subject}`,
      message: `Yêu cầu của bạn hiện đang ở trạng thái: ${getSupportStatusLabel(status)}.`,
      type: 'system',
      priority: updated.priority === 'high' ? 'high' : 'normal',
      recipientType: 'employee',
      recipientId: updated.requesterId,
      relatedEntityType: null,
      relatedEntityId: null,
    })
  } catch (_e) { void _e }

  return Promise.resolve({ ok: true, request: updated })
}

export function assignSupportRequest(id, employeeId) {
  const existing = requests.find((r) => r.id === id)
  if (!existing) {
    return Promise.resolve({ ok: false, errors: { _form: 'Không tìm thấy yêu cầu.' } })
  }
  const updated = {
    ...existing,
    assignedTo: employeeId || null,
    updatedAt: new Date().toISOString(),
  }
  requests = requests.map((r) => (r.id === id ? updated : r))
  notify('support.assign', { request: updated })
  return Promise.resolve({ ok: true, request: updated })
}

export function addSupportMessage(id, message) {
  const existing = requests.find((r) => r.id === id)
  if (!existing) {
    return Promise.resolve({ ok: false, errors: { _form: 'Không tìm thấy yêu cầu.' } })
  }
  const text = (message?.message ?? '').trim()
  if (!text) {
    return Promise.resolve({ ok: false, errors: { message: 'Vui lòng nhập nội dung.' } })
  }
  if (!message?.senderId || !message?.senderRole) {
    return Promise.resolve({ ok: false, errors: { _form: 'Thiếu thông tin người gửi.' } })
  }
  const now = new Date().toISOString()
  const msg = {
    id: makeMessageId(),
    senderId: message.senderId,
    senderRole: message.senderRole,
    message: text,
    createdAt: now,
  }
  const updated = {
    ...existing,
    messages: [...existing.messages, msg],
    updatedAt: now,
  }
  requests = requests.map((r) => (r.id === id ? updated : r))
  notify('support.message', { request: updated, message: msg })

  // Best-effort notification cho phía bên kia.
  try {
    if (message.senderRole === 'admin') {
      void createNotification({
        title: `Phản hồi mới cho: ${updated.subject}`,
        message: `Admin vừa phản hồi yêu cầu hỗ trợ của bạn.`,
        type: 'system',
        priority: 'normal',
        recipientType: 'employee',
        recipientId: updated.requesterId,
        relatedEntityType: null,
        relatedEntityId: null,
      })
    }
  } catch (_e) { void _e }

  return Promise.resolve({ ok: true, request: updated, message: msg })
}

export function deleteSupportRequest(id) {
  const existing = requests.find((r) => r.id === id)
  if (!existing) {
    return Promise.resolve({ ok: false, error: 'Không tìm thấy yêu cầu.' })
  }
  requests = requests.filter((r) => r.id !== id)
  notify('support.delete', { request: existing })
  return Promise.resolve({ ok: true })
}

// ---------- Validate ------------------------------------------------------

function validateRequest(payload) {
  const errors = {}
  if (!payload.subject?.trim()) errors.subject = 'Vui lòng nhập tiêu đề.'
  if (!payload.description?.trim()) errors.description = 'Vui lòng nhập nội dung.'
  if (!payload.category) errors.category = 'Vui lòng chọn loại yêu cầu.'
  if (!payload.priority) errors.priority = 'Vui lòng chọn mức độ.'
  if (!payload.requesterId) errors.requesterId = 'Thiếu thông tin người gửi.'
  return errors
}

// ---------- ID gen --------------------------------------------------------

function makeRequestId() {
  let max = 0
  for (const r of requests) {
    const m = /^support-(\d+)$/.exec(r.id || '')
    if (m) {
      const v = parseInt(m[1], 10)
      if (v > max) max = v
    }
  }
  return `support-${String(max + 1).padStart(3, '0')}`
}

function makeMessageId() {
  let max = 0
  for (const r of requests) {
    for (const m of r.messages) {
      const match = /^message-(\d+)$/.exec(m.id || '')
      if (match) {
        const v = parseInt(match[1], 10)
        if (v > max) max = v
      }
    }
  }
  return `message-${String(max + 1).padStart(3, '0')}`
}