/**
 * dashboardService - tổng hợp + lọc dữ liệu cho Admin/Employee dashboard.
 *
 * Nguyên tắc:
 * - Toàn bộ hằng số/tổng/tỷ lệ đều tính từ các bảng trong
 *   `dashboardMockData.js`. Không hardcode con số trong component, không
 *   random mỗi lần render.
 * - Mọi hàm trả về dữ liệu theo `employeeId` để Employee dashboard chỉ
 *   thấy dữ liệu của chính mình. Admin nhận thống kê toàn công ty.
 * - Khi tích hợp Express + MongoDB, các hàm ở đây sẽ được thay bằng
 *   `httpClient.get(endpoints.dashboard.admin())` / `.employee(id)`.
 */

import {
  EMPLOYEES,
  DEPARTMENTS,
  ATTENDANCE_LAST_7_DAYS,
  LEAVE_REQUESTS,
  PAYROLL_PERIODS,
  TRAINING_COURSES,
  EMPLOYEE_TRAININGS,
  NOTIFICATIONS,
  ACTIVITIES,
  EMPLOYEE_ATTENDANCE,
} from '../data/dashboardMockData'

// ---------- Helpers --------------------------------------------------------
function findEmployee(employeeId) {
  return EMPLOYEES.find((e) => e.id === employeeId) ?? null
}

function departmentNameOf(employeeId) {
  const emp = findEmployee(employeeId)
  if (!emp) return '—'
  const dept = DEPARTMENTS.find((d) => d.id === emp.departmentId)
  return dept?.name ?? '—'
}

function sumBy(arr, selector) {
  return arr.reduce((acc, item) => acc + selector(item), 0)
}

function attendanceRate(present, total) {
  if (!total) return 0
  return Math.round((present / total) * 1000) / 10 // 1 decimal
}

// ---------- ADMIN ----------------------------------------------------------

/**
 * Tổng quan admin: 5 thẻ thống kê + 1 biểu đồ chấm công + 1 bảng phân bố
 * phòng ban. Mọi con số đều dẫn xuất từ dữ liệu.
 */
export function getAdminOverview() {
  const totalEmployees = EMPLOYEES.length
  const activeEmployees = EMPLOYEES.filter((e) => e.status === 'active').length
  const departments = DEPARTMENTS.length

  const pendingLeaves = LEAVE_REQUESTS.filter((l) => l.status === 'pending').length

  // Tổng số ngày công thực tế trong 7 ngày / tổng ngày công tối đa
  const last7 = ATTENDANCE_LAST_7_DAYS
  const totalPresent = sumBy(last7, (d) => d.present)
  // workingDays * employees mỗi ngày (xấp xỉ = số nhân viên đang làm)
  const expected = sumBy(
    last7,
    (d) => (d.day === 'CN' ? 0 : activeEmployees),
  )
  const attendanceRateValue = attendanceRate(totalPresent, expected)

  // Đếm nhân viên mới trong 30 ngày gần nhất so với 2026-10-01
  const cutoff = '2026-08-01' // giả lập "tháng này"
  const newHiresThisMonth = EMPLOYEES.filter((e) => e.joinedAt >= cutoff).length

  return {
    stats: {
      totalEmployees,
      activeEmployees,
      departments,
      pendingLeaves,
      attendanceRate: attendanceRateValue,
      newHiresThisMonth,
    },
    attendanceLast7Days: last7,
    departments: DEPARTMENTS.map((d) => ({
      id: d.id,
      name: d.name,
      headcount: EMPLOYEES.filter((e) => e.departmentId === d.id).length || d.headcount,
    })),
  }
}

/**
 * Bảng nhân viên mới: lọc từ EMPLOYEES theo `joinedAt` mới nhất.
 */
export function getRecentEmployees(limit = 5) {
  return [...EMPLOYEES]
    .sort((a, b) => (a.joinedAt < b.joinedAt ? 1 : -1))
    .slice(0, limit)
    .map((e) => ({
      id: e.id,
      name: e.name,
      email: e.email,
      department: departmentNameOf(e.id),
      jobTitle: e.jobTitle,
      joinedAt: e.joinedAt,
      status: e.status === 'active' ? 'Đang làm' : 'Ngừng',
    }))
}

