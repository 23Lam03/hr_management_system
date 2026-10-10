/**
 * contractService - quản lý hợp đồng (Phần 13).
 *
 * Nguyên tắc:
 * - Pub-sub để UI bump tick và re-render.
 * - Mọi thao tác trả Promise (mô phỏng API).
 * - Validate đầy đủ; chặn trùng mã; không cho terminate 2 lần.
 * - Phân quyền employee: chỉ lấy dữ liệu của chính mình.
 * - KHÔNG can thiệp Payroll.
 */

import {
  CONTRACTS as SEED_CONTRACTS,
  CONTRACT_TYPE_LABEL,
  CONTRACT_STATUS_LABEL,
} from '../data/contractMockData'

import {
  validateContract,
  validateExtension,
} from '../utils/contractUtils'

import {
  getEmployeeById,
  getEmployees,
  getDepartments,
} from './employeeService'

// ---------- Mutable store -------------------------------------------------
let contracts = SEED_CONTRACTS.map((c) => ({
  ...c,
  history: [...(c.history || [])],
}))

const listeners = new Set()
function notify(eventType, payload) {
  for (const cb of listeners) {
    try { cb({ type: eventType, payload }) } catch (_e) { void _e }
  }
}

export function subscribeContracts(cb) {
  listeners.add(cb)
  return () => listeners.delete(cb)
}

// ---------- Lookups -------------------------------------------------------

export function getContractTypes() {
  return [
    { value: 'probation',  label: 'Hợp đồng thử việc' },
    { value: 'fixed_term', label: 'Hợp đồng xác định thời hạn' },
    { value: 'indefinite', label: 'Hợp đồng không xác định thời hạn' },
    { value: 'internship', label: 'Hợp đồng thực tập' },
    { value: 'other',      label: 'Khác' },
  ]
}

export function getContractStatuses() {
  return [
    { value: 'draft',      label: 'Bản nháp' },
    { value: 'pending',    label: 'Chờ xử lý' },
    { value: 'active',     label: 'Đang hiệu lực' },
    { value: 'expired',    label: 'Hết hạn' },
    { value: 'terminated', label: 'Đã kết thúc' },
    { value: 'cancelled',  label: 'Đã hủy' },
  ]
}

export function getContractTypeLabel(v) { return CONTRACT_TYPE_LABEL[v] ?? v }
export function getContractStatusLabel(v) { return CONTRACT_STATUS_LABEL[v] ?? v }

// ---------- Decorator -----------------------------------------------------

function decorateContract(c) {
  if (!c) return c
  const emp = getEmployeeById(c.employeeId)
  if (!emp) {
    return {
      ...c,
      employeeName: '—',
      employeeCode: '',
      departmentId: '',
      departmentName: '—',
      position: '',
      employee: null,
    }
  }
  const dept = getDepartments().find((d) => d.id === emp.departmentId)
  return {
    ...c,
    employeeCode: emp.employeeCode,
    employeeName: emp.fullName,
    departmentId: emp.departmentId,
    departmentName: dept?.name || '—',
    position: emp.position,
    email: emp.email,
    employee: {
      id: emp.id,
      employeeCode: emp.employeeCode,
      fullName: emp.fullName,
      departmentName: dept?.name || '—',
      position: emp.position,
      email: emp.email,
    },
  }
}

// ---------- Query ---------------------------------------------------------

export function getContracts() {
  return contracts.map(decorateContract)
}

export function getContractById(id) {
  const raw = contracts.find((c) => c.id === id)
  return raw ? decorateContract(raw) : null
}

export function getContractsByEmployee(employeeId) {
  return contracts
    .filter((c) => c.employeeId === employeeId)
    .map(decorateContract)
    .sort((a, b) => (b.effectiveDate || '').localeCompare(a.effectiveDate || ''))
}

export function getActiveContract(employeeId) {
  return getContractsByEmployee(employeeId).find((c) => c.status === 'active') || null
}

