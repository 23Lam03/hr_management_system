/**
 * benefitService - quản lý phúc lợi (Phần 12).
 *
 * Nguyên tắc:
 * - Pub-sub để UI bump tick và re-render.
 * - Mọi thao tác đều trả Promise (mô phỏng API).
 * - Validate đầy đủ; chặn trùng mã + duplicate assignment.
 * - Quyền sở hữu: employee chỉ xem được EmployeeBenefit của mình.
 */

import {
  BENEFITS as SEED_BENEFITS,
  EMPLOYEE_BENEFITS as SEED_ASSIGNMENTS,
  BENEFIT_TYPE_LABEL,
  BENEFIT_STATUS_LABEL,
  EMPLOYEE_BENEFIT_STATUS_LABEL,
  VALUE_UNIT_LABEL,
} from '../data/benefitMockData'

import {
  validateBenefit,
} from '../utils/benefitUtils'

import {
  getEmployeeById,
  getEmployees,
  getDepartments,
} from './employeeService'

// ---------- Mutable store -------------------------------------------------
let benefits = SEED_BENEFITS.map((b) => ({
  ...b,
  departmentIds: [...(b.departmentIds || [])],
}))
let assignments = SEED_ASSIGNMENTS.map((a) => ({ ...a }))

const listeners = new Set()
function notify(eventType, payload) {
  for (const cb of listeners) {
    try { cb({ type: eventType, payload }) } catch (_e) { void _e }
  }
}

export function subscribeBenefits(cb) {
  listeners.add(cb)
  return () => listeners.delete(cb)
}

// ---------- Lookups -------------------------------------------------------

export function getBenefitTypes() {
  return [
    { value: 'insurance', label: 'Bảo hiểm' },
    { value: 'allowance', label: 'Phụ cấp' },
    { value: 'healthcare', label: 'Chăm sóc sức khỏe' },
    { value: 'training',   label: 'Hỗ trợ đào tạo' },
    { value: 'welfare',    label: 'Phúc lợi khác' },
  ]
}

export function getBenefitStatuses() {
  return [
    { value: 'draft',   label: 'Bản nháp' },
    { value: 'active',  label: 'Đang hoạt động' },
    { value: 'paused',  label: 'Tạm dừng' },
    { value: 'expired', label: 'Hết hạn' },
  ]
}

export function getEmployeeBenefitStatuses() {
  return [
    { value: 'active',    label: 'Đang hưởng' },
    { value: 'expired',   label: 'Đã hết hạn' },
    { value: 'cancelled', label: 'Đã hủy' },
  ]
}

export function getValueUnits() {
  return [
    { value: 'vnd_month', label: 'VNĐ / tháng' },
    { value: 'vnd_year',  label: 'VNĐ / năm' },
    { value: 'percent',   label: '% lương' },
    { value: 'times',     label: 'Lần / năm' },
    { value: 'fixed',     label: 'Giá trị cố định' },
  ]
}

export function getBenefitTypeLabel(v) { return BENEFIT_TYPE_LABEL[v] ?? v }
export function getBenefitStatusLabel(v) { return BENEFIT_STATUS_LABEL[v] ?? v }
export function getEmployeeBenefitStatusLabel(v) { return EMPLOYEE_BENEFIT_STATUS_LABEL[v] ?? v }
export function getValueUnitLabel(v) { return VALUE_UNIT_LABEL[v] ?? v }

// ---------- Decorators ----------------------------------------------------

function decorateBenefit(b) {
  if (!b) return b
  const assigns = assignments.filter((a) => a.benefitId === b.id)
  const activeAssignees = assigns.filter((a) => a.status === 'active')
  const today = new Date().toISOString().slice(0, 10)
  const expiringSoon = activeAssignees.filter((a) => a.endDate && a.endDate >= today && a.endDate <= addDaysISO(today, 30)).length
  return {
    ...b,
    totalAssignees: assigns.length,
    activeAssigneesCount: activeAssignees.length,
    expiredAssigneesCount: assigns.filter((a) => a.status === 'expired').length,
    cancelledAssigneesCount: assigns.filter((a) => a.status === 'cancelled').length,
    expiringSoonCount: expiringSoon,
  }
}

function decorateAssignment(a) {
  if (!a) return a
  const emp = getEmployeeById(a.employeeId)
  if (!emp) return a
  const dept = getDepartments().find((d) => d.id === emp.departmentId)
  return {
    ...a,
    employeeCode: emp.employeeCode,
    employeeName: emp.fullName,
    departmentId: emp.departmentId,
    departmentName: dept?.name || '—',
    position: emp.position,
    status: deriveAssignmentStatus(a),
  }
}

