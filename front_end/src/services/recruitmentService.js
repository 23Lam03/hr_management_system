/**
 * recruitmentService - tuyển dụng (Phần 19 — AD-HRM14).
 *
 * Nguyên tắc:
 * - In-memory store (clone từ seed), có pub-sub để UI bump tick.
 * - Lưu vào localStorage với key hrm_recruitment_jobs / hrm_recruitment_applications
 *   để thay đổi demo được giữ qua refresh.
 * - Validate cơ bản; KHÔNG tính toán HR/salary/legal.
 * - Khi tích hợp backend chỉ cần thay body các hàm bằng httpClient.
 */

import {
  JOBS as SEED_JOBS,
  APPLICATIONS as SEED_APPLICATIONS,
  JOB_STATUSES,
  APPLICATION_STATUSES,
  DEPARTMENT_OPTIONS,
  EMPLOYMENT_TYPES,
  JOB_STATUS_LABEL,
  APPLICATION_STATUS_LABEL,
} from '../data/recruitmentData'

const JOB_KEY = 'hrm_recruitment_jobs'
const APP_KEY = 'hrm_recruitment_applications'

// ---------- Persist helpers (mock) ----------------------------------------
function loadFromStorage(key, _seed) {
  try {
    const raw = localStorage.getItem(key)
    if (!raw) return null
    const parsed = JSON.parse(raw)
    if (!Array.isArray(parsed)) return null
    return parsed
  } catch (_e) {
    void _e
    return null
  }
}

function saveToStorage(key, list) {
  try {
    localStorage.setItem(key, JSON.stringify(list))
  } catch (_e) {
    void _e
  }
}

// ---------- Mutable stores -------------------------------------------------
let jobs = (loadFromStorage(JOB_KEY, SEED_JOBS) ?? SEED_JOBS).map((j) => ({ ...j }))
let applications = (loadFromStorage(APP_KEY, SEED_APPLICATIONS) ?? SEED_APPLICATIONS).map((a) => ({ ...a }))

const listeners = new Set()
function emitChange() {
  for (const cb of listeners) {
    try { cb() } catch (_e) { void _e }
  }
}

export function subscribeRecruitment(cb) {
  listeners.add(cb)
  return () => listeners.delete(cb)
}

function persist() {
  saveToStorage(JOB_KEY, jobs)
  saveToStorage(APP_KEY, applications)
  emitChange()
}

// ---------- Lookups --------------------------------------------------------
export function getJobStatuses()           { return JOB_STATUSES.slice() }
export function getApplicationStatuses()   { return APPLICATION_STATUSES.slice() }
export function getDepartmentOptions()     { return DEPARTMENT_OPTIONS.slice() }
export function getEmploymentTypeOptions() { return EMPLOYMENT_TYPES.slice() }

export function getJobStatusLabel(v) {
  return JOB_STATUS_LABEL[v] ?? v
}

export function getApplicationStatusLabel(v) {
  return APPLICATION_STATUS_LABEL[v] ?? v
}

// ---------- Job CRUD -------------------------------------------------------
export function getJobs() {
  return jobs.map((j) => ({ ...j }))
}

export function getJobById(id) {
  const found = jobs.find((j) => j.id === id)
  return found ? { ...found } : null
}

function makeJobId() {
  const max = jobs.reduce((m, j) => {
    const n = Number(String(j.id).replace('j-', '')) || 0
    return Math.max(m, n)
  }, 100)
  return `j-${String(max + 1).padStart(3, '0')}`
}