export function getContractHistory(employeeId) {
  return getContractsByEmployee(employeeId)
}

export function getExpiringContracts(thresholdDays = 30) {
  const today = new Date().toISOString().slice(0, 10)
  return contracts
    .filter((c) => c.status === 'active' && c.expiryDate && c.expiryDate >= today)
    .filter((c) => {
      const days = Math.round(
        (new Date(c.expiryDate).setHours(0, 0, 0, 0) - new Date(today).setHours(0, 0, 0, 0)) /
        (1000 * 60 * 60 * 24),
      )
      return days <= thresholdDays
    })
    .map(decorateContract)
}

// ---------- CRUD ----------------------------------------------------------

export function createContract(payload, actor = null) {
  if (!payload.employeeId) {
    return Promise.resolve({ ok: false, errors: { employeeId: 'Vui lòng chọn nhân viên.' } })
  }
  if (!getEmployeeById(payload.employeeId)) {
    return Promise.resolve({ ok: false, errors: { employeeId: 'Nhân viên không tồn tại.' } })
  }
  // Trùng mã
  const dup = contracts.find(
    (c) => c.contractCode.trim().toLowerCase() === payload.contractCode.trim().toLowerCase(),
  )
  if (dup) {
    return Promise.resolve({
      ok: false,
      errors: { contractCode: `Mã hợp đồng "${payload.contractCode}" đã tồn tại.` },
    })
  }
  const errors = validateContract(payload)
  if (Object.keys(errors).length) return Promise.resolve({ ok: false, errors })

  const id = makeContractId()
  const now = new Date().toISOString()
  const record = {
    id,
    contractCode: payload.contractCode.trim(),
    employeeId: payload.employeeId,
    contractType: payload.contractType,
    signedDate: payload.signedDate,
    effectiveDate: payload.effectiveDate,
    expiryDate: payload.expiryDate || null,
    status: payload.status,
    note: payload.note?.trim() ?? '',
    owner: payload.owner?.trim() || 'Phòng Nhân sự',
    history: [
      {
        id: `${id}-h1`,
        contractId: id,
        action: 'create',
        previousStatus: null,
        newStatus: payload.status,
        previousExpiryDate: null,
        newExpiryDate: payload.expiryDate || null,
        reason: 'Tạo hợp đồng',
        actorId: actor?.id ?? 'usr-admin-001',
        actorName: actor?.name ?? 'Admin',
        timestamp: now,
      },
    ],
    createdAt: now,
    updatedAt: now,
  }
  contracts = [record, ...contracts]
  notify('contract.create', { contract: decorateContract(record) })
  return Promise.resolve({ ok: true, contract: decorateContract(record) })
}

export function updateContract(id, payload, actor = null) {
  const existing = contracts.find((c) => c.id === id)
  if (!existing) {
    return Promise.resolve({ ok: false, errors: { _form: 'Không tìm thấy hợp đồng.' } })
  }
  if (existing.status === 'terminated' || existing.status === 'cancelled' || existing.status === 'expired') {
    return Promise.resolve({
      ok: false,
      errors: { _form: 'Hợp đồng đã hết hạn / kết thúc, không thể chỉnh sửa.' },
    })
  }
  // Trùng mã
  const dup = contracts.find(
    (c) =>
      c.id !== id &&
      c.contractCode.trim().toLowerCase() === payload.contractCode.trim().toLowerCase(),
  )
  if (dup) {
    return Promise.resolve({
      ok: false,
      errors: { contractCode: `Mã hợp đồng "${payload.contractCode}" đã tồn tại.` },
    })
  }
  const errors = validateContract({ ...existing, ...payload })
  if (Object.keys(errors).length) return Promise.resolve({ ok: false, errors })

  const prevStatus = existing.status
  const newStatus = payload.status
  const historyAppend = prevStatus !== newStatus
    ? [{
        id: `${existing.id}-h${existing.history.length + 1}`,
        contractId: existing.id,
        action: 'status_change',
        previousStatus: prevStatus,
        newStatus,
        previousExpiryDate: existing.expiryDate,
        newExpiryDate: payload.expiryDate || null,
        reason: 'Cập nhật trạng thái',
        actorId: actor?.id ?? 'usr-admin-001',
        actorName: actor?.name ?? 'Admin',
        timestamp: new Date().toISOString(),
      }]
    : []

  const updated = {
    ...existing,
    contractCode: payload.contractCode.trim(),
    employeeId: payload.employeeId,
    contractType: payload.contractType,
    signedDate: payload.signedDate,
    effectiveDate: payload.effectiveDate,
    expiryDate: payload.expiryDate || null,
    status: newStatus,
    note: payload.note?.trim() ?? '',
    owner: payload.owner?.trim() || existing.owner,
    history: [...existing.history, ...historyAppend],
    updatedAt: new Date().toISOString(),
  }
  contracts = contracts.map((c) => (c.id === id ? updated : c))
  notify('contract.update', { contract: decorateContract(updated) })
  return Promise.resolve({ ok: true, contract: decorateContract(updated) })
}

