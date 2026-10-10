/**
 * employeeService - module quản lý nhân viên.
 *
 * Đây là lớp logic dữ liệu duy nhất cho trang /admin/employees.
 * Mọi thao tác (đọc danh sách, tìm kiếm, lọc, sắp xếp, phân trang, tạo,
 * cập nhật, đổi trạng thái) đều đi qua service - KHÔNG xử lý trong JSX.
 *
 * Lưu ý:
 * - Dữ liệu mock trong RAM (mảng EMPLOYEES). Khi tích hợp backend, các
 *   hàm này sẽ được thay bằng httpClient tương ứng.
 * - Service bắn `change` event để hook có thể subscribe re-render.
 * - Bảo vệ session demo: không cho đổi trạng thái tài khoản admin đang
 *   đăng nhập (usr-admin-001) sang inactive.
 */

import {
  EMPLOYEES as SEED_EMPLOYEES,
  DEPARTMENTS,
  EMPLOYMENT_TYPES,
  EMPLOYMENT_STATUSES,
  EMPLOYMENT_TYPE_LABEL,
  EMPLOYMENT_STATUS_LABEL,
  GENDERS,
  GENDER_LABEL,
  nextEmployeeCode as computeNextEmployeeCode,
  ADMIN_EMPLOYEE_ID,
} from '../data/employeeMockData'

// ---------- Mutable store ---------------------------------------------------
let employees = [...SEED_EMPLOYEES]
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

export function subscribeEmployees(cb) {
  listeners.add(cb)
  return () => listeners.delete(cb)
}

// ---------- Validators ------------------------------------------------------

const EMAIL_RE = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/
// Số điện thoại Việt Nam cơ bản: 0/84 + 9-10 chữ số, có thể có dấu cách
const PHONE_RE = /^(0|\+84)\d{9,10}$/

function stripSpaces(s = '') {
  return String(s).replace(/[\s.-]/g, '')
}

export function validateEmployee(payload, { excludeId = null } = {}) {
  const errors = {}

  if (!payload.fullName?.trim()) {
    errors.fullName = 'Vui lòng nhập họ và tên.'
  } else if (payload.fullName.trim().length < 2) {
    errors.fullName = 'Họ và tên phải có ít nhất 2 ký tự.'
  }

  if (!payload.email?.trim()) {
    errors.email = 'Vui lòng nhập email.'
  } else if (!EMAIL_RE.test(payload.email.trim())) {
    errors.email = 'Email không đúng định dạng.'
  } else if (isEmailTaken(payload.email.trim(), excludeId)) {
    errors.email = 'Email này đã được sử dụng.'
  }

  if (!payload.phone?.trim()) {
    errors.phone = 'Vui lòng nhập số điện thoại.'
  } else if (!PHONE_RE.test(stripSpaces(payload.phone))) {
    errors.phone = 'Số điện thoại phải có 10-11 chữ số, bắt đầu bằng 0 hoặc +84.'
  }

  if (!payload.employeeCode?.trim()) {
    errors.employeeCode = 'Vui lòng nhập mã nhân viên.'
  } else if (isCodeTaken(payload.employeeCode.trim(), excludeId)) {
    errors.employeeCode = 'Mã nhân viên đã tồn tại.'
  }

  if (!payload.departmentId) {
    errors.departmentId = 'Vui lòng chọn phòng ban.'
  }

  if (!payload.position?.trim()) {
    errors.position = 'Vui lòng nhập chức vụ.'
  }

  if (!payload.employmentType) {
    errors.employmentType = 'Vui lòng chọn loại hình làm việc.'
  }

  if (!payload.hireDate) {
    errors.hireDate = 'Vui lòng chọn ngày vào làm.'
  } else {
    const today = new Date()
    today.setHours(23, 59, 59, 999)
    const hire = new Date(payload.hireDate)
    if (Number.isNaN(hire.getTime())) {
      errors.hireDate = 'Ngày vào làm không hợp lệ.'
    } else if (hire.getTime() > today.getTime()) {
      errors.hireDate = 'Ngày vào làm không được lớn hơn hôm nay.'
    }
  }

  if (payload.dateOfBirth) {
    const dob = new Date(payload.dateOfBirth)
    if (Number.isNaN(dob.getTime())) {
      errors.dateOfBirth = 'Ngày sinh không hợp lệ.'
    } else {
      const now = new Date()
      if (dob.getTime() > now.getTime()) {
        errors.dateOfBirth = 'Ngày sinh không được lớn hơn hôm nay.'
      } else {
        const ageYears = (now - dob) / (365.25 * 24 * 60 * 60 * 1000)
        if (ageYears < 16) {
          errors.dateOfBirth = 'Nhân viên phải từ 16 tuổi trở lên.'
        } else if (ageYears > 80) {
          errors.dateOfBirth = 'Ngày sinh không hợp lệ.'
        }
      }
    }
  }

  if (!payload.status) {
    errors.status = 'Vui lòng chọn trạng thái.'
  }

  if (payload.managerId && payload.managerId === payload.id) {
    errors.managerId = 'Người quản lý không thể là chính nhân viên này.'
  }

  return errors
}

