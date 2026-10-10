// Leave request validators — pure functions, không throw raw Error ngoài
// dạng chuẩn `{ code, message, field?, value? }`.
//
// Quy ước: nếu validation fail trả object error, controller sẽ chuyển
// sang AppError. Nếu pass trả `{ ok: true, value: <normalized> }`.

import mongoose from 'mongoose';
import { LEAVE_TYPES, LEAVE_STATUSES } from '../models/leaveRequest.model.js';

const ALLOWED_SORT_FIELDS = Object.freeze([
  'createdAt',
  'updatedAt',
  'startDate',
  'endDate',
  'leaveType',
  'status',
]);

const ISO_DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

function toError(code, message, field, value, status = 400) {
  return { status, code, message, field, value };
}

// Parse `YYYY-MM-DD` thành UTC midnight Date. Trả lỗi nếu không hợp lệ.
// Giống pattern Phase 6: tránh lệch ngày do UTC/local timezone.
export function parseDateString(value, fieldName) {
  if (typeof value !== 'string' || !ISO_DATE_RE.test(value)) {
    return {
      error: toError(
        'VALIDATION_ERROR',
        `${fieldName} must be a valid date in YYYY-MM-DD format`,
        fieldName,
        value,
      ),
    };
  }
  const [y, m, d] = value.split('-').map((s) => Number(s));
  const dt = new Date(Date.UTC(y, m - 1, d));
  if (
    Number.isNaN(dt.getTime()) ||
    dt.getUTCFullYear() !== y ||
    dt.getUTCMonth() !== m - 1 ||
    dt.getUTCDate() !== d
  ) {
    return {
      error: toError(
        'VALIDATION_ERROR',
        `${fieldName} is not a valid date`,
        fieldName,
        value,
      ),
    };
  }
  return { value: dt };
}

export function validateIdParam(id) {
  if (typeof id !== 'string' || !mongoose.Types.ObjectId.isValid(id)) {
    return { error: toError('VALIDATION_ERROR', 'id is not a valid ObjectId', 'id', id) };
  }
  return { value: id };
}

function validateEnum(value, allowed, fieldName) {
  if (typeof value !== 'string' || !allowed.includes(value)) {
    return {
      error: toError(
        'VALIDATION_ERROR',
        `${fieldName} must be one of: ${allowed.join(', ')}`,
        fieldName,
        value,
      ),
    };
  }
  return { value };
}

function validateString(value, fieldName, { min, max, required }) {
  if (value === undefined || value === null) {
    if (required) {
      return { error: toError('VALIDATION_ERROR', `${fieldName} is required`, fieldName) };
    }
    return { value: undefined };
  }
  if (typeof value !== 'string') {
    return { error: toError('VALIDATION_ERROR', `${fieldName} must be a string`, fieldName) };
  }
  const trimmed = value.trim();
  if (required && trimmed.length === 0) {
    return { error: toError('VALIDATION_ERROR', `${fieldName} cannot be empty`, fieldName) };
  }
  if (min != null && trimmed.length < min) {
    return {
      error: toError(
        'VALIDATION_ERROR',
        `${fieldName} must be at least ${min} characters`,
        fieldName,
      ),
    };
  }
  if (max != null && trimmed.length > max) {
    return {
      error: toError(
        'VALIDATION_ERROR',
        `${fieldName} must be at most ${max} characters`,
        fieldName,
      ),
    };
  }
  return { value: trimmed };
}

function validatePositiveInt(value, fieldName, { defaultValue, min, max }) {
  if (value === undefined || value === null || value === '') {
    return { value: defaultValue };
  }
  const n = Number(value);
  if (!Number.isInteger(n) || n < min || n > max) {
    return {
      error: toError(
        'VALIDATION_ERROR',
        `${fieldName} must be an integer between ${min} and ${max}`,
        fieldName,
        value,
      ),
    };
  }
  return { value: n };
}

function validateSortField(value) {
  if (value === undefined || value === null || value === '') {
    return { value: '-createdAt' };
  }
  if (typeof value !== 'string' || !ALLOWED_SORT_FIELDS.includes(value.replace(/^-/, ''))) {
    return {
      error: toError(
        'VALIDATION_ERROR',
        `sort must be one of: ${ALLOWED_SORT_FIELDS.map((f) => '+' + f).join(', ')} or '-' + f`,
        'sort',
        value,
      ),
    };
  }
  return { value: value };
}

