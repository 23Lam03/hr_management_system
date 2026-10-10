/**
 * evaluationService - quản lý đánh giá hiệu suất (Phần 9).
 *
 * Nguyên tắc:
 * - Store in-memory (mảng). Tái sử dụng nhân viên / phòng ban từ employeeService.
 * - Pub-sub để UI bump tick và re-render.
 * - Các thao tác đều trả Promise để mô phỏng API.
 * - Phân biệt rõ:
 *   + EvaluationStatus (trạng thái của bản ghi đánh giá 1 nhân viên)
 *   + CycleStatus (trạng thái của cả kỳ đánh giá)
 * - Trung bình điểm tính qua evaluationUtils.calcAverageScore.
 */

import {
  EVALUATION_CYCLES as SEED_CYCLES,
  EMPLOYEE_EVALUATIONS as SEED_EVALUATIONS,
  EVALUATION_CRITERIA,
  CYCLE_STATUS_LABEL,
  EVALUATION_STATUS_LABEL,
} from '../data/evaluationMockData'

import {
  calcAverageScore,
  getCycleProgress,
  validateCycle,
  validateFullEvaluation,
  isValidScore,
} from '../utils/evaluationUtils'

import {
  getEmployeeById,
  getEmployees,
  getDepartments,
} from './employeeService'

// ---------- Mutable store -------------------------------------------------
let cycles = SEED_CYCLES.map((c) => ({ ...c, departmentIds: [...(c.departmentIds || [])], employeeIds: [...(c.employeeIds || [])] }))
let evaluations = SEED_EVALUATIONS.map((e) => ({
  ...e,
  criteriaScores: e.criteriaScores.map((cs) => ({ ...cs })),
}))
const listeners = new Set()

function notify(eventType, payload) {
  for (const cb of listeners) {
    try { cb({ type: eventType, payload }) } catch (_e) { void _e }
  }
}

export function subscribeEvaluations(cb) {
  listeners.add(cb)
  return () => listeners.delete(cb)
}

// ---------- Lookups -------------------------------------------------------

export function getEvaluationCriteria() {
  return EVALUATION_CRITERIA.slice()
}

export function getCycleStatusLabel(value) {
  return CYCLE_STATUS_LABEL[value] ?? value
}

export function getEvaluationStatusLabel(value) {
  return EVALUATION_STATUS_LABEL[value] ?? value
}

// ---------- Decorators ----------------------------------------------------

function decorateEvaluation(record) {
  const emp = getEmployeeById(record.employeeId)
  if (!emp) return record
  const dept = getDepartments().find((d) => d.id === emp.departmentId)
  return {
    ...record,
    employeeCode: record.employeeCode || emp.employeeCode,
    employeeName: record.employeeName || emp.fullName,
    departmentId: record.departmentId || emp.departmentId,
    departmentName: record.departmentName || dept?.name || '—',
    position: record.position || emp.position,
  }
}

function getEmployeePoolForCycle(cycle) {
  let pool = getEmployees().filter((e) => e.status === 'active')
  if (cycle.employeeIds?.length) {
    pool = pool.filter((e) => cycle.employeeIds.includes(e.id))
  } else if (cycle.departmentIds?.length) {
    pool = pool.filter((e) => cycle.departmentIds.includes(e.departmentId))
  }
  return pool
}