// ---------- Lookups ---------------------------------------------------------

export function getDepartments() {
  return DEPARTMENTS.slice()
}

export function getEmploymentTypes() {
  return EMPLOYMENT_TYPES.slice()
}

export function getEmploymentStatuses() {
  return EMPLOYMENT_STATUSES.slice()
}

export function getGenders() {
  return GENDERS.slice()
}

/** Danh sách quản lý: tất cả nhân viên active trừ bản thân (excludeId). */
export function getManagers(excludeId = null) {
  return employees
    .filter((e) => e.status === 'active' && e.id !== excludeId)
    .map((e) => ({ id: e.id, name: e.fullName, position: e.position, departmentId: e.departmentId }))
}

export function getEmployees() {
  return employees.slice()
}

export function getEmployeeById(id) {
  return employees.find((e) => e.id === id) ?? null
}

export function isEmailTaken(email, excludeId = null) {
  const lower = String(email).toLowerCase()
  return employees.some((e) => e.email.toLowerCase() === lower && e.id !== excludeId)
}

export function isCodeTaken(code, excludeId = null) {
  return employees.some((e) => e.employeeCode === code && e.id !== excludeId)
}

// ---------- Stats -----------------------------------------------------------

/** Đếm nhanh theo trạng thái. Mọi nơi cần hiển thị KPI gọi hàm này. */
export function getEmployeeStats() {
  const total = employees.length
  const active = employees.filter((e) => e.status === 'active').length
  const onLeave = employees.filter((e) => e.status === 'on_leave').length
  const inactive = employees.filter((e) => e.status === 'inactive').length
  return { total, active, onLeave, inactive }
}

// ---------- Query helpers (filter/sort/paginate) ---------------------------

function compareBy(key, direction = 'asc') {
  const sign = direction === 'desc' ? -1 : 1
  return (a, b) => {
    const av = a[key]
    const bv = b[key]
    if (av === bv) return 0
    if (av === undefined || av === null) return 1
    if (bv === undefined || bv === null) return -1
    return av < bv ? -1 * sign : 1 * sign
  }
}

export const SORT_FIELDS = ['fullName', 'employeeCode', 'departmentName', 'hireDate']

/**
 * Lấy danh sách nhân viên với filter/sort/paginate.
 * @param {Object} query
 * @param {string} [query.search]    Tìm theo tên / mã / email
 * @param {string} [query.departmentId]
 * @param {string} [query.employmentType]
 * @param {string} [query.status]
 * @param {string} [query.sortBy]    fullName | employeeCode | departmentName | hireDate
 * @param {'asc'|'desc'} [query.sortDir]
 * @param {number} [query.page]      1-based
 * @param {number} [query.pageSize]  5 | 10 | 20
 */
