// Payroll service — business logic for the Payroll Management API.
//
// Quy ước lỗi: các hàm trả về `{ error: { status, code, message, field? } }`
// khi thất bại, hoặc `{ data, meta? }` khi thành công.
//
// Quyết định nghiệp vụ (Phase 8):
// - `grossSalary = baseSalary + allowances + bonuses`
// - `netSalary   = grossSalary - deductions`
// - Làm tròn 2 chữ số thập phân (Math.round(x*100)/100).
// - State machine: `draft → approved → paid`, `cancelled` từ draft/approved.
//   Sau khi `approved` hoặc `paid` KHÔNG thể chỉnh sửa các trường tiền.
// - `approve` & `mark-paid` ghi `approvedBy/At`, `paidBy/At` từ `req.user._id`.
// - Approval / mark-paid chỉ bởi Admin (controller handles).
// - Unique (employeeId, periodMonth, periodYear): E11000 → 409 DUPLICATE_PAYROLL.
// - Ownership: Employee chỉ xem payroll của linked Employee. Cross-user → 404.
// - KHÔNG tự tính workedDays / standardWorkDays từ Attendance / LeaveRequest:
//   Phase 8 chưa có policy. Admin nhập tay thông qua POST / PATCH (khi draft).
// - KHÔNG có DELETE.

import mongoose from 'mongoose';
import { Payroll, Employee } from '../models/index.js';

const { Types } = mongoose;

const NOT_FOUND = {
  error: {
    status: 404,
    code: 'PAYROLL_NOT_FOUND',
    message: 'Payroll record not found',
  },
};

const BAD_REQUEST = (code, message, field) => ({
  error: { status: 400, code, message, ...(field ? { field } : {}) },
});

const CONFLICT = (code, message, field) => ({
  error: {
    status: 409,
    code,
    message,
    ...(field ? { field } : {}),
  },
});

// Làm tròn 2 chữ số thập phân.
function round2(n) {
  if (!Number.isFinite(n)) return n;
  return Math.round(n * 100) / 100;
}

function buildSort(sortStr) {
  const descending = sortStr.startsWith('-');
  const field = descending ? sortStr.slice(1) : sortStr.replace(/^\+/, '');
  return { [field]: descending ? -1 : 1 };
}

function buildListFilter({ filters }) {
  const and = [];
  if (filters.employeeId) and.push({ employeeId: filters.employeeId });
  if (filters.status) and.push({ status: filters.status });
  if (filters.periodMonth) and.push({ periodMonth: filters.periodMonth });
  if (filters.periodYear) and.push({ periodYear: filters.periodYear });
  if (and.length === 0) return {};
  if (and.length === 1) return and[0];
  return { $and: and };
}

function serializeLean(doc) {
  if (!doc) return doc;
  const { __v, ...rest } = doc;
  return rest;
}

/**
 * Trả về Employee ACTIVE liên kết với `userId`, hoặc null.
 */
export async function findLinkedEmployeeForUser(userId) {
  if (!userId) return null;
  return Employee.findOne({ userId, isDeleted: { $ne: true } })
    .select('_id isDeleted')
    .lean();
}

/**
 * Verify Employee tồn tại và chưa soft-delete.
 */
async function assertEmployeeActive(employeeId) {
  if (!employeeId) {
    return {
      error: {
        status: 400,
        code: 'VALIDATION_ERROR',
        field: 'employeeId',
        message: 'employeeId is required',
      },
    };
  }
  if (!Types.ObjectId.isValid(employeeId)) {
    return {
      error: {
        status: 400,
        code: 'VALIDATION_ERROR',
        field: 'employeeId',
        message: 'employeeId is not a valid ObjectId',
      },
    };
  }
  const e = await Employee.findById(employeeId).select('_id isDeleted').lean();
  if (!e) {
    return {
      error: {
        status: 400,
        code: 'VALIDATION_ERROR',
        field: 'employeeId',
        message: 'employeeId does not reference an existing Employee',
      },
    };
  }
  if (e.isDeleted) {
    return {
      error: {
        status: 400,
        code: 'VALIDATION_ERROR',
        field: 'employeeId',
        message: 'employeeId references a soft-deleted Employee',
      },
    };
  }
  return null;
}

function translateDuplicateKey(err) {
  return {
    error: {
      status: 409,
      code: 'DUPLICATE_PAYROLL',
      message:
        'A payroll record already exists for this employee and period (periodMonth, periodYear)',
      field: 'employeeId',
    },
  };
}

// ===== List =====

