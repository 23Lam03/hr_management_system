// Dashboard & Reports service (Phase 9).
//
// Tất cả aggregation chạy trong MongoDB để tránh N+1. Khi cần join
// Employee ↔ Department dùng $lookup (1 query duy nhất). Không dùng
// $where. Không tự tính các giá trị Phase 8 chưa hỗ trợ (workedDays
// từ Attendance, OT, holiday...).
//
// Quy ước đếm Employee:
// - `total`     = COUNT(isDeleted:false)
// - `active`    = COUNT(isDeleted:false && employmentStatus='active')
// - `inactive`  = COUNT(isDeleted:false && employmentStatus in {on_leave, inactive})
//
// Quy ước soft-delete:
// - Chỉ Employee có `isDeleted`. Mọi aggregation KHÔNG đếm isDeleted=true.

import {
  Employee,
  Department,
  Position,
  Attendance,
  LeaveRequest,
  Payroll,
} from '../models/index.js';
import { ATTENDANCE_STATUSES } from '../models/attendance.model.js';
import { LEAVE_STATUSES, LEAVE_TYPES } from '../models/leaveRequest.model.js';
import { PAYROLL_STATUSES } from '../models/payroll.model.js';

function round2(n) {
  if (!Number.isFinite(n)) return 0;
  return Math.round(n * 100) / 100;
}

function nowUtcMidnight() {
  const now = new Date();
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));
}

function endOfMonth(month, year) {
  // UTC midnight of first day of NEXT month → exclusive.
  return new Date(Date.UTC(year, month, 1));
}

function defaultPayrollPeriod() {
  const now = new Date();
  // Kỳ lương hiện tại = tháng trước (vì tháng hiện tại thường chưa chốt).
  // Trả về tháng trước cho an toàn; nếu muốn override, dùng query params.
  const prev = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - 1, 1));
  return {
    periodMonth: prev.getUTCMonth() + 1,
    periodYear: prev.getUTCFullYear(),
  };
}

// ===== Overview =====

export async function getOverview() {
  // Run independent counts in parallel.
  const [empAgg, depActive, posActive, leavePending, attendanceInMonth, payrollForPeriod] =
    await Promise.all([
      Employee.aggregate([
        { $match: { isDeleted: { $ne: true } } },
        {
          $group: {
            _id: '$employmentStatus',
            count: { $sum: 1 },
          },
        },
      ]),
      Department.countDocuments({ status: 'active' }),
      Position.countDocuments({ status: 'active' }),
      LeaveRequest.countDocuments({ status: 'pending' }),
      Attendance.countDocuments({
        workDate: { $gte: nowUtcMidnight(), $lt: endOfMonth(new Date().getUTCMonth() + 1, new Date().getUTCFullYear()) },
      }),
      (async () => {
        const period = defaultPayrollPeriod();
        const agg = await Payroll.aggregate([
          { $match: { periodMonth: period.periodMonth, periodYear: period.periodYear } },
          {
            $group: {
              _id: '$status',
              count: { $sum: 1 },
              totalNet: { $sum: '$netSalary' },
            },
          },
        ]);
        return { period, agg };
      })(),
    ]);

  // Tính total/active/inactive
  let total = 0;
  let active = 0;
  let inactive = 0;
  for (const row of empAgg) {
    const c = row.count;
    total += c;
    if (row._id === 'active') active += c;
    else inactive += c; // 'on_leave' + 'inactive' + null (defensive)
  }

  // Build payroll summary theo kỳ
  const payrollCount = payrollForPeriod.agg.reduce((s, r) => s + r.count, 0);
  let payrollTotalNet = 0;
  let payrollTotalNetPaid = 0;
  for (const r of payrollForPeriod.agg) {
    payrollTotalNet += round2(r.totalNet || 0);
    if (r._id === 'paid') payrollTotalNetPaid += round2(r.totalNet || 0);
  }

  return {
    employees: { total, active, inactive },
    departments: { active: depActive },
    positions: { active: posActive },
    leaveRequests: { pending: leavePending },
    attendance: { recordsInMonth: attendanceInMonth },
    payroll: {
      currentPeriod: {
        periodMonth: payrollForPeriod.period.periodMonth,
        periodYear: payrollForPeriod.period.periodYear,
        count: payrollCount,
        totalNet: round2(payrollTotalNet),
        totalNetPaid: round2(payrollTotalNetPaid),
      },
    },
  };
}