export function queryEmployees(query = {}) {
  const {
    search = '',
    departmentId = '',
    employmentType = '',
    status = '',
    sortBy = 'fullName',
    sortDir = 'asc',
    page = 1,
    pageSize = 10,
  } = query

  const trimmed = search.trim().toLowerCase()

  let rows = employees.map((e) => ({
    ...e,
    departmentName: DEPARTMENTS.find((d) => d.id === e.departmentId)?.name ?? '—',
    employmentTypeLabel: EMPLOYMENT_TYPE_LABEL[e.employmentType] ?? e.employmentType,
    statusLabel: EMPLOYMENT_STATUS_LABEL[e.status] ?? e.status,
  }))

  if (trimmed) {
    rows = rows.filter((r) =>
      r.fullName.toLowerCase().includes(trimmed) ||
      r.employeeCode.toLowerCase().includes(trimmed) ||
      r.email.toLowerCase().includes(trimmed),
    )
  }

  if (departmentId) {
    rows = rows.filter((r) => r.departmentId === departmentId)
  }

  if (employmentType) {
    rows = rows.filter((r) => r.employmentType === employmentType)
  }

  if (status) {
    rows = rows.filter((r) => r.status === status)
  }

  if (SORT_FIELDS.includes(sortBy)) {
    rows.sort(compareBy(sortBy, sortDir))
  }

  const total = rows.length
  const size = Math.max(1, Number(pageSize) || 10)
  const totalPages = Math.max(1, Math.ceil(total / size))
  const currentPage = Math.min(Math.max(1, Number(page) || 1), totalPages)
  const start = (currentPage - 1) * size
  const items = rows.slice(start, start + size)

  return {
    items,
    total,
    page: currentPage,
    pageSize: size,
    totalPages,
  }
}

// ---------- Mutations -------------------------------------------------------

function makeId() {
  let max = 0
  for (const e of employees) {
    const m = /^emp-(\d+)$/.exec(e.id || '')
    if (m) {
      const n = parseInt(m[1], 10)
      if (n > max) max = n
    }
  }
  return `emp-${String(max + 1).padStart(3, '0')}`
}

function managerNameOf(managerId) {
  if (!managerId) return '—'
  return employees.find((e) => e.id === managerId)?.fullName ?? '—'
}

/**
 * Tạo nhân viên. Tự sinh `id` và (nếu thiếu) `employeeCode`.
 * @returns {Promise<{ ok: boolean, employee?: object, errors?: object }>}
 */
export function createEmployee(payload) {
  const errors = validateEmployee(payload)
  if (Object.keys(errors).length) {
    return Promise.resolve({ ok: false, errors })
  }
  const now = new Date().toISOString()
  const id = makeId()
  const employeeCode = payload.employeeCode?.trim() || computeNextEmployeeCode(employees)
  // Tránh trường hợp trùng code nếu payload trống
  const finalCode = isCodeTaken(employeeCode) ? computeNextEmployeeCode(employees) : employeeCode

  const employee = {
    id,
    employeeCode: finalCode,
    fullName: payload.fullName.trim(),
    email: payload.email.trim(),
    phone: payload.phone.trim(),
    avatar: payload.avatar ?? null,
    gender: payload.gender || 'other',
    dateOfBirth: payload.dateOfBirth || null,
    departmentId: payload.departmentId,
    position: payload.position.trim(),
    employmentType: payload.employmentType,
    hireDate: payload.hireDate,
    managerId: payload.managerId || null,
    managerName: managerNameOf(payload.managerId),
    address: payload.address?.trim() || '',
    status: payload.status,
    createdAt: now,
    updatedAt: now,
  }
  employees = [employee, ...employees]
  notify('create', { employee })
  return Promise.resolve({ ok: true, employee })
}

/**
 * Cập nhật nhân viên.
 */