/**
 * Tự tính lại status theo ngày hiện tại nếu chưa bị cancelled.
 */
function deriveAssignmentStatus(a) {
  if (a.status === 'cancelled') return 'cancelled'
  const today = new Date().toISOString().slice(0, 10)
  if (a.endDate && a.endDate < today) return 'expired'
  return 'active'
}

function addDaysISO(iso, days) {
  const d = new Date(iso)
  d.setUTCDate(d.getUTCDate() + days)
  return d.toISOString().slice(0, 10)
}

// ---------- Benefit CRUD --------------------------------------------------

export function getBenefits() {
  return benefits.map(decorateBenefit)
}

export function getBenefitById(id) {
  const raw = benefits.find((b) => b.id === id)
  return raw ? decorateBenefit(raw) : null
}

export function createBenefit(payload) {
  const dup = benefits.find((b) => b.code.trim().toLowerCase() === payload.code.trim().toLowerCase())
  if (dup) {
    return Promise.resolve({
      ok: false,
      errors: { code: `Mã phúc lợi "${payload.code}" đã tồn tại.` },
    })
  }
  const errors = validateBenefit(payload)
  if (Object.keys(errors).length) return Promise.resolve({ ok: false, errors })

  const id = makeBenefitId()
  const now = new Date().toISOString()
  const record = {
    id,
    code: payload.code.trim(),
    name: payload.name.trim(),
    type: payload.type,
    description: payload.description?.trim() ?? '',
    value: payload.value === '' || payload.value === undefined ? null : Number(payload.value),
    valueUnit: payload.valueUnit ?? 'fixed',
    eligibility: payload.eligibility?.trim() ?? '',
    startDate: payload.startDate,
    endDate: payload.endDate || null,
    status: payload.status,
    departmentIds: Array.isArray(payload.departmentIds) ? [...payload.departmentIds] : [],
    createdAt: now,
    updatedAt: now,
  }
  benefits = [record, ...benefits]
  notify('benefit.create', { benefit: decorateBenefit(record) })
  return Promise.resolve({ ok: true, benefit: decorateBenefit(record) })
}

export function updateBenefit(id, payload) {
  const existing = benefits.find((b) => b.id === id)
  if (!existing) {
    return Promise.resolve({ ok: false, errors: { _form: 'Không tìm thấy chương trình phúc lợi.' } })
  }
  // Trùng mã
  const dup = benefits.find(
    (b) => b.id !== id && b.code.trim().toLowerCase() === payload.code.trim().toLowerCase(),
  )
  if (dup) {
    return Promise.resolve({
      ok: false,
      errors: { code: `Mã phúc lợi "${payload.code}" đã tồn tại.` },
    })
  }
  const errors = validateBenefit({ ...existing, ...payload })
  if (Object.keys(errors).length) return Promise.resolve({ ok: false, errors })

  const updated = {
    ...existing,
    code: payload.code.trim(),
    name: payload.name.trim(),
    type: payload.type,
    description: payload.description?.trim() ?? '',
    value: payload.value === '' || payload.value === undefined ? null : Number(payload.value),
    valueUnit: payload.valueUnit ?? existing.valueUnit,
    eligibility: payload.eligibility?.trim() ?? '',
    startDate: payload.startDate,
    endDate: payload.endDate || null,
    status: payload.status,
    departmentIds: Array.isArray(payload.departmentIds) ? [...payload.departmentIds] : existing.departmentIds,
    updatedAt: new Date().toISOString(),
  }
  benefits = benefits.map((b) => (b.id === id ? updated : b))
  notify('benefit.update', { benefit: decorateBenefit(updated) })
  return Promise.resolve({ ok: true, benefit: decorateBenefit(updated) })
}

/**
 * Cập nhật nhanh trạng thái (active / paused / expired / draft).
 */
export function updateBenefitStatus(id, status) {
  const existing = benefits.find((b) => b.id === id)
  if (!existing) return Promise.resolve({ ok: false, error: 'Không tìm thấy chương trình.' })
  const updated = { ...existing, status, updatedAt: new Date().toISOString() }
  benefits = benefits.map((b) => (b.id === id ? updated : b))
  notify('benefit.status', { benefit: decorateBenefit(updated) })
  return Promise.resolve({ ok: true, benefit: decorateBenefit(updated) })
}