export async function listPayrolls(query) {
  const { page, limit, filters, sort } = query;
  const filter = buildListFilter({ filters });
  const sortObj = buildSort(sort);
  const skip = (page - 1) * limit;

  const [total, docs] = await Promise.all([
    Payroll.countDocuments(filter),
    Payroll.find(filter).sort(sortObj).skip(skip).limit(limit).lean({ virtuals: true }),
  ]);

  return {
    data: docs.map(serializeLean),
    pagination: {
      page,
      limit,
      total,
      totalPages: total === 0 ? 0 : Math.ceil(total / limit),
    },
  };
}

export async function listPayrollsForEmployee(employeeId, query) {
  const { page, limit, filters, sort } = query;
  const merged = buildListFilter({
    filters: { ...filters, employeeId: employeeId.toString() },
  });
  const sortObj = buildSort(sort);
  const skip = (page - 1) * limit;

  const [total, docs] = await Promise.all([
    Payroll.countDocuments(merged),
    Payroll.find(merged).sort(sortObj).skip(skip).limit(limit).lean({ virtuals: true }),
  ]);

  return {
    data: docs.map(serializeLean),
    pagination: {
      page,
      limit,
      total,
      totalPages: total === 0 ? 0 : Math.ceil(total / limit),
    },
  };
}

// ===== Read =====

export async function getPayrollById(id, actor) {
  if (!Types.ObjectId.isValid(id)) {
    return BAD_REQUEST('VALIDATION_ERROR', 'Invalid id: must be a valid ObjectId', 'id');
  }
  const doc = await Payroll.findById(id).lean({ virtuals: true });
  if (!doc) return { ...NOT_FOUND };
  if (actor && actor.role !== 'admin') {
    const linked = await findLinkedEmployeeForUser(actor._id);
    if (!linked || linked._id.toString() !== doc.employeeId.toString()) {
      return { ...NOT_FOUND }; // chống lộ
    }
  }
  return { data: serializeLean(doc) };
}

// ===== Create =====

export async function createPayroll(payload, actor) {
  const empCheck = await assertEmployeeActive(payload.employeeId);
  if (empCheck) return empCheck;

  const grossSalary = round2(payload.baseSalary + payload.allowances + payload.bonuses);
  const netSalary = round2(grossSalary - payload.deductions);

  if (!Number.isFinite(grossSalary) || grossSalary < 0) {
    return {
      error: {
        status: 400,
        code: 'VALIDATION_ERROR',
        field: 'baseSalary',
        message: 'Computed grossSalary is invalid',
      },
    };
  }
  if (!Number.isFinite(netSalary) || netSalary < 0) {
    return {
      error: {
        status: 400,
        code: 'VALIDATION_ERROR',
        field: 'deductions',
        message: 'Computed netSalary is invalid (deductions exceed grossSalary)',
      },
    };
  }

  let doc;
  try {
    doc = await Payroll.create({
      employeeId: payload.employeeId,
      periodMonth: payload.periodMonth,
      periodYear: payload.periodYear,
      baseSalary: payload.baseSalary,
      allowances: payload.allowances,
      bonuses: payload.bonuses,
      deductions: payload.deductions,
      grossSalary,
      netSalary,
      workedDays: payload.workedDays ?? null,
      standardWorkDays: payload.standardWorkDays ?? null,
      note: payload.note ?? '',
      status: 'draft',
      createdBy: actor && actor._id ? actor._id : null,
      updatedBy: actor && actor._id ? actor._id : null,
    });
  } catch (err) {
    if (err && err.code === 11000) return translateDuplicateKey(err);
    if (err && err.name === 'ValidationError') {
      return {
        error: {
          status: 400,
          code: 'VALIDATION_ERROR',
          message: err.message,
        },
      };
    }
    throw err;
  }

  return { data: doc.toJSON() };
}

// ===== Update =====

