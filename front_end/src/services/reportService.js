/**
 * reportService - tổng hợp dữ liệu từ các module hiện có cho AD-HRM12.
 *
 * Nguyên tắc:
 * - KHÔNG tự tạo dữ liệu. Chỉ gom & đếm từ các service hiện tại.
 * - KHÔNG tính công thức HR/tax/insurance/overtime mới.
 * - Khi cần truy vấn/lọc/sort/paginate, ưu tiên dùng `query*` của service
 *   tương ứng (đã chốt chuẩn). Nếu cần lọc gì khác, tự lọc trên kết quả
 *   nhưng KHÔNG mutate store.
 */

import {
  getEmployees,
  getEmployeeById,
  getDepartments,
  queryEmployees,
  subscribeEmployees,
} from './employeeService'

import {
  getAttendanceRecords,
  queryAttendance,
  subscribeAttendance,
} from './attendanceService'

import {
  getPayrollRecords,
  queryPayroll,
  subscribePayroll,
} from './payrollService'

import {
  queryLeaveRequests,
  subscribeLeaves,
} from './leaveService'

import {
  queryEvaluationsByCycle,
  queryEvaluationCycles,
  subscribeEvaluations,
} from './evaluationService'

import {
  queryTrainings,
  subscribeTrainings,
} from './trainingService'

import {
  queryBenefits,
  subscribeBenefits,
} from './benefitService'

import {
  queryContracts,
  subscribeContracts,
} from './contractService'

import { ATTENDANCE_STATUSES, ATTENDANCE_STATUS_LABEL } from '../data/attendanceMockData'
import { EMPLOYMENT_STATUS_LABEL, EMPLOYMENT_STATUSES } from '../data/employeeMockData'
import { PAYMENT_STATUS_LABEL, PAYMENT_STATUSES } from '../data/payrollMockData'
import { LEAVE_STATUSES, LEAVE_STATUS_LABEL } from '../data/leaveMockData'
import { EVALUATION_STATUSES, EVALUATION_STATUS_LABEL } from '../data/evaluationMockData'
import { CONTRACT_STATUSES, CONTRACT_STATUS_LABEL } from '../data/contractMockData'
import { BENEFIT_STATUSES, BENEFIT_STATUS_LABEL } from '../data/benefitMockData'
import { TRAINING_STATUSES, TRAINING_STATUS_LABEL } from '../data/trainingMockData'

// ---------- Pub-sub --------------------------------------------------------
const listeners = new Set()
function emitChange() {
  for (const cb of listeners) {
    try { cb() } catch (_e) { void _e }
  }
}

export function subscribeReport(cb) {
  listeners.add(cb)
  // forward events from underlying services
  const unsubE = subscribeEmployees(() => emitChange())
  const unsubA = subscribeAttendance(() => emitChange())
  const unsubP = subscribePayroll(() => emitChange())
  const unsubL = subscribeLeaves(() => emitChange())
  const unsubEv = subscribeEvaluations(() => emitChange())
  const unsubT = subscribeTrainings(() => emitChange())
  const unsubB = subscribeBenefits(() => emitChange())
  const unsubC = subscribeContracts(() => emitChange())

  listeners.add(cb)
  return () => {
    listeners.delete(cb)
    unsubE(); unsubA(); unsubP(); unsubL(); unsubEv(); unsubT(); unsubB(); unsubC()
  }
}

// ---------- Lookups (status enums) ----------------------------------------
// Re-export getDepartments để các component có thể dùng qua reportService
export { getDepartments }
export function getEmployeeStatuses()     { return EMPLOYMENT_STATUSES.slice() }
export function getAttendanceStatusList() { return ATTENDANCE_STATUSES.slice() }
export function getPaymentStatusList()    { return PAYMENT_STATUSES.slice() }
export function getLeaveStatusList()      { return LEAVE_STATUSES.slice() }
export function getEvaluationStatusList() { return EVALUATION_STATUSES.slice() }
export function getTrainingStatusList()   { return TRAINING_STATUSES.slice() }
export function getBenefitStatusList()    { return BENEFIT_STATUSES.slice() }
export function getContractStatusList()   { return CONTRACT_STATUSES.slice() }

