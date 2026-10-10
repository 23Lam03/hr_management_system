/**
 * promotionService - tuyển dụng (Phần 20 — AD-HRM15).
 *
 * Nguyên tắc:
 * - In-memory store (clone từ seed), có pub-sub để UI bump tick.
 * - Lưu vào localStorage với key hrm_promotions để giữ qua refresh.
 * - Validation cơ bản; KHÔNG tính HR/salary/legal evaluation.
 * - KHÔNG tự ý sửa Employee/Contract/Payroll/Evaluation data.
 */

import { PROMOTION_STATUSES, PROMOTIONS as SEED_PROMOTIONS } from '../data/promotionData'

const STORAGE_KEY = 'hrm_promotions'

// ---------- Persistence ---------------------------------------------------
function loadFromStorage() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return null
    const parsed = JSON.parse(raw)
    if (!Array.isArray(parsed)) return null
    return parsed
  } catch (_e) {
    void _e
    return null
  }
}

function saveToStorage(list) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(list))
  } catch (_e) {
    void _e
  }
}

// ---------- Init store ------------------------------------------------------
let promotions = (loadFromStorage() ?? SEED_PROMOTIONS).map((p) => ({ ...p }))

const listeners = new Set()
function emitChange() {
  for (const cb of listeners) {
    try { cb() } catch (_e) { void _e }
  }
}

export function subscribePromotions(cb) {
  listeners.add(cb)
  return () => listeners.delete(cb)
}

function persist() {
  saveToStorage(promotions)
  emitChange()
}

// ---------- Lookups -------------------------------------------------------
export function getPromotionStatuses() {
  return PROMOTION_STATUSES.slice()
}

// ---------- Read ---------------------------------------------------------
export function getPromotions() {
  return promotions.map((p) => ({ ...p }))
}

export function getPromotionById(id) {
  const found = promotions.find((p) => p.id === id)
  return found ? { ...found } : null
}

export function getPromotionsByEmployeeId(employeeId) {
  return promotions
    .filter((p) => p.employeeId === employeeId)
    .map((p) => ({ ...p }))
}

// ---------- Validation ----------------------------------------------------
export function validatePromotion(payload) {
  const errors = {}
  if (!payload.employeeId) {
    errors.employeeId = 'Vui lòng chọn nhân viên.'
  }
  if (!payload.proposedPosition?.trim()) {
    errors.proposedPosition = 'Vui lòng nhập chức danh đề xuất.'
  }
  if (!payload.reason?.trim()) {
    errors.reason = 'Vui lòng nhập lý do.'
  }
  if (!payload.effectiveDate) {
    errors.effectiveDate = 'Vui lòng chọn ngày hiệu lực.'
  }
  return errors
}

// ---------- Mutation -----------------------------------------------------
function makePromotionId() {
  const max = promotions.reduce((m, p) => {
    const n = Number(String(p.id).replace('promotion-', '')) || 0
    return Math.max(m, n)
  }, 0)
  return `promotion-${String(max + 1).padStart(3, '0')}`
}

export function createPromotion(payload) {
  const errors = validatePromotion(payload)
  if (Object.keys(errors).length) {
    return Promise.resolve({ ok: false, errors })
  }
  const now = new Date().toISOString()
  const next = {
    id: makePromotionId(),
    employeeId: payload.employeeId,
    currentPosition: payload.currentPosition?.trim() || '',
    proposedPosition: payload.proposedPosition.trim(),
    currentDepartment: payload.currentDepartment?.trim() || '',
    proposedDepartment: payload.proposedDepartment?.trim() || payload.currentDepartment?.trim() || '',
    reason: payload.reason.trim(),
    effectiveDate: payload.effectiveDate,
    status: payload.status || 'pending',
    note: payload.note?.trim() || '',
    createdBy: 'usr-admin-001',
    createdAt: now,
    updatedAt: now,
  }
  promotions = [next, ...promotions]
  persist()
  return Promise.resolve({ ok: true, promotion: { ...next } })
}

