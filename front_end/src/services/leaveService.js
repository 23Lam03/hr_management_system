/**
 * leaveService - quản lý đơn nghỉ phép (Phần 7).
 *
 * Nguyên tắc:
 * - Mọi thao tác (đọc / tìm / lọc / sort / paginate / tạo / duyệt / từ
 *   chối / huỷ) đều đi qua service - JSX không xử lý logic dữ liệu.
 * - Tái sử dụng nhân viên + phòng ban từ employeeService / employeeMockData.
 * - KHÔNG tự ý trừ phép năm - chính sách chưa được xác định.
 * - Service bắn pub-sub để hook tự re-render.
 * - Bảo vệ quyền sở hữu: huỷ đơn phải đúng employeeId.
 * - Cùng một nguồn dữ liệu cho admin & employee (không tạo bản sao).
 */

import {
  LEAVE_REQUESTS as SEED_REQUESTS,
  LEAVE_TYPES,
  LEAVE_TYPE_LABEL,
  LEAVE_SESSIONS,
  LEAVE_STATUSES,
  LEAVE_STATUS_LABEL,
  LEAVE_BALANCE_DEMO,
} from '../data/leaveMockData'

import {
  getEmployeeById,
  getEmployees,
  getDepartments,
} from './employeeService'

// ---------- Mutable store -------------------------------------------------
let requests = SEED_REQUESTS.map((r) => ({
  ...r,
  history: Array.isArray(r.history) ? [...r.history] : [],
}))
const listeners = new Set()

function notify(eventType, payload) {
  for (const cb of listeners) {
    try {
      cb({ type: eventType, payload })
    } catch (_err) {
      void _err
    }
  }
}

export function subscribeLeaves(cb) {
  listeners.add(cb)
  return () => listeners.delete(cb)
}

// ---------- Lookups --------------------------------------------------------

export function getLeaveTypes() {
  return LEAVE_TYPES.slice()
}

export function getLeaveStatuses() {
  return LEAVE_STATUSES.slice()
}

export function getLeaveSessions() {
  return LEAVE_SESSIONS.slice()
}

// ---------- Date helpers ---------------------------------------------------

function toDate(s) {
  if (!s) return null
  const d = new Date(s)
  return Number.isNaN(d.getTime()) ? null : d
}

/** Tính tổng ngày nghỉ theo quy tắc lịch (calendar days, demo).
 *
 * Lưu ý: Đây là cách tính minh họa. Khi có chính sách ngày làm việc /
 * ngày lễ chính thức, hàm này sẽ được thay thế.
 *
 * - startSession / endSession = 'full' → 1 ngày cho ngày đó.
 * - 'morning' / 'afternoon' → 0.5 ngày.
 * - Nếu startSession = endSession (cùng buổi) trong 1 ngày → 0.5 ngày.
 * - Nếu startSession = 'morning' và endSession = 'afternoon' và
 *   startDate = endDate → 1 ngày.
 * - Mặc định: cả hai đầu 'full'.
 */
export function calcTotalDays({ startDate, endDate, startSession = 'full', endSession = 'full' }) {
  const start = toDate(startDate)
  const end = toDate(endDate)
  if (!start || !end) return 0
  if (end < start) return 0

  const oneDay = 24 * 60 * 60 * 1000
  const days = Math.floor((end - start) / oneDay) + 1

  if (days === 1) {
    if (startSession === endSession && startSession !== 'full') return 0.5
    if (startSession === 'morning' && endSession === 'afternoon') return 1
    if (startSession === 'full' && endSession === 'full') return 1
    // Các kết hợp khác giữ 1 ngày để an toàn
    return 1
  }

  // Nhiều ngày: tính riêng ngày đầu / ngày cuối / giữa
  const first = startSession === 'full' ? 1 : 0.5
  const last = endSession === 'full' ? 1 : 0.5
  const middle = Math.max(0, days - 2)
  return Math.round((first + middle + last) * 100) / 100
}

/**
 * Hai khoảng [a1,a2] và [b1,b2] có giao nhau không?
 * Bỏ qua trường hợp a2 < b1 hoặc b2 < a1.
 */
function rangesOverlap(a1, a2, b1, b2) {
  return a1 <= b2 && b1 <= a2
}