function ensureEvaluationRecord(cycleId, employeeId) {
  let rec = evaluations.find((e) => e.cycleId === cycleId && e.employeeId === employeeId)
  if (rec) return rec
  const emp = getEmployeeById(employeeId)
  const cycle = cycles.find((c) => c.id === cycleId)
  if (!emp || !cycle) return null
  const reviewerMap = {
    'emp-001': { id: 'usr-admin-001', name: 'Nguyễn Minh Anh' },
    'emp-002': { id: 'emp-001', name: 'Nguyễn Minh Anh' },
    'emp-003': { id: 'emp-008', name: 'Trương Thanh Hà' },
    'emp-004': { id: 'usr-admin-001', name: 'Nguyễn Minh Anh' },
    'emp-005': { id: 'emp-006', name: 'Ngô Hải Đăng' },
    'emp-006': { id: 'usr-admin-001', name: 'Nguyễn Minh Anh' },
    'emp-007': { id: 'usr-admin-001', name: 'Nguyễn Minh Anh' },
    'emp-008': { id: 'emp-006', name: 'Ngô Hải Đăng' },
    'emp-009': { id: 'emp-006', name: 'Ngô Hải Đăng' },
    'emp-010': { id: 'emp-003', name: 'Lê Hoàng Phương' },
    'emp-011': { id: 'usr-admin-001', name: 'Nguyễn Minh Anh' },
    'emp-012': { id: 'emp-006', name: 'Ngô Hải Đăng' },
    'emp-013': { id: 'usr-admin-001', name: 'Nguyễn Minh Anh' },
    'emp-014': { id: 'usr-admin-001', name: 'Nguyễn Minh Anh' },
    'emp-015': { id: 'emp-004', name: 'Phan Thanh Tùng' },
  }
  const r = reviewerMap[employeeId] || { id: 'usr-admin-001', name: 'Nguyễn Minh Anh' }
  const now = new Date().toISOString()
  rec = {
    id: `${cycleId}-${employeeId}`,
    cycleId,
    employeeId,
    reviewerId: r.id,
    reviewerName: r.name,
    criteriaScores: EVALUATION_CRITERIA.map((c) => ({
      criteriaId: c.id,
      criteriaName: c.name,
      score: 0,
      comment: '',
    })),
    averageScore: 0,
    strengths: '',
    improvements: '',
    generalComment: '',
    developmentGoals: '',
    trainingRecommendations: '',
    status: 'pending',
    publishedAt: null,
    createdAt: now,
    updatedAt: now,
  }
  evaluations = [rec, ...evaluations]
  return rec
}

// ---------- Cycle CRUD ----------------------------------------------------

export function getEvaluationCycles() {
  return cycles.slice()
}

export function getEvaluationCycleById(id) {
  return cycles.find((c) => c.id === id) ?? null
}

export function createEvaluationCycle(payload) {
  const errors = validateCycle(payload)
  if (Object.keys(errors).length) {
    return Promise.resolve({ ok: false, errors })
  }
  const id = makeCycleId()
  const now = new Date().toISOString()
  const cycle = {
    id,
    name: payload.name.trim(),
    description: payload.description?.trim() ?? '',
    startDate: payload.startDate,
    endDate: payload.endDate,
    departmentIds: Array.isArray(payload.departmentIds) ? [...payload.departmentIds] : [],
    employeeIds: Array.isArray(payload.employeeIds) ? [...payload.employeeIds] : [],
    status: payload.status,
    createdAt: now,
    updatedAt: now,
  }
  cycles = [cycle, ...cycles]
  // Khởi tạo evaluation records pending cho nhân viên thuộc cycle
  const pool = getEmployeePoolForCycle(cycle)
  for (const emp of pool) {
    ensureEvaluationRecord(cycle.id, emp.id)
  }
  notify('cycle.create', { cycle })
  return Promise.resolve({ ok: true, cycle })
}

export function updateEvaluationCycle(id, payload) {
  const existing = cycles.find((c) => c.id === id)
  if (!existing) {
    return Promise.resolve({ ok: false, errors: { _form: 'Không tìm thấy kỳ đánh giá.' } })
  }
  if (existing.status === 'closed' || existing.status === 'completed') {
    return Promise.resolve({
      ok: false,
      errors: { _form: 'Kỳ đánh giá đã đóng/hoàn thành, không thể chỉnh sửa.' },
    })
  }
  const merged = { ...existing, ...payload }
  const errors = validateCycle(merged)
  if (Object.keys(errors).length) {
    return Promise.resolve({ ok: false, errors })
  }
  const updated = {
    ...existing,
    name: merged.name.trim(),
    description: merged.description?.trim() ?? '',
    startDate: merged.startDate,
    endDate: merged.endDate,
    departmentIds: Array.isArray(merged.departmentIds) ? [...merged.departmentIds] : [],
    employeeIds: Array.isArray(merged.employeeIds) ? [...merged.employeeIds] : [],
    status: merged.status,
    updatedAt: new Date().toISOString(),
  }
  cycles = cycles.map((c) => (c.id === id ? updated : c))
  notify('cycle.update', { cycle: updated })
  return Promise.resolve({ ok: true, cycle: updated })
}

