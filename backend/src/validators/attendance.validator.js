// Input validation for the Attendance Management API.
//
// Quy ước:
// - Date string dạng `YYYY-MM-DD` được chuẩn hoá thành UTC midnight.
// - ISO 8601 datetime (`YYYY-MM-DDTHH:mm:ss.sssZ`) được giữ nguyên.
// - `workDate` chỉ chấp nhận date string (YYYY-MM-DD) để tránh nhầm
//   với datetime — ngày làm việc không nên có giờ.
// - `checkInAt` / `checkOutAt` chấp nhận ISO datetime đầy đủ.

import { ATTENDANCE_STATUSES } from '../models/attendance.model.js';

const OBJECT_ID_RE = /^[a-fA-F0-9]{24}$/;
const DATE_ONLY_RE = /^\d{4}-\d{2}-\d{2}$/;

const DEFAULT_PAGE = 1;
const DEFAULT_LIMIT = 10;
const MAX_LIMIT = 100;

// Field allowlist for create.
const CREATE_FIELDS = Object.freeze([
  'employeeId',
  'workDate',
  'checkInAt',
  'checkOutAt',
  'status',
  'note',
]);

// Field allowlist for update (intentionally excludes createdBy / createdAt / _id / __v).
const UPDATE_FIELDS = Object.freeze([
  'employeeId',
  'workDate',
  'checkInAt',
  'checkOutAt',
  'status',
  'note',
]);