export function updatePromotion(id, payload) {
  const errors = validatePromotion(payload)
  if (Object.keys(errors).length) {
    return Promise.resolve({ ok: false, errors })
  }
  const idx = promotions.findIndex((p) => p.id === id)
  if (idx === -1) {
    return Promise.resolve({ ok: false, error: 'Không tìm thấy promotion.' })
  }
  const current = promotions[idx]
  const next = {
    ...current,
    employeeId: payload.employeeId,
    currentPosition: payload.currentPosition?.trim() || current.currentPosition,
    proposedPosition: payload.proposedPosition.trim(),
    currentDepartment: payload.currentDepartment?.trim() || current.currentDepartment,
    proposedDepartment: payload.proposedDepartment?.trim() || payload.currentDepartment?.trim() || current.proposedDepartment,
    reason: payload.reason.trim(),
    effectiveDate: payload.effectiveDate,
    status: payload.status || current.status,
    note: payload.note?.trim() ?? current.note,
    updatedAt: new Date().toISOString(),
  }
  promotions = promotions.map((p) => (p.id === id ? next : p))
  persist()
  return Promise.resolve({ ok: true, promotion: { ...next } })
}

export function updatePromotionStatus(id, status) {
  const valid = PROMOTION_STATUSES.find((s) => s.value === status)
  if (!valid) return Promise.resolve({ ok: false, error: 'Trạng thái không hợp lệ.' })
  const idx = promotions.findIndex((p) => p.id === id)
  if (idx === -1) return Promise.resolve({ ok: false, error: 'Không tìm thấy promotion.' })
  const next = { ...promotions[idx], status, updatedAt: new Date().toISOString() }
  promotions = promotions.map((p) => (p.id === id ? next : p))
  persist()
  return Promise.resolve({ ok: true, promotion: { ...next } })
}

export function deletePromotion(id) {
  const idx = promotions.findIndex((p) => p.id === id)
  if (idx === -1) return Promise.resolve({ ok: false, error: 'Không tìm thấy promotion.' })
  promotions = promotions.filter((p) => p.id !== id)
  persist()
  return Promise.resolve({ ok: true })
}

// ---------- Summary ------------------------------------------------------
export function getPromotionSummary() {
  return {
    total: promotions.length,
    pending: promotions.filter((p) => p.status === 'pending').length,
    approved: promotions.filter((p) => p.status === 'approved').length,
    rejected: promotions.filter((p) => p.status === 'rejected').length,
    cancelled: promotions.filter((p) => p.status === 'cancelled').length,
  }
}

// ---------- Query ---------------------------------------------------------
const SORTABLE = new Set(['effectiveDate', 'createdAt', 'status'])

function sortItems(items, sortBy, sortDir) {
  if (!SORTABLE.has(sortBy)) return items
  const sign = sortDir === 'desc' ? -1 : 1
  return items.slice().sort((a, b) => {
    const av = a[sortBy] ?? ''
    const bv = b[sortBy] ?? ''
    if (av === bv) return 0
    if (av === '' || av === null || av === undefined) return 1
    if (bv === '' || bv === null || bv === undefined) return -1
    if (typeof av === 'number' && typeof bv === 'number') {
      return av < bv ? -1 * sign : 1 * sign
    }
    return String(av).localeCompare(String(bv)) * sign
  })
}

export function queryPromotions(q = {}) {
  const {
    search = '',
    status = '',
    employeeId = '',
    sortBy = 'createdAt',
    sortDir = 'desc',
    page = 1,
    pageSize = 10,
  } = q

  const trimmed = search.toLowerCase()
  let rows = getPromotions()
  if (trimmed) {
    rows = rows.filter((p) => {
      return (
        p.currentPosition.toLowerCase().includes(trimmed) ||
        p.proposedPosition.toLowerCase().includes(trimmed) ||
        p.currentDepartment.toLowerCase().includes(trimmed) ||
        p.proposedDepartment.toLowerCase().includes(trimmed) ||
        (p.employeeId ?? '').toLowerCase().includes(trimmed)
      )
    })
  }
  if (status) rows = rows.filter((p) => p.status === status)
  if (employeeId) rows = rows.filter((p) => p.employeeId === employeeId)

  rows = sortItems(rows, sortBy, sortDir)

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