// Attendance service — business logic for the Attendance Management API.
//
// Responsibilities:
// - Build safe Mongoose queries from validated input (no client strings
//   go directly into MongoDB operators).
// - Verify reference existence (Employee) and the soft-delete state of
//   the referenced Employee before writing.
// - Handle duplicate (employeeId, workDate) by translating E11000 to a
//   409 with a stable code.
// - Honor ownership rules: Employee users can only access their own
//   attendance records (matched on Employee.userId == req.user._id).
//   Non-owners get 404 (not 403) to avoid leaking ID existence.
//
// Errors returned by this module carry `status` and `code` so the
// controller can map them to HTTP responses.

import mongoose from 'mongoose';
import { Attendance, Employee } from '../models/index.js';

const { Types } = mongoose;

const NOT_FOUND = {
  error: { status: 404, code: 'ATTENDANCE_NOT_FOUND', message: 'Attendance not found' },
};

const BAD_REQUEST = (code, message) => ({
  error: { status: 400, code, message },
});

/**
 * Build the Mongo filter from a normalized query.
 * - filters: { employeeId?, status?, workDate: { $gte?, $lt? } }
 */
function buildListFilter({ filters }) {
  const and = [];
  if (filters.employeeId) and.push({ employeeId: filters.employeeId });
  if (filters.status) and.push({ status: filters.status });
  if (filters.workDate && (filters.workDate.$gte || filters.workDate.$lt)) {
    and.push({ workDate: filters.workDate });
  }
  if (and.length === 0) return {};
  if (and.length === 1) return and[0];
  return { $and: and };
}

/**
 * List attendance records (Admin only — controller handles authorization).
 * Default ordering: workDate desc (newest first).
 */
export async function listAttendance(query) {
  const { page, limit, filters, sortBy, sortOrder } = query;
  const filter = buildListFilter({ filters });
  const sort = { [sortBy]: sortOrder === 'asc' ? 1 : -1 };
  const skip = (page - 1) * limit;

  const [total, docs] = await Promise.all([
    Attendance.countDocuments(filter),
    Attendance.find(filter).sort(sort).skip(skip).limit(limit).lean({ virtuals: true }),
  ]);

  const data = docs.map(serializeLean);

  return {
    data,
    pagination: {
      page,
      limit,
      total,
      totalPages: total === 0 ? 0 : Math.ceil(total / limit),
    },
  };
}

/**
 * List attendance records for a specific employee.
 * Used by /api/attendance/me. `actor` is the authenticated user object.
 */
export async function listAttendanceForEmployee(employeeId, query) {
  const { page, limit, sortBy, sortOrder } = query;
  const filter = { employeeId };
  const sort = { [sortBy]: sortOrder === 'asc' ? 1 : -1 };
  const skip = (page - 1) * limit;

  const [total, docs] = await Promise.all([
    Attendance.countDocuments(filter),
    Attendance.find(filter).sort(sort).skip(skip).limit(limit).lean({ virtuals: true }),
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
 * Get an attendance record by id.
 * Returns 400 for invalid id, 404 for missing.
 * If `actor` is provided and is not admin, the record must belong to
 * the actor's linked Employee. Mismatch returns 404 (not 403).
 */
export async function getAttendanceById(id, actor) {
  if (!Types.ObjectId.isValid(id)) {
    return BAD_REQUEST('VALIDATION_ERROR', 'Invalid id: must be a valid ObjectId');
  }
  const doc = await Attendance.findById(id).lean({ virtuals: true });
  if (!doc) {
    return { ...NOT_FOUND };
  }
  // Owner check for non-admin actors.
  if (actor && actor.role !== 'admin') {
    const owner = await Employee.findOne({ userId: actor._id })
      .select('_id')
      .lean();
    if (!owner || owner._id.toString() !== doc.employeeId.toString()) {
      return { ...NOT_FOUND };
    }
  }
  return { data: serializeLean(doc) };
}

/**
 * Verify that the referenced employee exists and is not soft-deleted.
 * Returns null on success, error object otherwise.
 */
async function assertEmployeeActive(employeeId) {
  if (!employeeId) return null;
  const e = await Employee.findById(employeeId)
    .select('_id isDeleted')
    .lean();
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
 * Create a new attendance record.
 * `actor` is the authenticated user object — used to set createdBy.
 */
export async function createAttendance(payload, actor) {
  const empCheck = await assertEmployeeActive(payload.employeeId);
  if (empCheck) return empCheck;

  const doc = new Attendance({
    employeeId: payload.employeeId,
    workDate: payload.workDate,
    checkInAt: payload.checkInAt ?? null,
    checkOutAt: payload.checkOutAt ?? null,
    status: payload.status,
    note: payload.note ?? '',
    createdBy: actor && actor._id ? actor._id : null,
    updatedBy: actor && actor._id ? actor._id : null,
  });

  try {
    const saved = await doc.save();
    return { data: saved.toJSON() };
  } catch (err) {
    if (err && err.code === 11000) {
      return translateDuplicateKey(err);
    }
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
 * Update an existing attendance record.
 * `actor` is the authenticated user object — used to set updatedBy.
 */
export async function updateAttendance(id, payload, actor) {
  if (!Types.ObjectId.isValid(id)) {
    return BAD_REQUEST('VALIDATION_ERROR', 'Invalid id: must be a valid ObjectId');
  }
  const existing = await Attendance.findById(id);
  if (!existing) {
    return { ...NOT_FOUND };
  }

  // Reference check if employeeId is changing.
  if (payload.employeeId !== undefined) {
    const check = await assertEmployeeActive(payload.employeeId);
    if (check) return check;
  }

  // Apply allowed fields.
  for (const [key, value] of Object.entries(payload)) {
    existing[key] = value;
  }
  existing.updatedBy = actor && actor._id ? actor._id : existing.updatedBy;

  try {
    const saved = await existing.save();
    return { data: saved.toJSON() };
  } catch (err) {
    if (err && err.code === 11000) {
      return translateDuplicateKey(err);
    }
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
 * Translate a Mongo duplicate-key error into a structured 409.
 */
function translateDuplicateKey(err) {
  const fields = Object.keys(err.keyPattern || err.keyValue || {});
  let message = 'Duplicate attendance record for this employee and workDate';
  let code = 'DUPLICATE_ATTENDANCE';
  if (fields.includes('employeeId') || fields.length > 0) {
    code = 'DUPLICATE_ATTENDANCE';
    message = 'An attendance record already exists for this employee and workDate';
  }
  return { error: { status: 409, code, message } };
}

/**
 * Strip mongoose internals from a lean doc.
 */
function serializeLean(doc) {
  const { __v, ...rest } = doc;
  return rest;
}
