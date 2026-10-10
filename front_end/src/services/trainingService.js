/**
 * trainingService - quản lý đào tạo (Phần 11).
 *
 * Nguyên tắc:
 * - Pub-sub để UI bump tick và re-render.
 * - Các thao tác đều trả Promise (mô phỏng API).
 * - Trung tâm là 2 store: courses và participants.
 * - Tự động khởi tạo participant record khi registerTraining.
 * - Validate đầy đủ; chặn sửa khóa cancelled/completed.
 * - Bảo vệ quyền sở hữu: employee chỉ xem được bản ghi của mình.
 */

import {
  TRAINING_COURSES as SEED_COURSES,
  TRAINING_PARTICIPANTS as SEED_PARTICIPANTS,
  TRAINING_STATUS_LABEL,
  PARTICIPANT_STATUS_LABEL,
  LEARNING_STATUS_LABEL,
} from '../data/trainingMockData'

import {
  validateTraining,
  validateParticipantProgress,
  hasAvailableSlot,
  getActiveParticipantsCount,
} from '../utils/trainingUtils'

import {
  getEmployeeById,
  getEmployees,
  getDepartments,
} from './employeeService'

// ---------- Mutable store -------------------------------------------------
let courses = SEED_COURSES.map((c) => ({
  ...c,
  employeeIds: [...(c.employeeIds || [])],
}))
let participants = SEED_PARTICIPANTS.map((p) => ({ ...p }))
const listeners = new Set()

function notify(eventType, payload) {
  for (const cb of listeners) {
    try { cb({ type: eventType, payload }) } catch (_e) { void _e }
  }
}

export function subscribeTrainings(cb) {
  listeners.add(cb)
  return () => listeners.delete(cb)
}

// ---------- Lookups -------------------------------------------------------

export function getTrainingCategories() {
  return [
    { value: 'hard_skill', label: 'Kỹ năng chuyên môn' },
    { value: 'soft_skill', label: 'Kỹ năng mềm' },
    { value: 'onboarding', label: 'Hội nhập nhân viên mới' },
    { value: 'compliance', label: 'An toàn & quy trình nội bộ' },
    { value: 'other',      label: 'Khác' },
  ]
}

export function getTrainingFormats() {
  return [
    { value: 'offline', label: 'Trực tiếp' },
    { value: 'online',  label: 'Trực tuyến' },
    { value: 'hybrid',  label: 'Kết hợp' },
  ]
}

export function getTrainingStatuses() {
  return [
    { value: 'draft',      label: 'Bản nháp' },
    { value: 'open',       label: 'Mở đăng ký' },
    { value: 'in_progress', label: 'Đang diễn ra' },
    { value: 'completed',  label: 'Đã hoàn thành' },
    { value: 'cancelled',  label: 'Đã hủy' },
  ]
}

export function getParticipantStatuses() {
  return [
    { value: 'registered', label: 'Đã đăng ký' },
    { value: 'confirmed',  label: 'Đã xác nhận' },
    { value: 'waitlisted', label: 'Danh sách chờ' },
    { value: 'cancelled',  label: 'Đã hủy đăng ký' },
  ]
}

export function getLearningStatuses() {
  return [
    { value: 'not_started', label: 'Chưa bắt đầu' },
    { value: 'in_progress', label: 'Đang học' },
    { value: 'completed',   label: 'Hoàn thành' },
    { value: 'failed',      label: 'Chưa đạt' },
  ]
}

export function getTrainingStatusLabel(value) {
  return TRAINING_STATUS_LABEL[value] ?? value
}

export function getParticipantStatusLabel(value) {
  return PARTICIPANT_STATUS_LABEL[value] ?? value
}

export function getLearningStatusLabel(value) {
  return LEARNING_STATUS_LABEL[value] ?? value
}

// ---------- Decorators ----------------------------------------------------

function decorateParticipant(p) {
  if (!p) return p
  const emp = getEmployeeById(p.employeeId)
  if (!emp) return p
  const dept = getDepartmentsSafe().find((d) => d.id === emp.departmentId)
  return {
    ...p,
    employeeCode: p.employeeCode || emp.employeeCode,
    employeeName: p.employeeName || emp.fullName,
    departmentId: p.departmentId || emp.departmentId,
    departmentName: p.departmentName || dept?.name || '—',
    position: p.position || emp.position,
  }
}

function getDepartmentsSafe() {
  try {
    return getDepartments()
  } catch (_e) {
    void _e
    return _getDepartmentsFallback()
  }
}