/**
 * Kiểm tra xung đột đơn nghỉ phép: có đơn pending/approved nào của cùng
 * nhân viên (trừ excludeId) giao với khoảng mới không.
 */
function findConflict({ employeeId, startDate, endDate, excludeId = null }) {
  const newStart = startDate
  const newEnd = endDate
  return requests.find(
    (r) =>
      r.id !== excludeId &&
      r.employeeId === employeeId &&
      (r.status === 'pending' || r.status === 'approved') &&
      rangesOverlap(r.startDate, r.endDate, newStart, newEnd),
  )
}

// ---------- Validators -----------------------------------------------------

/**
 * Validate payload form. Trả về object errors.
 *
 * @param {Object} payload
 * @param {string|null} currentUserEmployeeId  ID nhân viên hiện tại - phải khớp employeeId.
 * @param {string|null} excludeRequestId      Khi sửa, loại trừ đơn này khi check trùng.
 */
export function validateLeaveRequest(payload, { currentUserEmployeeId = null, excludeRequestId = null } = {}) {
  const errors = {}

  if (!payload.leaveType) {
    errors.leaveType = 'Vui lòng chọn loại nghỉ phép.'
  } else if (!LEAVE_TYPE_LABEL[payload.leaveType]) {
    errors.leaveType = 'Loại nghỉ phép không hợp lệ.'
  }

  if (!payload.startDate) {
    errors.startDate = 'Vui lòng chọn ngày bắt đầu.'
  }
  if (!payload.endDate) {
    errors.endDate = 'Vui lòng chọn ngày kết thúc.'
  }
  if (payload.startDate && payload.endDate) {
    if (payload.endDate < payload.startDate) {
      errors.endDate = 'Ngày kết thúc không được trước ngày bắt đầu.'
    }
  }

  // Không cho phép đơn trong quá khứ (theo yêu cầu demo).
  // todayStr sẽ được truyền từ caller để test ổn định, mặc định dùng 2026-10-01.
  const today = payload._today || '2026-10-01'
  if (payload.startDate && payload.startDate < today) {
    errors.startDate = 'Không thể gửi đơn cho ngày trong quá khứ.'
  }

  if (!payload.reason?.trim()) {
    errors.reason = 'Vui lòng nhập lý do nghỉ.'
  } else if (payload.reason.trim().length < 5) {
    errors.reason = 'Lý do nghỉ phải có ít nhất 5 ký tự.'
  } else if (payload.reason.length > 500) {
    errors.reason = 'Lý do nghỉ không được vượt quá 500 ký tự.'
  }

  // Ownership: nếu người dùng cố gắng tạo/sửa đơn cho employeeId khác
  if (currentUserEmployeeId && payload.employeeId && payload.employeeId !== currentUserEmployeeId) {
    errors._form = 'Bạn không thể gửi đơn thay người khác.'
  }

  // Trùng khoảng nghỉ - kiểm tra độc lập với errors ngày khác để đảm bảo
  // người dùng luôn biết khoảng nào đã bị đụng.
  if (payload.employeeId && payload.startDate && payload.endDate) {
    const conflict = findConflict({
      employeeId: payload.employeeId,
      startDate: payload.startDate,
      endDate: payload.endDate,
      excludeId: excludeRequestId,
    })
    if (conflict) {
      errors._form = `Đơn ${conflict.requestCode} đang có khoảng nghỉ giao với khoảng này.`
    }
  }

  return errors
}

// ---------- Mutations ------------------------------------------------------

function nowIso() {
  return new Date().toISOString()
}

function appendHistory(record, entry) {
  return [
    ...((record.history || []).map((h) => ({ ...h }))),
    { ...entry, timestamp: entry.timestamp || nowIso() },
  ]
}

function makeId() {
  let max = 0
  for (const r of requests) {
    const m = /^lr-(\d+)$/.exec(r.id || '')
    if (m) {
      const n = parseInt(m[1], 10)
      if (n > max) max = n
    }
  }
  return `lr-${String(max + 1).padStart(3, '0')}`
}

