// Input validation for the Position Management API.

import { POSITION_STATUSES } from '../models/position.model.js';

const OBJECT_ID_RE = /^[a-fA-F0-9]{24}$/;
const CODE_RE = /^[A-Z0-9_-]+$/;

const DEFAULT_PAGE = 1;
const DEFAULT_LIMIT = 10;
const MAX_LIMIT = 100;

// Field allowlist for create.
const CREATE_FIELDS = Object.freeze([
  'name',
  'code',
  'description',
  'departmentId',
  'status',
]);

// Field allowlist for update.
const UPDATE_FIELDS = Object.freeze([
  'name',
  'code',
  'description',
  'departmentId',
  'status',
]);

// Sort allowlist.
const SORTABLE_FIELDS = Object.freeze([
  'name',
  'code',
  'createdAt',
  'updatedAt',
]);
const SORT_DIRECTIONS = Object.freeze(['asc', 'desc']);

function makeError(status, code, message, field) {
  return { error: { status, code, message, field } };
}

function isPlainObject(v) {
  return v !== null && typeof v === 'object' && !Array.isArray(v);
}

function isValidObjectIdString(v) {
  return typeof v === 'string' && OBJECT_ID_RE.test(v) && /^[a-fA-F0-9]{24}$/.test(v);
}

function toObjectIdOrNull(v) {
  if (v === null || v === undefined || v === '') return null;
  if (!isValidObjectIdString(v)) return undefined;
  return v;
}

function pickAllowed(body, allow) {
  const out = {};
  for (const key of allow) {
    if (Object.prototype.hasOwnProperty.call(body, key)) {
      out[key] = body[key];
    }
  }
  return out;
}

/**
 * Escape regex metacharacters.
 */
