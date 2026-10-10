/**
 * attendanceService - quản lý chấm công (Phần 6).
 *
 * Nguyên tắc:
 * - Mọi logic truy vấn / lọc / tính workHours, lateMinutes, earlyLeaveMinutes
 *   đều ở đây. JSX chỉ render.
 * - Tái sử dụng dữ liệu nhân viên + phòng ban từ employeeService.js /
 *   employeeMockData.js - KHÔNG tạo nguồn riêng.
 * - Ca làm việc demo theo DEFAULT_SHIFT_RULE. Khi tích hợp backend, các
 *   hàm này sẽ thay bằng httpClient.get(...) tương ứng.
 */

import {
  ATTENDANCE_RECORDS as SEED_RECORDS,
  ATTENDANCE_STATUSES,
  ATTENDANCE_STATUS_LABEL,
  DEFAULT_SHIFT_RULE,
} from '../data/attendanceMockData'

import {
  getDepartments,
  getEmployees,
  getEmployeeById,
} from './employeeService'

// ---------- Mutable store --------------------------------------------------
let records = SEED_RECORDS.map((r) => ({
  ...r,
  // Phase 28: approval fields - default cho seed
  approvalStatus: r.approvalStatus || 'pending',
  approvedBy: r.approvedBy || null,
  approvedAt: r.approvedAt || null,
  approvalNote: r.approvalNote || '',
  createdAt: r.createdAt || '2026-09-25T08:00:00+07:00',
  updatedAt: r.updatedAt || '2026-10-01T17:00:00+07:00',
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

export function subscribeAttendance(cb) {
  listeners.add(cb)
  return () => listeners.delete(cb)
}

// ---------- Lookups / status -----------------------------------------------

export function getAttendanceStatuses() {
  return ATTENDANCE_STATUSES.slice()
}

// ---------- Time helpers ---------------------------------------------------

/** Convert "HH:MM" to minutes since 00:00. */
function toMinutes(hhmm) {
  if (!hhmm || typeof hhmm !== 'string') return null
  const m = /^(\d{1,2}):(\d{2})$/.exec(hhmm)
  if (!m) return null
  const h = parseInt(m[1], 10)
  const mm = parseInt(m[2], 10)
  if (Number.isNaN(h) || Number.isNaN(mm)) return null
  if (h > 23 || mm > 59) return null
  return h * 60 + mm
}

// Silence unused-import lint
void getDepartments

// ---------- Computation ----------------------------------------------------

/**
 * Tính lại workHours / lateMinutes / earlyLeaveMinutes / status từ checkIn +
 * checkOut theo ca làm mặc định. KHÔNG tự ý đặt status khi thiếu dữ liệu.
 *
 * Trả về { workHours, lateMinutes, earlyLeaveMinutes, status, reason? }
 *
 * @param {{ checkIn?: string|null, checkOut?: string|null, status?: string, note?: string }} input
 */
export function recomputeMetrics({ checkIn, checkOut, status, note } = {}) {
  const inM = toMinutes(checkIn)
  const outM = toMinutes(checkOut)

  // Thiếu dữ liệu (giờ vào HOẶC giờ ra rỗng) -> trạng thái "incomplete"
  // trừ khi status đã được set là on_leave / absent.
  if ((inM === null || outM === null)) {
    if (status === 'on_leave' || status === 'absent') {
      return { workHours: 0, lateMinutes: 0, earlyLeaveMinutes: 0, status, note: note ?? '' }
    }
    return {
      workHours: 0,
      lateMinutes: 0,
      earlyLeaveMinutes: 0,
      status: 'incomplete',
      note: note ?? '',
    }
  }

  const startM = toMinutes(DEFAULT_SHIFT_RULE.startTime)
  const endM = toMinutes(DEFAULT_SHIFT_RULE.endTime)
  const grace = DEFAULT_SHIFT_RULE.lateGraceMinutes
  const earlyGrace = DEFAULT_SHIFT_RULE.earlyLeaveGraceMinutes
  const breakMin = DEFAULT_SHIFT_RULE.breakMinutes

  // Tính giờ làm = checkOut - checkIn - break. Nếu ra sớm hơn vào thì giữ 0.
  const rawMinutes = Math.max(0, outM - inM - breakMin)

  const lateMinutes = Math.max(0, inM - startM - grace)
  const earlyLeaveMinutes = Math.max(0, endM + earlyGrace - outM)

  // Xác định status: ưu tiên giữ status hiện tại nếu là on_leave/absent
  let derivedStatus = 'on_time'
  if (status === 'on_leave' || status === 'absent') {
    derivedStatus = status
  } else if (lateMinutes > 0 && earlyLeaveMinutes > 0) {
    derivedStatus = 'late' // ưu tiên đi muộn trong label nhưng giữ cả 2 field
  } else if (lateMinutes > 0) {
    derivedStatus = 'late'
  } else if (earlyLeaveMinutes > 0) {
    derivedStatus = 'early_leave'
  } else if (outM <= inM) {
    // Giờ ra <= giờ vào: bất hợp lệ cho ca thường, đánh incomplete
    derivedStatus = 'incomplete'
  }

  return {
    workHours: Math.round((rawMinutes / 60) * 100) / 100,
    lateMinutes,
    earlyLeaveMinutes,
    status: derivedStatus,
    note: note ?? '',
  }
}

/**
 * Validate payload form. Trả về object errors.
 *
 * @param {Object} payload
 * @param {string|null} excludeRecordId  Khi sửa, loại trừ bản ghi này khi
 *                                      kiểm tra trùng (employeeId, date).
 */
export function validateAttendance(payload, { excludeRecordId = null } = {}) {
  const errors = {}

  if (!payload.employeeId) {
    errors.employeeId = 'Vui lòng chọn nhân viên.'
  } else if (!getEmployeeById(payload.employeeId)) {
    errors.employeeId = 'Nhân viên không tồn tại.'
  }

  if (!payload.date) {
    errors.date = 'Vui lòng chọn ngày chấm công.'
  } else {
    const d = new Date(payload.date)
    if (Number.isNaN(d.getTime())) {
      errors.date = 'Ngày chấm công không hợp lệ.'
    }
  }

  // checkIn / checkOut có thể null nếu status là on_leave / absent / incomplete
  const checkInM = toMinutes(payload.checkIn)
  const checkOutM = toMinutes(payload.checkOut)

  if (payload.checkIn && checkInM === null) {
    errors.checkIn = 'Giờ vào không đúng định dạng HH:MM.'
  }
  if (payload.checkOut && checkOutM === null) {
    errors.checkOut = 'Giờ ra không đúng định dạng HH:MM.'
  }

  // Nếu cả checkIn và checkOut đều có mà checkOut <= checkIn -> báo lỗi
  if (
    checkInM !== null &&
    checkOutM !== null &&
    checkOutM <= checkInM
  ) {
    errors.checkOut = 'Giờ ra phải sau giờ vào.'
  }

  if (!payload.status) {
    errors.status = 'Vui lòng chọn trạng thái.'
  } else if (!ATTENDANCE_STATUS_LABEL[payload.status]) {
    errors.status = 'Trạng thái không hợp lệ.'
  }

  // Trùng nhân viên + ngày (mỗi người 1 bản ghi/ngày)
  if (!errors.employeeId && !errors.date && payload.employeeId && payload.date) {
    const dup = records.some(
      (r) => r.id !== excludeRecordId && r.employeeId === payload.employeeId && r.date === payload.date,
    )
    if (dup) {
      errors._form = 'Đã tồn tại bản ghi chấm công cho nhân viên này trong ngày này.'
    }
  }

  if (payload.note && payload.note.length > 500) {
    errors.note = 'Ghi chú không được vượt quá 500 ký tự.'
  }

  return errors
}

// ---------- Mutations ------------------------------------------------------

function makeId() {
  let max = 0
  for (const r of records) {
    const m = /^att-(\d+)$/.exec(r.id || '')
    if (m) {
      const n = parseInt(m[1], 10)
      if (n > max) max = n
    }
  }
  return `att-${String(max + 1).padStart(3, '0')}`
}

function nowIso() {
  return new Date().toISOString()
}

/**
 * Tạo bản ghi chấm công.
 */
export function createAttendanceRecord(payload) {
  const errors = validateAttendance(payload)
  if (Object.keys(errors).length) {
    return Promise.resolve({ ok: false, errors })
  }
  const metrics = recomputeMetrics({
    checkIn: payload.checkIn || null,
    checkOut: payload.checkOut || null,
    status: payload.status,
    note: payload.note,
  })
  const now = nowIso()
  const record = {
    id: makeId(),
    employeeId: payload.employeeId,
    date: payload.date,
    checkIn: payload.checkIn || null,
    checkOut: payload.checkOut || null,
    workHours: metrics.workHours,
    lateMinutes: metrics.lateMinutes,
    earlyLeaveMinutes: metrics.earlyLeaveMinutes,
    status: metrics.status,
    note: payload.note?.trim() ?? '',
    // Phase 28: approval status mặc định = 'pending' cho mỗi record mới.
    approvalStatus: payload.approvalStatus || 'pending',
    approvedBy: null,
    approvedAt: null,
    approvalNote: '',
    createdAt: now,
    updatedAt: now,
  }
  records = [record, ...records]
  notify('create', { record })
  return Promise.resolve({ ok: true, record })
}

/**
 * Cập nhật bản ghi.
 */
export function updateAttendanceRecord(id, payload) {
  const existing = records.find((r) => r.id === id)
  if (!existing) {
    return Promise.resolve({ ok: false, errors: { _form: 'Không tìm thấy bản ghi.' } })
  }
  const errors = validateAttendance(payload, { excludeRecordId: id })
  if (Object.keys(errors).length) {
    return Promise.resolve({ ok: false, errors })
  }
  const metrics = recomputeMetrics({
    checkIn: payload.checkIn || null,
    checkOut: payload.checkOut || null,
    status: payload.status,
    note: payload.note,
  })
  const updated = {
    ...existing,
    employeeId: payload.employeeId,
    date: payload.date,
    checkIn: payload.checkIn || null,
    checkOut: payload.checkOut || null,
    workHours: metrics.workHours,
    lateMinutes: metrics.lateMinutes,
    earlyLeaveMinutes: metrics.earlyLeaveMinutes,
    status: metrics.status,
    note: payload.note?.trim() ?? '',
    // Phase 28: nếu record đang bị rejected → set lại pending khi Admin sửa.
    approvalStatus: existing.approvalStatus === 'rejected' ? 'pending' : existing.approvalStatus,
    updatedAt: nowIso(),
  }
  records = records.map((r) => (r.id === id ? updated : r))
  notify('update', { record: updated })
  return Promise.resolve({ ok: true, record: updated })
}

// ---------- Phase 28: Approval workflow ----------------------------------

export const ATTENDANCE_APPROVAL_STATUSES = Object.freeze([
  { value: 'pending',  label: 'Chờ duyệt',   tone: 'warning' },
  { value: 'approved', label: 'Đã duyệt',    tone: 'success' },
  { value: 'rejected', label: 'Từ chối',     tone: 'danger' },
])

export const ATTENDANCE_APPROVAL_LABEL = ATTENDANCE_APPROVAL_STATUSES.reduce(
  (acc, s) => { acc[s.value] = s.label; return acc },
  {},
)

export const ATTENDANCE_APPROVAL_TONE = ATTENDANCE_APPROVAL_STATUSES.reduce(
  (acc, s) => { acc[s.value] = s.tone; return acc },
  {},
)

function setApproval(id, decision, reviewerId, note, employeeName, date) {
  const existing = records.find((r) => r.id === id)
  if (!existing) {
    return Promise.resolve({ ok: false, error: 'Không tìm thấy bản ghi.' })
  }
  if (existing.approvalStatus === 'approved' && decision === 'approved') {
    return Promise.resolve({ ok: false, error: 'Bản ghi đã được duyệt.' })
  }
  const updated = {
    ...existing,
    approvalStatus: decision,
    approvedBy: reviewerId || null,
    approvedAt: nowIso(),
    approvalNote: note?.trim() || '',
    updatedAt: nowIso(),
  }
  records = records.map((r) => (r.id === id ? updated : r))
  notify('approval', { record: updated, decision, note: updated.approvalNote })

  // Phase 28: tạo notification cho employee (best-effort, fail-soft).
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const notifService = require('./notificationService')
    if (notifService.createNotification) {
      notifService.createNotification({
        type: 'attendance',
        relatedEntityType: 'attendance',
        relatedEntityId: existing.id,
        recipientId: existing.employeeId,
        title: decision === 'approved'
          ? `Attendance record approved`
          : `Attendance record rejected`,
        description: `Ngày ${date || existing.date}${note ? ` · ${note}` : ''}`,
        createdBy: reviewerId || 'usr-admin-001',
      })
    }
  } catch (_e) { void _e }

  return Promise.resolve({ ok: true, record: updated })
}

export function approveAttendance(id, reviewerId = null, note = '', employeeName = '', date = '') {
  return setApproval(id, 'approved', reviewerId, note, employeeName, date)
}

export function rejectAttendance(id, reviewerId = null, note = '', employeeName = '', date = '') {
  return setApproval(id, 'rejected', reviewerId, note, employeeName, date)
}

export function getApprovalSummary(filters = {}) {
  const {
    dateFrom = '',
    dateTo = '',
    departmentId = '',
  } = filters

  let rows = records.map(decorate)
  if (dateFrom) rows = rows.filter((r) => r.date >= dateFrom)
  if (dateTo)   rows = rows.filter((r) => r.date <= dateTo)
  if (departmentId) rows = rows.filter((r) => r.departmentId === departmentId)

  return {
    total: rows.length,
    pending:  rows.filter((r) => r.approvalStatus === 'pending').length,
    approved: rows.filter((r) => r.approvalStatus === 'approved').length,
    rejected: rows.filter((r) => r.approvalStatus === 'rejected').length,
  }
}

// ---------- Phase 28: Attendance Rules -----------------------------------

const RULES_SEED = [
  {
    id: 'rule-001',
    name: 'Ca làm việc tiêu chuẩn',
    description: 'Khung giờ làm việc mặc định 08:00 - 17:00 (Thứ 2 - Thứ 6).',
    category: 'working_hours',
    enabled: true,
    createdBy: 'usr-admin-001',
    createdAt: '2026-09-01T08:00:00+07:00',
    updatedAt: '2026-09-01T08:00:00+07:00',
  },
  {
    id: 'rule-002',
    name: 'Dung sai đi muộn / về sớm',
    description: 'Cho phép dung sai 5 phút khi đi muộn hoặc về sớm trước khi tính là vi phạm.',
    category: 'working_hours',
    enabled: true,
    createdBy: 'usr-admin-001',
    createdAt: '2026-09-01T08:00:00+07:00',
    updatedAt: '2026-09-01T08:00:00+07:00',
  },
  {
    id: 'rule-003',
    name: 'Yêu cầu duyệt chấm công',
    description: 'Mọi bản ghi chấm công mới cần được Admin phê duyệt trước khi tính hợp lệ.',
    category: 'approval',
    enabled: true,
    createdBy: 'usr-admin-001',
    createdAt: '2026-09-01T08:00:00+07:00',
    updatedAt: '2026-09-01T08:00:00+07:00',
  },
]

let rules = RULES_SEED.map((r) => ({ ...r }))

export const RULE_CATEGORIES = Object.freeze([
  { value: 'working_hours',  label: 'Working Hours' },
  { value: 'attendance_status', label: 'Attendance Status' },
  { value: 'approval',       label: 'Approval' },
])

export function getAttendanceRules() {
  return rules.slice().sort((a, b) => String(a.id).localeCompare(String(b.id)))
}

export function getAttendanceRuleById(id) {
  return rules.find((r) => r.id === id) || null
}

export function validateRule(payload) {
  const errors = {}
  if (!payload.name?.trim()) errors.name = 'Vui lòng nhập tên quy tắc.'
  if (payload.category && !RULE_CATEGORIES.find((c) => c.value === payload.category)) {
    errors.category = 'Danh mục không hợp lệ.'
  }
  return errors
}

function nextRuleId() {
  let max = 0
  for (const r of rules) {
    const m = /^rule-(\d+)$/.exec(r.id || '')
    if (m) max = Math.max(max, parseInt(m[1], 10))
  }
  return `rule-${String(max + 1).padStart(3, '0')}`
}

export function createAttendanceRule(payload) {
  const errors = validateRule(payload)
  if (Object.keys(errors).length) return Promise.resolve({ ok: false, errors })
  const now = nowIso()
  const rule = {
    id: nextRuleId(),
    name: payload.name.trim(),
    description: payload.description?.trim() || '',
    category: payload.category || 'working_hours',
    enabled: payload.enabled !== false,
    createdBy: payload.createdBy || 'usr-admin-001',
    createdAt: now,
    updatedAt: now,
  }
  rules = [rule, ...rules]
  notify('rule:create', { rule })
  return Promise.resolve({ ok: true, rule })
}

export function updateAttendanceRule(id, payload) {
  const existing = rules.find((r) => r.id === id)
  if (!existing) return Promise.resolve({ ok: false, errors: { _form: 'Không tìm thấy quy tắc.' } })
  const errors = validateRule(payload)
  if (Object.keys(errors).length) return Promise.resolve({ ok: false, errors })
  const updated = {
    ...existing,
    name: payload.name.trim(),
    description: payload.description?.trim() ?? existing.description,
    category: payload.category || existing.category,
    enabled: payload.enabled !== false,
    updatedAt: nowIso(),
  }
  rules = rules.map((r) => (r.id === id ? updated : r))
  notify('rule:update', { rule: updated })
  return Promise.resolve({ ok: true, rule: updated })
}

export function toggleAttendanceRule(id, enabled) {
  const existing = rules.find((r) => r.id === id)
  if (!existing) return Promise.resolve({ ok: false, error: 'Không tìm thấy quy tắc.' })
  const updated = { ...existing, enabled: Boolean(enabled), updatedAt: nowIso() }
  rules = rules.map((r) => (r.id === id ? updated : r))
  notify('rule:update', { rule: updated })
  return Promise.resolve({ ok: true, rule: updated })
}

export function deleteAttendanceRule(id) {
  const existing = rules.find((r) => r.id === id)
  if (!existing) return Promise.resolve({ ok: false, error: 'Không tìm thấy quy tắc.' })
  rules = rules.filter((r) => r.id !== id)
  notify('rule:delete', { id })
  return Promise.resolve({ ok: true })
}

// ---------- Phase 28: Employee scoped queries ----------------------------

export function getMyAttendance(employeeId) {
  return records
    .filter((r) => r.employeeId === employeeId)
    .map(decorate)
    .slice()
    .sort((a, b) => (a.date < b.date ? 1 : -1))
}

export function queryMyAttendance(employeeId, q = {}) {
  const {
    search = '',
    dateFrom = '',
    dateTo = '',
    status = '',
    approvalStatus = '',
    sortBy = 'date',
    sortDir = 'desc',
    page = 1,
    pageSize = 10,
  } = q

  let rows = records.map(decorate).filter((r) => r.employeeId === employeeId)
  const trimmed = search.trim().toLowerCase()
  if (trimmed) {
    rows = rows.filter((r) =>
      r.employeeName.toLowerCase().includes(trimmed) ||
      (r.note || '').toLowerCase().includes(trimmed),
    )
  }
  if (dateFrom) rows = rows.filter((r) => r.date >= dateFrom)
  if (dateTo)   rows = rows.filter((r) => r.date <= dateTo)
  if (status)         rows = rows.filter((r) => r.status === status)
  if (approvalStatus) rows = rows.filter((r) => r.approvalStatus === approvalStatus)

  const SORTABLE = ['date', 'checkIn', 'checkOut', 'workHours']
  if (SORTABLE.includes(sortBy)) {
    const sign = sortDir === 'desc' ? -1 : 1
    rows.sort((a, b) => {
      const av = a[sortBy]
      const bv = b[sortBy]
      if (av === bv) return 0
      if (av == null || av === '') return 1
      if (bv == null || bv === '') return -1
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

// ---------- Read helpers ---------------------------------------------------

export function getAttendanceById(id) {
  return records.find((r) => r.id === id) ?? null
}

export function getAttendanceRecords() {
  return records.slice()
}

/**
 * Decorate record với thông tin nhân viên / phòng ban. Dùng trong bảng +
 * filter. Lưu ý: KHÔNG mutate record gốc.
 */
function decorate(record) {
  const emp = getEmployeeById(record.employeeId)
  const dept = emp ? getDepartments().find((d) => d.id === emp.departmentId) : null
  return {
    ...record,
    employeeCode: emp?.employeeCode ?? '',
    employeeName: emp?.fullName ?? '—',
    departmentId: emp?.departmentId ?? '',
    departmentName: dept?.name ?? '—',
    statusLabel: ATTENDANCE_STATUS_LABEL[record.status] ?? record.status,
  }
}

/**
 * Query chấm công với filter / sort / paginate.
 *
 * @param {Object} q
 * @param {string} [q.search]         Tìm theo tên / mã NV
 * @param {string} [q.dateFrom]       YYYY-MM-DD
 * @param {string} [q.dateTo]
 * @param {string} [q.departmentId]
 * @param {string} [q.employeeId]
 * @param {string} [q.status]
 * @param {string} [q.sortBy]         employeeName | date | checkIn | checkOut | workHours
 * @param {'asc'|'desc'} [q.sortDir]
 * @param {number} [q.page]
 * @param {number} [q.pageSize]
 */
export function queryAttendance(q = {}) {
  const {
    search = '',
    dateFrom = '',
    dateTo = '',
    departmentId = '',
    employeeId = '',
    status = '',
    sortBy = 'date',
    sortDir = 'desc',
    page = 1,
    pageSize = 10,
  } = q

  const trimmed = search.trim().toLowerCase()

  let rows = records.map(decorate)

  if (trimmed) {
    rows = rows.filter(
      (r) =>
        r.employeeName.toLowerCase().includes(trimmed) ||
        r.employeeCode.toLowerCase().includes(trimmed),
    )
  }
  if (dateFrom) {
    rows = rows.filter((r) => r.date >= dateFrom)
  }
  if (dateTo) {
    rows = rows.filter((r) => r.date <= dateTo)
  }
  if (departmentId) {
    rows = rows.filter((r) => r.departmentId === departmentId)
  }
  if (employeeId) {
    rows = rows.filter((r) => r.employeeId === employeeId)
  }
  if (status) {
    rows = rows.filter((r) => r.status === status)
  }

  // Sort: với checkIn/checkOut: record có thể null -> đẩy xuống cuối.
  const SORTABLE = ['employeeName', 'date', 'checkIn', 'checkOut', 'workHours']
  if (SORTABLE.includes(sortBy)) {
    const sign = sortDir === 'desc' ? -1 : 1
    rows.sort((a, b) => {
      const av = a[sortBy]
      const bv = b[sortBy]
      if (av === bv) return 0
      if (av === null || av === undefined || av === '') return 1
      if (bv === null || bv === undefined || bv === '') return -1
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
 * Tính thống kê trên phạm vi đang lọc.
 *
 * Trả về:
 *   - inScope: tổng nhân viên (đang active) thuộc phạm vi phòng ban (nếu
 *     filter theo phòng ban). Nếu filter theo ngày, scope = tất cả NV
 *     active của công ty.
 *   - recorded: số bản ghi trong phạm vi.
 *   - onTime, late, earlyLeave, onLeave, absent, incomplete: số bản ghi.
 *   - attendanceRate: tỉ lệ chuyên cần = (onTime + late + earlyLeave) / (active trong phạm vi).
 *     Đây là tỉ lệ "có mặt" (không tính nghỉ phép / vắng / thiếu dữ liệu).
 *
 * Quy tắc đếm:
 *   - Mỗi bản ghi = 1 lượt. Mỗi nhân viên có thể có 1 bản ghi/ngày, nên
 *     đếm theo bản ghi là chính xác.
 */
export function getAttendanceSummary(filters = {}) {
  const {
    dateFrom = '',
    dateTo = '',
    departmentId = '',
  } = filters

  // Phạm vi ngày: nếu thiếu 1 đầu thì mặc định lấy rộng (toàn dữ liệu)
  const allRows = records.map(decorate)
  let rowsInScope = allRows
  if (dateFrom) rowsInScope = rowsInScope.filter((r) => r.date >= dateFrom)
  if (dateTo)   rowsInScope = rowsInScope.filter((r) => r.date <= dateTo)
  if (departmentId) rowsInScope = rowsInScope.filter((r) => r.departmentId === departmentId)

  const recorded = rowsInScope.length

  // inScope = tổng NV active trong phạm vi (để tính attendanceRate)
  // Nếu filter theo ngày: scope = tổng NV active cùng phòng ban (hoặc công ty)
  const allEmployees = getEmployees()
  let activeEmployees
  if (departmentId) {
    activeEmployees = allEmployees.filter((e) => e.status === 'active' && e.departmentId === departmentId)
  } else {
    activeEmployees = allEmployees.filter((e) => e.status === 'active')
  }
  const inScope = activeEmployees.length
  const workingDays = countWorkingDays(dateFrom, dateTo)
  const expected = inScope * workingDays

  const counts = {
    on_time: 0,
    late: 0,
    early_leave: 0,
    on_leave: 0,
    absent: 0,
    incomplete: 0,
  }
  for (const r of rowsInScope) {
    if (counts[r.status] !== undefined) counts[r.status] += 1
  }

  const presentCount = counts.on_time + counts.late + counts.early_leave
  // AttendanceRate tính trên kỳ vọng có mặt = active * workingDays
  const attendanceRate = expected ? Math.round((presentCount / expected) * 1000) / 10 : 0

  return {
    inScope,
    recorded,
    workingDays,
    expected,
    present: presentCount,
    late: counts.late,
    earlyLeave: counts.early_leave,
    onLeave: counts.on_leave,
    absent: counts.absent,
    incomplete: counts.incomplete,
    attendanceRate,
    range: { dateFrom, dateTo },
  }
}

/**
 * Đếm số ngày làm việc trong khoảng (mặc định: chỉ tính T2-T6, trừ CN).
 * Nếu thiếu 1 đầu -> đếm trên toàn dữ liệu.
 */
export function countWorkingDays(dateFrom, dateTo) {
  let start = dateFrom
  let end = dateTo
  if (!start || !end) {
    const allDates = records.map((r) => r.date).filter(Boolean).sort()
    if (!start) start = allDates[0]
    if (!end) end = allDates[allDates.length - 1]
  }
  if (!start || !end) return 0
  if (start > end) [start, end] = [end, start]

  const d = new Date(start)
  const e = new Date(end)
  let count = 0
  while (d <= e) {
    const day = d.getDay()
    // 0 = CN, 6 = T7 (cuối tuần không tính công)
    if (day !== 0 && day !== 6) count += 1
    d.setDate(d.getDate() + 1)
  }
  return count
}

// Silence unused-import lint
void getDepartments