// ---------- Assignment ----------------------------------------------------

export function getAssignments(benefitId) {
  return assignments
    .filter((a) => a.benefitId === benefitId)
    .map(decorateAssignment)
    .sort((a, b) => (a.assignedAt || '').localeCompare(b.assignedAt || ''))
}

/**
 * Gán 1 (hoặc nhiều) nhân viên vào benefit.
 * Từ chối nếu nhân viên đã có record đang active cùng benefit.
 */
export function assignBenefitToEmployees(payload) {
  const { benefitId, employeeIds, startDate, endDate, note, assignedBy } = payload
  const benefit = benefits.find((b) => b.id === benefitId)
  if (!benefit) return Promise.resolve({ ok: false, error: 'Không tìm thấy chương trình.' })
  if (benefit.status !== 'active') {
    return Promise.resolve({ ok: false, error: 'Chương trình không ở trạng thái hoạt động.' })
  }
  if (!Array.isArray(employeeIds) || employeeIds.length === 0) {
    return Promise.resolve({ ok: false, error: 'Vui lòng chọn ít nhất 1 nhân viên.' })
  }
  if (!startDate) {
    return Promise.resolve({ ok: false, error: 'Vui lòng chọn ngày bắt đầu hưởng.' })
  }
  if (endDate && endDate < startDate) {
    return Promise.resolve({ ok: false, error: 'Ngày kết thúc không được trước ngày bắt đầu.' })
  }

  // Check trùng
  const existingActive = new Set(
    assignments
      .filter((a) => a.benefitId === benefitId && a.status !== 'cancelled')
      .map((a) => a.employeeId),
  )
  const dups = employeeIds.filter((id) => existingActive.has(id))
  if (dups.length) {
    return Promise.resolve({
      ok: false,
      error: `Nhân viên đã có quyền lợi này đang hoạt động: ${dups.join(', ')}`,
      duplicates: dups,
    })
  }

  const now = new Date().toISOString()
  const newRecords = employeeIds.map((employeeId, idx) => {
    // Nếu đã từng bị cancelled trước đó, tạo id mới tránh trùng primary
    return {
      id: `${benefitId}-${employeeId}-${Date.now()}-${idx}`,
      benefitId,
      employeeId,
      startDate,
      endDate: endDate || null,
      status: 'active',
      note: note?.trim() ?? '',
      assignedBy: assignedBy ?? 'usr-admin-001',
      assignedAt: now,
    }
  })
  assignments = [...newRecords, ...assignments]
  notify('assignment.create', { records: newRecords.map(decorateAssignment) })
  return Promise.resolve({ ok: true, records: newRecords.map(decorateAssignment) })
}

export function updateAssignment(id, payload) {
  const existing = assignments.find((a) => a.id === id)
  if (!existing) return Promise.resolve({ ok: false, error: 'Không tìm thấy quyền lợi.' })
  if (existing.status === 'cancelled') {
    return Promise.resolve({ ok: false, error: 'Quyền lợi đã bị hủy.' })
  }
  const updated = {
    ...existing,
    startDate: payload.startDate ?? existing.startDate,
    endDate: payload.endDate !== undefined ? (payload.endDate || null) : existing.endDate,
    note: payload.note?.trim() ?? existing.note,
    status: payload.status ?? existing.status,
  }
  if (updated.startDate && updated.endDate && updated.endDate < updated.startDate) {
    return Promise.resolve({ ok: false, error: 'Ngày kết thúc không được trước ngày bắt đầu.' })
  }
  assignments = assignments.map((a) => (a.id === id ? updated : a))
  notify('assignment.update', { record: decorateAssignment(updated) })
  return Promise.resolve({ ok: true, record: decorateAssignment(updated) })
}

/**
 * Hủy quyền lợi của 1 nhân viên.
 */
export function cancelAssignment(id, reason = '') {
  const existing = assignments.find((a) => a.id === id)
  if (!existing) return Promise.resolve({ ok: false, error: 'Không tìm thấy quyền lợi.' })
  if (existing.status === 'cancelled') {
    return Promise.resolve({ ok: false, error: 'Quyền lợi đã được hủy trước đó.' })
  }
  const updated = {
    ...existing,
    status: 'cancelled',
    note: reason?.trim() || existing.note,
  }
  assignments = assignments.map((a) => (a.id === id ? updated : a))
  notify('assignment.cancel', { record: decorateAssignment(updated) })
  return Promise.resolve({ ok: true, record: decorateAssignment(updated) })
}

