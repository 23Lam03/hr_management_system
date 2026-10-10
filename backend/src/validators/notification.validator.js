// Validator cho Notification API — Phase 11.

import mongoose from 'mongoose';
import { NOTIFICATION_TYPES } from '../models/notification.model.js';

const { Types } = mongoose;
const MAX_LIMIT = 100;
const ALLOWED_SORT_FIELDS = ['createdAt', 'isRead', 'type'];

function toError(code, message, field, value, status = 400) {
  return { status, code, message, field, value };
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

function validateBoolean(value, fieldName) {
  if (value === undefined || value === null || value === '') {
    return { value: undefined };
  }
  if (typeof value === 'boolean') return { value };
  if (value === 'true') return { value: true };
  if (value === 'false') return { value: false };
  return {
    error: toError(
      'VALIDATION_ERROR',
      `${fieldName} must be a boolean`,
      fieldName,
      value,
    ),
  };
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
        `sort must be one of: ${ALLOWED_SORT_FIELDS.map((f) => '-' + f).join(', ')}`,
        'sort',
        value,
      ),
    };
  }
  return { value };
}

export function validateIdParam(id) {
  if (typeof id !== 'string' || !Types.ObjectId.isValid(id)) {
    return {
      error: toError('VALIDATION_ERROR', 'id is not a valid ObjectId', 'id', id),
    };
  }
  return { value: id };
}

export function validateListQuery(query = {}) {
  const out = { filters: {} };

  if (query.isRead !== undefined) {
    const r = validateBoolean(query.isRead, 'isRead');
    if (r.error) return r;
    if (typeof r.value === 'boolean') out.filters.isRead = r.value;
  }

  if (query.type !== undefined) {
    const r = validateEnum(query.type, NOTIFICATION_TYPES, 'type');
    if (r.error) return r;
    if (r.value) out.filters.type = r.value;
  }

  const page = validatePositiveInt(query.page, 'page', {
    defaultValue: 1,
    min: 1,
    max: 1_000_000,
  });
  if (page.error) return page;
  out.page = page.value;

  // Service sẽ cap limit về 100.
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