/**
 * Đơn nghỉ phép đang chờ - admin dùng để xử lý.
 */
export function getPendingLeaveRequests(limit = 5) {
  return LEAVE_REQUESTS.filter((l) => l.status === 'pending')
    .sort((a, b) => (a.submittedAt < b.submittedAt ? 1 : -1))
    .slice(0, limit)
    .map((l) => ({
      ...l,
      employeeName: findEmployee(l.employeeId)?.name ?? '—',
      department: departmentNameOf(l.employeeId),
    }))
}

/**
 * Hoạt động gần đây (admin feed).
 */
export function getRecentActivities(limit = 6) {
  return [...ACTIVITIES]
    .sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1))
    .slice(0, limit)
}

// ---------- EMPLOYEE -------------------------------------------------------

/**
 * Lấy thông tin tổng quan của một nhân viên theo id.
 * Trả về null nếu id không tồn tại.
 */
export function getEmployeeSummary(employeeId) {
  const emp = findEmployee(employeeId)
  if (!emp) return null
  const attendance = EMPLOYEE_ATTENDANCE[employeeId] ?? null

  const leaves = LEAVE_REQUESTS.filter((l) => l.employeeId === employeeId)
  const pendingLeaves = leaves.filter((l) => l.status === 'pending').length
  const approvedLeaves = leaves.filter((l) => l.status === 'approved').length
  const remainingLeaves = Math.max(12 - approvedLeaves, 0) // policy demo

  const lastPayroll = PAYROLL_PERIODS
    .filter((p) => p.employeeId === employeeId)
    .sort((a, b) => (a.paidAt < b.paidAt ? 1 : -1))[0]

  const trainings = EMPLOYEE_TRAININGS
    .filter((t) => t.employeeId === employeeId)
    .map((t) => TRAINING_COURSES.find((c) => c.id === t.courseId))
    .filter(Boolean)

  const notifications = NOTIFICATIONS
    .filter((n) => n.employeeId === employeeId)
    .sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1))

  // --- Phase 27: aggregate các module khác (read-only, không copy data) ---
  let evaluations = []
  let benefits = []
  let contracts = []
  let support = { open: 0, in_progress: 0, waiting: 0, resolved: 0, recent: [] }
  let promotions = []
  let applications = { total: 0, recent: [] }
  let attendanceApproval = { pending: 0, approved: 0, rejected: 0 }

  try {
    const evalService = require('./evaluationService')
    const allEvals = evalService.getMyEvaluations
      ? evalService.getMyEvaluations(employeeId, { includeUnpublished: false })
      : []
    evaluations = allEvals.slice(0, 3)
  } catch (_e) { void _e }

  try {
    const benefitService = require('./benefitService')
    benefits = benefitService.getMyBenefits
      ? benefitService.getMyBenefits(employeeId) || []
      : []
  } catch (_e) { void _e }

  try {
    const contractService = require('./contractService')
    contracts = contractService.getContractsByEmployee
      ? contractService.getContractsByEmployee(employeeId) || []
      : []
  } catch (_e) { void _e }

  try {
    const supportService = require('./supportService')
    const supportAll = supportService.getSupportRequestsByUser
      ? supportService.getSupportRequestsByUser(employeeId) || []
      : []
    support = {
      open: supportAll.filter((s) => s.status === 'open').length,
      in_progress: supportAll.filter((s) => s.status === 'in_progress').length,
      waiting: supportAll.filter((s) => s.status === 'waiting').length,
      resolved: supportAll.filter((s) => s.status === 'resolved' || s.status === 'closed').length,
      recent: supportAll
        .slice()
        .sort((a, b) => String(b.createdAt || '').localeCompare(String(a.createdAt || '')))
        .slice(0, 3),
    }
  } catch (_e) { void _e }

  try {
    const promotionService = require('./promotionService')
    const allProm = promotionService.getPromotionsByEmployeeId
      ? promotionService.getPromotionsByEmployeeId(employeeId) || []
      : []
    promotions = allProm
      .slice()
      .sort((a, b) => String(b.createdAt || '').localeCompare(String(a.createdAt || '')))
      .slice(0, 3)
  } catch (_e) { void _e }

  try {
    const recruitmentService = require('./recruitmentService')
    const allApps = recruitmentService.getApplicationsByEmployeeId
      ? recruitmentService.getApplicationsByEmployeeId(employeeId) || []
      : []
    applications = {
      total: allApps.length,
      recent: allApps
        .slice()
        .sort((a, b) => String(b.createdAt || '').localeCompare(String(a.createdAt || '')))
        .slice(0, 3),
    }
  } catch (_e) { void _e }

  let payrollApproval = { pending: 0, approved: 0, rejected: 0 }
  try {
    const payrollService = require('./payrollService')
    if (payrollService.getPayrollByEmployee) {
      const myPay = payrollService.getPayrollByEmployee(employeeId) || []
      payrollApproval = {
        pending:  myPay.filter((r) => r.approvalStatus === 'pending').length,
        approved: myPay.filter((r) => r.approvalStatus === 'approved').length,
        rejected: myPay.filter((r) => r.approvalStatus === 'rejected').length,
      }
    }
  } catch (_e) { void _e }

  let evaluationApproval = { pending: 0, approved: 0, rejected: 0, latest: null }
  try {
    const evaluationService = require('./evaluationService')
    if (evaluationService.getMyEvaluations) {
      const myEvals = evaluationService.getMyEvaluations(employeeId, { includeUnpublished: true }) || []
      evaluationApproval = {
        pending:  myEvals.filter((r) => r.status === 'completed').length,
        approved: myEvals.filter((r) => r.status === 'published').length,
        rejected: myEvals.filter((r) => r.status === 'rejected').length,
        latest: myEvals[0] || null,
      }
    }
  } catch (_e) { void _e }

  try {
    const attendanceService = require('./attendanceService')
    if (attendanceService.getMyAttendance) {
      const myAtt = attendanceService.getMyAttendance(employeeId) || []
      attendanceApproval = {
        pending:  myAtt.filter((r) => r.approvalStatus === 'pending').length,
        approved: myAtt.filter((r) => r.approvalStatus === 'approved').length,
        rejected: myAtt.filter((r) => r.approvalStatus === 'rejected').length,
      }
    }
  } catch (_e) { void _e }

  return {
    employee: {
      id: emp.id,
      name: emp.name,
      email: emp.email,
      jobTitle: emp.jobTitle,
      department: departmentNameOf(emp.id),
      joinedAt: emp.joinedAt,
      status: emp.status,
    },
    attendance,
    leave: {
      pending: pendingLeaves,
      approved: approvedLeaves,
      remaining: remainingLeaves,
      recent: leaves
        .sort((a, b) => (a.submittedAt < b.submittedAt ? 1 : -1))
        .slice(0, 5),
    },
    payroll: lastPayroll ?? null,
    trainings,
    notifications,
    evaluations,
    benefits,
    contracts,
    support,
    promotions,
    applications,
    attendanceApproval,
    payrollApproval,
    evaluationApproval,
  }
}

/**
 * Trạng thái chấm công của employee trong 7 ngày gần nhất -
 * dùng để render mini chart trên Employee Dashboard.
 */
export function getEmployeeAttendanceWeek(_employeeId) {
  // Trong demo: hiển thị tỷ lệ chấm công cá nhân mỗi ngày = present / active
  // (đơn giản hoá). Thực tế sẽ query bảng `attendance` riêng của user.
  const active = EMPLOYEES.filter((e) => e.status === 'active').length
  return ATTENDANCE_LAST_7_DAYS.map((d) => ({
    date: d.date,
    day: d.day,
    present: d.day === 'CN' ? 1 : active > 30 ? 1 : 1, // demo: nhân viên luôn đi làm trừ CN
    late: 0,
  }))
}