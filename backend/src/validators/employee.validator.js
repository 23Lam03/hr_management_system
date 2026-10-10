// Input validation for the Employee Management API.
//
// Design notes (mirrors src/validators/auth.validator.js):
// - Pure functions that return either a sanitized payload or a structured
//   error. They never throw unexpectedly; controllers map errors to HTTP.
// - Allowlist-driven: only fields explicitly accepted here will be passed
//   to the service layer. This prevents clients from injecting fields
//   like `passwordHash`, `role`, `_id`, `__v`, `createdAt`, `updatedAt`,
//   or the soft-delete fields `isDeleted`, `deletedAt`, `deletedBy`.
// - Search strings are normalized and passed as plain substrings; the
//   service escapes regex metacharacters to prevent user-supplied
//   patterns from changing query logic.
//
// Enums mirror the schema exactly. Do NOT change enum values here
// without coordinating with src/models/employee.model.js.

import mongoose from 'mongoose';
import {
  EMPLOYMENT_STATUSES,
  EMPLOYMENT_TYPES,
  GENDERS,
} from '../models/employee.model.js';

const EMAIL_RE = /^\S+@\S+\.\S+$/;
// ObjectId hex string, 24 chars.
const OBJECT_ID_RE = /^[a-fA-F0-9]{24}$/;
// Loose E.164-ish phone: digits, spaces, +, -, parentheses, 6-20 chars.
const PHONE_RE = /^[0-9+\-()\s]{6,20}$/;

const DEFAULT_PAGE = 1;
const DEFAULT_LIMIT = 10;
const MAX_LIMIT = 100;

// Field allowlist for create.
const CREATE_FIELDS = Object.freeze([
  'employeeCode',
  'userId',
  'fullName',
  'email',
  'phone',
  'avatar',
  'gender',
  'dateOfBirth',
  'departmentId',
  'positionId',
  'position',
  'employmentType',
  'hireDate',
  'managerId',
  'address',
  'employmentStatus',
]);

// Field allowlist for update (intentionally excludes immutable / system
// fields and soft-delete fields).
// - employeeCode is updatable; if a duplicate collision happens, the
//   service returns 409 (handled by the DB unique index).
// - Soft-delete fields (isDeleted, deletedAt, deletedBy) are NOT in
//   this list; use DELETE endpoint instead.
const UPDATE_FIELDS = Object.freeze([
  'employeeCode',
  'userId',
  'fullName',
  'email',
  'phone',
  'avatar',
  'gender',
  'dateOfBirth',
  'departmentId',
  'positionId',
  'position',
  'employmentType',
  'hireDate',
  'managerId',
  'address',
  'employmentStatus',
]);