let _cachedDepartments = null
function _getDepartmentsFallback() {
  if (_cachedDepartments) return _cachedDepartments
  // Fallback: lấy từ departmentId của employees
  const seen = new Set()
  const result = []
  for (const emp of getEmployees()) {
    if (emp.departmentId && !seen.has(emp.departmentId)) {
      seen.add(emp.departmentId)
      result.push({ id: emp.departmentId, name: emp.departmentName || '—' })
    }
  }
  _cachedDepartments = result
  return result
}

function decorateCourse(c) {
  if (!c) return c
  const ps = participants
    .filter((p) => p.trainingId === c.id)
    .map(decorateParticipant)
  return {
    ...c,
    totalRegistered: ps.length,
    registeredCount: getActiveParticipantsCount(ps),
    confirmedCount: ps.filter((p) => p.registrationStatus === 'confirmed').length,
    completedCount: ps.filter((p) => p.learningStatus === 'completed').length,
  }
}

// ---------- Course CRUD ---------------------------------------------------

export function getTrainings() {
  return courses.map(decorateCourse)
}

export function getTrainingById(id) {
  const raw = courses.find((c) => c.id === id)
  return raw ? decorateCourse(raw) : null
}

export function createTraining(payload) {
  // Kiểm tra trùng code
  const dup = courses.find((c) => c.code.trim().toLowerCase() === payload.code.trim().toLowerCase())
  if (dup) {
    return Promise.resolve({
      ok: false,
      errors: { code: `Mã khóa học "${payload.code}" đã tồn tại.` },
    })
  }
  const errors = validateTraining(payload)
  if (Object.keys(errors).length) {
    return Promise.resolve({ ok: false, errors })
  }
  const id = makeCourseId()
  const now = new Date().toISOString()
  const course = {
    id,
    code: payload.code.trim(),
    name: payload.name.trim(),
    category: payload.category,
    description: payload.description?.trim() ?? '',
    objectives: payload.objectives?.trim() ?? '',
    instructor: payload.instructor.trim(),
    format: payload.format,
    location: payload.location?.trim() ?? '',
    meetingUrl: payload.meetingUrl?.trim() ?? '',
    startDate: payload.startDate,
    endDate: payload.endDate,
    registrationDeadline: payload.registrationDeadline,
    durationHours: Number(payload.durationHours),
    capacity: Number(payload.capacity),
    employeeIds: Array.isArray(payload.employeeIds) ? [...payload.employeeIds] : [],
    status: payload.status,
    createdAt: now,
    updatedAt: now,
  }
  courses = [course, ...courses]
  notify('course.create', { course })
  return Promise.resolve({ ok: true, course: decorateCourse(course) })
}

export function updateTraining(id, payload) {
  const existing = courses.find((c) => c.id === id)
  if (!existing) {
    return Promise.resolve({ ok: false, errors: { _form: 'Không tìm thấy khóa đào tạo.' } })
  }
  if (existing.status === 'completed' || existing.status === 'cancelled') {
    return Promise.resolve({
      ok: false,
      errors: { _form: 'Khóa học đã hoàn thành hoặc đã hủy, không thể chỉnh sửa.' },
    })
  }
  // Trùng mã
  const dup = courses.find(
    (c) => c.id !== id && c.code.trim().toLowerCase() === payload.code.trim().toLowerCase(),
  )
  if (dup) {
    return Promise.resolve({
      ok: false,
      errors: { code: `Mã khóa học "${payload.code}" đã tồn tại.` },
    })
  }
  const merged = { ...existing, ...payload }
  const errors = validateTraining(merged)
  if (Object.keys(errors).length) {
    return Promise.resolve({ ok: false, errors })
  }
  // Nghiệp vụ: không cho phép giảm sức chứa xuống dưới số đã xác nhận
  const activeCount = participants.filter(
    (p) => p.trainingId === id && p.registrationStatus !== 'cancelled',
  ).length
  if (Number(payload.capacity) < activeCount) {
    return Promise.resolve({
      ok: false,
      errors: { capacity: `Sức chứa không thể nhỏ hơn số học viên đang tham gia (${activeCount}).` },
    })
  }

  const updated = {
    ...existing,
    code: payload.code.trim(),
    name: payload.name.trim(),
    category: payload.category,
    description: payload.description?.trim() ?? '',
    objectives: payload.objectives?.trim() ?? '',
    instructor: payload.instructor.trim(),
    format: payload.format,
    location: payload.location?.trim() ?? '',
    meetingUrl: payload.meetingUrl?.trim() ?? '',
    startDate: payload.startDate,
    endDate: payload.endDate,
    registrationDeadline: payload.registrationDeadline,
    durationHours: Number(payload.durationHours),
    capacity: Number(payload.capacity),
    employeeIds: Array.isArray(payload.employeeIds) ? [...payload.employeeIds] : existing.employeeIds,
    status: payload.status,
    updatedAt: new Date().toISOString(),
  }
  courses = courses.map((c) => (c.id === id ? updated : c))
  notify('course.update', { course: decorateCourse(updated) })
  return Promise.resolve({ ok: true, course: decorateCourse(updated) })
}