function generateRequestCode() {
  const d = new Date()
  const yyyy = d.getFullYear()
  const mm = String(d.getMonth() + 1).padStart(2, '0')
  const dd = String(d.getDate()).padStart(2, '0')
  const prefix = `LR-${yyyy}${mm}${dd}-`
  let n = 1
  const taken = new Set(
    requests
      .filter((r) => r.requestCode?.startsWith(prefix))
      .map((r) => r.requestCode),
  )
  while (taken.has(`${prefix}${String(n).padStart(4, '0')}`)) {
    n += 1
  }
  return `${prefix}${String(n).padStart(4, '0')}`
}

/**
 * Tạo đơn nghỉ phép.
 *
 * @param {Object} payload
 * @param {string} currentUserEmployeeId  ID nhân viên gửi đơn (lấy từ useAuth).
 * @param {Object} [actor]                Tuỳ chọn - { name } để ghi vào history.
 *                                        Mặc định lấy từ employee.fullName.
 */
export function createLeaveRequest(payload, currentUserEmployeeId, actor = null) {
  const enriched = { ...payload, employeeId: currentUserEmployeeId }
  const errors = validateLeaveRequest(enriched, { currentUserEmployeeId })
  if (Object.keys(errors).length) {
    return Promise.resolve({ ok: false, errors })
  }
  const emp = getEmployeeById(currentUserEmployeeId)
  if (!emp) {
    return Promise.resolve({ ok: false, errors: { _form: 'Không tìm thấy hồ sơ nhân viên.' } })
  }
  const departments = getDepartments()
  const dept = departments.find((d) => d.id === emp.departmentId)
  const totalDays = calcTotalDays({
    startDate: payload.startDate,
    endDate: payload.endDate,
    startSession: payload.startSession || 'full',
    endSession: payload.endSession || 'full',
  })
  const now = nowIso()
  const record = {
    id: makeId(),
    requestCode: generateRequestCode(),
    employeeId: emp.id,
    leaveType: payload.leaveType,
    startDate: payload.startDate,
    endDate: payload.endDate,
    startSession: payload.startSession || 'full',
    endSession: payload.endSession || 'full',
    totalDays,
    reason: payload.reason.trim(),
    status: 'pending',
    approverId: null,
    approverName: '',
    reviewedAt: null,
    rejectionReason: '',
    createdAt: now,
    updatedAt: now,
    employeeCode: emp.employeeCode,
    employeeName: emp.fullName,
    departmentId: emp.departmentId,
    departmentName: dept?.name ?? '—',
  }
  record.history = appendHistory(
    record,
    {
      fromStatus: null,
      toStatus: 'pending',
      actorId: emp.id,
      actorName: actor?.name || emp.fullName,
      timestamp: now,
      note: `Tạo đơn ${record.requestCode}`,
    },
  )
  requests = [record, ...requests]
  notify('create', { record })
  return Promise.resolve({ ok: true, record })
}

/**
 * Phê duyệt đơn. reviewer = { id, name }.
 */
export function approveLeaveRequest(id, reviewer) {
  const existing = requests.find((r) => r.id === id)
  if (!existing) return Promise.resolve({ ok: false, error: 'Không tìm thấy đơn.' })
  if (existing.status !== 'pending') {
    return Promise.resolve({
      ok: false,
      error: `Đơn đã ở trạng thái "${LEAVE_STATUS_LABEL[existing.status]}". Không thể phê duyệt.`,
    })
  }
  if (!reviewer?.id || !reviewer?.name) {
    return Promise.resolve({ ok: false, error: 'Thiếu thông tin người xử lý.' })
  }
  const now = nowIso()
  const merged = {
    ...existing,
    status: 'approved',
    approverId: reviewer.id,
    approverName: reviewer.name,
    reviewedAt: now,
    rejectionReason: '',
    updatedAt: now,
  }
  merged.history = appendHistory(existing, {
    fromStatus: 'pending',
    toStatus: 'approved',
    actorId: reviewer.id,
    actorName: reviewer.name,
    timestamp: now,
    note: 'Phê duyệt đơn nghỉ phép.',
  })
  const updated = merged
  requests = requests.map((r) => (r.id === id ? updated : r))
  notify('approve', { record: updated })

  // Phase 33: notify employee (best-effort, fail-soft).
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const notifService = require('./notificationService')
    if (notifService.createNotification) {
      notifService.createNotification({
        type: 'leave',
        relatedEntityType: 'leave',
        relatedEntityId: updated.id,
        recipientId: updated.employeeId,
        title: 'Your leave request has been approved',
        description: `Đơn nghỉ phép từ ${updated.startDate} đến ${updated.endDate}`,
        createdBy: reviewer.id,
      })
    }
  } catch (_e) { void _e }

  return Promise.resolve({ ok: true, record: updated })
}