export function getStatusLabel(kind, value) {
  const map = {
    employee:    EMPLOYMENT_STATUS_LABEL,
    attendance:  ATTENDANCE_STATUS_LABEL,
    payroll:     PAYMENT_STATUS_LABEL,
    leave:       LEAVE_STATUS_LABEL,
    evaluation:  EVALUATION_STATUS_LABEL,
    training:    TRAINING_STATUS_LABEL,
    benefit:     BENEFIT_STATUS_LABEL,
    contract:    CONTRACT_STATUS_LABEL,
  }
  return (map[kind] ?? {})[value] ?? value
}

export function getDepartmentName(departmentId) {
  return getDepartments().find((d) => d.id === departmentId)?.name ?? '—'
}

// ---------- System overview ------------------------------------------------

export function getSystemOverview() {
  const employees    = getEmployees()
  const attendance   = getAttendanceRecords()
  const payroll      = getPayrollRecords()
  const leave        = countByStatus(queryLeaveRequests().items)
  const training     = queryTrainings().total
  const benefit      = queryBenefits().total
  const contract     = queryContracts().total

  const activeEmployees = employees.filter((e) => e.status === 'active').length

  const payrollSum = payroll.reduce(
    (acc, r) => ({
      gross: acc.gross + (r.grossSalary || 0),
      deduction: acc.deduction + (r.totalDeduction || 0),
      net: acc.net + (r.netSalary || 0),
    }),
    { gross: 0, deduction: 0, net: 0 },
  )

  // attendance kpi
  const attendanceByStatus = countByStatus(attendance)

  return {
    employees: {
      total: employees.length,
      active: activeEmployees,
      inactive: employees.length - activeEmployees,
    },
    attendance: {
      total: attendance.length,
      byStatus: attendanceByStatus,
    },
    payroll: {
      total: payroll.length,
      gross: payrollSum.gross,
      deduction: payrollSum.deduction,
      net: payrollSum.net,
    },
    leave: {
      total: queryLeaveRequests().total,
      byStatus: leave,
    },
    training: { total: training },
    benefit:  { total: benefit },
    contract: { total: contract },
  }
}

// ---------- Employee Report -----------------------------------------------

export function getEmployeeReport(query = {}) {
  const data = queryEmployees(query)
  const employees = data.items
  const byDepartment = countByGroup(employees, (e) => e.departmentId)
  const byStatus = countByStatus(employees)

  return {
    ...data,
    employees,
    summary: {
      total: employees.length,
      byStatus,
      byDepartment,
    },
  }
}

// ---------- Attendance Report ----------------------------------------------

export function getAttendanceReport(query = {}) {
  const data = queryAttendance(query)
  const records = data.items
  const byStatus = countByStatus(records)
  const byDate = countByGroup(records, (r) => r.date)
  const dateList = Object.keys(byDate).sort()
  const series = dateList.map((date) => ({
    date,
    total: byDate[date],
    present: records.filter((r) => r.date === date && r.status !== 'absent' && r.status !== 'on_leave').length,
    absent: records.filter((r) => r.date === date && r.status === 'absent').length,
    late: records.filter((r) => r.date === date && r.status === 'late').length,
  }))

  return {
    ...data,
    records,
    summary: {
      total: records.length,
      byStatus,
      byDate,
      series,
    },
  }
}

// ---------- Payroll Report ------------------------------------------------

