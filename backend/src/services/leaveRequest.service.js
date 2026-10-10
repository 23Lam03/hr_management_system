// Leave request service — business logic cho Leave Management API.
//
// Quy ước lỗi: các hàm trả về `{ error: { status, code, message, field? } }`
// khi thất bại, hoặc `{ data, ... }` khi thành công. Controller chuyển
// error thành HTTP response.
//
// Quyết định nghiệp vụ đã chốt:
// - Overlap check: hai khoảng ngày [A_start, A_end] và [B_start, B_end]
//   giao nhau nếu A_start <= B_end && A_end >= B_start. Áp dụng cho các
//   đơn cùng Employee có status `pending` hoặc `approved`. `rejected` và
//   `cancelled` KHÔNG chặn.
// - Khi sửa hoặc duyệt, exclude chính đơn đang xét (`excludeId`).
// - Khi cập nhật, nếu `startDate` / `endDate` không được gửi, giữ nguyên
//   giá trị hiện tại để kiểm tra overlap.
// - Ownership: Employee chỉ thao tác trên đơn của Employee liên kết với
//   `req.user._id` thông qua `Employee.userId`. Sai lệch → 404 (chống lộ).
// - Admin tạo thay nhân viên được phép (chỉ khi `adminCreate=true` từ controller).
//   Khi đó vẫn qua overlap check và employee-active check.

import mongoose from 'mongoose';
import { LeaveRequest, Employee } from '../models/index.js';

const { Types } = mongoose;

const NOT_FOUND = {
  error: { status: 404, code: 'LEAVE_REQUEST_NOT_FOUND', message: 'Leave request not found' },
};

const BAD_REQUEST = (code, message, field) => ({
  error: { status: 400, code, message, ...(field ? { field } : {}) },
});

const CONFLICT = (code, message) => ({
  error: { status: 409, code, message },
});

const BLOCKING_STATUSES = ['pending', 'approved'];

function buildSort(sortStr) {
  const descending = sortStr.startsWith('-');
  const field = descending ? sortStr.slice(1) : sortStr.replace(/^\+/, '');
  return { [field]: descending ? -1 : 1 };
}