export function validateJob(payload, { excludeId: _excludeId = null } = {}) {
  const errors = {}
  if (!payload.title?.trim()) {
    errors.title = 'Vui lòng nhập tiêu đề công việc.'
  }
  if (!payload.departmentId) {
    errors.departmentId = 'Vui lòng chọn phòng ban.'
  }
  if (!payload.employmentType) {
    errors.employmentType = 'Vui lòng chọn loại hình làm việc.'
  }
  if (!payload.description?.trim()) {
    errors.description = 'Vui lòng nhập mô tả công việc.'
  }
  const vacancies = Number(payload.vacancies)
  if (payload.vacancies === '' || payload.vacancies === null || payload.vacancies === undefined || Number.isNaN(vacancies)) {
    errors.vacancies = 'Vui lòng nhập số vị trí cần tuyển.'
  } else if (vacancies <= 0) {
    errors.vacancies = 'Số vị trí cần lớn hơn 0.'
  }
  return errors
}

export function createJob(payload) {
  const errors = validateJob(payload)
  if (Object.keys(errors).length) {
    return Promise.resolve({ ok: false, errors })
  }
  const now = new Date().toISOString()
  const next = {
    id: makeJobId(),
    title: payload.title.trim(),
    departmentId: payload.departmentId,
    location: payload.location?.trim() || '',
    employmentType: payload.employmentType,
    description: payload.description.trim(),
    requirements: Array.isArray(payload.requirements)
      ? payload.requirements.filter(Boolean)
      : (payload.requirements ?? '')
          .toString()
          .split('\n')
          .map((s) => s.trim())
          .filter(Boolean),
    vacancies: Number(payload.vacancies),
    status: payload.status || 'draft',
    postedAt: payload.status === 'open' ? new Date().toISOString().slice(0, 10) : null,
    closingDate: payload.closingDate || null,
    createdBy: 'usr-admin-001',
    createdAt: now,
    updatedAt: now,
  }
  jobs = [next, ...jobs]
  persist()
  return Promise.resolve({ ok: true, job: { ...next } })
}

export function updateJob(id, payload) {
  const errors = validateJob(payload, { excludeId: id })
  if (Object.keys(errors).length) {
    return Promise.resolve({ ok: false, errors })
  }
  const idx = jobs.findIndex((j) => j.id === id)
  if (idx === -1) {
    return Promise.resolve({ ok: false, error: 'Không tìm thấy công việc.' })
  }
  const current = jobs[idx]
  const next = {
    ...current,
    title: payload.title.trim(),
    departmentId: payload.departmentId,
    location: payload.location?.trim() || '',
    employmentType: payload.employmentType,
    description: payload.description.trim(),
    requirements: Array.isArray(payload.requirements)
      ? payload.requirements.filter(Boolean)
      : (payload.requirements ?? '')
          .toString()
          .split('\n')
          .map((s) => s.trim())
          .filter(Boolean),
    vacancies: Number(payload.vacancies),
    status: payload.status || current.status,
    closingDate: payload.closingDate || null,
    updatedAt: new Date().toISOString(),
  }
  if (current.status !== 'open' && next.status === 'open' && !next.postedAt) {
    next.postedAt = new Date().toISOString().slice(0, 10)
  }
  jobs = jobs.map((j) => (j.id === id ? next : j))
  persist()
  return Promise.resolve({ ok: true, job: { ...next } })
}

export function updateJobStatus(id, status) {
  const valid = JOB_STATUSES.find((s) => s.value === status)
  if (!valid) {
    return Promise.resolve({ ok: false, error: 'Trạng thái không hợp lệ.' })
  }
  const idx = jobs.findIndex((j) => j.id === id)
  if (idx === -1) {
    return Promise.resolve({ ok: false, error: 'Không tìm thấy công việc.' })
  }
  const next = {
    ...jobs[idx],
    status,
    updatedAt: new Date().toISOString(),
  }
  if (status === 'open' && !next.postedAt) {
    next.postedAt = new Date().toISOString().slice(0, 10)
  }
  jobs = jobs.map((j) => (j.id === id ? next : j))
  persist()
  return Promise.resolve({ ok: true, job: { ...next } })
}