// ---------- Employee self-service -----------------------------------------

/**
 * Phúc lợi đang active của employee hiện tại.
 */
export function getMyBenefits(employeeId) {
  return assignments
    .filter((a) => a.employeeId === employeeId)
    .map(decorateAssignment)
    .filter((r) => r.status === 'active' || r.status === 'expired')
    .map((r) => ({
      ...r,
      benefit: getBenefitById(r.benefitId),
    }))
    .filter((r) => r.benefit)
}

export function getMyBenefitById(employeeId, benefitId) {
  const records = assignments
    .filter((a) => a.employeeId === employeeId && a.benefitId === benefitId)
    .map(decorateAssignment)
  if (records.length === 0) return null
  const benefit = getBenefitById(benefitId)
  if (!benefit) return null
  // Trả về record mới nhất còn active (hoặc expired nếu không có active).
  const active = records.find((r) => r.status === 'active')
  const record = active ?? records[0]
  return { ...record, benefit }
}

// ---------- Query / Summary ----------------------------------------------

/**
 * Query Benefit (search/filter/sort/paginate).
 */
export function queryBenefits(q = {}) {
  const {
    search = '',
    type = '',
    status = '',
    departmentId = '',
    startDateFrom = '',
    startDateTo = '',
    sortBy = 'updatedAt',
    sortDir = 'desc',
    page = 1,
    pageSize = 10,
  } = q
  const searchLow = search.trim().toLowerCase()
  let rows = benefits.map(decorateBenefit)
  if (searchLow) {
    rows = rows.filter(
      (b) =>
        (b.name || '').toLowerCase().includes(searchLow) ||
        (b.code || '').toLowerCase().includes(searchLow) ||
        (b.description || '').toLowerCase().includes(searchLow),
    )
  }
  if (type) rows = rows.filter((b) => b.type === type)
  if (status) rows = rows.filter((b) => b.status === status)
  if (departmentId) {
    rows = rows.filter((b) => !b.departmentIds?.length || b.departmentIds.includes(departmentId))
  }
  if (startDateFrom) rows = rows.filter((b) => b.startDate >= startDateFrom)
  if (startDateTo) rows = rows.filter((b) => b.startDate <= startDateTo)

  const SORTABLE = ['name', 'code', 'startDate', 'endDate', 'updatedAt']
  if (SORTABLE.includes(sortBy)) {
    const sign = sortDir === 'desc' ? -1 : 1
    rows.sort((a, b) => {
      const av = a[sortBy] ?? ''
      const bv = b[sortBy] ?? ''
      if (av === bv) return 0
      if (av === '' || av === null) return 1
      if (bv === '' || bv === null) return -1
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

/**
 * Summary cho Admin.
 */
export function getBenefitsSummary() {
  const total = benefits.length
  const active = benefits.filter((b) => b.status === 'active').length
  const paused = benefits.filter((b) => b.status === 'paused').length
  const draft = benefits.filter((b) => b.status === 'draft').length
  const expired = benefits.filter((b) => b.status === 'expired').length
  const totalActiveAssignees = assignments.filter((a) => a.status === 'active').length
  return { total, active, paused, draft, expired, totalActiveAssignees }
}

/**
 * Summary cho Employee.
 */
export function getMyBenefitsSummary(employeeId) {
  const all = getMyBenefits(employeeId)
  const total = all.length
  const insurance = all.filter((r) => r.benefit?.type === 'insurance').length
  const allowance = all.filter((r) => r.benefit?.type === 'allowance').length
  const others = all.filter((r) =>
    !['insurance', 'allowance'].includes(r.benefit?.type),
  ).length
  const today = new Date().toISOString().slice(0, 10)
  const expiringSoon = all.filter(
    (r) => r.status === 'active' && r.endDate && r.endDate >= today && r.endDate <= addDaysISO(today, 30),
  ).length
  return { total, insurance, allowance, others, expiringSoon }
}

// ---------- ID gen --------------------------------------------------------

function makeBenefitId() {
  let max = 0
  for (const b of benefits) {
    const m = /^bn-(\d+)$/.exec(b.id || '')
    if (m) {
      const n = parseInt(m[1], 10)
      if (n > max) max = n
    }
  }
  return `bn-${String(max + 1).padStart(3, '0')}`
}

void getEmployees