export function getPayrollReport(query = {}) {
  const data = queryPayroll(query)
  const records = data.items
  const totals = records.reduce(
    (acc, r) => ({
      gross: acc.gross + (r.grossSalary || 0),
      deduction: acc.deduction + (r.totalDeduction || 0),
      net: acc.net + (r.netSalary || 0),
    }),
    { gross: 0, deduction: 0, net: 0 },
  )

  // group theo tháng/năm
  const byPeriod = records.reduce((acc, r) => {
    const key = `${r.year}-${String(r.month).padStart(2, '0')}`
    if (!acc[key]) acc[key] = { period: key, total: 0, net: 0, gross: 0 }
    acc[key].total += 1
    acc[key].net   += (r.netSalary || 0)
    acc[key].gross += (r.grossSalary || 0)
    return acc
  }, {})
  const series = Object.values(byPeriod).sort((a, b) => a.period.localeCompare(b.period))

  return {
    ...data,
    records,
    summary: {
      total: records.length,
      gross: totals.gross,
      deduction: totals.deduction,
      net: totals.net,
      byStatus: countByStatus(records, 'paymentStatus'),
      series,
    },
  }
}

// ---------- Leave Report --------------------------------------------------

export function getLeaveReport(query = {}) {
  const data = queryLeaveRequests(query)
  const items = data.items
  return {
    ...data,
    items,
    summary: {
      total: items.length,
      byStatus: countByStatus(items),
    },
  }
}

// ---------- Evaluation Report ---------------------------------------------

export function getEvaluationReport(query = {}) {
  // Nếu truyền cycleId -> query theo cycle; nếu không lấy cycle gần nhất.
  const cycles = queryEvaluationCycles().items
  const cycleId = query.cycleId ?? cycles[0]?.id
  if (!cycleId) {
    return { items: [], total: 0, page: 1, pageSize: 10, totalPages: 0, summary: { total: 0, byStatus: {}, avgScore: null } }
  }
  const data = queryEvaluationsByCycle(cycleId, query)
  const items = data.items
  const completed = items.filter((e) => e.status === 'completed' || e.status === 'published')
  const scores = completed
    .map((e) => e.overallScore ?? e.finalScore)
    .filter((s) => typeof s === 'number' && !Number.isNaN(s))
  const avgScore = scores.length ? scores.reduce((a, b) => a + b, 0) / scores.length : null

  return {
    ...data,
    items,
    cycleId,
    summary: {
      total: items.length,
      byStatus: countByStatus(items),
      avgScore,
      completed: completed.length,
    },
  }
}

export function getEvaluationCycles() {
  return queryEvaluationCycles().items
}

// ---------- Training Report -----------------------------------------------

export function getTrainingReport(query = {}) {
  const data = queryTrainings(query)
  const items = data.items
  return {
    ...data,
    items,
    summary: {
      total: items.length,
      byStatus: countByStatus(items),
      participants: items.reduce((acc, t) => acc + (t.participantsCount ?? t.participants ?? 0), 0),
    },
  }
}

// ---------- Benefits Report -----------------------------------------------

export function getBenefitsReport(query = {}) {
  const data = queryBenefits(query)
  const items = data.items
  return {
    ...data,
    items,
    summary: {
      total: items.length,
      byStatus: countByStatus(items),
    },
  }
}

// ---------- Contract Report -----------------------------------------------

export function getContractsReport(query = {}) {
  const data = queryContracts(query)
  const items = data.items
  return {
    ...data,
    items,
    summary: {
      total: items.length,
      byStatus: countByStatus(items),
    },
  }
}

// ---------- Helpers --------------------------------------------------------

function countByStatus(items, key = 'status') {
  const out = {}
  for (const it of items) {
    const v = it[key] ?? 'unknown'
    out[v] = (out[v] || 0) + 1
  }
  return out
}

function countByGroup(items, getter) {
  const out = {}
  for (const it of items) {
    const v = getter(it) ?? 'unknown'
    out[v] = (out[v] || 0) + 1
  }
  return out
}

// Re-export cho AdminReportsPage dùng tiện
export { getEmployeeById }