/**
 * Huỷ khóa học - chuyển trạng thái sang cancelled.
 */
export function cancelTraining(id) {
  const existing = courses.find((c) => c.id === id)
  if (!existing) {
    return Promise.resolve({ ok: false, error: 'Không tìm thấy khóa đào tạo.' })
  }
  if (existing.status === 'cancelled') {
    return Promise.resolve({ ok: false, error: 'Khóa học đã ở trạng thái hủy.' })
  }
  const updated = {
    ...existing,
    status: 'cancelled',
    updatedAt: new Date().toISOString(),
  }
  courses = courses.map((c) => (c.id === id ? updated : c))
  notify('course.cancel', { course: decorateCourse(updated) })
  return Promise.resolve({ ok: true, course: decorateCourse(updated) })
}

// ---------- Participants ---------------------------------------------------

export function getTrainingParticipants(trainingId) {
  return participants
    .filter((p) => p.trainingId === trainingId)
    .map(decorateParticipant)
    .sort((a, b) => (a.registeredAt || '').localeCompare(b.registeredAt || ''))
}

/**
 * Thêm nhân viên vào khóa học (admin).
 */
export function addTrainingParticipant(trainingId, employeeId, options = {}) {
  const course = courses.find((c) => c.id === trainingId)
  if (!course) {
    return Promise.resolve({ ok: false, error: 'Không tìm thấy khóa học.' })
  }
  if (course.status === 'cancelled') {
    return Promise.resolve({ ok: false, error: 'Khóa học đã bị hủy.' })
  }
  if (!getEmployeeById(employeeId)) {
    return Promise.resolve({ ok: false, error: 'Nhân viên không tồn tại.' })
  }
  const existing = participants.find((p) => p.trainingId === trainingId && p.employeeId === employeeId)
  if (existing && existing.registrationStatus !== 'cancelled') {
    return Promise.resolve({ ok: false, error: 'Nhân viên đã có đăng ký đang hoạt động.' })
  }
  // Hết chỗ?
  const ps = participants.filter((p) => p.trainingId === trainingId).map(decorateParticipant)
  if (!hasAvailableSlot(course, ps) && options.allowWaitlist !== true) {
    return Promise.resolve({ ok: false, error: 'Khóa học đã đủ sức chứa.' })
  }
  const now = new Date().toISOString()
  let status = options.registrationStatus || 'confirmed'
  if (!hasAvailableSlot(course, ps)) {
    status = 'waitlisted'
  }
  const record = {
    id: `${trainingId}-${employeeId}`,
    trainingId,
    employeeId,
    registeredAt: now,
    registrationStatus: status,
    learningStatus: 'not_started',
    progress: 0,
    score: null,
    result: null,
    instructorComment: '',
    completedAt: null,
    resultPublished: false,
  }
  if (existing) {
    participants = participants.map((p) => (p.id === existing.id ? record : p))
  } else {
    participants = [record, ...participants]
  }
  notify('participant.add', { record: decorateParticipant(record) })
  return Promise.resolve({ ok: true, record: decorateParticipant(record) })
}

/**
 * Cập nhật trạng thái đăng ký (admin): confirmed / waitlisted / registered / cancelled.
 */
export function updateParticipantRegistration(trainingId, employeeId, registrationStatus) {
  const rec = participants.find((p) => p.trainingId === trainingId && p.employeeId === employeeId)
  if (!rec) return Promise.resolve({ ok: false, error: 'Không tìm thấy đăng ký.' })
  const updated = { ...rec, registrationStatus }
  participants = participants.map((p) => (p.id === rec.id ? updated : p))
  notify('participant.update', { record: decorateParticipant(updated) })
  return Promise.resolve({ ok: true, record: decorateParticipant(updated) })
}

/**
 * Cập nhật tiến độ / kết quả học tập (admin).
 */
