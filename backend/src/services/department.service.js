// Department service — business logic for the Department Management API.
//
// Responsibilities:
// - Build safe Mongoose queries from validated input.
// - Escape regex metacharacters in user-supplied search strings.
// - Verify reference existence (Employee) before writing.
// - Enforce uniqueness via Mongoose index, translate errors to 409.
// - Soft deactivation (status: inactive) instead of hard delete.
//
// Errors thrown here carry `status` and `code` so the controller
// can map them to HTTP responses.

import mongoose from 'mongoose';
import { Department, Employee } from '../models/index.js';
import { escapeRegex } from '../validators/department.validator.js';

const { Types } = mongoose;

const NOT_FOUND = {
  error: { status: 404, code: 'DEPARTMENT_NOT_FOUND', message: 'Department not found' },
};

const BAD_REQUEST = (code, message) => ({
  error: { status: 400, code, message },
});

/**
 * Build the Mongo filter from a normalized query.
 * - Search matches name or code (case-insensitive substring).
 */
function buildListFilter({ search, filters }) {
  const and = [];
  if (filters.status) and.push({ status: filters.status });
  if (search) {
    const re = new RegExp(escapeRegex(search), 'i');
    and.push({
      $or: [
        { name: re },
        { code: re },
      ],
    });
  }
  if (and.length === 0) return {};
  if (and.length === 1) return and[0];
  return { $and: and };
}

/**
 * List departments with pagination, search, filters, and sort.
 */
export async function listDepartments(query) {
  const { page, limit, search, filters, sortBy, sortOrder } = query;
  const filter = buildListFilter({ search, filters });
  const sort = { [sortBy]: sortOrder === 'asc' ? 1 : -1 };
  const skip = (page - 1) * limit;

  const [total, docs] = await Promise.all([
    Department.countDocuments(filter),
    Department.find(filter).sort(sort).skip(skip).limit(limit).lean({ virtuals: true }),
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
 * Get a department by id. Returns the safe JSON document.
 * Returns 404 for a missing department. Returns 400 for an invalid id.
 */
export async function getDepartmentById(id) {
  if (!Types.ObjectId.isValid(id)) {
    return BAD_REQUEST('VALIDATION_ERROR', 'Invalid id: must be a valid ObjectId');
  }
  const doc = await Department.findById(id).lean({ virtuals: true });
  if (!doc) {
    return { ...NOT_FOUND };
  }
  return { data: serializeLean(doc) };
}

/**
 * Verify that the manager employee exists and is not soft-deleted.
 * Returns null on success, error object otherwise.
 */
async function assertManagerEmployeeExists(managerEmployeeId) {
  if (!managerEmployeeId) return null;
  const m = await Employee.findById(managerEmployeeId)
    .select('_id isDeleted')
    .lean();
  if (!m) {
    return {
      error: {
        status: 400,
        code: 'VALIDATION_ERROR',
        field: 'managerEmployeeId',
        message: 'managerEmployeeId does not reference an existing Employee',
      },
    };
  }
  if (m.isDeleted) {
    return {
      error: {
        status: 400,
        code: 'VALIDATION_ERROR',
        field: 'managerEmployeeId',
        message: 'managerEmployeeId references a soft-deleted Employee',
      },
    };
  }
  return null;
}

/**
 * Create a new department.
 */
export async function createDepartment(payload) {
  // Manager reference check.
  const mgrCheck = await assertManagerEmployeeExists(payload.managerEmployeeId);
  if (mgrCheck) return mgrCheck;

  const doc = new Department({
    name: payload.name,
    code: payload.code,
    description: payload.description ?? '',
    managerEmployeeId: payload.managerEmployeeId ?? null,
    status: payload.status ?? 'active',
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
 * Update an existing department.
 */
export async function updateDepartment(id, payload) {
  if (!Types.ObjectId.isValid(id)) {
    return BAD_REQUEST('VALIDATION_ERROR', 'Invalid id: must be a valid ObjectId');
  }
  const existing = await Department.findById(id);
  if (!existing) {
    return { ...NOT_FOUND };
  }

  // Manager reference check when changing.
  if (payload.managerEmployeeId !== undefined) {
    const check = await assertManagerEmployeeExists(payload.managerEmployeeId);
    if (check) return check;
  }

  // Apply allowed fields.
  for (const [key, value] of Object.entries(payload)) {
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
 * Deactivate a department (set status: inactive).
 * - Idempotent: a second call on an already-inactive department
 *   returns 200 with `alreadyDeactivated: true`.
 * - Does NOT touch employees, positions, or other references.
 * - Preserves the historical link.
 */
export async function deactivateDepartment(id) {
  if (!Types.ObjectId.isValid(id)) {
    return BAD_REQUEST('VALIDATION_ERROR', 'Invalid id: must be a valid ObjectId');
  }
  const doc = await Department.findById(id);
  if (!doc) {
    return { ...NOT_FOUND };
  }
  if (doc.status === 'inactive') {
    return { data: doc.toJSON(), alreadyDeactivated: true };
  }
  doc.status = 'inactive';
  await doc.save();
  return { data: doc.toJSON(), alreadyDeactivated: false };
}

/**
 * Translate a Mongo duplicate-key error into a structured 409.
 */
function translateDuplicateKey(err) {
  const fields = Object.keys(err.keyPattern || err.keyValue || {});
  let message = 'Duplicate value for a unique field';
  let code = 'DUPLICATE_KEY';
  if (fields.includes('code')) {
    code = 'DUPLICATE_DEPARTMENT_CODE';
    message = 'department code already exists';
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