// ===== Attendance summary =====

export async function getAttendanceSummary({ startDate, endDate }) {
  const match = {};
  if (startDate || endDate) {
    match.workDate = {};
    if (startDate) match.workDate.$gte = startDate;
    if (endDate) {
      // inclusive
      const endExclusive = new Date(endDate.getTime() + 24 * 60 * 60 * 1000);
      match.workDate.$lt = endExclusive;
    }
  }

  // Run independent aggregations in parallel.
  const [totals, byStatus, byDay, byDept] = await Promise.all([
    Attendance.aggregate([
      { $match: match },
      { $count: 'total' },
    ]),
    Attendance.aggregate([
      { $match: match },
      { $group: { _id: '$status', count: { $sum: 1 } } },
    ]),
    Attendance.aggregate([
      { $match: match },
      { $group: { _id: '$workDate', count: { $sum: 1 } } },
      { $count: 'uniqueDays' },
    ]),
    Attendance.aggregate([
      { $match: match },
      {
        $lookup: {
          from: 'employees',
          localField: 'employeeId',
          foreignField: '_id',
          as: 'employee',
        },
      },
      { $unwind: { path: '$employee', preserveNullAndEmptyArrays: true } },
      {
        $group: {
          _id: '$employee.departmentId',
          count: { $sum: 1 },
        },
      },
      {
        $lookup: {
          from: 'departments',
          localField: '_id',
          foreignField: '_id',
          as: 'department',
        },
      },
      {
        $project: {
          _id: 0,
          departmentId: '$_id',
          name: { $ifNull: [{ $arrayElemAt: ['$department.name', 0] }, null] },
          count: 1,
        },
      },
      { $sort: { count: -1 } },
    ]),
  ]);

  // Build byStatus map với mọi giá trị enum.
  const statusMap = {};
  for (const s of ATTENDANCE_STATUSES) statusMap[s] = 0;
  for (const r of byStatus) {
    if (Object.prototype.hasOwnProperty.call(statusMap, r._id)) {
      statusMap[r._id] = r.count;
    }
  }

  return {
    range: {
      startDate: startDate || null,
      endDate: endDate || null,
    },
    total: totals[0]?.total || 0,
    uniqueDays: byDay[0]?.uniqueDays || 0,
    byStatus: statusMap,
    byDepartment: byDept,
  };
}

// ===== Leave summary =====

export async function getLeaveSummary({ startDate, endDate, by }) {
  const dateField = by === 'createdAt' ? 'createdAt' : 'startDate';
  const match = {};
  if (startDate || endDate) {
    match[dateField] = {};
    if (startDate) match[dateField].$gte = startDate;
    if (endDate) {
      const endExclusive = new Date(endDate.getTime() + 24 * 60 * 60 * 1000);
      match[dateField].$lt = endExclusive;
    }
  }

  const [totals, byStatus, byLeaveType] = await Promise.all([
    LeaveRequest.aggregate([{ $match: match }, { $count: 'total' }]),
    LeaveRequest.aggregate([
      { $match: match },
      { $group: { _id: '$status', count: { $sum: 1 } } },
    ]),
    LeaveRequest.aggregate([
      { $match: match },
      { $group: { _id: '$leaveType', count: { $sum: 1 } } },
    ]),
  ]);

  const statusMap = {};
  for (const s of LEAVE_STATUSES) statusMap[s] = 0;
  for (const r of byStatus) {
    if (Object.prototype.hasOwnProperty.call(statusMap, r._id)) statusMap[r._id] = r.count;
  }
  const typeMap = {};
  for (const t of LEAVE_TYPES) typeMap[t] = 0;
  for (const r of byLeaveType) {
    if (Object.prototype.hasOwnProperty.call(typeMap, r._id)) typeMap[r._id] = r.count;
  }

  return {
    range: {
      startDate: startDate || null,
      endDate: endDate || null,
      filterBy: dateField,
    },
    total: totals[0]?.total || 0,
    byStatus: statusMap,
    byLeaveType: typeMap,
  };
}