/**
 * Đóng kỳ đánh giá (chuyển sang closed) - thao tác quản trị.
 */
export function closeEvaluationCycle(id) {
  const existing = cycles.find((c) => c.id === id)
  if (!existing) {
    return Promise.resolve({ ok: false, error: 'Không tìm thấy kỳ đánh giá.' })
  }
  if (existing.status === 'closed') {
    return Promise.resolve({ ok: false, error: 'Kỳ đánh giá đã ở trạng thái đóng.' })
  }
  const updated = {
    ...existing,
    status: 'closed',
    updatedAt: new Date().toISOString(),
  }
  cycles = cycles.map((c) => (c.id === id ? updated : c))
  notify('cycle.close', { cycle: updated })
  return Promise.resolve({ ok: true, cycle: updated })
}

// ---------- Evaluation CRUD ----------------------------------------------

export function getEvaluationById(id) {
  const raw = evaluations.find((e) => e.id === id)
  return raw ? decorateEvaluation(raw) : null
}

export function getEvaluationsByCycle(cycleId) {
  const cycle = cycles.find((c) => c.id === cycleId)
  if (!cycle) return []
  const inStore = evaluations.filter((e) => e.cycleId === cycleId).map(decorateEvaluation)
  // Đảm bảo có record cho mọi nhân viên trong pool
  const pool = getEmployeePoolForCycle(cycle)
  const result = [...inStore]
  for (const emp of pool) {
    if (!inStore.some((e) => e.employeeId === emp.id)) {
      const rec = ensureEvaluationRecord(cycle.id, emp.id)
      if (rec) result.push(decorateEvaluation(rec))
    }
  }
  return result
}

/**
 * Lưu bản nháp / cập nhật đánh giá - không thay đổi status.
 * Nếu bản ghi đã published/completed thì không cho lưu (chỉ cho complete/publish).
 */
export function saveEvaluationDraft(id, payload) {
  const existing = evaluations.find((e) => e.id === id)
  if (!existing) {
    return Promise.resolve({ ok: false, errors: { _form: 'Không tìm thấy bản đánh giá.' } })
  }
  if (existing.status === 'published') {
    return Promise.resolve({
      ok: false,
      errors: { _form: 'Bản đánh giá đã được công bố, không thể chỉnh sửa.' },
    })
  }
  const merged = mergeEvaluationPayload(existing, payload)
  const errors = validateDraft(merged)
  if (Object.keys(errors).length) {
    return Promise.resolve({ ok: false, errors })
  }
  const updated = applyEvaluationPayload(existing, merged, 'in_progress')
  evaluations = evaluations.map((e) => (e.id === id ? updated : e))
  notify('evaluation.draft', { record: updated })
  return Promise.resolve({ ok: true, record: updated })
}

/**
 * Hoàn thành đánh giá - yêu cầu tất cả tiêu chí required có điểm hợp lệ.
 * Status chuyển sang 'completed'. Chưa published.
 */