export function updateParticipantProgress(trainingId, employeeId, payload) {
  const rec = participants.find((p) => p.trainingId === trainingId && p.employeeId === employeeId)
  if (!rec) return Promise.resolve({ ok: false, errors: { _form: 'Không tìm thấy đăng ký.' } })
  const errors = validateParticipantProgress(payload)
  if (Object.keys(errors).length) {
    return Promise.resolve({ ok: false, errors })
  }
  const merged = { ...rec }
  if (payload.learningStatus !== undefined) merged.learningStatus = payload.learningStatus
  if (payload.progress !== undefined && payload.progress !== '') {
    merged.progress = Math.max(0, Math.min(100, Number(payload.progress)))
  }
  if (payload.score !== undefined && payload.score !== '') {
    merged.score = Math.max(0, Math.min(100, Number(payload.score)))
  }
  if (payload.result !== undefined) merged.result = payload.result
  if (payload.instructorComment !== undefined) merged.instructorComment = payload.instructorComment
  if (payload.resultPublished !== undefined) merged.resultPublished = !!payload.resultPublished
  if (merged.learningStatus === 'completed' || merged.learningStatus === 'failed') {
    if (!merged.completedAt) merged.completedAt = new Date().toISOString()
  }
  if (payload.completedAt !== undefined) merged.completedAt = payload.completedAt

  participants = participants.map((p) => (p.id === rec.id ? merged : p))
  notify('participant.progress', { record: decorateParticipant(merged) })
  return Promise.resolve({ ok: true, record: decorateParticipant(merged) })
}

/**
 * Employee tự đăng ký khóa học.
 */
export function registerTraining(trainingId, employeeId) {
  const course = courses.find((c) => c.id === trainingId)
  if (!course) return Promise.resolve({ ok: false, error: 'Không tìm thấy khóa học.' })
  if (course.status !== 'open') {
    return Promise.resolve({
      ok: false,
      error: 'Khóa học không ở trạng thái mở đăng ký.',
    })
  }
  // Hạn đăng ký
  const today = new Date().toISOString().slice(0, 10)
  if (course.registrationDeadline && course.registrationDeadline < today) {
    return Promise.resolve({
      ok: false,
      error: 'Đã quá hạn đăng ký.',
    })
  }
  const existing = participants.find((p) => p.trainingId === trainingId && p.employeeId === employeeId)
  if (existing && existing.registrationStatus !== 'cancelled') {
    return Promise.resolve({
      ok: false,
      error: 'Bạn đã đăng ký khóa học này.',
    })
  }
  const ps = participants.filter((p) => p.trainingId === trainingId).map(decorateParticipant)
  let status = 'registered'
  if (!hasAvailableSlot(course, ps)) {
    status = 'waitlisted'
  }
  const now = new Date().toISOString()
  const record = {
    id: `${trainingId}-${employeeId}`,
    trainingId,
    employeeId,
    registeredAt: now,
    registrationStatus: status,
    learningStatus: 'not_started',
    progress: 0,
    score: null,
    result: null,
    instructorComment: '',
    completedAt: null,
    resultPublished: false,
  }
  if (existing) {
    participants = participants.map((p) => (p.id === existing.id ? record : p))
  } else {
    participants = [record, ...participants]
  }
  notify('participant.register', { record: decorateParticipant(record) })
  return Promise.resolve({ ok: true, record: decorateParticipant(record) })
}

/**
 * Employee hủy đăng ký (chỉ khi còn ở trạng thái registered/confirmed/waitlisted
 * và trước khi khóa học bắt đầu).
 */
export function cancelTrainingRegistration(trainingId, employeeId) {
  const course = courses.find((c) => c.id === trainingId)
  if (!course) return Promise.resolve({ ok: false, error: 'Không tìm thấy khóa học.' })
  const rec = participants.find((p) => p.trainingId === trainingId && p.employeeId === employeeId)
  if (!rec) return Promise.resolve({ ok: false, error: 'Bạn chưa đăng ký khóa học này.' })
  if (rec.registrationStatus === 'cancelled') {
    return Promise.resolve({ ok: false, error: 'Đăng ký đã được hủy trước đó.' })
  }
  // Cho phép hủy trước khi khóa bắt đầu
  const today = new Date().toISOString().slice(0, 10)
  if (course.startDate && course.startDate < today && rec.learningStatus !== 'not_started') {
    return Promise.resolve({
      ok: false,
      error: 'Khóa học đã diễn ra, không thể hủy đăng ký.',
    })
  }
  const updated = { ...rec, registrationStatus: 'cancelled' }
  participants = participants.map((p) => (p.id === rec.id ? updated : p))
  notify('participant.cancel', { record: decorateParticipant(updated) })
  return Promise.resolve({ ok: true, record: decorateParticipant(updated) })
}