// ===== Payroll summary (dashboard + report) =====

async function buildPayrollSummary(filter) {
  // Nếu không có period cụ thể, dùng kỳ hiện tại (tháng trước).
  let { periodMonth, periodYear } = filter;
  if (periodMonth == null || periodYear == null) {
    const def = defaultPayrollPeriod();
    periodMonth = def.periodMonth;
    periodYear = def.periodYear;
  }

  const match = { periodMonth, periodYear };

  const [totals, byStatus] = await Promise.all([
    Payroll.aggregate([
      { $match: match },
      {
        $group: {
          _id: null,
          count: { $sum: 1 },
          totalBase: { $sum: '$baseSalary' },
          totalAllowances: { $sum: '$allowances' },
          totalBonuses: { $sum: '$bonuses' },
          totalDeductions: { $sum: '$deductions' },
          totalGross: { $sum: '$grossSalary' },
          totalNet: { $sum: '$netSalary' },
          totalNetApproved: {
            $sum: {
              $cond: [{ $eq: ['$status', 'approved'] }, '$netSalary', 0],
            },
          },
          totalNetPaid: {
            $sum: {
              $cond: [{ $eq: ['$status', 'paid'] }, '$netSalary', 0],
            },
          },
        },
      },
    ]),
    Payroll.aggregate([
      { $match: match },
      { $group: { _id: '$status', count: { $sum: 1 } } },
    ]),
  ]);

  const t = totals[0] || {
    count: 0,
    totalBase: 0,
    totalAllowances: 0,
    totalBonuses: 0,
    totalDeductions: 0,
    totalGross: 0,
    totalNet: 0,
    totalNetApproved: 0,
    totalNetPaid: 0,
  };

  const statusMap = {};
  for (const s of PAYROLL_STATUSES) statusMap[s] = 0;
  for (const r of byStatus) {
    if (Object.prototype.hasOwnProperty.call(statusMap, r._id)) statusMap[r._id] = r.count;
  }

  return {
    period: { periodMonth, periodYear },
    count: t.count,
    byStatus: statusMap,
    totalBase: round2(t.totalBase),
    totalAllowances: round2(t.totalAllowances),
    totalBonuses: round2(t.totalBonuses),
    totalDeductions: round2(t.totalDeductions),
    totalGross: round2(t.totalGross),
    totalNet: round2(t.totalNet),
    totalNetApproved: round2(t.totalNetApproved),
    totalNetPaid: round2(t.totalNetPaid),
  };
}

export async function getPayrollSummary(filter) {
  return buildPayrollSummary(filter);
}

// ===== Reports: employees =====