export function completeEvaluation(id, payload) {
  const existing = evaluations.find((e) => e.id === id)
  if (!existing) {
    return Promise.resolve({ ok: false, errors: { _form: 'Không tìm thấy bản đánh giá.' } })
  }
  if (existing.status === 'published') {
    return Promise.resolve({
      ok: false,
      errors: { _form: 'Bản đánh giá đã được công bố.' },
    })
  }
  const merged = mergeEvaluationPayload(existing, payload)
  const errors = validateFullEvaluation(merged, EVALUATION_CRITERIA)
  if (Object.keys(errors).length) {
    return Promise.resolve({ ok: false, errors })
  }
  const updated = applyEvaluationPayload(existing, merged, 'completed')
  evaluations = evaluations.map((e) => (e.id === id ? updated : e))
  notify('evaluation.complete', { record: updated })
  return Promise.resolve({ ok: true, record: updated })
}

/**
 * Công bố đánh giá cho nhân viên - chỉ chấp nhận bản đã 'completed'.
 * Phase 30: lưu approvedBy / approvedAt / approvalNote + notification cho employee.
 */
export function publishEvaluation(id, reviewerId = null, note = '') {
  const existing = evaluations.find((e) => e.id === id)
  if (!existing) {
    return Promise.resolve({ ok: false, error: 'Không tìm thấy bản đánh giá.' })
  }
  if (existing.status === 'published') {
    return Promise.resolve({ ok: false, error: 'Bản đánh giá đã được công bố.' })
  }
  if (existing.status === 'rejected') {
    return Promise.resolve({
      ok: false,
      error: 'Bản đánh giá đang ở trạng thái bị từ chối, không thể công bố.',
    })
  }
  if (existing.status !== 'completed') {
    return Promise.resolve({
      ok: false,
      error: 'Chỉ có thể công bố bản đánh giá đã hoàn thành.',
    })
  }
  const now = new Date().toISOString()
  const updated = {
    ...existing,
    status: 'published',
    publishedAt: now,
    approvedBy: reviewerId || existing.approvedBy || null,
    approvedAt: existing.approvedAt || now,
    approvalNote: note?.trim() || existing.approvalNote || '',
    updatedAt: now,
  }
  evaluations = evaluations.map((e) => (e.id === id ? updated : e))
  notify('evaluation.publish', { record: updated })

  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const notifService = require('./notificationService')
    if (notifService.createNotification) {
      notifService.createNotification({
        type: 'evaluation',
        relatedEntityType: 'evaluation',
        relatedEntityId: updated.id,
        recipientId: updated.employeeId,
        title: 'Your performance evaluation has been approved',
        description: `Kỳ đánh giá ${updated.cycleId}${note ? ` · ${note}` : ''}`,
        createdBy: reviewerId || 'usr-admin-001',
      })
    }
  } catch (_e) { void _e }

  return Promise.resolve({ ok: true, record: updated })
}

/**
 * Phase 30: từ chối đánh giá. Đặt status='rejected', ghi reviewer/note.
 * Chỉ áp dụng với record ở 'completed'. Sau khi reject, record không thể publish
 * mà không qua complete lại.
 */
export function rejectEvaluation(id, reviewerId = null, note = '') {
  const existing = evaluations.find((e) => e.id === id)
  if (!existing) {
    return Promise.resolve({ ok: false, error: 'Không tìm thấy bản đánh giá.' })
  }
  if (existing.status === 'published') {
    return Promise.resolve({
      ok: false,
      error: 'Bản đánh giá đã được công bố, không thể từ chối.',
    })
  }
  if (existing.status !== 'completed') {
    return Promise.resolve({
      ok: false,
      error: 'Chỉ có thể từ chối bản đánh giá đã hoàn thành.',
    })
  }
  const now = new Date().toISOString()
  const updated = {
    ...existing,
    status: 'rejected',
    rejectedBy: reviewerId || null,
    rejectedAt: now,
    rejectionNote: note?.trim() || '',
    updatedAt: now,
  }
  evaluations = evaluations.map((e) => (e.id === id ? updated : e))
  notify('evaluation.reject', { record: updated })

  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const notifService = require('./notificationService')
    if (notifService.createNotification) {
      notifService.createNotification({
        type: 'evaluation',
        relatedEntityType: 'evaluation',
        relatedEntityId: updated.id,
        recipientId: updated.employeeId,
        title: 'Your performance evaluation has been rejected',
        description: `Kỳ đánh giá ${updated.cycleId}${note ? ` · ${note}` : ''}`,
        createdBy: reviewerId || 'usr-admin-001',
      })
    }
  } catch (_e) { void _e }

  return Promise.resolve({ ok: true, record: updated })
}