export function updateEmployee(id, payload) {
  const existing = employees.find((e) => e.id === id)
  if (!existing) {
    return Promise.resolve({ ok: false, errors: { _form: 'Không tìm thấy nhân viên.' } })
  }
  const errors = validateEmployee(payload, { excludeId: id })
  if (Object.keys(errors).length) {
    return Promise.resolve({ ok: false, errors })
  }
  const updated = {
    ...existing,
    employeeCode: payload.employeeCode.trim(),
    fullName: payload.fullName.trim(),
    email: payload.email.trim(),
    phone: payload.phone.trim(),
    avatar: payload.avatar ?? existing.avatar,
    gender: payload.gender || existing.gender,
    dateOfBirth: payload.dateOfBirth || null,
    departmentId: payload.departmentId,
    position: payload.position.trim(),
    employmentType: payload.employmentType,
    hireDate: payload.hireDate,
    managerId: payload.managerId || null,
    managerName: managerNameOf(payload.managerId),
    address: payload.address?.trim() ?? '',
    status: payload.status,
    updatedAt: new Date().toISOString(),
  }
  employees = employees.map((e) => (e.id === id ? updated : e))
  notify('update', { employee: updated })
  return Promise.resolve({ ok: true, employee: updated })
}

/**
 * updateEmployeeProfile - employee tự cập nhật profile của mình.
 *
 * Hạn chế so với updateEmployee:
 * - Không cho phép đổi employeeCode, email, departmentId, position,
 *   employmentType, hireDate, managerId, status, role.
 * - Chỉ các field personal/contact được ghi.
 */
export function updateEmployeeProfile(id, payload) {
  const existing = employees.find((e) => e.id === id)
  if (!existing) {
    return Promise.resolve({ ok: false, errors: { _form: 'Không tìm thấy nhân viên.' } })
  }
  const errors = validateProfile(payload)
  if (Object.keys(errors).length) {
    return Promise.resolve({ ok: false, errors })
  }
  const updated = {
    ...existing,
    fullName: (payload.fullName ?? existing.fullName).trim(),
    phone: (payload.phone ?? '').trim(),
    address: (payload.address ?? '').trim(),
    avatar: payload.avatar ?? existing.avatar,
    gender: payload.gender ?? existing.gender,
    dateOfBirth: payload.dateOfBirth || existing.dateOfBirth,
    updatedAt: new Date().toISOString(),
  }
  employees = employees.map((e) => (e.id === id ? updated : e))
  notify('update', { employee: updated })
  return Promise.resolve({ ok: true, employee: updated })
}

export function validateProfile(payload) {
  const errors = {}
  if (!payload.fullName || !payload.fullName.trim()) {
    errors.fullName = 'Vui lòng nhập họ tên.'
  }
  if (payload.phone && !/^[0-9+\s().-]{8,20}$/.test(String(payload.phone).trim())) {
    errors.phone = 'Số điện thoại không hợp lệ.'
  }
  return errors
}

/**
 * Đổi trạng thái nhân viên. Bảo vệ session demo.
 */
export function updateEmployeeStatus(id, status) {
  const existing = employees.find((e) => e.id === id)
  if (!existing) {
    return Promise.resolve({ ok: false, error: 'Không tìm thấy nhân viên.' })
  }
  if (!EMPLOYMENT_STATUS_LABEL[status]) {
    return Promise.resolve({ ok: false, error: 'Trạng thái không hợp lệ.' })
  }
  // Không cho đổi trạng thái tài khoản admin đang đăng nhập
  if (existing.id === ADMIN_EMPLOYEE_ID && status !== 'active') {
    return Promise.resolve({
      ok: false,
      error: 'Không thể thay đổi trạng thái của tài khoản quản trị đang đăng nhập.',
    })
  }
  const updated = { ...existing, status, updatedAt: new Date().toISOString() }
  employees = employees.map((e) => (e.id === id ? updated : e))
  notify('status', { employee: updated })
  return Promise.resolve({ ok: true, employee: updated })
}

// ---------- Hook helper -----------------------------------------------------

/**
 * Custom hook đơn giản - subscribe vào service để trigger re-render mỗi
 * khi danh sách nhân viên thay đổi. Trả về `version` tăng dần.
 */
import { useEffect, useReducer } from 'react'

export function useEmployeesVersion() {
  const [version, force] = useReducer((n) => n + 1, 0)
  useEffect(() => subscribeEmployees(() => force()), [])
  return version
}

// Silence unused-export lint for build-time tooling
export { EMPLOYMENT_TYPE_LABEL, EMPLOYMENT_STATUS_LABEL, GENDER_LABEL }