export async function updatePayroll(id, payload, actor) {
  if (!Types.ObjectId.isValid(id)) {
    return BAD_REQUEST('VALIDATION_ERROR', 'Invalid id: must be a valid ObjectId', 'id');
  }
  const existing = await Payroll.findById(id);
  if (!existing) return { ...NOT_FOUND };

  // Ownership: employee chỉ sửa được của mình.
  if (actor && actor.role !== 'admin') {
    const linked = await findLinkedEmployeeForUser(actor._id);
    if (!linked || linked._id.toString() !== existing.employeeId.toString()) {
      return { ...NOT_FOUND };
    }
  }

  if (existing.status !== 'draft') {
    return {
      error: {
        status: 409,
        code: 'INVALID_STATE',
        message: `Cannot update a payroll record in status "${existing.status}"`,
        field: 'status',
      },
    };
  }

  // Apply allowed fields.
  for (const [k, v] of Object.entries(payload)) {
    existing[k] = v;
  }

  // Recompute gross/net.
  const grossSalary = round2(
    Number(existing.baseSalary) +
      Number(existing.allowances ?? 0) +
      Number(existing.bonuses ?? 0),
  );
  const netSalary = round2(grossSalary - Number(existing.deductions ?? 0));

  if (!Number.isFinite(grossSalary) || grossSalary < 0) {
    return {
      error: {
        status: 400,
        code: 'VALIDATION_ERROR',
        field: 'baseSalary',
        message: 'Computed grossSalary is invalid',
      },
    };
  }
  if (!Number.isFinite(netSalary) || netSalary < 0) {
    return {
      error: {
        status: 400,
        code: 'VALIDATION_ERROR',
        field: 'deductions',
        message: 'Computed netSalary is invalid (deductions exceed grossSalary)',
      },
    };
  }

  existing.grossSalary = grossSalary;
  existing.netSalary = netSalary;
  if (actor && actor._id) existing.updatedBy = actor._id;

  try {
    const saved = await existing.save();
    return { data: saved.toJSON() };
  } catch (err) {
    if (err && err.code === 11000) return translateDuplicateKey(err);
    if (err && err.name === 'ValidationError') {
      return {
        error: {
          status: 400,
          code: 'VALIDATION_ERROR',
          message: err.message,
        },
      };
    }
    throw err;
  }
}

// ===== State transitions =====

export async function approvePayroll(id, actor) {
  if (!Types.ObjectId.isValid(id)) {
    return BAD_REQUEST('VALIDATION_ERROR', 'Invalid id: must be a valid ObjectId', 'id');
  }
  const existing = await Payroll.findById(id);
  if (!existing) return { ...NOT_FOUND };

  if (existing.status === 'approved') {
    // Idempotent: trả về bản ghi hiện tại + meta.
    return { data: existing.toJSON(), meta: { alreadyApproved: true } };
  }
  if (existing.status !== 'draft') {
    return CONFLICT(
      'INVALID_STATE',
      `Cannot approve a payroll record in status "${existing.status}"`,
    );
  }

  // Kiểm tra Employee vẫn active trước khi approve.
  const emp = await Employee.findById(existing.employeeId)
    .select('_id isDeleted')
    .lean();
  if (!emp) {
    return {
      error: {
        status: 409,
        code: 'EMPLOYEE_NOT_FOUND',
        message: 'Employee no longer exists',
      },
    };
  }
  if (emp.isDeleted) {
    return {
      error: {
        status: 409,
        code: 'EMPLOYEE_DELETED',
        message: 'Cannot approve payroll for a soft-deleted Employee',
      },
    };
  }

  existing.status = 'approved';
  existing.approvedBy = actor && actor._id ? actor._id : null;
  existing.approvedAt = new Date();
  if (actor && actor._id) existing.updatedBy = actor._id;

  const saved = await existing.save();
  return { data: saved.toJSON() };
}

export async function markPaidPayroll(id, actor) {
  if (!Types.ObjectId.isValid(id)) {
    return BAD_REQUEST('VALIDATION_ERROR', 'Invalid id: must be a valid ObjectId', 'id');
  }
  const existing = await Payroll.findById(id);
  if (!existing) return { ...NOT_FOUND };

  if (existing.status === 'paid') {
    return { data: existing.toJSON(), meta: { alreadyPaid: true } };
  }
  if (existing.status !== 'approved') {
    return CONFLICT(
      'INVALID_STATE',
      `Cannot mark-paid a payroll record in status "${existing.status}"`,
    );
  }

  existing.status = 'paid';
  existing.paidBy = actor && actor._id ? actor._id : null;
  existing.paidAt = new Date();
  if (actor && actor._id) existing.updatedBy = actor._id;

  const saved = await existing.save();
  return { data: saved.toJSON() };
}

export async function cancelPayroll(id, actor) {
  if (!Types.ObjectId.isValid(id)) {
    return BAD_REQUEST('VALIDATION_ERROR', 'Invalid id: must be a valid ObjectId', 'id');
  }
  const existing = await Payroll.findById(id);
  if (!existing) return { ...NOT_FOUND };

  if (existing.status === 'cancelled') {
    return { data: existing.toJSON(), meta: { alreadyCancelled: true } };
  }
  if (existing.status === 'paid') {
    return CONFLICT(
      'INVALID_STATE',
      'Cannot cancel a payroll record in status "paid"',
    );
  }
  if (existing.status !== 'draft' && existing.status !== 'approved') {
    return CONFLICT(
      'INVALID_STATE',
      `Cannot cancel a payroll record in status "${existing.status}"`,
    );
  }

  existing.status = 'cancelled';
  if (actor && actor._id) existing.updatedBy = actor._id;

  const saved = await existing.save();
  return { data: saved.toJSON() };
}