// Sort allowlist.
const SORTABLE_FIELDS = Object.freeze([
  'workDate',
  'checkInAt',
  'checkOutAt',
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
  return typeof v === 'string' && OBJECT_ID_RE.test(v);
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
 * Parse a date string or Date.
 * - `YYYY-MM-DD` → UTC midnight of that date.
 * - ISO 8601 datetime → Date.
 * - Date instance → returned as-is.
 * Returns null if invalid.
 */
function parseDate(raw) {
  if (raw === null || raw === undefined || raw === '') return null;
  if (raw instanceof Date) {
    return Number.isNaN(raw.getTime()) ? null : raw;
  }
  if (typeof raw !== 'string') return null;
  if (DATE_ONLY_RE.test(raw)) {
    const [y, m, d] = raw.split('-').map(Number);
    const dt = new Date(Date.UTC(y, m - 1, d));
    return Number.isNaN(dt.getTime()) ? null : dt;
  }
  const dt = new Date(raw);
  return Number.isNaN(dt.getTime()) ? null : dt;
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

  // filters
  const filters = {};

  if (q.employeeId !== undefined && q.employeeId !== '') {
    if (!isValidObjectIdString(q.employeeId)) {
      return makeError(400, 'VALIDATION_ERROR', 'employeeId is not a valid ObjectId', 'employeeId');
    }
    filters.employeeId = q.employeeId;
  }

  if (q.status !== undefined && q.status !== '') {
    if (!ATTENDANCE_STATUSES.includes(q.status)) {
      return makeError(
        400,
        'VALIDATION_ERROR',
        'status must be one of: ' + ATTENDANCE_STATUSES.join(', '),
        'status',
      );
    }
    filters.status = q.status;
  }

  // startDate / endDate (inclusive). Chỉ chấp nhận YYYY-MM-DD để
  // tránh nhầm với datetime. endDate inclusive cả ngày đó.
  let startDate = null;
  if (q.startDate !== undefined && q.startDate !== '') {
    const d = parseDate(q.startDate);
    if (!d) {
      return makeError(400, 'VALIDATION_ERROR', 'startDate is not a valid date (YYYY-MM-DD)', 'startDate');
    }
    startDate = d;
  }
  let endDate = null;
  if (q.endDate !== undefined && q.endDate !== '') {
    const d = parseDate(q.endDate);
    if (!d) {
      return makeError(400, 'VALIDATION_ERROR', 'endDate is not a valid date (YYYY-MM-DD)', 'endDate');
    }
    endDate = d;
  }
  if (startDate && endDate && startDate.getTime() > endDate.getTime()) {
    return makeError(
      400,
      'VALIDATION_ERROR',
      'startDate must not be after endDate',
      'startDate',
    );
  }

  if (startDate || endDate) {
    const range = {};
    if (startDate) range.$gte = startDate;
    if (endDate) {
      // Inclusive: bao gồm cả ngày endDate → cộng thêm 1 ngày và dùng $lt.
      const endExclusive = new Date(endDate.getTime() + 24 * 60 * 60 * 1000);
      range.$lt = endExclusive;
    }
    filters.workDate = range;
  }

  // sort
  let sortBy = 'workDate';
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
    value: { page, limit, filters, sortBy, sortOrder },
  };
}

/**
 * Validate the create payload.
 * `workDate` chỉ chấp nhận YYYY-MM-DD.
 * `checkInAt` / `checkOutAt` chấp nhận ISO datetime đầy đủ.
 */
export function validateCreatePayload(body) {
  if (!isPlainObject(body)) {
    return makeError(400, 'BAD_REQUEST', 'Request body must be an object');
  }

  // Reject unknown fields.
  for (const key of Object.keys(body)) {
    if (!CREATE_FIELDS.includes(key)) {
      return makeError(400, 'VALIDATION_ERROR', `Field "${key}" is not allowed`, key);
    }
  }

  const v = {};

  // employeeId
  if (typeof body.employeeId !== 'string' || !isValidObjectIdString(body.employeeId)) {
    return makeError(400, 'VALIDATION_ERROR', 'employeeId is required and must be a valid ObjectId', 'employeeId');
  }
  v.employeeId = body.employeeId;

  // workDate — required, YYYY-MM-DD
  if (typeof body.workDate !== 'string' || !DATE_ONLY_RE.test(body.workDate)) {
    return makeError(
      400,
      'VALIDATION_ERROR',
      'workDate is required and must be a date string in YYYY-MM-DD format',
      'workDate',
    );
  }
  const wd = parseDate(body.workDate);
  if (!wd) {
    return makeError(400, 'VALIDATION_ERROR', 'workDate is not a valid date', 'workDate');
  }
  v.workDate = wd;

  // status (required)
  if (typeof body.status !== 'string' || !ATTENDANCE_STATUSES.includes(body.status)) {
    return makeError(
      400,
      'VALIDATION_ERROR',
      'status is required and must be one of: ' + ATTENDANCE_STATUSES.join(', '),
      'status',
    );
  }
  v.status = body.status;

  // checkInAt (optional)
  if (body.checkInAt !== undefined && body.checkInAt !== null && body.checkInAt !== '') {
    if (typeof body.checkInAt !== 'string') {
      return makeError(400, 'VALIDATION_ERROR', 'checkInAt must be an ISO datetime string', 'checkInAt');
    }
    const ci = parseDate(body.checkInAt);
    if (!ci) {
      return makeError(400, 'VALIDATION_ERROR', 'checkInAt is not a valid datetime', 'checkInAt');
    }
    v.checkInAt = ci;
  } else {
    v.checkInAt = null;
  }

  // checkOutAt (optional)
  if (body.checkOutAt !== undefined && body.checkOutAt !== null && body.checkOutAt !== '') {
    if (typeof body.checkOutAt !== 'string') {
      return makeError(400, 'VALIDATION_ERROR', 'checkOutAt must be an ISO datetime string', 'checkOutAt');
    }
    const co = parseDate(body.checkOutAt);
    if (!co) {
      return makeError(400, 'VALIDATION_ERROR', 'checkOutAt is not a valid datetime', 'checkOutAt');
    }
    v.checkOutAt = co;
  } else {
    v.checkOutAt = null;
  }

  // Cross-field check: checkOutAt >= checkInAt.
  if (v.checkInAt && v.checkOutAt && v.checkOutAt.getTime() < v.checkInAt.getTime()) {
    return makeError(
      400,
      'VALIDATION_ERROR',
      'checkOutAt must be greater than or equal to checkInAt',
      'checkOutAt',
    );
  }

  // note (optional)
  if (body.note !== undefined && body.note !== null && body.note !== '') {
    if (typeof body.note !== 'string') {
      return makeError(400, 'VALIDATION_ERROR', 'note must be a string', 'note');
    }
    if (body.note.trim().length > 500) {
      return makeError(400, 'VALIDATION_ERROR', 'note must be at most 500 characters', 'note');
    }
    v.note = body.note.trim();
  } else {
    v.note = '';
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

  // Reject unknown fields.
  for (const key of Object.keys(body)) {
    if (!UPDATE_FIELDS.includes(key)) {
      return makeError(400, 'VALIDATION_ERROR', `Field "${key}" is not allowed`, key);
    }
  }

  if (Object.keys(body).length === 0) {
    return makeError(400, 'VALIDATION_ERROR', 'Request body must contain at least one updatable field');
  }

  const v = {};
  let assigned = false;

  if (body.employeeId !== undefined) {
    if (typeof body.employeeId !== 'string' || !isValidObjectIdString(body.employeeId)) {
      return makeError(400, 'VALIDATION_ERROR', 'employeeId must be a valid ObjectId', 'employeeId');
    }
    v.employeeId = body.employeeId;
    assigned = true;
  }

  if (body.workDate !== undefined) {
    if (typeof body.workDate !== 'string' || !DATE_ONLY_RE.test(body.workDate)) {
      return makeError(
        400,
        'VALIDATION_ERROR',
        'workDate must be a date string in YYYY-MM-DD format',
        'workDate',
      );
    }
    const wd = parseDate(body.workDate);
    if (!wd) {
      return makeError(400, 'VALIDATION_ERROR', 'workDate is not a valid date', 'workDate');
    }
    v.workDate = wd;
    assigned = true;
  }

  if (body.status !== undefined) {
    if (typeof body.status !== 'string' || !ATTENDANCE_STATUSES.includes(body.status)) {
      return makeError(
        400,
        'VALIDATION_ERROR',
        'status must be one of: ' + ATTENDANCE_STATUSES.join(', '),
        'status',
      );
    }
    v.status = body.status;
    assigned = true;
  }

  if (body.checkInAt !== undefined) {
    if (body.checkInAt === null || body.checkInAt === '') {
      v.checkInAt = null;
    } else {
      if (typeof body.checkInAt !== 'string') {
        return makeError(400, 'VALIDATION_ERROR', 'checkInAt must be an ISO datetime string', 'checkInAt');
      }
      const ci = parseDate(body.checkInAt);
      if (!ci) {
        return makeError(400, 'VALIDATION_ERROR', 'checkInAt is not a valid datetime', 'checkInAt');
      }
      v.checkInAt = ci;
    }
    assigned = true;
  }

  if (body.checkOutAt !== undefined) {
    if (body.checkOutAt === null || body.checkOutAt === '') {
      v.checkOutAt = null;
    } else {
      if (typeof body.checkOutAt !== 'string') {
        return makeError(400, 'VALIDATION_ERROR', 'checkOutAt must be an ISO datetime string', 'checkOutAt');
      }
      const co = parseDate(body.checkOutAt);
      if (!co) {
        return makeError(400, 'VALIDATION_ERROR', 'checkOutAt is not a valid datetime', 'checkOutAt');
      }
      v.checkOutAt = co;
    }
    assigned = true;
  }

  // Cross-field check.
  const effectiveIn = v.checkInAt !== undefined ? v.checkInAt : null;
  const effectiveOut = v.checkOutAt !== undefined ? v.checkOutAt : null;
  if (effectiveIn && effectiveOut && effectiveOut.getTime() < effectiveIn.getTime()) {
    return makeError(
      400,
      'VALIDATION_ERROR',
      'checkOutAt must be greater than or equal to checkInAt',
      'checkOutAt',
    );
  }

  if (body.note !== undefined) {
    if (body.note === null || body.note === '') {
      v.note = '';
    } else {
      if (typeof body.note !== 'string') {
        return makeError(400, 'VALIDATION_ERROR', 'note must be a string', 'note');
      }
      if (body.note.trim().length > 500) {
        return makeError(400, 'VALIDATION_ERROR', 'note must be at most 500 characters', 'note');
      }
      v.note = body.note.trim();
    }
    assigned = true;
  }

  if (!assigned) {
    return makeError(400, 'VALIDATION_ERROR', 'Request body must contain at least one updatable field');
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
  parseDate,
  DATE_ONLY_RE,
  CREATE_FIELDS,
  UPDATE_FIELDS,
  SORTABLE_FIELDS,
};