export function extendContract(id, payload, actor = null) {
  const existing = contracts.find((c) => c.id === id)
  if (!existing) {
    return Promise.resolve({ ok: false, errors: { _form: 'Không tìm thấy hợp đồng.' } })
  }
  if (existing.status !== 'active' && existing.status !== 'pending' && existing.status !== 'expired') {
    return Promise.resolve({
      ok: false,
      errors: { _form: 'Chỉ gia hạn được hợp đồng đang hiệu lực, chờ xử lý hoặc hết hạn.' },
    })
  }
  const errors = validateExtension(payload, existing.expiryDate)
  if (Object.keys(errors).length) return Promise.resolve({ ok: false, errors })

  const now = new Date().toISOString()
  const updated = {
    ...existing,
    expiryDate: payload.newExpiryDate,
    status: existing.status === 'expired' ? 'active' : existing.status,
    note: payload.note?.trim()
      ? `${existing.note ? existing.note + '\n' : ''}[Gia hạn] ${payload.note.trim()}`
      : existing.note,
    history: [
      ...existing.history,
      {
        id: `${existing.id}-h${existing.history.length + 1}`,
        contractId: existing.id,
        action: 'extend',
        previousStatus: existing.status,
        newStatus: existing.status === 'expired' ? 'active' : existing.status,
        previousExpiryDate: existing.expiryDate,
        newExpiryDate: payload.newExpiryDate,
        reason: payload.note?.trim() || 'Gia hạn hợp đồng',
        actorId: actor?.id ?? 'usr-admin-001',
        actorName: actor?.name ?? 'Admin',
        timestamp: now,
      },
    ],
    updatedAt: now,
  }
  contracts = contracts.map((c) => (c.id === id ? updated : c))
  notify('contract.extend', { contract: decorateContract(updated) })
  return Promise.resolve({ ok: true, contract: decorateContract(updated) })
}

export function terminateContract(id, payload, actor = null) {
  const existing = contracts.find((c) => c.id === id)
  if (!existing) {
    return Promise.resolve({ ok: false, errors: { _form: 'Không tìm thấy hợp đồng.' } })
  }
  if (existing.status === 'terminated' || existing.status === 'cancelled') {
    return Promise.resolve({
      ok: false,
      errors: { _form: 'Hợp đồng đã được kết thúc/hủy trước đó.' },
    })
  }
  if (!payload.reason?.trim()) {
    return Promise.resolve({
      ok: false,
      errors: { reason: 'Vui lòng nhập lý do kết thúc.' },
    })
  }

  const now = new Date().toISOString()
  const updated = {
    ...existing,
    status: 'terminated',
    expiryDate: payload.endDate || existing.expiryDate,
    note: payload.note?.trim()
      ? `${existing.note ? existing.note + '\n' : ''}[Kết thúc] ${payload.note.trim()}`
      : existing.note,
    history: [
      ...existing.history,
      {
        id: `${existing.id}-h${existing.history.length + 1}`,
        contractId: existing.id,
        action: 'terminate',
        previousStatus: existing.status,
        newStatus: 'terminated',
        previousExpiryDate: existing.expiryDate,
        newExpiryDate: payload.endDate || existing.expiryDate,
        reason: payload.reason.trim(),
        actorId: actor?.id ?? 'usr-admin-001',
        actorName: actor?.name ?? 'Admin',
        timestamp: now,
      },
    ],
    updatedAt: now,
  }
  contracts = contracts.map((c) => (c.id === id ? updated : c))
  notify('contract.terminate', { contract: decorateContract(updated) })
  return Promise.resolve({ ok: true, contract: decorateContract(updated) })
}