/**
 * Từ chối đơn. Lý do bắt buộc.
 */
export function rejectLeaveRequest(id, reviewer, reason) {
  const existing = requests.find((r) => r.id === id)
  if (!existing) return Promise.resolve({ ok: false, error: 'Không tìm thấy đơn.' })
  if (existing.status !== 'pending') {
    return Promise.resolve({
      ok: false,
      error: `Đơn đã ở trạng thái "${LEAVE_STATUS_LABEL[existing.status]}". Không thể từ chối.`,
    })
  }
  if (!reviewer?.id || !reviewer?.name) {
    return Promise.resolve({ ok: false, error: 'Thiếu thông tin người xử lý.' })
  }
  if (!reason?.trim()) {
    return Promise.resolve({ ok: false, error: 'Vui lòng nhập lý do từ chối.' })
  }
  if (reason.trim().length < 3) {
    return Promise.resolve({ ok: false, error: 'Lý do từ chối phải có ít nhất 3 ký tự.' })
  }
  const now = nowIso()
  const merged = {
    ...existing,
    status: 'rejected',
    approverId: reviewer.id,
    approverName: reviewer.name,
    reviewedAt: now,
    rejectionReason: reason.trim(),
    updatedAt: now,
  }
  merged.history = appendHistory(existing, {
    fromStatus: 'pending',
    toStatus: 'rejected',
    actorId: reviewer.id,
    actorName: reviewer.name,
    timestamp: now,
    note: reason.trim(),
  })
  const updated = merged
  requests = requests.map((r) => (r.id === id ? updated : r))
  notify('reject', { record: updated })

  // Phase 33: notify employee (best-effort, fail-soft).
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const notifService = require('./notificationService')
    if (notifService.createNotification) {
      notifService.createNotification({
        type: 'leave',
        relatedEntityType: 'leave',
        relatedEntityId: updated.id,
        recipientId: updated.employeeId,
        title: 'Your leave request has been rejected',
        description: `Lý do: ${reason.trim()}`,
        createdBy: reviewer.id,
      })
    }
  } catch (_e) { void _e }

  return Promise.resolve({ ok: true, record: updated })
}

/**
 * Huỷ đơn của chính nhân viên. Chỉ cho phép khi đang `pending`.
 */
export function cancelLeaveRequest(id, employeeId) {
  const existing = requests.find((r) => r.id === id)
  if (!existing) return Promise.resolve({ ok: false, error: 'Không tìm thấy đơn.' })
  if (existing.employeeId !== employeeId) {
    return Promise.resolve({ ok: false, error: 'Bạn không có quyền huỷ đơn của người khác.' })
  }
  if (existing.status !== 'pending') {
    return Promise.resolve({
      ok: false,
      error: `Chỉ có thể huỷ đơn đang "Chờ duyệt". Đơn hiện ở trạng thái "${LEAVE_STATUS_LABEL[existing.status]}".`,
    })
  }
  const emp = getEmployeeById(employeeId)
  const now = nowIso()
  const merged = {
    ...existing,
    status: 'cancelled',
    updatedAt: now,
  }
  merged.history = appendHistory(existing, {
    fromStatus: 'pending',
    toStatus: 'cancelled',
    actorId: employeeId,
    actorName: emp?.fullName || 'Nhân viên',
    timestamp: now,
    note: 'Huỷ đơn nghỉ phép.',
  })
  const updated = merged
  requests = requests.map((r) => (r.id === id ? updated : r))
  notify('cancel', { record: updated })
  return Promise.resolve({ ok: true, record: updated })
}

// ---------- Read helpers ---------------------------------------------------

export function getLeaveRequests() {
  return requests.slice()
}

export function getLeaveRequestById(id) {
  return requests.find((r) => r.id === id) ?? null
}