export async function getEmployeesReport() {
  const [byStatus, byDepartment, byPosition, byEmploymentType, hireYearAgg, totals] =
    await Promise.all([
      Employee.aggregate([
        { $match: { isDeleted: { $ne: true } } },
        { $group: { _id: '$employmentStatus', count: { $sum: 1 } } },
      ]),
      Employee.aggregate([
        { $match: { isDeleted: { $ne: true } } },
        {
          $group: {
            _id: '$departmentId',
            count: { $sum: 1 },
          },
        },
        {
          $lookup: {
            from: 'departments',
            localField: '_id',
            foreignField: '_id',
            as: 'department',
          },
        },
        {
          $project: {
            _id: 0,
            departmentId: '$_id',
            name: { $ifNull: [{ $arrayElemAt: ['$department.name', 0] }, null] },
            count: 1,
          },
        },
        { $sort: { count: -1 } },
      ]),
      Employee.aggregate([
        { $match: { isDeleted: { $ne: true } } },
        {
          $group: {
            _id: '$positionId',
            count: { $sum: 1 },
          },
        },
        {
          $lookup: {
            from: 'positions',
            localField: '_id',
            foreignField: '_id',
            as: 'position',
          },
        },
        {
          $project: {
            _id: 0,
            positionId: '$_id',
            name: { $ifNull: [{ $arrayElemAt: ['$position.name', 0] }, null] },
            count: 1,
          },
        },
        { $sort: { count: -1 } },
      ]),
      Employee.aggregate([
        { $match: { isDeleted: { $ne: true } } },
        { $group: { _id: '$employmentType', count: { $sum: 1 } } },
      ]),
      Employee.aggregate([
        { $match: { isDeleted: { $ne: true } } },
        {
          $group: {
            _id: { $year: '$hireDate' },
            count: { $sum: 1 },
          },
        },
        { $sort: { _id: 1 } },
      ]),
      Employee.aggregate([
        { $match: { isDeleted: { $ne: true } } },
        { $count: 'total' },
      ]),
    ]);

  const statusMap = {};
  for (const r of byStatus) statusMap[r._id ?? 'unknown'] = r.count;
  const typeMap = {};
  for (const r of byEmploymentType) typeMap[r._id ?? 'unknown'] = r.count;
  const hireByYear = hireYearAgg.map((r) => ({ year: r._id, count: r.count }));

  return {
    total: totals[0]?.total || 0,
    byEmploymentStatus: statusMap,
    byDepartment,
    byPosition,
    byEmploymentType: typeMap,
    byHireYear: hireByYear,
  };
}

// ===== Reports: attendance =====

export async function getAttendanceReport({ startDate, endDate }) {
  const match = {};
  if (startDate || endDate) {
    match.workDate = {};
    if (startDate) match.workDate.$gte = startDate;
    if (endDate) {
      const endExclusive = new Date(endDate.getTime() + 24 * 60 * 60 * 1000);
      match.workDate.$lt = endExclusive;
    }
  }

  const [totals, byStatus, byEmployee, byDept] = await Promise.all([
    Attendance.aggregate([{ $match: match }, { $count: 'total' }]),
    Attendance.aggregate([
      { $match: match },
      { $group: { _id: '$status', count: { $sum: 1 } } },
    ]),
    Attendance.aggregate([
      { $match: match },
      {
        $group: {
          _id: '$employeeId',
          count: { $sum: 1 },
        },
      },
      { $sort: { count: -1 } },
      { $limit: 50 },
      {
        $lookup: {
          from: 'employees',
          localField: '_id',
          foreignField: '_id',
          as: 'employee',
        },
      },
      {
        $project: {
          _id: 0,
          employeeId: '$_id',
          fullName: { $ifNull: [{ $arrayElemAt: ['$employee.fullName', 0] }, null] },
          employeeCode: {
            $ifNull: [{ $arrayElemAt: ['$employee.employeeCode', 0] }, null],
          },
          count: 1,
        },
      },
    ]),
    Attendance.aggregate([
      { $match: match },
      {
        $lookup: {
          from: 'employees',
          localField: 'employeeId',
          foreignField: '_id',
          as: 'employee',
        },
      },
      { $unwind: { path: '$employee', preserveNullAndEmptyArrays: true } },
      {
        $group: {
          _id: '$employee.departmentId',
          count: { $sum: 1 },
        },
      },
      {
        $lookup: {
          from: 'departments',
          localField: '_id',
          foreignField: '_id',
          as: 'department',
        },
      },
      {
        $project: {
          _id: 0,
          departmentId: '$_id',
          name: { $ifNull: [{ $arrayElemAt: ['$department.name', 0] }, null] },
          count: 1,
        },
      },
      { $sort: { count: -1 } },
    ]),
  ]);

  const statusMap = {};
  for (const s of ATTENDANCE_STATUSES) statusMap[s] = 0;
  for (const r of byStatus) {
    if (Object.prototype.hasOwnProperty.call(statusMap, r._id)) statusMap[r._id] = r.count;
  }

  return {
    range: {
      startDate: startDate || null,
      endDate: endDate || null,
    },
    total: totals[0]?.total || 0,
    byStatus: statusMap,
    byEmployee,
    byDepartment: byDept,
  };
}