// ---------- Employee self-service -----------------------------------------

/**
 * Lấy danh sách khóa học của 1 nhân viên (đã đăng ký / đang học / hoàn thành).
 * Không bao gồm cancelled registration.
 *
 * @param {Object} options
 * @param {boolean} options.includeUnpublished - nếu true, bao gồm cả learningStatus chưa công bố
 */
export function getMyTrainings(employeeId) {
  const records = participants
    .filter((p) => p.employeeId === employeeId && p.registrationStatus !== 'cancelled')
    .map(decorateParticipant)
  return records.map((r) => {
    const course = getTrainingById(r.trainingId)
    return { ...r, course }
  }).filter((r) => r.course)
}

export function getMyTrainingById(employeeId, trainingId) {
  const rec = participants.find(
    (p) => p.trainingId === trainingId && p.employeeId === employeeId,
  )
  if (!rec) return null
  const course = getTrainingById(trainingId)
  if (!course) return null
  return { ...decorateParticipant(rec), course }
}

/**
 * Trả về các khóa học mà employee CÓ THỂ đăng ký (chưa đăng ký, còn hạn).
 */
export function getAvailableTrainingsForEmployee(employeeId) {
  const today = new Date().toISOString().slice(0, 10)
  return courses
    .filter((c) => c.status === 'open')
    .filter((c) => !c.registrationDeadline || c.registrationDeadline >= today)
    .map(decorateCourse)
    .filter((c) => {
      const existing = participants.find(
        (p) => p.trainingId === c.id && p.employeeId === employeeId,
      )
      return !existing || existing.registrationStatus === 'cancelled'
    })
}

// ---------- Query / Summary ----------------------------------------------

/**
 * Query khóa đào tạo (filter/sort/paginate).
 *
 * Filters:
 *  - search: name hoặc code
 *  - status, category, format
 *  - startDateFrom / startDateTo: lọc theo ngày bắt đầu
 *  - registrationDeadlineFrom / registrationDeadlineTo
 */
export function queryTrainings(q = {}) {
  const {
    search = '',
    status = '',
    category = '',
    format = '',
    startDateFrom = '',
    startDateTo = '',
    sortBy = 'updatedAt',
    sortDir = 'desc',
    page = 1,
    pageSize = 10,
  } = q

  const trimmed = search.trim().toLowerCase()
  let rows = courses.map(decorateCourse)

  if (trimmed) {
    rows = rows.filter(
      (c) =>
        (c.name || '').toLowerCase().includes(trimmed) ||
        (c.code || '').toLowerCase().includes(trimmed),
    )
  }
  if (status) rows = rows.filter((c) => c.status === status)
  if (category) rows = rows.filter((c) => c.category === category)
  if (format) rows = rows.filter((c) => c.format === format)
  if (startDateFrom) rows = rows.filter((c) => c.startDate >= startDateFrom)
  if (startDateTo) rows = rows.filter((c) => c.startDate <= startDateTo)

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
 * Summary cho Admin
 */
export function getTrainingsSummary() {
  const total = courses.length
  const open = courses.filter((c) => c.status === 'open').length
  const inProgress = courses.filter((c) => c.status === 'in_progress').length
  const completed = courses.filter((c) => c.status === 'completed').length
  const cancelled = courses.filter((c) => c.status === 'cancelled').length
  const draft = courses.filter((c) => c.status === 'draft').length
  const totalRegistrations = participants.filter((p) => p.registrationStatus !== 'cancelled').length
  return { total, open, inProgress, completed, cancelled, draft, totalRegistrations }
}

/**
 * Summary cho Employee
 */
export function getMyTrainingsSummary(employeeId) {
  const all = getMyTrainings(employeeId)
  const total = all.length
  const inProgress = all.filter((r) => r.learningStatus === 'in_progress').length
  const completed = all.filter((r) => r.learningStatus === 'completed').length
  const pending = all.filter((r) => r.registrationStatus === 'registered').length
  const confirmed = all.filter((r) => r.registrationStatus === 'confirmed').length
  return { total, inProgress, completed, pending, confirmed }
}

// ---------- ID gen --------------------------------------------------------

function makeCourseId() {
  let max = 0
  for (const c of courses) {
    const m = /^tc-(\d+)$/.exec(c.id || '')
    if (m) {
      const n = parseInt(m[1], 10)
      if (n > max) max = n
    }
  }
  return `tc-${String(max + 1).padStart(3, '0')}`
}

// silence unused
void getEmployees