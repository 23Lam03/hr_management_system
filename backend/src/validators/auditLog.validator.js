// Validator cho Audit Log API (Phase 10 + Phase 15).
// Pure functions, return { error } hoặc { value }.

import mongoose from 'mongoose';
import {
  AUDIT_ACTIONS,
  AUDIT_RESOURCE_TYPES,
  AUDIT_STATUSES,
} from '../models/auditLog.model.js';

const { Types } = mongoose;

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const MAX_DATE_RANGE_DAYS = 366;
const MAX_LIMIT = 100;
const ALLOWED_SORT_FIELDS = ['createdAt', 'action', 'resourceType', 'actorRole'];

function toError(code, message, field, value, status = 400) {
  return { status, code, message, field, value };
}

function parseDateString(value, fieldName) {
  if (typeof value !== 'string' || !DATE_RE.test(value)) {
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
      error: toError('VALIDATION_ERROR', `${fieldName} is not a valid date`, fieldName, value),
    };
  }
  return { value: dt };
}

function validateObjectId(value, fieldName) {
  if (value === undefined || value === null || value === '') {
    return { value: undefined };
  }
  if (typeof value !== 'string' || !Types.ObjectId.isValid(value)) {
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

function validateEnum(value, allowed, fieldName) {
  if (value === undefined || value === null || value === '') {
    return { value: undefined };
  }
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

function validateSort(value) {
  if (value === undefined || value === null || value === '') {
    return { value: '-createdAt' };
  }
  if (typeof value !== 'string') {
    return {
      error: toError('VALIDATION_ERROR', 'sort must be a string', 'sort', value),
    };
  }
  const field = value.replace(/^[-+]/, '');
  if (!ALLOWED_SORT_FIELDS.includes(field)) {
    return {
      error: toError(
        'VALIDATION_ERROR',
        `sort must be one of: ${ALLOWED_SORT_FIELDS.map((f) => '+' + f).join(', ')} or '-' + f`,
        'sort',
        value,
      ),
    };
  }
  return { value };
}

export function validateListQuery(query = {}) {
  const out = { filters: {} };

  if (query.actorUserId !== undefined) {
    const r = validateObjectId(query.actorUserId, 'actorUserId');
    if (r.error) return r;
    if (r.value) out.filters.actorUserId = r.value;
  }

  if (query.action !== undefined) {
    const r = validateEnum(query.action, AUDIT_ACTIONS, 'action');
    if (r.error) return r;
    if (r.value) out.filters.action = r.value;
  }

  if (query.status !== undefined && query.status !== '') {
    // Phase 15: allow filtering by status (success | failure). Useful
    // for security monitoring dashboards.
    const r = validateEnum(query.status, AUDIT_STATUSES, 'status');
    if (r.error) return r;
    if (r.value) out.filters.status = r.value;
  }

  if (query.resourceType !== undefined) {
    const r = validateEnum(query.resourceType, AUDIT_RESOURCE_TYPES, 'resourceType');
    if (r.error) return r;
    if (r.value) out.filters.resourceType = r.value;
  }

  if (query.resourceId !== undefined) {
    const r = validateObjectId(query.resourceId, 'resourceId');
    if (r.error) return r;
    if (r.value) out.filters.resourceId = r.value;
  }

  if (query.startDate !== undefined && query.startDate !== '') {
    const r = parseDateString(query.startDate, 'startDate');
    if (r.error) return r;
    out.filters.startDate = r.value;
  }

  if (query.endDate !== undefined && query.endDate !== '') {
    const r = parseDateString(query.endDate, 'endDate');
    if (r.error) return r;
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
        'startDate',
      ),
    };
  }

  if (out.filters.startDate && out.filters.endDate) {
    const dayMs = 24 * 60 * 60 * 1000;
    const days =
      Math.floor(
        (out.filters.endDate.getTime() - out.filters.startDate.getTime()) / dayMs,
      ) + 1;
    if (days > MAX_DATE_RANGE_DAYS) {
      return {
        error: toError(
          'VALIDATION_ERROR',
          `Date range must be at most ${MAX_DATE_RANGE_DAYS} days`,
          'endDate',
        ),
      };
    }
  }

  const page = validatePositiveInt(query.page, 'page', {
    defaultValue: 1,
    min: 1,
    max: 1_000_000,
  });
  if (page.error) return page;
  out.page = page.value;

  // Service sẽ cap limit về 100; validator chỉ check kiểu integer.
  const limit = validatePositiveInt(query.limit, 'limit', {
    defaultValue: 20,
    min: 1,
    max: 1_000_000,
  });
  if (limit.error) return limit;
  out.limit = limit.value;

  const sort = validateSort(query.sort);
  if (sort.error) return sort;
  out.sort = sort.value;

  return { value: out };
}