function validateOptionalObjectId(value, fieldName) {
  if (value === undefined || value === null || value === '') {
    return { value: undefined };
  }
  if (typeof value !== 'string' || !mongoose.Types.ObjectId.isValid(value)) {
    return {
      error: toError(
        'VALIDATION_ERROR',
        `${fieldName} is not a valid ObjectId`,
        fieldName,
        value,
      ),
    };
  }
  return { value };
}

// Validate list query (dùng cho GET /api/leave-requests và GET /me).
export function validateListQuery(query = {}) {
  const out = { filters: {} };

  if (query.status !== undefined) {
    const r = validateEnum(query.status, LEAVE_STATUSES, 'status');
    if (r.error) return { error: r.error };
    out.filters.status = r.value;
  }

  if (query.leaveType !== undefined) {
    const r = validateEnum(query.leaveType, LEAVE_TYPES, 'leaveType');
    if (r.error) return { error: r.error };
    out.filters.leaveType = r.value;
  }

  if (query.employeeId !== undefined) {
    const r = validateOptionalObjectId(query.employeeId, 'employeeId');
    if (r.error) return { error: r.error };
    if (r.value) out.filters.employeeId = r.value;
  }

  if (query.startDate !== undefined) {
    const r = parseDateString(query.startDate, 'startDate');
    if (r.error) return { error: r.error };
    out.filters.startDate = r.value;
  }

  if (query.endDate !== undefined) {
    const r = parseDateString(query.endDate, 'endDate');
    if (r.error) return { error: r.error };
    out.filters.endDate = r.value;
  }

  if (
    out.filters.startDate &&
    out.filters.endDate &&
    out.filters.startDate.getTime() > out.filters.endDate.getTime()
  ) {
    return {
      error: toError(
        'VALIDATION_ERROR',
        'startDate must be less than or equal to endDate',
        'endDate',
      ),
    };
  }

  const page = validatePositiveInt(query.page, 'page', { defaultValue: 1, min: 1, max: 1000000 });
  if (page.error) return { error: page.error };
  out.page = page.value;

  const limit = validatePositiveInt(query.limit, 'limit', { defaultValue: 20, min: 1, max: 100 });
  if (limit.error) return { error: limit.error };
  out.limit = limit.value;

  const sort = validateSortField(query.sort);
  if (sort.error) return { error: sort.error };
  out.sort = sort.value;

  return { value: out };
}

// Validate create payload (POST /api/leave-requests).
// `employeeId` là tùy chọn: nếu thiếu, service sẽ lấy từ req.user's linked Employee.
// Nếu là Admin tạo thay, `employeeId` bắt buộc.
export function validateCreatePayload(body = {}, { adminCreate = false } = {}) {
  if (body === null || typeof body !== 'object' || Array.isArray(body)) {
    return { error: toError('VALIDATION_ERROR', 'Body must be a JSON object', 'body') };
  }

  // Từ chối các trường hệ thống / trường bị client can thiệp.
  for (const f of ['status', 'reviewedBy', 'reviewedAt', 'createdAt', 'updatedAt', 'reviewNote']) {
    if (Object.prototype.hasOwnProperty.call(body, f)) {
      return {
        error: toError(
          'VALIDATION_ERROR',
          `Field "${f}" is not allowed when creating a leave request`,
          f,
        ),
      };
    }
  }

  const out = {};

  // employeeId: bắt buộc nếu adminCreate, ngược lại optional.
  if (body.employeeId !== undefined) {
    const r = validateOptionalObjectId(body.employeeId, 'employeeId');
    if (r.error) return { error: r.error };
    out.employeeId = r.value;
  }
  if (adminCreate && !out.employeeId) {
    return {
      error: toError(
        'VALIDATION_ERROR',
        'employeeId is required when admin creates a request on behalf of an employee',
        'employeeId',
      ),
    };
  }

  const lt = validateEnum(body.leaveType, LEAVE_TYPES, 'leaveType');
  if (lt.error) return { error: lt.error };
  out.leaveType = lt.value;

  const sd = parseDateString(body.startDate, 'startDate');
  if (sd.error) return { error: sd.error };
  out.startDate = sd.value;

  const ed = parseDateString(body.endDate, 'endDate');
  if (ed.error) return { error: ed.error };
  out.endDate = ed.value;

  if (out.startDate.getTime() > out.endDate.getTime()) {
    return {
      error: toError(
        'VALIDATION_ERROR',
        'endDate must be greater than or equal to startDate',
        'endDate',
      ),
    };
  }

  const re = validateString(body.reason, 'reason', { min: 3, max: 500, required: true });
  if (re.error) return { error: re.error };
  out.reason = re.value;

  return { value: out };
}