function buildListFilter(filters) {
  const and = [];

  if (filters.employeeId) {
    and.push({ employeeId: filters.employeeId });
  }
  if (filters.status) {
    and.push({ status: filters.status });
  }
  if (filters.leaveType) {
    and.push({ leaveType: filters.leaveType });
  }

  // Date range filter: lọc các đơn mà KHUNG NGHỈ của đơn giao nhau
  // với khoảng [filters.startDate, filters.endDate].
  //
  // Hai khoảng [D_start, D_end] và [F_start, F_end] giao nhau khi
  //   D_start <= F_end  AND  D_end >= F_start.
  //
  // Áp dụng vào query:
  //   - nếu user gửi filters.startDate: thêm `endDate >= filters.startDate`.
  //   - nếu user gửi filters.endDate:   thêm `startDate <= filters.endDate`.
  // Hai điều kiện là OR trên cùng field? Không — chúng là AND. Khi user
  // gửi cả hai, ta đẩy cả hai điều kiện vào `and`, buildListFilter sẽ
  // tự gộp thành `{ $and: [...] }` ở cuối.
  //
  // Đây chính là cùng công thức overlap được dùng trong
  // findOverlappingLeaveRequest, đảm bảo "đơn đang nghỉ vào ngày
  // filters.startDate..filters.endDate" được bao gồm. Cùng ngày biên
  // cũng được tính là giao nhau.
  if (filters.startDate) {
    and.push({ endDate: { $gte: filters.startDate } });
  }
  if (filters.endDate) {
    and.push({ startDate: { $lte: filters.endDate } });
  }

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
 * Trả về Employee ACTIVE liên kết với `userId`, hoặc null nếu:
 *   - chưa có Employee liên kết,
 *   - hoặc Employee đã bị soft-delete.
 *
 * Mọi endpoint phụ thuộc ownership (POST, /me, PATCH, cancel, GET /:id)
 * phải dùng helper này để đảm bảo user thuộc về một Employee còn
 * "sống" theo quy ước của dự án.
 */
export async function findLinkedEmployeeForUser(userId) {
  if (!userId) return null;
  return Employee.findOne({ userId, isDeleted: { $ne: true } })
    .select('_id isDeleted')
    .lean();
}

/**
 * Đảm bảo Employee tồn tại và chưa soft-delete.
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

/**
 * Overlap check giữa khoảng [startDate, endDate] và các đơn đang blocking
 * của cùng Employee. excludeId dùng khi cập nhật để loại trừ chính nó.
 *
 * Blocking statuses: pending, approved.
 */
export async function findOverlappingLeaveRequest(
  employeeId,
  startDate,
  endDate,
  excludeId = null,
) {
  const filter = {
    employeeId,
    status: { $in: BLOCKING_STATUSES },
  };
  // Khoảng [A_start, A_end] và [B_start, B_end] overlap khi
  // A_start <= B_end && A_end >= B_start.
  // A là khoảng đang xét, B là khoảng trong DB.
  // Lọc các đơn B: B_start <= endDate && B_end >= startDate.
  filter.startDate = { $lte: endDate };
  filter.endDate = { $gte: startDate };

  if (excludeId) {
    if (!Types.ObjectId.isValid(excludeId)) {
      return {
        error: {
          status: 400,
          code: 'VALIDATION_ERROR',
          field: 'id',
          message: 'excludeId is not a valid ObjectId',
        },
      };
    }
    filter._id = { $ne: excludeId };
  }

  const doc = await LeaveRequest.findOne(filter).select('_id startDate endDate status').lean();
  if (!doc) return { data: null };
  return { data: serializeLean(doc) };
}

/**
 * Tạo đơn nghỉ phép. `actor` là req.user.
 * - Nếu actor là employee: phải có linked Employee; `employeeId` bị bỏ qua
 *   và tự lấy từ linked Employee.
 * - Nếu actor là admin: phải cung cấp `employeeId` (adminCreate=true).
 */
export async function createLeaveRequest(payload, actor) {
  let employeeId = payload.employeeId;

  if (actor.role === 'employee') {
    const linked = await findLinkedEmployeeForUser(actor._id);
    if (!linked) {
      return {
        error: {
          status: 404,
          code: 'EMPLOYEE_NOT_FOUND',
          message: 'No employee profile is linked to the current user',
        },
      };
    }
    employeeId = linked._id.toString();
  } else if (actor.role === 'admin') {
    // Admin phải cung cấp employeeId.
    if (!employeeId) {
      return {
        error: {
          status: 400,
          code: 'VALIDATION_ERROR',
          field: 'employeeId',
          message: 'employeeId is required when admin creates a request on behalf of an employee',
        },
      };
    }
  }

  const empCheck = await assertEmployeeActive(employeeId);
  if (empCheck) return empCheck;

  // Overlap check.
  const overlap = await findOverlappingLeaveRequest(
    employeeId,
    payload.startDate,
    payload.endDate,
    null,
  );
  if (overlap.error) return overlap;
  if (overlap.data) {
    return {
      error: {
        status: 409,
        code: 'LEAVE_OVERLAP',
        message:
          'Employee already has a pending or approved leave request that overlaps with this date range',
        field: 'startDate',
      },
    };
  }

  let doc;
  try {
    doc = await LeaveRequest.create({
      employeeId,
      leaveType: payload.leaveType,
      startDate: payload.startDate,
      endDate: payload.endDate,
      reason: payload.reason,
      status: 'pending',
    });
  } catch (err) {
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

/**
 * Cập nhật đơn. Chỉ cho phép cập nhật các trường nghiệp vụ (leaveType,
 * startDate, endDate, reason). Validator đã chặn client gửi trường hệ
 * thống; service chỉ kiểm tra trạng thái cho phép.
 */
export async function updateLeaveRequest(id, payload, actor) {
  if (!Types.ObjectId.isValid(id)) {
    return BAD_REQUEST('VALIDATION_ERROR', 'Invalid id: must be a valid ObjectId', 'id');
  }
  const existing = await LeaveRequest.findById(id);
  if (!existing) {
    return { ...NOT_FOUND };
  }

  // Ownership: nếu actor là employee, đơn phải thuộc về linked Employee.
  if (actor.role !== 'admin') {
    const linked = await findLinkedEmployeeForUser(actor._id);
    if (!linked || linked._id.toString() !== existing.employeeId.toString()) {
      return { ...NOT_FOUND };
    }

    // Chỉ `pending` mới sửa được.
    if (existing.status !== 'pending') {
      return {
        error: {
          status: 409,
          code: 'INVALID_STATE',
          message: `Cannot update a leave request in status "${existing.status}"`,
        },
      };
    }
  } else {
    // Admin không sửa qua PATCH (đề bài tách approve/reject).
    // Từ chối PATCH từ admin để rõ ràng: admin dùng approve/reject.
    return {
      error: {
        status: 403,
        code: 'FORBIDDEN',
        message:
          'Admin should use POST /api/leave-requests to create and PATCH /:id/approve or /:id/reject to review requests, not PATCH /:id',
      },
    };
  }

  // Xác định khoảng ngày cuối cùng sau khi merge.
  const newStart = payload.startDate ?? existing.startDate;
  const newEnd = payload.endDate ?? existing.endDate;

  if (newStart.getTime() > newEnd.getTime()) {
    return {
      error: {
        status: 400,
        code: 'VALIDATION_ERROR',
        field: 'endDate',
        message: 'endDate must be greater than or equal to startDate',
      },
    };
  }

  // Overlap check: loại trừ chính nó.
  const overlap = await findOverlappingLeaveRequest(
    existing.employeeId,
    newStart,
    newEnd,
    existing._id,
  );
  if (overlap.error) return overlap;
  if (overlap.data) {
    return {
      error: {
        status: 409,
        code: 'LEAVE_OVERLAP',
        message:
          'Employee already has a pending or approved leave request that overlaps with this date range',
        field: 'startDate',
      },
    };
  }

  for (const [k, v] of Object.entries(payload)) {
    existing[k] = v;
  }

  try {
    const saved = await existing.save();
    return { data: saved.toJSON() };
  } catch (err) {
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

/**
 * Hủy đơn của chính Employee. Chỉ cho phép khi status = 'pending'.
 * Idempotent: nếu đã `cancelled` thì trả về bản ghi + meta (không lỗi).
 */
export async function cancelLeaveRequest(id, actor) {
  if (!Types.ObjectId.isValid(id)) {
    return BAD_REQUEST('VALIDATION_ERROR', 'Invalid id: must be a valid ObjectId', 'id');
  }
  const existing = await LeaveRequest.findById(id);
  if (!existing) {
    return { ...NOT_FOUND };
  }

  if (actor.role !== 'admin') {
    const linked = await findLinkedEmployeeForUser(actor._id);
    if (!linked || linked._id.toString() !== existing.employeeId.toString()) {
      return { ...NOT_FOUND };
    }
  } else {
    // Admin không cần hủy đơn của Employee; admin dùng reject.
    return {
      error: {
        status: 403,
        code: 'FORBIDDEN',
        message: 'Admin should use PATCH /:id/reject instead of cancel',
      },
    };
  }

  if (existing.status === 'cancelled') {
    return { data: existing.toJSON(), meta: { alreadyCancelled: true } };
  }
  if (existing.status === 'approved' || existing.status === 'rejected') {
    return {
      error: {
        status: 409,
        code: 'INVALID_STATE',
        message: `Cannot cancel a leave request in status "${existing.status}"`,
      },
    };
  }

  existing.status = 'cancelled';
  const saved = await existing.save();
  return { data: saved.toJSON(), meta: { alreadyCancelled: false } };
}

/**
 * Lấy chi tiết đơn. Admin: mọi đơn. Employee: chỉ đơn của linked Employee.
 * Sai lệch → 404 (chống lộ).
 */
export async function getLeaveRequestById(id, actor) {
  if (!Types.ObjectId.isValid(id)) {
    return BAD_REQUEST('VALIDATION_ERROR', 'Invalid id: must be a valid ObjectId', 'id');
  }
  const doc = await LeaveRequest.findById(id).lean({ virtuals: true });
  if (!doc) {
    return { ...NOT_FOUND };
  }
  if (actor && actor.role !== 'admin') {
    const linked = await findLinkedEmployeeForUser(actor._id);
    if (!linked || linked._id.toString() !== doc.employeeId.toString()) {
      return { ...NOT_FOUND };
    }
  }
  return { data: serializeLean(doc) };
}

/**
 * List phân trang cho Admin.
 */
export async function listLeaveRequests(query) {
  const { page, limit, filters, sort } = query;
  const filter = buildListFilter(filters);
  const sortObj = buildSort(sort);
  const skip = (page - 1) * limit;

  const [total, docs] = await Promise.all([
    LeaveRequest.countDocuments(filter),
    LeaveRequest.find(filter).sort(sortObj).skip(skip).limit(limit).lean({ virtuals: true }),
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

/**
 * List phân trang cho Employee (chỉ đơn của linked Employee).
 */
export async function listLeaveRequestsForEmployee(employeeId, query) {
  const { page, limit, filters, sort } = query;
  const filter = buildListFilter({ ...filters, employeeId: employeeId.toString() });
  const sortObj = buildSort(sort);
  const skip = (page - 1) * limit;

  const [total, docs] = await Promise.all([
    LeaveRequest.countDocuments(filter),
    LeaveRequest.find(filter).sort(sortObj).skip(skip).limit(limit).lean({ virtuals: true }),
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

/**
 * Approve đơn. Admin only (controller handles). Chỉ khi `pending`.
 * Re-check overlap trước khi approve, để tránh hai đơn pending cùng
 * thời gian được duyệt thành công tuần tự.
 */
export async function approveLeaveRequest(id, payload, actor) {
  if (!Types.ObjectId.isValid(id)) {
    return BAD_REQUEST('VALIDATION_ERROR', 'Invalid id: must be a valid ObjectId', 'id');
  }
  const existing = await LeaveRequest.findById(id);
  if (!existing) {
    return { ...NOT_FOUND };
  }

  if (existing.status !== 'pending') {
    return {
      error: {
        status: 409,
        code: 'INVALID_STATE',
        message: `Cannot approve a leave request in status "${existing.status}"`,
      },
    };
  }

  // Overlap re-check (loại trừ chính nó).
  const overlap = await findOverlappingLeaveRequest(
    existing.employeeId,
    existing.startDate,
    existing.endDate,
    existing._id,
  );
  if (overlap.error) return overlap;
  if (overlap.data) {
    return {
      error: {
        status: 409,
        code: 'LEAVE_OVERLAP',
        message:
          'Cannot approve: another pending or approved leave request overlaps with this date range',
      },
    };
  }

  existing.status = 'approved';
  existing.reviewedBy = actor._id;
  existing.reviewedAt = new Date();
  if (payload && payload.reviewNote !== undefined) {
    existing.reviewNote = payload.reviewNote;
  }

  const saved = await existing.save();
  return { data: saved.toJSON() };
}

/**
 * Reject đơn. Admin only. Chỉ khi `pending`.
 */
export async function rejectLeaveRequest(id, payload, actor) {
  if (!Types.ObjectId.isValid(id)) {
    return BAD_REQUEST('VALIDATION_ERROR', 'Invalid id: must be a valid ObjectId', 'id');
  }
  const existing = await LeaveRequest.findById(id);
  if (!existing) {
    return { ...NOT_FOUND };
  }

  if (existing.status !== 'pending') {
    return {
      error: {
        status: 409,
        code: 'INVALID_STATE',
        message: `Cannot reject a leave request in status "${existing.status}"`,
      },
    };
  }

  existing.status = 'rejected';
  existing.reviewedBy = actor._id;
  existing.reviewedAt = new Date();
  if (payload && payload.reviewNote !== undefined) {
    existing.reviewNote = payload.reviewNote;
  }

  const saved = await existing.save();
  return { data: saved.toJSON() };
}
