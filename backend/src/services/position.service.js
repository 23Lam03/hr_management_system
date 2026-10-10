// Position service — business logic for the Position Management API.

import mongoose from 'mongoose';
import { Position, Department } from '../models/index.js';
import { escapeRegex } from '../validators/position.validator.js';

const { Types } = mongoose;

const NOT_FOUND = {
  error: { status: 404, code: 'POSITION_NOT_FOUND', message: 'Position not found' },
};

const BAD_REQUEST = (code, message) => ({
  error: { status: 400, code, message },
});

/**
 * Build the Mongo filter from a normalized query.
 * - Search matches name or code (case-insensitive substring).
 * - Filter by status and departmentId.
 */
function buildListFilter({ search, filters }) {
  const and = [];
  if (filters.status) and.push({ status: filters.status });
  if (filters.departmentId) and.push({ departmentId: filters.departmentId });
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
 * List positions with pagination, search, filters, and sort.
 */
export async function listPositions(query) {
  const { page, limit, search, filters, sortBy, sortOrder } = query;
  const filter = buildListFilter({ search, filters });
  const sort = { [sortBy]: sortOrder === 'asc' ? 1 : -1 };
  const skip = (page - 1) * limit;

  const [total, docs] = await Promise.all([
    Position.countDocuments(filter),
    Position.find(filter).sort(sort).skip(skip).limit(limit).lean({ virtuals: true }),
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
 * Get a position by id. Returns the safe JSON document.
 * Returns 400 for invalid id, 404 for missing.
 */
export async function getPositionById(id) {
  if (!Types.ObjectId.isValid(id)) {
    return BAD_REQUEST('VALIDATION_ERROR', 'Invalid id: must be a valid ObjectId');
  }
  const doc = await Position.findById(id).lean({ virtuals: true });
  if (!doc) {
    return { ...NOT_FOUND };
  }
  return { data: serializeLean(doc) };
}

/**
 * Verify that the referenced department exists and is active.
 * Returns null on success, error object otherwise.
 * - null departmentId is allowed (general position).
 * - Inactive departments are rejected for new links.
 */
async function assertDepartmentActive(departmentId) {
  if (!departmentId) return null;
  const d = await Department.findById(departmentId)
    .select('_id status')
    .lean();
  if (!d) {
    return {
      error: {
        status: 400,
        code: 'VALIDATION_ERROR',
        field: 'departmentId',
        message: 'departmentId does not reference an existing Department',
      },
    };
  }
  if (d.status === 'inactive') {
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

/**
 * Create a new position.
 */
export async function createPosition(payload) {
  const deptCheck = await assertDepartmentActive(payload.departmentId);
  if (deptCheck) return deptCheck;

  const doc = new Position({
    name: payload.name,
    code: payload.code,
    description: payload.description ?? '',
    departmentId: payload.departmentId ?? null,
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
 * Update an existing position.
 */
export async function updatePosition(id, payload) {
  if (!Types.ObjectId.isValid(id)) {
    return BAD_REQUEST('VALIDATION_ERROR', 'Invalid id: must be a valid ObjectId');
  }
  const existing = await Position.findById(id);
  if (!existing) {
    return { ...NOT_FOUND };
  }

  // Department reference check when changing.
  if (payload.departmentId !== undefined) {
    const check = await assertDepartmentActive(payload.departmentId);
    if (check) return check;
  }

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
 * Deactivate a position (set status: inactive).
 * - Idempotent: a second call on an already-inactive position
 *   returns 200 with `alreadyDeactivated: true`.
 * - Does NOT touch employees that reference this position.
 */
export async function deactivatePosition(id) {
  if (!Types.ObjectId.isValid(id)) {
    return BAD_REQUEST('VALIDATION_ERROR', 'Invalid id: must be a valid ObjectId');
  }
  const doc = await Position.findById(id);
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
    code = 'DUPLICATE_POSITION_CODE';
    message = 'position code already exists';
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