// Sort allowlist — anything outside this is rejected.
const SORTABLE_FIELDS = Object.freeze([
  'fullName',
  'employeeCode',
  'hireDate',
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
  return typeof v === 'string' && OBJECT_ID_RE.test(v) && mongoose.Types.ObjectId.isValid(v);
}

function toObjectIdOrNull(v) {
  if (v === null || v === undefined || v === '') return null;
  if (!isValidObjectIdString(v)) return undefined; // signal invalid
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
 * Validate a list query.
 * Returns { value: { page, limit, search, filters, sortBy, sortOrder, includeDeleted } }.
 * Each value is normalized; bad fields produce 400.
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
      return makeError(
        400,
        'VALIDATION_ERROR',
        `limit must not exceed ${MAX_LIMIT}`,
        'limit',
      );
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
  if (q.departmentId !== undefined && q.departmentId !== '') {
    const v = toObjectIdOrNull(q.departmentId);
    if (v === undefined) {
      return makeError(400, 'VALIDATION_ERROR', 'departmentId is not a valid ObjectId', 'departmentId');
    }
    if (v !== null) filters.departmentId = v;
  }
  if (q.positionId !== undefined && q.positionId !== '') {
    const v = toObjectIdOrNull(q.positionId);
    if (v === undefined) {
      return makeError(400, 'VALIDATION_ERROR', 'positionId is not a valid ObjectId', 'positionId');
    }
    if (v !== null) filters.positionId = v;
  }
  if (q.employmentStatus !== undefined && q.employmentStatus !== '') {
    if (!EMPLOYMENT_STATUSES.includes(q.employmentStatus)) {
      return makeError(
        400,
        'VALIDATION_ERROR',
        'employmentStatus must be one of: ' + EMPLOYMENT_STATUSES.join(', '),
        'employmentStatus',
      );
    }
    filters.employmentStatus = q.employmentStatus;
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

  // includeDeleted — admins only (enforced in service). Here we just
  // parse the boolean.
  let includeDeleted = false;
  if (q.includeDeleted !== undefined && q.includeDeleted !== '') {
    const v = String(q.includeDeleted).toLowerCase();
    if (!['true', 'false'].includes(v)) {
      return makeError(
        400,
        'VALIDATION_ERROR',
        'includeDeleted must be "true" or "false"',
        'includeDeleted',
      );
    }
    includeDeleted = v === 'true';
  }

  return {
    value: { page, limit, search, filters, sortBy, sortOrder, includeDeleted },
  };
}

/**
 * Validate the create payload.
 * Returns { value: { ...allowed fields, normalized... } } or { error }.
 */
export function validateCreatePayload(body) {
  if (!isPlainObject(body)) {
    return makeError(400, 'BAD_REQUEST', 'Request body must be an object');
  }

  // Reject unknown fields explicitly so clients learn the contract.
  for (const key of Object.keys(body)) {
    if (!CREATE_FIELDS.includes(key)) {
      return makeError(
        400,
        'VALIDATION_ERROR',
        `Field "${key}" is not allowed`,
        key,
      );
    }
  }

  const v = {};

  // employeeCode
  if (typeof body.employeeCode !== 'string' || body.employeeCode.trim().length === 0) {
    return makeError(400, 'VALIDATION_ERROR', 'employeeCode is required', 'employeeCode');
  }
  v.employeeCode = body.employeeCode.trim();

  // fullName
  if (typeof body.fullName !== 'string' || body.fullName.trim().length === 0) {
    return makeError(400, 'VALIDATION_ERROR', 'fullName is required', 'fullName');
  }
  v.fullName = body.fullName.trim();

  // email
  if (typeof body.email !== 'string' || body.email.trim().length === 0) {
    return makeError(400, 'VALIDATION_ERROR', 'email is required', 'email');
  }
  if (!EMAIL_RE.test(body.email.trim())) {
    return makeError(400, 'VALIDATION_ERROR', 'email is not valid', 'email');
  }
  v.email = body.email.trim().toLowerCase();

  // employmentType
  if (!EMPLOYMENT_TYPES.includes(body.employmentType)) {
    return makeError(
      400,
      'VALIDATION_ERROR',
      'employmentType must be one of: ' + EMPLOYMENT_TYPES.join(', '),
      'employmentType',
    );
  }
  v.employmentType = body.employmentType;

  // hireDate
  const hireDate = parseDateField(body.hireDate, 'hireDate');
  if (hireDate.error) return hireDate;
  if (!hireDate.value) {
    return makeError(400, 'VALIDATION_ERROR', 'hireDate is required', 'hireDate');
  }
  if (hireDate.value.getTime() > Date.now()) {
    return makeError(400, 'VALIDATION_ERROR', 'hireDate cannot be in the future', 'hireDate');
  }
  v.hireDate = hireDate.value;

  // userId (optional)
  if (body.userId !== undefined && body.userId !== null && body.userId !== '') {
    if (!isValidObjectIdString(body.userId)) {
      return makeError(400, 'VALIDATION_ERROR', 'userId is not a valid ObjectId', 'userId');
    }
    v.userId = body.userId;
  } else {
    v.userId = null;
  }

  // phone (optional)
  if (body.phone !== undefined && body.phone !== null && body.phone !== '') {
    if (typeof body.phone !== 'string') {
      return makeError(400, 'VALIDATION_ERROR', 'phone must be a string', 'phone');
    }
    if (!PHONE_RE.test(body.phone.trim())) {
      return makeError(400, 'VALIDATION_ERROR', 'phone is not valid', 'phone');
    }
    v.phone = body.phone.trim();
  } else {
    v.phone = '';
  }

  // avatar (optional URL string)
  if (body.avatar !== undefined && body.avatar !== null && body.avatar !== '') {
    if (typeof body.avatar !== 'string') {
      return makeError(400, 'VALIDATION_ERROR', 'avatar must be a string', 'avatar');
    }
    v.avatar = body.avatar;
  } else {
    v.avatar = null;
  }

  // gender
  if (body.gender !== undefined && body.gender !== null && body.gender !== '') {
    if (!GENDERS.includes(body.gender)) {
      return makeError(
        400,
        'VALIDATION_ERROR',
        'gender must be one of: ' + GENDERS.join(', '),
        'gender',
      );
    }
    v.gender = body.gender;
  } else {
    v.gender = undefined; // let schema default
  }

  // dateOfBirth
  if (body.dateOfBirth !== undefined && body.dateOfBirth !== null && body.dateOfBirth !== '') {
    const dob = parseDateField(body.dateOfBirth, 'dateOfBirth');
    if (dob.error) return dob;
    v.dateOfBirth = dob.value;
  } else {
    v.dateOfBirth = null;
  }

  // departmentId
  if (body.departmentId !== undefined && body.departmentId !== null && body.departmentId !== '') {
    if (!isValidObjectIdString(body.departmentId)) {
      return makeError(400, 'VALIDATION_ERROR', 'departmentId is not a valid ObjectId', 'departmentId');
    }
    v.departmentId = body.departmentId;
  } else {
    v.departmentId = null;
  }

  // positionId
  if (body.positionId !== undefined && body.positionId !== null && body.positionId !== '') {
    if (!isValidObjectIdString(body.positionId)) {
      return makeError(400, 'VALIDATION_ERROR', 'positionId is not a valid ObjectId', 'positionId');
    }
    v.positionId = body.positionId;
  } else {
    v.positionId = null;
  }

  // position (denormalized text)
  if (body.position !== undefined && body.position !== null && body.position !== '') {
    if (typeof body.position !== 'string') {
      return makeError(400, 'VALIDATION_ERROR', 'position must be a string', 'position');
    }
    v.position = body.position.trim();
  }

  // managerId
  if (body.managerId !== undefined && body.managerId !== null && body.managerId !== '') {
    if (!isValidObjectIdString(body.managerId)) {
      return makeError(400, 'VALIDATION_ERROR', 'managerId is not a valid ObjectId', 'managerId');
    }
    v.managerId = body.managerId;
  } else {
    v.managerId = null;
  }

  // address
  if (body.address !== undefined && body.address !== null && body.address !== '') {
    if (typeof body.address !== 'string') {
      return makeError(400, 'VALIDATION_ERROR', 'address must be a string', 'address');
    }
    v.address = body.address.trim();
  } else {
    v.address = '';
  }

  // employmentStatus
  if (body.employmentStatus !== undefined && body.employmentStatus !== null && body.employmentStatus !== '') {
    if (!EMPLOYMENT_STATUSES.includes(body.employmentStatus)) {
      return makeError(
        400,
        'VALIDATION_ERROR',
        'employmentStatus must be one of: ' + EMPLOYMENT_STATUSES.join(', '),
        'employmentStatus',
      );
    }
    v.employmentStatus = body.employmentStatus;
  } else {
    v.employmentStatus = undefined; // let schema default
  }

  return { value: v };
}

/**
 * Validate a partial update payload.
 * Returns { value: { ...allowed normalized fields } } or { error }.
 * At least one allowed field must be present.
 */
export function validateUpdatePayload(body) {
  if (!isPlainObject(body)) {
    return makeError(400, 'BAD_REQUEST', 'Request body must be an object');
  }

  // Reject unknown fields explicitly.
  for (const key of Object.keys(body)) {
    if (!UPDATE_FIELDS.includes(key)) {
      return makeError(
        400,
        'VALIDATION_ERROR',
        `Field "${key}" is not allowed`,
        key,
      );
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

  if (body.employeeCode !== undefined) {
    if (typeof body.employeeCode !== 'string' || body.employeeCode.trim().length === 0) {
      return makeError(400, 'VALIDATION_ERROR', 'employeeCode must be a non-empty string', 'employeeCode');
    }
    v.employeeCode = body.employeeCode.trim();
    assigned = true;
  }

  if (body.fullName !== undefined) {
    if (typeof body.fullName !== 'string' || body.fullName.trim().length === 0) {
      return makeError(400, 'VALIDATION_ERROR', 'fullName must be a non-empty string', 'fullName');
    }
    v.fullName = body.fullName.trim();
    assigned = true;
  }

  if (body.email !== undefined) {
    if (typeof body.email !== 'string' || !EMAIL_RE.test(body.email.trim())) {
      return makeError(400, 'VALIDATION_ERROR', 'email is not valid', 'email');
    }
    v.email = body.email.trim().toLowerCase();
    assigned = true;
  }

  if (body.userId !== undefined) {
    if (body.userId === null || body.userId === '') {
      v.userId = null;
    } else if (!isValidObjectIdString(body.userId)) {
      return makeError(400, 'VALIDATION_ERROR', 'userId is not a valid ObjectId', 'userId');
    } else {
      v.userId = body.userId;
    }
    assigned = true;
  }

  if (body.phone !== undefined) {
    if (body.phone === null || body.phone === '') {
      v.phone = '';
    } else if (typeof body.phone !== 'string' || !PHONE_RE.test(body.phone.trim())) {
      return makeError(400, 'VALIDATION_ERROR', 'phone is not valid', 'phone');
    } else {
      v.phone = body.phone.trim();
    }
    assigned = true;
  }

  if (body.avatar !== undefined) {
    if (body.avatar === null || body.avatar === '') {
      v.avatar = null;
    } else if (typeof body.avatar !== 'string') {
      return makeError(400, 'VALIDATION_ERROR', 'avatar must be a string', 'avatar');
    } else {
      v.avatar = body.avatar;
    }
    assigned = true;
  }

  if (body.gender !== undefined) {
    if (body.gender === null || body.gender === '') {
      v.gender = undefined; // schema-level unset isn't trivial; leave field alone
    } else if (!GENDERS.includes(body.gender)) {
      return makeError(
        400,
        'VALIDATION_ERROR',
        'gender must be one of: ' + GENDERS.join(', '),
        'gender',
      );
    } else {
      v.gender = body.gender;
    }
    assigned = true;
  }

  if (body.dateOfBirth !== undefined) {
    if (body.dateOfBirth === null || body.dateOfBirth === '') {
      v.dateOfBirth = null;
    } else {
      const dob = parseDateField(body.dateOfBirth, 'dateOfBirth');
      if (dob.error) return dob;
      v.dateOfBirth = dob.value;
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

  if (body.positionId !== undefined) {
    if (body.positionId === null || body.positionId === '') {
      v.positionId = null;
    } else if (!isValidObjectIdString(body.positionId)) {
      return makeError(400, 'VALIDATION_ERROR', 'positionId is not a valid ObjectId', 'positionId');
    } else {
      v.positionId = body.positionId;
    }
    assigned = true;
  }

  if (body.position !== undefined) {
    if (body.position === null || body.position === '') {
      v.position = '';
    } else if (typeof body.position !== 'string') {
      return makeError(400, 'VALIDATION_ERROR', 'position must be a string', 'position');
    } else {
      v.position = body.position.trim();
    }
    assigned = true;
  }

  if (body.employmentType !== undefined) {
    if (!EMPLOYMENT_TYPES.includes(body.employmentType)) {
      return makeError(
        400,
        'VALIDATION_ERROR',
        'employmentType must be one of: ' + EMPLOYMENT_TYPES.join(', '),
        'employmentType',
      );
    }
    v.employmentType = body.employmentType;
    assigned = true;
  }

  if (body.hireDate !== undefined) {
    const hd = parseDateField(body.hireDate, 'hireDate');
    if (hd.error) return hd;
    if (!hd.value) {
      return makeError(400, 'VALIDATION_ERROR', 'hireDate is required', 'hireDate');
    }
    if (hd.value.getTime() > Date.now()) {
      return makeError(400, 'VALIDATION_ERROR', 'hireDate cannot be in the future', 'hireDate');
    }
    v.hireDate = hd.value;
    assigned = true;
  }

  if (body.managerId !== undefined) {
    if (body.managerId === null || body.managerId === '') {
      v.managerId = null;
    } else if (!isValidObjectIdString(body.managerId)) {
      return makeError(400, 'VALIDATION_ERROR', 'managerId is not a valid ObjectId', 'managerId');
    } else {
      v.managerId = body.managerId;
    }
    assigned = true;
  }

  if (body.address !== undefined) {
    if (body.address === null || body.address === '') {
      v.address = '';
    } else if (typeof body.address !== 'string') {
      return makeError(400, 'VALIDATION_ERROR', 'address must be a string', 'address');
    } else {
      v.address = body.address.trim();
    }
    assigned = true;
  }

  if (body.employmentStatus !== undefined) {
    if (body.employmentStatus === null || body.employmentStatus === '') {
      v.employmentStatus = undefined;
    } else if (!EMPLOYMENT_STATUSES.includes(body.employmentStatus)) {
      return makeError(
        400,
        'VALIDATION_ERROR',
        'employmentStatus must be one of: ' + EMPLOYMENT_STATUSES.join(', '),
        'employmentStatus',
      );
    } else {
      v.employmentStatus = body.employmentStatus;
    }
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
 * Validate an :id path parameter. Returns { id } or { error }.
 */
export function validateIdParam(rawId) {
  if (typeof rawId !== 'string' || !isValidObjectIdString(rawId)) {
    return makeError(400, 'VALIDATION_ERROR', 'Invalid id: must be a valid ObjectId');
  }
  return { id: rawId };
}

function parseDateField(raw, fieldName) {
  if (raw === null || raw === undefined || raw === '') {
    return { value: null };
  }
  const d = new Date(raw);
  if (Number.isNaN(d.getTime())) {
    return makeError(400, 'VALIDATION_ERROR', `${fieldName} is not a valid date`, fieldName);
  }
  return { value: d };
}

// Internal helper exposed for tests.
export const _internal = {
  isPlainObject,
  isValidObjectIdString,
  pickAllowed,
  CREATE_FIELDS,
  UPDATE_FIELDS,
  SORTABLE_FIELDS,
};