export function deleteJob(id) {
  const found = jobs.find((j) => j.id === id)
  if (!found) {
    return Promise.resolve({ ok: false, error: 'Không tìm thấy công việc.' })
  }
  const relatedApps = applications.filter((a) => a.jobId === id)
  if (relatedApps.length) {
    return Promise.resolve({
      ok: false,
      error: 'hasApplications',
      applicationCount: relatedApps.length,
    })
  }
  jobs = jobs.filter((j) => j.id !== id)
  persist()
  return Promise.resolve({ ok: true })
}

// ---------- Application CRUD -----------------------------------------------
export function getApplications() {
  return applications.map((a) => ({ ...a }))
}

export function getApplicationById(id) {
  const found = applications.find((a) => a.id === id)
  return found ? { ...found } : null
}

export function getApplicationsByJobId(jobId) {
  return applications.filter((a) => a.jobId === jobId).map((a) => ({ ...a }))
}

export function getApplicationCountByJobId(jobId) {
  return applications.filter((a) => a.jobId === jobId).length
}

export function getApplicationsByEmployeeId(employeeId) {
  if (!employeeId) return []
  return applications.filter((a) => a.employeeId === employeeId).map((a) => ({ ...a }))
}

export function hasEmployeeApplied(jobId, employeeId) {
  if (!employeeId) return false
  return applications.some((a) => a.jobId === jobId && a.employeeId === employeeId)
}

function makeAppId() {
  const max = applications.reduce((m, a) => {
    const n = Number(String(a.id).replace('app-', '')) || 0
    return Math.max(m, n)
  }, 0)
  return `app-${String(max + 1).padStart(3, '0')}`
}

export function createApplication(payload) {
  if (!payload.jobId) return Promise.resolve({ ok: false, errors: { jobId: 'Vui lòng chọn vị trí.' } })
  if (!payload.candidateName?.trim()) return Promise.resolve({ ok: false, errors: { candidateName: 'Vui lòng nhập tên ứng viên.' } })
  const now = new Date().toISOString()
  const next = {
    id: makeAppId(),
    jobId: payload.jobId,
    employeeId: payload.employeeId ?? null,
    candidateName: payload.candidateName.trim(),
    email: payload.email?.trim() || '',
    phone: payload.phone?.trim() || '',
    appliedAt: payload.appliedAt || new Date().toISOString().slice(0, 10),
    status: payload.status || 'new',
    note: payload.note?.trim() || '',
    createdAt: now,
    updatedAt: now,
  }
  applications = [next, ...applications]
  persist()
  return Promise.resolve({ ok: true, application: { ...next } })
}

export function updateApplicationStatus(id, status) {
  const valid = APPLICATION_STATUSES.find((s) => s.value === status)
  if (!valid) return Promise.resolve({ ok: false, error: 'Trạng thái không hợp lệ.' })
  const idx = applications.findIndex((a) => a.id === id)
  if (idx === -1) return Promise.resolve({ ok: false, error: 'Không tìm thấy hồ sơ.' })
  const next = { ...applications[idx], status, updatedAt: new Date().toISOString() }
  applications = applications.map((a) => (a.id === id ? next : a))
  persist()
  return Promise.resolve({ ok: true, application: { ...next } })
}

export function updateApplicationNote(id, note) {
  const idx = applications.findIndex((a) => a.id === id)
  if (idx === -1) return Promise.resolve({ ok: false, error: 'Không tìm thấy hồ sơ.' })
  const next = { ...applications[idx], note: (note ?? '').trim(), updatedAt: new Date().toISOString() }
  applications = applications.map((a) => (a.id === id ? next : a))
  persist()
  return Promise.resolve({ ok: true, application: { ...next } })
}

export function deleteApplication(id) {
  const idx = applications.findIndex((a) => a.id === id)
  if (idx === -1) return Promise.resolve({ ok: false, error: 'Không tìm thấy hồ sơ.' })
  applications = applications.filter((a) => a.id !== id)
  persist()
  return Promise.resolve({ ok: true })
}

