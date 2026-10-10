// Employee service — business logic for the Employee Management API.
//
// Responsibilities:
// - Build safe Mongoose queries from validated input (no client strings
//   go directly into MongoDB operators).
// - Escape regex metacharacters in user-supplied search strings.
// - Verify reference existence (Department, Position, User) before
//   writing.
// - Enforce unique `userId` constraint at the application layer
//   (the unique partial index is the last line of defense).
// - Soft-delete with idempotency and audit fields.
// - Return plain objects (already safe toJSON) — no `passwordHash` is
//   reachable through Employee documents because we never read it here.
//
// Errors thrown by this module carry `status` and `code` so the
// controller can map them to HTTP responses.

import mongoose from 'mongoose';
import { Employee, Department, Position, User } from '../models/index.js';

const { Types } = mongoose;

const NOT_FOUND = (id) => ({
  error: { status: 404, code: 'EMPLOYEE_NOT_FOUND', message: 'Employee not found' },
  id,
});

const BAD_REQUEST = (code, message) => ({
  error: { status: 400, code, message },
});

/**
 * Escape regex metacharacters so user-supplied search strings behave
 * as plain substrings and cannot inject patterns.
 */
function escapeRegex(s) {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/**
 * Build the Mongo filter from a normalized query.
 */
function buildListFilter({ search, filters, includeDeleted }) {
  const and = [];
  if (!includeDeleted) {
    and.push({ isDeleted: { $ne: true } });
  }
  if (filters.departmentId) and.push({ departmentId: filters.departmentId });
  if (filters.positionId) and.push({ positionId: filters.positionId });
  if (filters.employmentStatus) and.push({ employmentStatus: filters.employmentStatus });
  if (search) {
    const re = new RegExp(escapeRegex(search), 'i');
    and.push({
      $or: [
        { fullName: re },
        { employeeCode: re },
        { email: re },
      ],
    });
  }
  if (and.length === 0) return {};
  if (and.length === 1) return and[0];
  return { $and: and };
}

/**
 * List employees with pagination, search, filters, and sort.
 * - Default behavior: exclude soft-deleted records.
 * - If `actorRole` is not 'admin', force exclude-deleted and do not
 *   allow employees to "view all" by toggling includeDeleted.
 */
export async function listEmployees(query, actor) {
  const { page, limit, search, filters, sortBy, sortOrder, includeDeleted } = query;

  // Permission for includeDeleted: admin only.
  const isAdmin = actor && actor.role === 'admin';
  const includeDeletedSafe = isAdmin ? includeDeleted : false;

  const filter = buildListFilter({ search, filters, includeDeleted: includeDeletedSafe });
  const sort = { [sortBy]: sortOrder === 'asc' ? 1 : -1 };

  const skip = (page - 1) * limit;
  // Use Promise.all to run count and find in parallel.
  const [total, docs] = await Promise.all([
    Employee.countDocuments(filter),
    Employee.find(filter)
      .sort(sort)
      .skip(skip)
      .limit(limit)
      // Lean + manual toJSON to avoid any chance of passwordHash leakage.
      .lean({ virtuals: true }),
  ]);

  // Convert docs to safe JSON shape (lean docs do NOT run transform,
  // so strip __v and any sensitive fields manually).
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
 * Get an employee by id. Honors soft-delete for non-admins.
 * Returns the safe JSON document.
 */
export async function getEmployeeById(id, actor) {
  if (!Types.ObjectId.isValid(id)) {
    return BAD_REQUEST('VALIDATION_ERROR', 'Invalid id: must be a valid ObjectId');
  }
  const doc = await Employee.findById(id).lean({ virtuals: true });
  if (!doc) {
    return { ...NOT_FOUND(id) };
  }
  if (doc.isDeleted && !(actor && actor.role === 'admin')) {
    // For non-admins, a soft-deleted employee is treated as not found.
    return { ...NOT_FOUND(id) };
  }
  return { data: serializeLean(doc) };
}

/**
 * Verify that the position belongs to the given department when both
 * are provided. Returns null on success or an error object.
 * Business rule: a Position's `departmentId` (if set) should match
 * the Employee's `departmentId`. This is the standard "position is
 * scoped to a department" rule.
 *
 * If position has no departmentId (general position), it's compatible
 * with any department.
 */
async function checkPositionDepartmentCompatibility({ positionId, departmentId }) {
  if (!positionId) return null;
  const pos = await Position.findById(positionId).select('_id departmentId status').lean();
  if (!pos) {
    return {
      error: {
        status: 400,
        code: 'VALIDATION_ERROR',
        field: 'positionId',
        message: 'positionId does not reference an existing Position',
      },
    };
  }
  if (pos.status === 'inactive') {
    return {
      error: {
        status: 400,
        code: 'VALIDATION_ERROR',
        field: 'positionId',
        message: 'Position is inactive',
      },
    };
  }
  // If position is scoped to a specific department, it must match.
  if (pos.departmentId && departmentId) {
    if (pos.departmentId.toString() !== departmentId.toString()) {
      return {
        error: {
          status: 422,
          code: 'POSITION_DEPARTMENT_MISMATCH',
          field: 'positionId',
          message: 'Position does not belong to the specified Department',
        },
      };
    }
  }
  return null;
}

async function assertDepartmentActive(departmentId) {
  if (!departmentId) return null;
  const dept = await Department.findById(departmentId)
    .select('_id status')
    .lean();
  if (!dept) {
    return {
      error: {
        status: 400,
        code: 'VALIDATION_ERROR',
        field: 'departmentId',
        message: 'departmentId does not reference an existing Department',
      },
    };
  }
  if (dept.status === 'inactive') {
    return {
      error: {
        status: 400,
        code: 'VALIDATION_ERROR',
        field: 'departmentId',
        message: 'Department is inactive',
      },
    };
  }
  return null;
}

async function assertUserExists(userId) {
  if (!userId) return null;
  const u = await User.findById(userId).select('_id').lean();
  if (!u) {
    return {
      error: {
        status: 400,
        code: 'VALIDATION_ERROR',
        field: 'userId',
        message: 'userId does not reference an existing User',
      },
    };
  }
  return null;
}

async function assertUserNotLinkedToOtherEmployee(userId, excludeEmployeeId) {
  if (!userId) return null;
  const filter = { userId };
  if (excludeEmployeeId) {
    filter._id = { $ne: excludeEmployeeId };
  }
  const existing = await Employee.findOne(filter).select('_id employeeCode').lean();
  if (existing) {
    return {
      error: {
        status: 409,
        code: 'DUPLICATE_USER_LINK',
        message: 'This user is already linked to another employee',
      },
    };
  }
  return null;
}

async function assertManagerNotSelf(managerId, selfId) {
  if (!managerId || !selfId) return null;
  if (managerId.toString() === selfId.toString()) {
    return {
      error: {
        status: 422,
        code: 'MANAGER_INVALID',
        message: 'managerId cannot be the employee themselves',
      },
    };
  }
  // Also verify the manager employee exists (and is not soft-deleted).
  const m = await Employee.findById(managerId).select('_id isDeleted').lean();
  if (!m || m.isDeleted) {
    return {
      error: {
        status: 422,
        code: 'MANAGER_INVALID',
        message: 'managerId does not reference an existing employee',
      },
    };
  }
  return null;
}

/**
 * Create a new employee.
 */
export async function createEmployee(payload) {
  // Reference existence checks.
  const deptCheck = await assertDepartmentActive(payload.departmentId);
  if (deptCheck) return deptCheck;

  const posCompat = await checkPositionDepartmentCompatibility({
    positionId: payload.positionId,
    departmentId: payload.departmentId,
  });
  if (posCompat) return posCompat;

  const userCheck = await assertUserExists(payload.userId);
  if (userCheck) return userCheck;

  const userLinkCheck = await assertUserNotLinkedToOtherEmployee(payload.userId, null);
  if (userLinkCheck) return userLinkCheck;

  // Build the doc with only schema-known fields.
  const doc = new Employee({
    employeeCode: payload.employeeCode,
    fullName: payload.fullName,
    email: payload.email,
    phone: payload.phone ?? '',
    avatar: payload.avatar ?? null,
    gender: payload.gender,
    dateOfBirth: payload.dateOfBirth ?? null,
    departmentId: payload.departmentId ?? null,
    positionId: payload.positionId ?? null,
    position: payload.position ?? '',
    employmentType: payload.employmentType,
    hireDate: payload.hireDate,
    managerId: payload.managerId ?? null,
    address: payload.address ?? '',
    employmentStatus: payload.employmentStatus,
  });
  if (payload.userId) {
    doc.userId = payload.userId;
  }

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
 * Update an existing employee.
 */
export async function updateEmployee(id, payload) {
  if (!Types.ObjectId.isValid(id)) {
    return BAD_REQUEST('VALIDATION_ERROR', 'Invalid id: must be a valid ObjectId');
  }

  const existing = await Employee.findById(id);
  if (!existing || existing.isDeleted) {
    return { ...NOT_FOUND(id) };
  }

  // Reference checks for fields being changed.
  if (payload.departmentId !== undefined) {
    const check = await assertDepartmentActive(payload.departmentId);
    if (check) return check;
  }
  if (
    payload.positionId !== undefined ||
    payload.departmentId !== undefined
  ) {
    // Use the effective departmentId (new if set, else existing).
    const effectiveDept =
      payload.departmentId !== undefined ? payload.departmentId : existing.departmentId;
    const effectivePos =
      payload.positionId !== undefined ? payload.positionId : existing.positionId;
    const check = await checkPositionDepartmentCompatibility({
      positionId: effectivePos,
      departmentId: effectiveDept,
    });
    if (check) return check;
  }
  if (payload.userId !== undefined) {
    const existsCheck = await assertUserExists(payload.userId);
    if (existsCheck) return existsCheck;
    if (payload.userId) {
      const linkCheck = await assertUserNotLinkedToOtherEmployee(
        payload.userId,
        existing._id,
      );
      if (linkCheck) return linkCheck;
    }
  }
  if (payload.managerId !== undefined) {
    const mgrCheck = await assertManagerNotSelf(payload.managerId, existing._id);
    if (mgrCheck) return mgrCheck;
  }

  // Apply allowed fields.
  for (const [key, value] of Object.entries(payload)) {
    if (key === 'gender' && value === undefined) continue;
    if (key === 'employmentStatus' && value === undefined) continue;
    existing[key] = value;
  }

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
 * Soft-delete an employee.
 * - Idempotent: a second call on an already-deleted record returns
 *   the already-deleted state (with `alreadyDeleted: true` so the
 *   controller can choose the right status code).
 * - Does NOT touch the linked User.
 * - Sets audit fields: deletedAt, deletedBy.
 */
export async function softDeleteEmployee(id, actor) {
  if (!Types.ObjectId.isValid(id)) {
    return BAD_REQUEST('VALIDATION_ERROR', 'Invalid id: must be a valid ObjectId');
  }
  const doc = await Employee.findById(id);
  if (!doc) {
    return { ...NOT_FOUND(id) };
  }
  if (doc.isDeleted) {
    return { data: doc.toJSON(), alreadyDeleted: true };
  }
  doc.isDeleted = true;
  doc.deletedAt = new Date();
  if (actor && actor._id) {
    doc.deletedBy = actor._id;
  }
  await doc.save();
  return { data: doc.toJSON(), alreadyDeleted: false };
}

/**
 * Translate a Mongo duplicate-key error into a structured 409.
 */
function translateDuplicateKey(err) {
  const fields = Object.keys(err.keyPattern || err.keyValue || {});
  let message = 'Duplicate value for a unique field';
  let code = 'DUPLICATE_KEY';
  if (fields.includes('employeeCode')) {
    code = 'DUPLICATE_EMPLOYEE_CODE';
    message = 'employeeCode already exists';
  } else if (fields.includes('email')) {
    code = 'DUPLICATE_EMAIL';
    message = 'email already exists';
  } else if (fields.includes('userId')) {
    code = 'DUPLICATE_USER_LINK';
    message = 'This user is already linked to another employee';
  }
  return { error: { status: 409, code, message } };
}

/**
 * Strip mongoose internals and any sensitive fields from a lean doc.
 * (Lean docs do not run `transform`, so we sanitize here.)
 */
function serializeLean(doc) {
  const { __v, ...rest } = doc;
  return rest;
}