/**
 * Phase 30: cycle-level approval summary.
 */
export function getEvaluationApprovalSummary(cycleId = '') {
  let pool = evaluations.slice()
  if (cycleId) pool = pool.filter((e) => e.cycleId === cycleId)
  return {
    pending:  pool.filter((e) => e.status === 'completed').length,
    approved: pool.filter((e) => e.status === 'published').length,
    rejected: pool.filter((e) => e.status === 'rejected').length,
    total:    pool.length,
  }
}

/**
 * Lấy danh sách đánh giá của 1 nhân viên - dùng cho trang Employee.
 * Mặc định chỉ trả về các bản đã published.
 *
 * @param {Object} options
 * @param {boolean} [options.includeUnpublished] - chỉ dùng cho admin context
 */
export function getMyEvaluations(employeeId, { includeUnpublished = false } = {}) {
  return evaluations
    .filter((e) => e.employeeId === employeeId)
    .filter((e) => includeUnpublished || e.status === 'published' || e.status === 'rejected')
    .map(decorateEvaluation)
    .sort((a, b) => (b.createdAt || '').localeCompare(a.createdAt || ''))
}

export function getMyEvaluationById(employeeId, evaluationId, { includeUnpublished = false } = {}) {
  const raw = evaluations.find((e) => e.id === evaluationId && e.employeeId === employeeId)
  if (!raw) return null
  // Phase 30: employee có thể xem record ở status 'published' hoặc 'rejected'.
  // Admin path dùng includeUnpublished=true để xem tất cả.
  if (!includeUnpublished && raw.status !== 'published' && raw.status !== 'rejected') return null
  return decorateEvaluation(raw)
}

// ---------- Validators & helpers ------------------------------------------

function validateDraft(payload) {
  const errors = {}
  for (const c of EVALUATION_CRITERIA) {
    if (!c.required) continue
    const cs = payload.criteriaScores?.find((x) => x.criteriaId === c.id)
    if (cs && cs.score && !isValidScore(cs.score)) {
      errors[`criteria.${c.id}`] = `Điểm "${c.name}" phải nằm trong khoảng 1–5.`
    }
  }
  return errors
}

function mergeEvaluationPayload(existing, payload) {
  // Merge criteriaScores theo criteriaId, giữ comment nếu payload không cung cấp
  const map = new Map(existing.criteriaScores.map((cs) => [cs.criteriaId, cs]))
  if (Array.isArray(payload.criteriaScores)) {
    for (const cs of payload.criteriaScores) {
      const old = map.get(cs.criteriaId) || { criteriaId: cs.criteriaId, criteriaName: cs.criteriaName, score: 0, comment: '' }
      map.set(cs.criteriaId, {
        ...old,
        ...cs,
        criteriaName: old.criteriaName || cs.criteriaName,
      })
    }
  }
  return {
    ...existing,
    strengths: payload.strengths ?? existing.strengths,
    improvements: payload.improvements ?? existing.improvements,
    generalComment: payload.generalComment ?? existing.generalComment,
    developmentGoals: payload.developmentGoals ?? existing.developmentGoals,
    trainingRecommendations: payload.trainingRecommendations ?? existing.trainingRecommendations,
    reviewerId: payload.reviewerId ?? existing.reviewerId,
    reviewerName: payload.reviewerName ?? existing.reviewerName,
    criteriaScores: Array.from(map.values()),
  }
}