export function escapeRegex(s) {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/**
 * Validate a list query.
 */
export function validateListQuery(query) {
  const q = isPlainObject(query) ? query : {};

  // page
  let page = DEFAULT_PAGE;
  if (q.page !== undefined && q.page !== '') {
    const n = Number(q.page);
    if (!Number.isInteger(n) || n < 1) {
      return makeError(400, 'VALIDATION_ERROR', 'page must be a positive integer', 'page');
    }
    page = n;
  }

  // limit
  let limit = DEFAULT_LIMIT;
  if (q.limit !== undefined && q.limit !== '') {
    const n = Number(q.limit);
    if (!Number.isInteger(n) || n < 1) {
      return makeError(400, 'VALIDATION_ERROR', 'limit must be a positive integer', 'limit');
    }
    if (n > MAX_LIMIT) {
      return makeError(400, 'VALIDATION_ERROR', `limit must not exceed ${MAX_LIMIT}`, 'limit');
    }
    limit = n;
  }

  // search
  let search = '';
  if (q.search !== undefined && q.search !== null) {
    if (typeof q.search !== 'string') {
      return makeError(400, 'VALIDATION_ERROR', 'search must be a string', 'search');
    }
    const trimmed = q.search.trim();
    if (trimmed.length > 100) {
      return makeError(400, 'VALIDATION_ERROR', 'search must be at most 100 characters', 'search');
    }
    search = trimmed;
  }

  // filters
  const filters = {};
  if (q.status !== undefined && q.status !== '') {
    if (!POSITION_STATUSES.includes(q.status)) {
      return makeError(
        400,
        'VALIDATION_ERROR',
        'status must be one of: ' + POSITION_STATUSES.join(', '),
        'status',
      );
    }
    filters.status = q.status;
  }
  if (q.departmentId !== undefined && q.departmentId !== '') {
    const v = toObjectIdOrNull(q.departmentId);
    if (v === undefined) {
      return makeError(400, 'VALIDATION_ERROR', 'departmentId is not a valid ObjectId', 'departmentId');
    }
    if (v !== null) filters.departmentId = v;
  }

  // sort
  let sortBy = 'createdAt';
  let sortOrder = 'desc';
  if (q.sortBy !== undefined && q.sortBy !== '') {
    if (!SORTABLE_FIELDS.includes(q.sortBy)) {
      return makeError(
        400,
        'VALIDATION_ERROR',
        'sortBy must be one of: ' + SORTABLE_FIELDS.join(', '),
        'sortBy',
      );
    }
    sortBy = q.sortBy;
  }
  if (q.sortOrder !== undefined && q.sortOrder !== '') {
    const v = String(q.sortOrder).toLowerCase();
    if (!SORT_DIRECTIONS.includes(v)) {
      return makeError(
        400,
        'VALIDATION_ERROR',
        'sortOrder must be one of: ' + SORT_DIRECTIONS.join(', '),
        'sortOrder',
      );
    }
    sortOrder = v;
  }

  return {
    value: { page, limit, search, filters, sortBy, sortOrder },
  };
}

/**
 * Validate the create payload.
 */
export function validateCreatePayload(body) {
  if (!isPlainObject(body)) {
    return makeError(400, 'BAD_REQUEST', 'Request body must be an object');
  }

  for (const key of Object.keys(body)) {
    if (!CREATE_FIELDS.includes(key)) {
      return makeError(400, 'VALIDATION_ERROR', `Field "${key}" is not allowed`, key);
    }
  }

  const v = {};

  // name (required)
  if (typeof body.name !== 'string' || body.name.trim().length === 0) {
    return makeError(400, 'VALIDATION_ERROR', 'name is required', 'name');
  }
  if (body.name.trim().length < 2) {
    return makeError(400, 'VALIDATION_ERROR', 'name must be at least 2 characters', 'name');
  }
  if (body.name.trim().length > 120) {
    return makeError(400, 'VALIDATION_ERROR', 'name must be at most 120 characters', 'name');
  }
  v.name = body.name.trim();

  // code (required)
  if (typeof body.code !== 'string' || body.code.trim().length === 0) {
    return makeError(400, 'VALIDATION_ERROR', 'code is required', 'code');
  }
  if (!CODE_RE.test(body.code.trim())) {
    return makeError(
      400,
      'VALIDATION_ERROR',
      'code must be uppercase letters, digits, _ or -',
      'code',
    );
  }
  if (body.code.trim().length < 2) {
    return makeError(400, 'VALIDATION_ERROR', 'code must be at least 2 characters', 'code');
  }
  if (body.code.trim().length > 32) {
    return makeError(400, 'VALIDATION_ERROR', 'code must be at most 32 characters', 'code');
  }
  v.code = body.code.trim();

  // description (optional)
  if (body.description !== undefined && body.description !== null) {
    if (typeof body.description !== 'string') {
      return makeError(400, 'VALIDATION_ERROR', 'description must be a string', 'description');
    }
    v.description = body.description.trim();
    if (v.description.length > 500) {
      return makeError(400, 'VALIDATION_ERROR', 'description must be at most 500 characters', 'description');
    }
  }

  // departmentId (optional)
  if (body.departmentId !== undefined && body.departmentId !== null && body.departmentId !== '') {
    if (!isValidObjectIdString(body.departmentId)) {
      return makeError(400, 'VALIDATION_ERROR', 'departmentId is not a valid ObjectId', 'departmentId');
    }
    v.departmentId = body.departmentId;
  }

  // status (optional)
  if (body.status !== undefined && body.status !== null && body.status !== '') {
    if (!POSITION_STATUSES.includes(body.status)) {
      return makeError(
        400,
        'VALIDATION_ERROR',
        'status must be one of: ' + POSITION_STATUSES.join(', '),
        'status',
      );
    }
    v.status = body.status;
  }

  return { value: v };
}

/**
 * Validate a partial update payload.
 */
export function validateUpdatePayload(body) {
  if (!isPlainObject(body)) {
    return makeError(400, 'BAD_REQUEST', 'Request body must be an object');
  }

  for (const key of Object.keys(body)) {
    if (!UPDATE_FIELDS.includes(key)) {
      return makeError(400, 'VALIDATION_ERROR', `Field "${key}" is not allowed`, key);
    }
  }

  if (Object.keys(body).length === 0) {
    return makeError(
      400,
      'VALIDATION_ERROR',
      'Request body must contain at least one updatable field',
    );
  }

  const v = {};
  let assigned = false;

  if (body.name !== undefined) {
    if (body.name === null || body.name === '') {
      return makeError(400, 'VALIDATION_ERROR', 'name cannot be set to empty', 'name');
    }
    if (typeof body.name !== 'string' || body.name.trim().length < 2) {
      return makeError(400, 'VALIDATION_ERROR', 'name must be at least 2 characters', 'name');
    }
    if (body.name.trim().length > 120) {
      return makeError(400, 'VALIDATION_ERROR', 'name must be at most 120 characters', 'name');
    }
    v.name = body.name.trim();
    assigned = true;
  }

  if (body.code !== undefined) {
    if (body.code === null || body.code === '') {
      return makeError(400, 'VALIDATION_ERROR', 'code cannot be set to empty', 'code');
    }
    if (!CODE_RE.test(body.code.trim())) {
      return makeError(
        400,
        'VALIDATION_ERROR',
        'code must be uppercase letters, digits, _ or -',
        'code',
      );
    }
    if (body.code.trim().length < 2 || body.code.trim().length > 32) {
      return makeError(400, 'VALIDATION_ERROR', 'code must be 2-32 characters', 'code');
    }
    v.code = body.code.trim();
    assigned = true;
  }

  if (body.description !== undefined) {
    if (body.description === null || body.description === '') {
      v.description = '';
    } else if (typeof body.description !== 'string') {
      return makeError(400, 'VALIDATION_ERROR', 'description must be a string', 'description');
    } else {
      if (body.description.trim().length > 500) {
        return makeError(400, 'VALIDATION_ERROR', 'description must be at most 500 characters', 'description');
      }
      v.description = body.description.trim();
    }
    assigned = true;
  }

  if (body.departmentId !== undefined) {
    if (body.departmentId === null || body.departmentId === '') {
      v.departmentId = null;
    } else if (!isValidObjectIdString(body.departmentId)) {
      return makeError(400, 'VALIDATION_ERROR', 'departmentId is not a valid ObjectId', 'departmentId');
    } else {
      v.departmentId = body.departmentId;
    }
    assigned = true;
  }

  if (body.status !== undefined) {
    if (body.status === null || body.status === '') {
      return makeError(400, 'VALIDATION_ERROR', 'status cannot be set to empty', 'status');
    }
    if (!POSITION_STATUSES.includes(body.status)) {
      return makeError(
        400,
        'VALIDATION_ERROR',
        'status must be one of: ' + POSITION_STATUSES.join(', '),
        'status',
      );
    }
    v.status = body.status;
    assigned = true;
  }

  if (!assigned) {
    return makeError(
      400,
      'VALIDATION_ERROR',
      'Request body must contain at least one updatable field',
    );
  }

  return { value: v };
}

/**
 * Validate an :id path parameter.
 */
export function validateIdParam(rawId) {
  if (typeof rawId !== 'string' || !isValidObjectIdString(rawId)) {
    return makeError(400, 'VALIDATION_ERROR', 'Invalid id: must be a valid ObjectId');
  }
  return { id: rawId };
}

// Expose internals for tests.
export const _internal = {
  isPlainObject,
  isValidObjectIdString,
  pickAllowed,
  CREATE_FIELDS,
  UPDATE_FIELDS,
  SORTABLE_FIELDS,
};