// Validate update payload (PATCH /api/leave-requests/:id by Employee).
// Chỉ cho phép: leaveType, startDate, endDate, reason. Mọi trường khác từ chối.
export function validateUpdatePayload(body = {}) {
  if (body === null || typeof body !== 'object' || Array.isArray(body)) {
    return { error: toError('VALIDATION_ERROR', 'Body must be a JSON object', 'body') };
  }

  const forbidden = [
    'employeeId',
    'status',
    'reviewedBy',
    'reviewedAt',
    'reviewNote',
    'createdAt',
    'updatedAt',
    'id',
    '_id',
  ];
  for (const f of forbidden) {
    if (Object.prototype.hasOwnProperty.call(body, f)) {
      return {
        error: toError(
          'VALIDATION_ERROR',
          `Field "${f}" is not allowed when updating a leave request`,
          f,
        ),
      };
    }
  }

  const allowed = ['leaveType', 'startDate', 'endDate', 'reason'];
  const present = allowed.filter((f) => body[f] !== undefined);
  if (present.length === 0) {
    return {
      error: toError(
        'VALIDATION_ERROR',
        'At least one of leaveType, startDate, endDate, reason must be provided',
        'body',
      ),
    };
  }

  const out = {};

  if (body.leaveType !== undefined) {
    const r = validateEnum(body.leaveType, LEAVE_TYPES, 'leaveType');
    if (r.error) return { error: r.error };
    out.leaveType = r.value;
  }

  if (body.startDate !== undefined) {
    const r = parseDateString(body.startDate, 'startDate');
    if (r.error) return { error: r.error };
    out.startDate = r.value;
  }

  if (body.endDate !== undefined) {
    const r = parseDateString(body.endDate, 'endDate');
    if (r.error) return { error: r.error };
    out.endDate = r.value;
  }

  if (
    out.startDate &&
    out.endDate &&
    out.startDate.getTime() > out.endDate.getTime()
  ) {
    return {
      error: toError(
        'VALIDATION_ERROR',
        'endDate must be greater than or equal to startDate',
        'endDate',
      ),
    };
  }

  if (body.reason !== undefined) {
    const r = validateString(body.reason, 'reason', { min: 3, max: 500, required: true });
    if (r.error) return { error: r.error };
    out.reason = r.value;
  }

  return { value: out };
}

// Validate review payload (approve/reject). Chỉ cho phép reviewNote.
export function validateReviewPayload(body = {}) {
  if (body === null || typeof body !== 'object' || Array.isArray(body)) {
    return { error: toError('VALIDATION_ERROR', 'Body must be a JSON object', 'body') };
  }

  const forbidden = [
    'employeeId',
    'status',
    'reviewedBy',
    'reviewedAt',
    'createdAt',
    'updatedAt',
    'leaveType',
    'startDate',
    'endDate',
    'reason',
    'id',
    '_id',
  ];
  for (const f of forbidden) {
    if (Object.prototype.hasOwnProperty.call(body, f)) {
      return {
        error: toError(
          'VALIDATION_ERROR',
          `Field "${f}" is not allowed in a review request`,
          f,
        ),
      };
    }
  }

  const out = {};
  if (body.reviewNote !== undefined) {
    const r = validateString(body.reviewNote, 'reviewNote', {
      min: 0,
      max: 500,
      required: false,
    });
    if (r.error) return { error: r.error };
    out.reviewNote = r.value;
  }
  return { value: out };
}