function decorate(record) {
  if (record.employeeName && record.departmentName) return record
  const emp = getEmployeeById(record.employeeId)
  if (!emp) return record
  const dept = getDepartments().find((d) => d.id === emp.departmentId)
  return {
    ...record,
    employeeCode: record.employeeCode || emp.employeeCode,
    employeeName: record.employeeName || emp.fullName,
    departmentId: record.departmentId || emp.departmentId,
    departmentName: record.departmentName || dept?.name || '—',
  }
}

/**
 * Query chấm công với filter / sort / paginate.
 *
 * Filters (admin/employee):
 *  - search (fullName / employeeCode / requestCode)
 *  - status, leaveType, departmentId
 *  - startDateFrom / startDateTo: lọc đơn có startDate nằm trong khoảng
 *  - createdFrom / createdTo: lọc theo ngày gửi đơn
 *  - employeeId: để employee page tự lọc đơn của mình
 * Sort:
 *  - submittedAt (default desc) | startDate | status
 */
export function queryLeaveRequests(q = {}) {
  const {
    search = '',
    status = '',
    leaveType = '',
    departmentId = '',
    startDateFrom = '',
    startDateTo = '',
    createdFrom = '',
    createdTo = '',
    employeeId = '',
    sortBy = 'submittedAt',
    sortDir = 'desc',
    page = 1,
    pageSize = 10,
  } = q

  const trimmed = search.trim().toLowerCase()
  let rows = requests.map(decorate)

  if (trimmed) {
    rows = rows.filter(
      (r) =>
        (r.employeeName || '').toLowerCase().includes(trimmed) ||
        (r.employeeCode || '').toLowerCase().includes(trimmed) ||
        (r.requestCode || '').toLowerCase().includes(trimmed),
    )
  }
  if (status) rows = rows.filter((r) => r.status === status)
  if (leaveType) rows = rows.filter((r) => r.leaveType === leaveType)
  if (departmentId) rows = rows.filter((r) => r.departmentId === departmentId)
  if (employeeId) rows = rows.filter((r) => r.employeeId === employeeId)
  if (startDateFrom) rows = rows.filter((r) => r.startDate >= startDateFrom)
  if (startDateTo)   rows = rows.filter((r) => r.startDate <= startDateTo)
  if (createdFrom)    rows = rows.filter((r) => (r.createdAt || '').slice(0, 10) >= createdFrom)
  if (createdTo)      rows = rows.filter((r) => (r.createdAt || '').slice(0, 10) <= createdTo)

  // Sort. status dùng order logic: pending > approved > rejected > cancelled
  const STATUS_ORDER = { pending: 0, approved: 1, rejected: 2, cancelled: 3 }
  const SORTABLE = ['submittedAt', 'startDate', 'status']
  if (SORTABLE.includes(sortBy)) {
    const sign = sortDir === 'desc' ? -1 : 1
    rows.sort((a, b) => {
      let av, bv
      if (sortBy === 'submittedAt') {
        av = a.createdAt || ''
        bv = b.createdAt || ''
      } else if (sortBy === 'startDate') {
        av = a.startDate || ''
        bv = b.startDate || ''
      } else {
        av = STATUS_ORDER[a.status] ?? 99
        bv = STATUS_ORDER[b.status] ?? 99
      }
      if (av === bv) return 0
      if (av === '' || av === null || av === undefined) return 1
      if (bv === '' || bv === null || bv === undefined) return -1
      return av < bv ? -1 * sign : 1 * sign
    })
  }

  const total = rows.length
  const size = Math.max(1, Number(pageSize) || 10)
  const totalPages = Math.max(1, Math.ceil(total / size))
  const currentPage = Math.min(Math.max(1, Number(page) || 1), totalPages)
  const start = (currentPage - 1) * size
  const items = rows.slice(start, start + size)

  return { items, total, page: currentPage, pageSize: size, totalPages }
}

// ---------- Summary -------------------------------------------------------

/**
 * Tính thống kê đơn nghỉ phép theo filter.
 *
 * - total: tổng đơn trong phạm vi filter
 * - pending / approved / rejected / cancelled: số đơn theo trạng thái
 * - approvedDays: tổng ngày nghỉ đã duyệt (cho dashboard nếu cần)
 */
