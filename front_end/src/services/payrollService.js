/**
 * Nguyên tắc:
 * - Mọi thao tác (đọc / lọc / sort / paginate / tạo / sửa / đánh dấu thanh
 *   toán) đều đi qua service. JSX không xử lý logic dữ liệu.
 * - Tái sử dụng dữ liệu nhân viên & phòng ban từ employeeService.
 * - KHÔNG tự đặt tỷ lệ thuế / bảo hiểm. Công thức demo ở payrollUtils.
 * - Không cho phép sửa record đã thanh toán (theo yêu cầu đề bài).
 * - Không cho phép thanh toán lại record đã thanh toán.
 * - Service bắn pub-sub để UI bump tick và re-render.
 */

import {
  PAYROLL_RECORDS as SEED_RECORDS,
  PAYMENT_STATUSES,
} from '../data/payrollMockData'

import {
  getEmployeeById,
  getEmployees,
  getDepartments,
} from './employeeService'

import {
  calcPayroll,
  normalizePayrollPayload,
  isNetSalaryValid,
} from '../utils/payrollUtils'

// ---------- Mutable store -------------------------------------------------
let records = SEED_RECORDS.map((r) => ({
  ...r,
  // Phase 29: approval workflow tách biệt với payment status.
  approvalStatus: r.approvalStatus || (r.paymentStatus === 'paid' ? 'approved' : 'pending'),
  approvedBy: r.approvedBy || null,
  approvedAt: r.approvedAt || null,
  approvalNote: r.approvalNote || '',
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

export function subscribePayroll(cb) {
  listeners.add(cb)
  return () => listeners.delete(cb)
}

// ---------- Lookups -------------------------------------------------------

export function getPaymentStatuses() {
  return PAYMENT_STATUSES.slice()
}

// ---------- Validators ----------------------------------------------------

/**
 * Validate payload payroll. Trả về object errors.
 *  - excludeId: dùng khi update để loại trừ bản ghi hiện tại khỏi check trùng.
 */
export function validatePayroll(payload, { excludeId = null, skipPaidCheck = false } = {}) {
  const errors = {}

  if (!payload.employeeId) {
    errors.employeeId = 'Vui lòng chọn nhân viên.'
  } else if (!getEmployeeById(payload.employeeId)) {
    errors.employeeId = 'Nhân viên không tồn tại trong hệ thống.'
  }

  if (!payload.month) {
    errors.month = 'Vui lòng chọn tháng.'
  } else if (Number(payload.month) < 1 || Number(payload.month) > 12) {
    errors.month = 'Tháng phải nằm trong khoảng 1–12.'
  }

  if (!payload.year) {
    errors.year = 'Vui lòng chọn năm.'
  } else {
    const y = Number(payload.year)
    if (!Number.isInteger(y) || y < 2000 || y > 2100) {
      errors.year = 'Năm không hợp lệ (2000–2100).'
    }
  }

  // Trùng nhân viên + kỳ lương
  if (
    payload.employeeId &&
    payload.month &&
    payload.year &&
    !errors.month &&
    !errors.year
  ) {
    const dup = records.find(
      (r) =>
        r.id !== excludeId &&
        r.employeeId === payload.employeeId &&
        r.month === Number(payload.month) &&
        r.year === Number(payload.year),
    )
    if (dup) {
      errors._form = `Nhân viên này đã có bảng lương ${String(payload.month).padStart(2, '0')}/${payload.year}.`
    }
  }

  // Validate các trường tiền
  const fields = [
    'baseSalary',
    'allowance',
    'bonus',
    'overtimePay',
    'insuranceDeduction',
    'taxDeduction',
    'otherDeduction',
  ]
  for (const f of fields) {
    const v = payload[f]
    if (v === '' || v === null || v === undefined) {
      errors[f] = 'Vui lòng nhập số hợp lệ.'
      continue
    }
    const n = Number(v)
    if (Number.isNaN(n)) {
      errors[f] = 'Vui lòng nhập số hợp lệ.'
    } else if (n < 0) {
      errors[f] = 'Không cho phép giá trị âm.'
    }
  }

  // Validate lương thực nhận (chỉ khi các trường không có lỗi field)
  const hasFieldError = fields.some((f) => errors[f])
  if (!hasFieldError && payload.employeeId) {
    const normalized = normalizePayrollPayload(payload)
    const totals = calcPayroll(normalized)
    if (!isNetSalaryValid(totals)) {
      errors._form =
        'Lương thực nhận đang âm. Vui lòng kiểm tra lại các khoản khấu trừ.'
    }
  }

  if (skipPaidCheck === false) {
    // Đảm bảo không tạo trùng đơn đã thanh toán cho cùng nhân viên + kỳ
    const dup = records.find(
      (r) =>
        r.id !== excludeId &&
        r.employeeId === payload.employeeId &&
        r.month === Number(payload.month) &&
        r.year === Number(payload.year) &&
        r.paymentStatus === 'paid',
    )
    if (dup) {
      errors._form = `Bảng lương ${dup.payrollCode} đã thanh toán, không thể tạo mới.`
    }
  }

  return errors
}

// ---------- Mutations ------------------------------------------------------

function nowIso() {
  return new Date().toISOString()
}

function makeId() {
  let max = 0
  for (const r of records) {
    const m = /^pr-(\d+)$/.exec(r.id || '')
    if (m) {
      const n = parseInt(m[1], 10)
      if (n > max) max = n
    }
  }
  return `pr-${String(max + 1).padStart(3, '0')}`
}

function generatePayrollCode(month, year) {
  const prefix = `PR-${year}${String(month).padStart(2, '0')}-`
  let n = 1
  while (records.some((r) => r.payrollCode === `${prefix}${String(n).padStart(4, '0')}`)) {
    n += 1
  }
  return `${prefix}${String(n).padStart(4, '0')}`
}

/** Tạo bảng lương mới. */
export function createPayroll(payload) {
  const errors = validatePayroll(payload, { skipPaidCheck: false })
  if (Object.keys(errors).length) {
    return Promise.resolve({ ok: false, errors })
  }
  const emp = getEmployeeById(payload.employeeId)
  if (!emp) {
    return Promise.resolve({ ok: false, errors: { _form: 'Không tìm thấy nhân viên.' } })
  }
  const departments = getDepartments()
  const dept = departments.find((d) => d.id === emp.departmentId)
  const normalized = normalizePayrollPayload(payload)
  const totals = calcPayroll(normalized)
  const now = nowIso()
  const record = {
    id: makeId(),
    payrollCode: generatePayrollCode(Number(payload.month), Number(payload.year)),
    employeeId: emp.id,
    employeeCode: emp.employeeCode,
    employeeName: emp.fullName,
    departmentId: emp.departmentId,
    departmentName: dept?.name ?? '—',
    month: Number(payload.month),
    year: Number(payload.year),
    baseSalary: normalized.baseSalary,
    allowance: normalized.allowance,
    bonus: normalized.bonus,
    overtimePay: normalized.overtimePay,
    grossSalary: totals.grossSalary,
    insuranceDeduction: normalized.insuranceDeduction,
    taxDeduction: normalized.taxDeduction,
    otherDeduction: normalized.otherDeduction,
    totalDeduction: totals.totalDeduction,
    netSalary: totals.netSalary,
    paymentStatus: 'unpaid',
    paymentDate: null,
    note: payload.note?.trim() ?? '',
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

/** Cập nhật bảng lương. Không cho sửa nếu đã thanh toán. */
export function updatePayroll(id, payload) {
  const existing = records.find((r) => r.id === id)
  if (!existing) {
    return Promise.resolve({ ok: false, errors: { _form: 'Không tìm thấy bảng lương.' } })
  }
  if (existing.paymentStatus === 'paid') {
    return Promise.resolve({
      ok: false,
      errors: { _form: 'Bảng lương đã thanh toán, không thể chỉnh sửa.' },
    })
  }
  const merged = { ...existing, ...payload }
  const errors = validatePayroll(merged, { excludeId: id })
  if (Object.keys(errors).length) {
    return Promise.resolve({ ok: false, errors })
  }
  const normalized = normalizePayrollPayload(merged)
  const totals = calcPayroll(normalized)
  const updated = {
    ...existing,
    employeeId: merged.employeeId,
    employeeCode: existing.employeeCode,
    employeeName: existing.employeeName,
    departmentId: existing.departmentId,
    departmentName: existing.departmentName,
    month: Number(merged.month),
    year: Number(merged.year),
    baseSalary: normalized.baseSalary,
    allowance: normalized.allowance,
    bonus: normalized.bonus,
    overtimePay: normalized.overtimePay,
    grossSalary: totals.grossSalary,
    insuranceDeduction: normalized.insuranceDeduction,
    taxDeduction: normalized.taxDeduction,
    otherDeduction: normalized.otherDeduction,
    totalDeduction: totals.totalDeduction,
    netSalary: totals.netSalary,
    note: merged.note?.trim() ?? '',
    // Nếu record đang rejected → reset về pending khi Admin edit.
    approvalStatus: existing.approvalStatus === 'rejected' ? 'pending' : existing.approvalStatus,
    updatedAt: nowIso(),
  }
  records = records.map((r) => (r.id === id ? updated : r))
  notify('update', { record: updated })
  return Promise.resolve({ ok: true, record: updated })
}

/** Đánh dấu đã thanh toán. */
export function markPayrollAsPaid(id, paymentDate) {
  const existing = records.find((r) => r.id === id)
  if (!existing) {
    return Promise.resolve({ ok: false, error: 'Không tìm thấy bảng lương.' })
  }
  if (existing.paymentStatus === 'paid') {
    return Promise.resolve({
      ok: false,
      error: `Bảng lương đã ở trạng thái "Đã thanh toán" từ ${existing.paymentDate}.`,
    })
  }
  // Validate dữ liệu hợp lệ trước khi thanh toán
  if (!isNetSalaryValid(existing)) {
    return Promise.resolve({
      ok: false,
      error: 'Bảng lương có lương thực nhận âm, không thể thanh toán.',
    })
  }
  const date = paymentDate || new Date().toISOString().slice(0, 10)
  const updated = {
    ...existing,
    paymentStatus: 'paid',
    paymentDate: date,
    updatedAt: nowIso(),
  }
  records = records.map((r) => (r.id === id ? updated : r))
  notify('pay', { record: updated })
  return Promise.resolve({ ok: true, record: updated })
}

// ---------- Phase 29: Approval workflow ---------------------------------

export const PAYROLL_APPROVAL_STATUSES = Object.freeze([
  { value: 'pending',  label: 'Chờ duyệt',   tone: 'warning' },
  { value: 'approved', label: 'Đã duyệt',    tone: 'success' },
  { value: 'rejected', label: 'Từ chối',     tone: 'danger' },
])

export const PAYROLL_APPROVAL_LABEL = PAYROLL_APPROVAL_STATUSES.reduce(
  (acc, s) => { acc[s.value] = s.label; return acc },
  {},
)

export const PAYROLL_APPROVAL_TONE = PAYROLL_APPROVAL_STATUSES.reduce(
  (acc, s) => { acc[s.value] = s.tone; return acc },
  {},
)

function setApproval(id, decision, reviewerId, note) {
  const existing = records.find((r) => r.id === id)
  if (!existing) return Promise.resolve({ ok: false, error: 'Không tìm thấy bảng lương.' })
  if (existing.approvalStatus === 'approved' && decision === 'approved') {
    return Promise.resolve({ ok: false, error: 'Bảng lương đã được duyệt.' })
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
  notify('approval', { record: updated, decision })

  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const notifService = require('./notificationService')
    if (notifService.createNotification) {
      notifService.createNotification({
        type: 'payroll',
        relatedEntityType: 'payroll',
        relatedEntityId: existing.id,
        recipientId: existing.employeeId,
        title: decision === 'approved'
          ? `Your payroll has been approved`
          : `Your payroll requires review`,
        description: `Kỳ lương T${String(existing.month).padStart(2, '0')}/${existing.year}${note ? ` · ${note}` : ''}`,
        createdBy: reviewerId || 'usr-admin-001',
      })
    }
  } catch (_e) { void _e }

  return Promise.resolve({ ok: true, record: updated })
}

export function approvePayroll(id, reviewerId = null, note = '') {
  return setApproval(id, 'approved', reviewerId, note)
}

export function rejectPayroll(id, reviewerId = null, note = '') {
  return setApproval(id, 'rejected', reviewerId, note)
}

export function getApprovalSummary(filters = {}) {
  let rows = records.map(decorate)
  if (filters.month) rows = rows.filter((r) => Number(r.month) === Number(filters.month))
  if (filters.year) rows = rows.filter((r) => Number(r.year) === Number(filters.year))
  if (filters.departmentId) rows = rows.filter((r) => r.departmentId === filters.departmentId)
  if (filters.employeeId) rows = rows.filter((r) => r.employeeId === filters.employeeId)

  return {
    total:    rows.length,
    pending:  rows.filter((r) => r.approvalStatus === 'pending').length,
    approved: rows.filter((r) => r.approvalStatus === 'approved').length,
    rejected: rows.filter((r) => r.approvalStatus === 'rejected').length,
  }
}

// ---------- Phase 29: Payroll Rules -------------------------------------

const RULES_SEED = [
  {
    id: 'plrule-001',
    name: 'Công thức lương Gross',
    description: 'Gross = Lương cơ bản + Phụ cấp + Thưởng + Làm thêm.',
    type: 'gross',
    enabled: true,
    createdBy: 'usr-admin-001',
    createdAt: '2026-09-01T08:00:00+07:00',
    updatedAt: '2026-09-01T08:00:00+07:00',
  },
  {
    id: 'plrule-002',
    name: 'Công thức khấu trừ',
    description: 'Tổng khấu trừ = BHXH + Thuế TNCN + Khấu trừ khác.',
    type: 'deduction',
    enabled: true,
    createdBy: 'usr-admin-001',
    createdAt: '2026-09-01T08:00:00+07:00',
    updatedAt: '2026-09-01T08:00:00+07:00',
  },
  {
    id: 'plrule-003',
    name: 'Yêu cầu duyệt bảng lương',
    description: 'Bảng lương phải được Admin duyệt trước khi thanh toán.',
    type: 'approval',
    enabled: true,
    createdBy: 'usr-admin-001',
    createdAt: '2026-09-01T08:00:00+07:00',
    updatedAt: '2026-09-01T08:00:00+07:00',
  },
]

let rules = RULES_SEED.map((r) => ({ ...r }))

export const PAYROLL_RULE_TYPES = Object.freeze([
  { value: 'gross',     label: 'Gross Salary' },
  { value: 'allowance', label: 'Allowance' },
  { value: 'bonus',     label: 'Bonus' },
  { value: 'overtime',  label: 'Overtime' },
  { value: 'deduction', label: 'Deduction' },
  { value: 'approval',  label: 'Approval' },
])

export function getPayrollRules() {
  return rules.slice().sort((a, b) => String(a.id).localeCompare(String(b.id)))
}
export function getPayrollRuleById(id) {
  return rules.find((r) => r.id === id) || null
}

function nextPayrollRuleId() {
  let max = 0
  for (const r of rules) {
    const m = /^plrule-(\d+)$/.exec(r.id || '')
    if (m) max = Math.max(max, parseInt(m[1], 10))
  }
  return `plrule-${String(max + 1).padStart(3, '0')}`
}

export function validatePayrollRule(payload) {
  const errors = {}
  if (!payload.name?.trim()) errors.name = 'Vui lòng nhập tên quy tắc.'
  if (payload.type && !PAYROLL_RULE_TYPES.find((t) => t.value === payload.type)) {
    errors.type = 'Loại không hợp lệ.'
  }
  return errors
}

export function createPayrollRule(payload) {
  const errors = validatePayrollRule(payload)
  if (Object.keys(errors).length) return Promise.resolve({ ok: false, errors })
  const now = nowIso()
  const rule = {
    id: nextPayrollRuleId(),
    name: payload.name.trim(),
    description: payload.description?.trim() || '',
    type: payload.type || 'gross',
    enabled: payload.enabled !== false,
    createdBy: payload.createdBy || 'usr-admin-001',
    createdAt: now,
    updatedAt: now,
  }
  rules = [rule, ...rules]
  notify('rule:create', { rule })
  return Promise.resolve({ ok: true, rule })
}

export function updatePayrollRule(id, payload) {
  const existing = rules.find((r) => r.id === id)
  if (!existing) return Promise.resolve({ ok: false, errors: { _form: 'Không tìm thấy quy tắc.' } })
  const errors = validatePayrollRule(payload)
  if (Object.keys(errors).length) return Promise.resolve({ ok: false, errors })
  const updated = {
    ...existing,
    name: payload.name.trim(),
    description: payload.description?.trim() ?? existing.description,
    type: payload.type || existing.type,
    enabled: payload.enabled !== false,
    updatedAt: nowIso(),
  }
  rules = rules.map((r) => (r.id === id ? updated : r))
  notify('rule:update', { rule: updated })
  return Promise.resolve({ ok: true, rule: updated })
}

export function togglePayrollRule(id, enabled) {
  const existing = rules.find((r) => r.id === id)
  if (!existing) return Promise.resolve({ ok: false, error: 'Không tìm thấy quy tắc.' })
  const updated = { ...existing, enabled: Boolean(enabled), updatedAt: nowIso() }
  rules = rules.map((r) => (r.id === id ? updated : r))
  notify('rule:update', { rule: updated })
  return Promise.resolve({ ok: true, rule: updated })
}

export function deletePayrollRule(id) {
  const existing = rules.find((r) => r.id === id)
  if (!existing) return Promise.resolve({ ok: false, error: 'Không tìm thấy quy tắc.' })
  rules = rules.filter((r) => r.id !== id)
  notify('rule:delete', { id })
  return Promise.resolve({ ok: true })
}

// ---------- Read helpers ---------------------------------------------------

export function getPayrollRecords() {
  return records.slice()
}

export function getPayrollById(id) {
  return records.find((r) => r.id === id) ?? null
}

export function getPayrollByEmployee(employeeId, filters = {}) {
  return records.filter((r) => {
    if (r.employeeId !== employeeId) return false
    if (filters.month && Number(r.month) !== Number(filters.month)) return false
    if (filters.year && Number(r.year) !== Number(filters.year)) return false
    if (filters.paymentStatus && r.paymentStatus !== filters.paymentStatus) return false
    if (filters.approvalStatus && r.approvalStatus !== filters.approvalStatus) return false
    return true
  })
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
 * Query bảng lương với filter / sort / paginate.
 */
export function queryPayroll(q = {}) {
  const {
    search = '',
    month = '',
    year = '',
    departmentId = '',
    paymentStatus = '',
    approvalStatus = '',
    employeeId = '',
    sortBy = 'updatedAt',
    sortDir = 'desc',
    page = 1,
    pageSize = 10,
  } = q

  const trimmed = search.trim().toLowerCase()
  let rows = records.map(decorate)

  if (trimmed) {
    rows = rows.filter(
      (r) =>
        (r.employeeName || '').toLowerCase().includes(trimmed) ||
        (r.employeeCode || '').toLowerCase().includes(trimmed) ||
        (r.payrollCode || '').toLowerCase().includes(trimmed),
    )
  }
  if (month) rows = rows.filter((r) => Number(r.month) === Number(month))
  if (year) rows = rows.filter((r) => Number(r.year) === Number(year))
  if (departmentId) rows = rows.filter((r) => r.departmentId === departmentId)
  if (paymentStatus) rows = rows.filter((r) => r.paymentStatus === paymentStatus)
  if (approvalStatus) rows = rows.filter((r) => r.approvalStatus === approvalStatus)
  if (employeeId) rows = rows.filter((r) => r.employeeId === employeeId)

  const SORTABLE = ['updatedAt', 'month', 'netSalary', 'grossSalary', 'employeeName']
  if (SORTABLE.includes(sortBy)) {
    const sign = sortDir === 'desc' ? -1 : 1
    rows.sort((a, b) => {
      const av = a[sortBy]
      const bv = b[sortBy]
      if (av === bv) return 0
      if (av === undefined || av === null || av === '') return 1
      if (bv === undefined || bv === null || bv === '') return -1
      if (typeof av === 'number' && typeof bv === 'number') {
        return av < bv ? -1 * sign : 1 * sign
      }
      return String(av).localeCompare(String(bv)) * sign
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

export function getPayrollSummary(filters = {}) {
  let rows = records.map(decorate)
  if (filters.month) rows = rows.filter((r) => Number(r.month) === Number(filters.month))
  if (filters.year) rows = rows.filter((r) => Number(r.year) === Number(filters.year))
  if (filters.departmentId) rows = rows.filter((r) => r.departmentId === filters.departmentId)
  if (filters.employeeId) rows = rows.filter((r) => r.employeeId === filters.employeeId)
  if (filters.paymentStatus) rows = rows.filter((r) => r.paymentStatus === filters.paymentStatus)

  // Đảm bảo chỉ tính 1 record / nhân viên / kỳ
  const seen = new Set()
  const uniqRows = rows.filter((r) => {
    const key = `${r.employeeId}-${r.year}-${r.month}`
    if (seen.has(key)) return false
    seen.add(key)
    return true
  })

  const totalEmployees = uniqRows.length
  const paid = uniqRows.filter((r) => r.paymentStatus === 'paid')
  const unpaid = uniqRows.filter((r) => r.paymentStatus === 'unpaid')
  const draft = uniqRows.filter((r) => r.paymentStatus === 'draft')

  return {
    totalEmployees,
    paidCount: paid.length,
    unpaidCount: unpaid.length,
    draftCount: draft.length,
    totalNet: paid.reduce((s, r) => s + (r.netSalary || 0), 0),
    unpaidNet: unpaid.reduce((s, r) => s + (r.netSalary || 0), 0),
    totalGross: uniqRows.reduce((s, r) => s + (r.grossSalary || 0), 0),
    totalDeduction: uniqRows.reduce((s, r) => s + (r.totalDeduction || 0), 0),
  }
}

// Silence unused-export lint
void getEmployees