// ---------- Summary --------------------------------------------------------
export function getRecruitmentSummary() {
  return {
    totalJobs: jobs.length,
    openJobs: jobs.filter((j) => j.status === 'open').length,
    pausedJobs: jobs.filter((j) => j.status === 'paused').length,
    closedJobs: jobs.filter((j) => j.status === 'closed').length,
    totalApplications: applications.length,
    applicationsByStatus: {
      new: applications.filter((a) => a.status === 'new').length,
      screening: applications.filter((a) => a.status === 'screening').length,
      interview: applications.filter((a) => a.status === 'interview').length,
      offer: applications.filter((a) => a.status === 'offer').length,
      hired: applications.filter((a) => a.status === 'hired').length,
      rejected: applications.filter((a) => a.status === 'rejected').length,
    },
  }
}

// ---------- Query helpers (search/filter/sort/pagination) -----------------
const JOB_SORTABLE = new Set(['title', 'postedAt', 'closingDate', 'vacancies'])
const APP_SORTABLE = new Set(['candidateName', 'appliedAt', 'status'])

function sortRows(items, sortBy, sortDir) {
  if (!sortBy) return items
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

export function queryJobs(q = {}) {
  const {
    search = '',
    status = '',
    employmentType = '',
    departmentId = '',
    sortBy = 'postedAt',
    sortDir = 'desc',
    page = 1,
    pageSize = 10,
  } = q

  const trimmed = search.toLowerCase()
  let rows = getJobs()
  if (trimmed) {
    rows = rows.filter((j) => {
      const deptName = DEPARTMENT_OPTIONS.find((d) => d.value === j.departmentId)?.label ?? ''
      return (
        j.title.toLowerCase().includes(trimmed) ||
        deptName.toLowerCase().includes(trimmed) ||
        (j.location ?? '').toLowerCase().includes(trimmed)
      )
    })
  }
  if (status) rows = rows.filter((j) => j.status === status)
  if (employmentType) rows = rows.filter((j) => j.employmentType === employmentType)
  if (departmentId) rows = rows.filter((j) => j.departmentId === departmentId)

  if (JOB_SORTABLE.has(sortBy)) {
    rows = sortRows(rows, sortBy, sortDir)
  } else {
    // Fallback: sort by updatedAt desc
    rows = sortRows(rows, 'updatedAt', 'desc')
  }

  const total = rows.length
  const size = Math.max(1, Number(pageSize) || 10)
  const totalPages = Math.max(1, Math.ceil(total / size))
  const currentPage = Math.min(Math.max(1, Number(page) || 1), totalPages)
  const start = (currentPage - 1) * size
  const items = rows.slice(start, start + size)

  // đính kèm application count
  const itemsWithCount = items.map((j) => ({
    ...j,
    applicationCount: getApplicationCountByJobId(j.id),
  }))

  return {
    items: itemsWithCount,
    total,
    page: currentPage,
    pageSize: size,
    totalPages,
  }
}

export function queryApplications(q = {}) {
  const {
    search = '',
    status = '',
    jobId = '',
    sortBy = 'appliedAt',
    sortDir = 'desc',
    page = 1,
    pageSize = 10,
  } = q

  const trimmed = search.toLowerCase()
  let rows = getApplications()
  if (trimmed) {
    rows = rows.filter((a) => {
      const job = getJobById(a.jobId)
      const jobTitle = job?.title ?? ''
      return (
        a.candidateName.toLowerCase().includes(trimmed) ||
        a.email.toLowerCase().includes(trimmed) ||
        a.phone.toLowerCase().includes(trimmed) ||
        jobTitle.toLowerCase().includes(trimmed)
      )
    })
  }
  if (status) rows = rows.filter((a) => a.status === status)
  if (jobId) rows = rows.filter((a) => a.jobId === jobId)

  if (APP_SORTABLE.has(sortBy)) {
    rows = sortRows(rows, sortBy, sortDir)
  } else {
    rows = sortRows(rows, 'updatedAt', 'desc')
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