export function getLeaveSummary(filters = {}) {
  const all = requests.map(decorate)
  let rows = all
  if (filters.departmentId) rows = rows.filter((r) => r.departmentId === filters.departmentId)
  if (filters.employeeId)   rows = rows.filter((r) => r.employeeId === filters.employeeId)
  if (filters.startDateFrom) rows = rows.filter((r) => r.startDate >= filters.startDateFrom)
  if (filters.startDateTo)   rows = rows.filter((r) => r.startDate <= filters.startDateTo)
  if (filters.createdFrom)    rows = rows.filter((r) => (r.createdAt || '').slice(0, 10) >= filters.createdFrom)
  if (filters.createdTo)      rows = rows.filter((r) => (r.createdAt || '').slice(0, 10) <= filters.createdTo)

  const total = rows.length
  const pending = rows.filter((r) => r.status === 'pending').length
  const approved = rows.filter((r) => r.status === 'approved').length
  const rejected = rows.filter((r) => r.status === 'rejected').length
  const cancelled = rows.filter((r) => r.status === 'cancelled').length
  const approvedDays = rows
    .filter((r) => r.status === 'approved')
    .reduce((sum, r) => sum + (r.totalDays || 0), 0)

  return {
    total,
    pending,
    approved,
    rejected,
    cancelled,
    approvedDays: Math.round(approvedDays * 100) / 100,
  }
}

// ---------- History (Phần 10) ---------------------------------------------

/**
 * Lấy lịch sử xử lý 1 đơn (sắp xếp theo thời gian tăng dần).
 * Trả về mảng rỗng nếu không tồn tại.
 */
export function getLeaveHistory(id) {
  const rec = requests.find((r) => r.id === id)
  if (!rec) return []
  return (rec.history || []).slice().sort((a, b) => (a.timestamp || '').localeCompare(b.timestamp || ''))
}

// ---------- Leave balance (Phần 10) --------------------------------------

/**
 * Trả về thông tin hạn mức nghỉ phép năm minh hoạ.
 *
 * @param {string} employeeId
 * @param {Object} [options]
 * @param {number} [options.year] Năm cần xem. Mặc định: năm hiện tại.
 *
 * Lưu ý: hạn mức lấy từ LEAVE_BALANCE_DEMO - đây là dữ liệu minh hoạ,
 * chưa phải chính sách phép năm chính thức của công ty.
 */
export function getLeaveBalance(employeeId, { year = new Date().getFullYear() } = {}) {
  const annualTotal = LEAVE_BALANCE_DEMO.annualTotal
  const used = requests
    .filter((r) => r.employeeId === employeeId)
    .filter((r) => r.status === 'approved')
    .filter((r) => (r.startDate || '').slice(0, 4) === String(year))
    .reduce((sum, r) => sum + (r.totalDays || 0), 0)
  const usedRounded = Math.round(used * 100) / 100
  const remainingRounded = Math.max(0, Math.round((annualTotal - used) * 100) / 100)
  const pending = requests
    .filter((r) => r.employeeId === employeeId)
    .filter((r) => r.status === 'pending')
    .filter((r) => (r.startDate || '').slice(0, 4) === String(year))
    .reduce((sum, r) => sum + (r.totalDays || 0), 0)
  return {
    year,
    annualTotal,
    used: usedRounded,
    remaining: remainingRounded,
    pendingDays: Math.round(pending * 100) / 100,
    unit: LEAVE_BALANCE_DEMO.unit,
    note: 'Hạn mức này là dữ liệu minh hoạ cho UI demo, chưa phải chính sách phép năm chính thức.',
  }
}

// ---------- Calendar (Phần 10) --------------------------------------------

/**
 * Trả về calendar trong 1 tháng: danh sách các ngày (YYYY-MM-DD) có đơn
 * nghỉ, kèm danh sách đơn liên quan (status khác nhau).
 *
 * @param {Object} options
 * @param {number} options.month 1-12
 * @param {number} options.year  YYYY
 * @param {string} [options.employeeId]   Lọc đơn của 1 nhân viên
 * @param {string} [options.departmentId] Lọc theo phòng ban
 *
 * Lưu ý:
 *  - Chỉ hiển thị đơn `approved` và `pending` trên lịch (rejected/cancelled
 *    không tính là nghỉ thực tế).
 *  - Một đơn có thể rải nhiều ngày. Mỗi ngày sẽ tham chiếu đến đơn gốc.
 */