// ---------- Query + Summary ----------------------------------------------

/**
 * Query hợp đồng (search/filter/sort/paginate).
 */
export function queryContracts(q = {}) {
  const {
    search = '',
    departmentId = '',
    contractType = '',
    status = '',
    effectiveFrom = '',
    effectiveTo = '',
    expiringWithinDays = '',
    sortBy = 'updatedAt',
    sortDir = 'desc',
    page = 1,
    pageSize = 10,
  } = q

  const searchLow = search.trim().toLowerCase()
  let rows = contracts.map(decorateContract)
  if (searchLow) {
    rows = rows.filter((c) =>
      (c.contractCode || '').toLowerCase().includes(searchLow) ||
      (c.employeeName || '').toLowerCase().includes(searchLow) ||
      (c.employeeCode || '').toLowerCase().includes(searchLow),
    )
  }
  if (departmentId) rows = rows.filter((c) => c.departmentId === departmentId)
  if (contractType) rows = rows.filter((c) => c.contractType === contractType)
  if (status) rows = rows.filter((c) => c.status === status)
  if (effectiveFrom) rows = rows.filter((c) => c.effectiveDate >= effectiveFrom)
  if (effectiveTo) rows = rows.filter((c) => c.effectiveDate <= effectiveTo)
  if (expiringWithinDays !== '' && expiringWithinDays !== null) {
    const today = new Date().toISOString().slice(0, 10)
    const max = Number(expiringWithinDays)
    rows = rows.filter((c) => {
      if (c.status !== 'active' || !c.expiryDate || c.expiryDate < today) return false
      const days = Math.round(
        (new Date(c.expiryDate).setHours(0, 0, 0, 0) - new Date(today).setHours(0, 0, 0, 0)) /
        (1000 * 60 * 60 * 24),
      )
      return days <= max
    })
  }

  const SORTABLE = ['contractCode', 'effectiveDate', 'expiryDate', 'updatedAt']
  if (SORTABLE.includes(sortBy)) {
    const sign = sortDir === 'desc' ? -1 : 1
    rows.sort((a, b) => {
      const av = a[sortBy] ?? ''
      const bv = b[sortBy] ?? ''
      if (av === bv) return 0
      if (av === '' || av === null) return 1
      if (bv === '' || bv === null) return -1
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
export function getContractsSummary() {
  const total = contracts.length
  const active = contracts.filter((c) => c.status === 'active').length
  const pending = contracts.filter((c) => c.status === 'pending').length
  const draft = contracts.filter((c) => c.status === 'draft').length
  const expired = contracts.filter((c) => c.status === 'expired').length
  const terminated = contracts.filter((c) => c.status === 'terminated').length
  const expiringSoon = getExpiringContracts(30).length
  return { total, active, pending, draft, expired, terminated, expiringSoon }
}

// ---------- ID gen --------------------------------------------------------

function makeContractId() {
  let max = 0
  for (const c of contracts) {
    const m = /^ct-(\d+)$/.exec(c.id || '')
    if (m) {
      const n = parseInt(m[1], 10)
      if (n > max) max = n
    }
  }
  return `ct-${String(max + 1).padStart(3, '0')}`
}

void getEmployees