// ===== Reports: leave-requests =====

export async function getLeaveRequestsReport({ startDate, endDate }) {
  // Default: filter theo startDate. Tài liệu mô tả rõ.
  const dateField = 'startDate';
  const match = {};
  if (startDate || endDate) {
    match[dateField] = {};
    if (startDate) match[dateField].$gte = startDate;
    if (endDate) {
      const endExclusive = new Date(endDate.getTime() + 24 * 60 * 60 * 1000);
      match[dateField].$lt = endExclusive;
    }
  }

  const [totals, byStatus, byType, byEmployee, byDept] = await Promise.all([
    LeaveRequest.aggregate([{ $match: match }, { $count: 'total' }]),
    LeaveRequest.aggregate([
      { $match: match },
      { $group: { _id: '$status', count: { $sum: 1 } } },
    ]),
    LeaveRequest.aggregate([
      { $match: match },
      { $group: { _id: '$leaveType', count: { $sum: 1 } } },
    ]),
    LeaveRequest.aggregate([
      { $match: match },
      {
        $group: {
          _id: '$employeeId',
          count: { $sum: 1 },
        },
      },
      { $sort: { count: -1 } },
      { $limit: 50 },
      {
        $lookup: {
          from: 'employees',
          localField: '_id',
          foreignField: '_id',
          as: 'employee',
        },
      },
      {
        $project: {
          _id: 0,
          employeeId: '$_id',
          fullName: { $ifNull: [{ $arrayElemAt: ['$employee.fullName', 0] }, null] },
          employeeCode: {
            $ifNull: [{ $arrayElemAt: ['$employee.employeeCode', 0] }, null],
          },
          count: 1,
        },
      },
    ]),
    LeaveRequest.aggregate([
      { $match: match },
      {
        $lookup: {
          from: 'employees',
          localField: 'employeeId',
          foreignField: '_id',
          as: 'employee',
        },
      },
      { $unwind: { path: '$employee', preserveNullAndEmptyArrays: true } },
      {
        $group: {
          _id: '$employee.departmentId',
          count: { $sum: 1 },
        },
      },
      {
        $lookup: {
          from: 'departments',
          localField: '_id',
          foreignField: '_id',
          as: 'department',
        },
      },
      {
        $project: {
          _id: 0,
          departmentId: '$_id',
          name: { $ifNull: [{ $arrayElemAt: ['$department.name', 0] }, null] },
          count: 1,
        },
      },
      { $sort: { count: -1 } },
    ]),
  ]);

  const statusMap = {};
  for (const s of LEAVE_STATUSES) statusMap[s] = 0;
  for (const r of byStatus) {
    if (Object.prototype.hasOwnProperty.call(statusMap, r._id)) statusMap[r._id] = r.count;
  }
  const typeMap = {};
  for (const t of LEAVE_TYPES) typeMap[t] = 0;
  for (const r of byType) {
    if (Object.prototype.hasOwnProperty.call(typeMap, r._id)) typeMap[r._id] = r.count;
  }

  return {
    range: {
      startDate: startDate || null,
      endDate: endDate || null,
      filterBy: dateField,
    },
    total: totals[0]?.total || 0,
    byStatus: statusMap,
    byLeaveType: typeMap,
    byEmployee,
    byDepartment: byDept,
  };
}

// ===== Reports: payroll =====

export async function getPayrollReport(filter) {
  // Tận dụng cùng helper với dashboard summary; chỉ bổ sung per-status
  // totals để dễ trực quan hoá.
  const summary = await buildPayrollSummary(filter);
  return summary;
}