export function getLeaveCalendar({ month, year, employeeId = '', departmentId = '' } = {}) {
  const m = Math.max(1, Math.min(12, Number(month) || (new Date().getMonth() + 1)))
  const y = Math.max(1970, Number(year) || new Date().getFullYear())
  const startOfMonth = `${String(y).padStart(4, '0')}-${String(m).padStart(2, '0')}-01`
  const endOfMonth = new Date(y, m, 0).toISOString().slice(0, 10)

  let rows = requests.map(decorate).filter((r) =>
    (r.status === 'approved' || r.status === 'pending'),
  )
  if (employeeId) rows = rows.filter((r) => r.employeeId === employeeId)
  if (departmentId) rows = rows.filter((r) => r.departmentId === departmentId)

  // Tạo map date -> các đơn nghỉ trùng ngày đó trong tháng
  const byDate = {}
  for (const r of rows) {
    if (!r.startDate || !r.endDate) continue
    if (r.endDate < startOfMonth || r.startDate > endOfMonth) continue
    const from = r.startDate < startOfMonth ? startOfMonth : r.startDate
    const to = r.endDate > endOfMonth ? endOfMonth : r.endDate
    const cur = new Date(from + 'T00:00:00Z')
    const stop = new Date(to + 'T00:00:00Z')
    while (cur <= stop) {
      const key = cur.toISOString().slice(0, 10)
      if (!byDate[key]) byDate[key] = []
      byDate[key].push({
        id: r.id,
        requestCode: r.requestCode,
        employeeId: r.employeeId,
        employeeName: r.employeeName,
        departmentName: r.departmentName,
        leaveType: r.leaveType,
        status: r.status,
        totalDays: r.totalDays,
        startDate: r.startDate,
        endDate: r.endDate,
      })
      cur.setUTCDate(cur.getUTCDate() + 1)
    }
  }

  return {
    month: m,
    year: y,
    startOfMonth,
    endOfMonth,
    byDate,
  }
}

/**
 * Helper: build 1 grid ngày cho 1 tháng (gồm cả phần tháng trước/sau
 * để hiển thị đầy đủ tuần). Trả về array các ô theo tuần (CN -> T7).
 */
export function getMonthGrid({ month, year } = {}) {
  const m = Math.max(1, Math.min(12, Number(month) || (new Date().getMonth() + 1)))
  const y = Math.max(1970, Number(year) || new Date().getFullYear())
  const first = new Date(y, m - 1, 1)
  const firstWeekday = first.getDay() // 0 = CN
  const daysInMonth = new Date(y, m, 0).getDate()
  const cells = []
  // Tháng trước
  const prevLast = new Date(y, m - 1, 0).getDate()
  for (let i = firstWeekday - 1; i >= 0; i--) {
    const d = prevLast - i
    const dateObj = new Date(y, m - 2, d)
    cells.push({
      date: dateObj.toISOString().slice(0, 10),
      day: d,
      inMonth: false,
    })
  }
  // Tháng hiện tại
  for (let d = 1; d <= daysInMonth; d++) {
    const dateObj = new Date(y, m - 1, d)
    cells.push({
      date: dateObj.toISOString().slice(0, 10),
      day: d,
      inMonth: true,
    })
  }
  // Tháng sau - chèn đến khi đủ 6 hàng x 7 cột = 42
  while (cells.length % 7 !== 0 || cells.length < 42) {
    const last = cells[cells.length - 1]
    const lastDate = new Date(last.date + 'T00:00:00Z')
    lastDate.setUTCDate(lastDate.getUTCDate() + 1)
    cells.push({
      date: lastDate.toISOString().slice(0, 10),
      day: lastDate.getUTCDate(),
      inMonth: lastDate.getUTCMonth() === m - 1,
    })
  }
  // Chia thành tuần
  const weeks = []
  for (let i = 0; i < cells.length; i += 7) weeks.push(cells.slice(i, i + 7))
  return { month: m, year: y, weeks }
}

// ---------- Utility export ------------------------------------------------

void getEmployees