function applyEvaluationPayload(existing, merged, status) {
  const avg = calcAverageScore(merged.criteriaScores)
  const now = new Date().toISOString()
  return {
    ...merged,
    averageScore: avg,
    status,
    publishedAt: status === 'published' ? merged.publishedAt || now : merged.publishedAt,
    updatedAt: now,
  }
}

function makeCycleId() {
  let max = 0
  for (const c of cycles) {
    const m = /^cycle-(\d+)$/.exec(c.id || '')
    if (m) {
      const n = parseInt(m[1], 10)
      if (n > max) max = n
    }
  }
  return `cycle-${String(max + 1).padStart(3, '0')}`
}

// ---------- Query / Summary ----------------------------------------------

/**
 * Query cycles (filter/sort/paginate).
 */
export function queryEvaluationCycles(q = {}) {
  const {
    search = '',
    departmentId = '',
    status = '',
    startDateFrom = '',
    startDateTo = '',
    sortBy = 'updatedAt',
    sortDir = 'desc',
    page = 1,
    pageSize = 10,
  } = q

  const trimmed = search.trim().toLowerCase()
  let rows = cycles.map((c) => {
    const evals = getEvaluationsByCycle(c.id)
    const progress = getCycleProgress(c, evals)
    return {
      ...c,
      totalEmployees: evals.length,
      completedCount: progress.completed,
      progressPercent: progress.percent,
    }
  })

  if (trimmed) {
    rows = rows.filter((c) => c.name.toLowerCase().includes(trimmed))
  }
  if (departmentId) {
    rows = rows.filter((c) =>
      (c.departmentIds || []).length === 0 || c.departmentIds.includes(departmentId),
    )
  }
  if (status) rows = rows.filter((c) => c.status === status)
  if (startDateFrom) rows = rows.filter((c) => c.startDate >= startDateFrom)
  if (startDateTo) rows = rows.filter((c) => c.startDate <= startDateTo)

  const SORTABLE = ['name', 'startDate', 'endDate', 'updatedAt', 'progressPercent']
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
 * Query evaluations thuộc cycle (filter/sort/paginate).
 */
export function queryEvaluationsByCycle(cycleId, q = {}) {
  const {
    search = '',
    status = '',
    departmentId = '',
    sortBy = 'employeeName',
    sortDir = 'asc',
    page = 1,
    pageSize = 10,
  } = q

  const all = getEvaluationsByCycle(cycleId)
  const trimmed = search.trim().toLowerCase()
  let rows = all
  if (trimmed) {
    rows = rows.filter((r) =>
      (r.employeeName || '').toLowerCase().includes(trimmed) ||
      (r.employeeCode || '').toLowerCase().includes(trimmed),
    )
  }
  if (status) rows = rows.filter((r) => r.status === status)
  if (departmentId) rows = rows.filter((r) => r.departmentId === departmentId)

  const SORTABLE = ['employeeName', 'averageScore', 'status', 'updatedAt']
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
 * Summary cho Admin: tổng cycles, đang thực hiện, hoàn thành, chưa bắt đầu.
 */
export function getCyclesSummary() {
  const total = cycles.length
  const inProgress = cycles.filter((c) => c.status === 'in_progress').length
  const completed = cycles.filter((c) => c.status === 'completed' || c.status === 'closed').length
  const upcoming = cycles.filter((c) => c.status === 'upcoming' || c.status === 'draft').length
  const published = evaluations.filter((e) => e.status === 'published').length
  return { total, inProgress, completed, upcoming, published }
}

/**
 * Summary cho Employee.
 */
export function getMyEvaluationSummary(employeeId) {
  const all = getMyEvaluations(employeeId, { includeUnpublished: false })
  const total = all.length
  const avg = total === 0
    ? 0
    : Math.round(
        (all.reduce((s, e) => s + (e.averageScore || 0), 0) / total) * 100,
      ) / 100
  return { total, publishedCount: total, averageScore: avg }
}

// Re-export utils cho admin page nếu cần
export { getCycleProgress }

// silence unused
void getEmployees