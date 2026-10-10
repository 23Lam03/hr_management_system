// Payroll validators — pure functions, không throw raw Error.
// Trả về `{ error: { status, code, message, field?, value? } }` hoặc
// `{ value: <normalized> }`.

import mongoose from 'mongoose';
import { PAYROLL_STATUSES } from '../models/payroll.model.js';

const { Types } = mongoose;

const ALLOWED_SORT_FIELDS = Object.freeze([
  'createdAt',
  'updatedAt',
  'periodMonth',
  'periodYear',
  'status',
  'grossSalary',
  'netSalary',
]);

const MONEY_MIN = 0;
const MONEY_MAX = 1e15;
const WORKED_DAYS_MAX = 31;
const PERIOD_MONTH_MIN = 1;
const PERIOD_MONTH_MAX = 12;
const PERIOD_YEAR_MIN = 2000;
const PERIOD_YEAR_MAX = 2100;

function toError(code, message, field, value, status = 400) {
  return { status, code, message, field, value };
}

function validateOptionalObjectId(value, fieldName) {
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

function validateIdParam(id) {
  if (typeof id !== 'string' || !Types.ObjectId.isValid(id)) {
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

function validateMoney(value, fieldName, { required = true, defaultValue = 0 } = {}) {
  if (value === undefined || value === null) {
    if (required) {
      return { error: toError('VALIDATION_ERROR', `${fieldName} is required`, fieldName) };
    }
    return { value: defaultValue };
  }
  const n = Number(value);
  if (!Number.isFinite(n)) {
    return {
      error: toError(
        'VALIDATION_ERROR',
        `${fieldName} must be a finite number`,
        fieldName,
        value,
      ),
    };
  }
  if (n < MONEY_MIN) {
    return {
      error: toError('VALIDATION_ERROR', `${fieldName} must be at least 0`, fieldName, value),
    };
  }
  if (n > MONEY_MAX) {
    return {
      error: toError(
        'VALIDATION_ERROR',
        `${fieldName} must be at most ${MONEY_MAX}`,
        fieldName,
        value,
      ),
    };
  }
  return { value: n };
}

function validateIntRange(value, fieldName, { min, max, required = true, defaultValue }) {
  if (value === undefined || value === null || value === '') {
    if (required) {
      return { error: toError('VALIDATION_ERROR', `${fieldName} is required`, fieldName) };
    }
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

function validateOptionalIntRange(value, fieldName, { min, max }) {
  if (value === undefined || value === null || value === '') {
    return { value: null };
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

// Validate list query (admin list & /me).
export function validateListQuery(query = {}) {
  const out = { filters: {} };

  if (query.status !== undefined) {
    const r = validateEnum(query.status, PAYROLL_STATUSES, 'status');
    if (r.error) return { error: r.error };
    out.filters.status = r.value;
  }

  if (query.employeeId !== undefined) {
    const r = validateOptionalObjectId(query.employeeId, 'employeeId');
    if (r.error) return { error: r.error };
    if (r.value) out.filters.employeeId = r.value;
  }

  if (query.periodMonth !== undefined) {
    const r = validateIntRange(query.periodMonth, 'periodMonth', {
      min: PERIOD_MONTH_MIN,
      max: PERIOD_MONTH_MAX,
      required: true,
    });
    if (r.error) return { error: r.error };
    out.filters.periodMonth = r.value;
  }

  if (query.periodYear !== undefined) {
    const r = validateIntRange(query.periodYear, 'periodYear', {
      min: PERIOD_YEAR_MIN,
      max: PERIOD_YEAR_MAX,
      required: true,
    });
    if (r.error) return { error: r.error };
    out.filters.periodYear = r.value;
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

// Validate create payload. Reject tất cả field hệ thống / field do
// service tính (grossSalary, netSalary) và field audit (createdBy...).
export function validateCreatePayload(body = {}) {
  if (body === null || typeof body !== 'object' || Array.isArray(body)) {
    return { error: toError('VALIDATION_ERROR', 'Body must be a JSON object', 'body') };
  }

  const forbidden = [
    'grossSalary',
    'netSalary',
    'status',
    'createdBy',
    'updatedBy',
    'approvedBy',
    'approvedAt',
    'paidBy',
    'paidAt',
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
          `Field "${f}" is not allowed when creating a payroll record`,
          f,
        ),
      };
    }
  }

  const out = {};

  if (body.employeeId !== undefined) {
    const r = validateOptionalObjectId(body.employeeId, 'employeeId');
    if (r.error) return { error: r.error };
    out.employeeId = r.value;
  }
  if (!out.employeeId) {
    return {
      error: toError('VALIDATION_ERROR', 'employeeId is required', 'employeeId'),
    };
  }

  const pm = validateIntRange(body.periodMonth, 'periodMonth', {
    min: PERIOD_MONTH_MIN,
    max: PERIOD_MONTH_MAX,
    required: true,
  });
  if (pm.error) return { error: pm.error };
  out.periodMonth = pm.value;

  const py = validateIntRange(body.periodYear, 'periodYear', {
    min: PERIOD_YEAR_MIN,
    max: PERIOD_YEAR_MAX,
    required: true,
  });
  if (py.error) return { error: py.error };
  out.periodYear = py.value;

  const bs = validateMoney(body.baseSalary, 'baseSalary', { required: true });
  if (bs.error) return { error: bs.error };
  out.baseSalary = bs.value;

  const al = validateMoney(body.allowances, 'allowances', { required: false, defaultValue: 0 });
  if (al.error) return { error: al.error };
  out.allowances = al.value;

  const bo = validateMoney(body.bonuses, 'bonuses', { required: false, defaultValue: 0 });
  if (bo.error) return { error: bo.error };
  out.bonuses = bo.value;

  const de = validateMoney(body.deductions, 'deductions', { required: false, defaultValue: 0 });
  if (de.error) return { error: de.error };
  out.deductions = de.value;

  if (body.workedDays !== undefined) {
    const r = validateOptionalIntRange(body.workedDays, 'workedDays', {
      min: 0,
      max: WORKED_DAYS_MAX,
    });
    if (r.error) return { error: r.error };
    out.workedDays = r.value;
  }

  if (body.standardWorkDays !== undefined) {
    const r = validateOptionalIntRange(body.standardWorkDays, 'standardWorkDays', {
      min: 0,
      max: WORKED_DAYS_MAX,
    });
    if (r.error) return { error: r.error };
    out.standardWorkDays = r.value;
  }

  if (body.note !== undefined) {
    const r = validateString(body.note, 'note', { min: 0, max: 500, required: false });
    if (r.error) return { error: r.error };
    out.note = r.value;
  }

  return { value: out };
}

// Validate update payload. Chỉ cho phép thay đổi các field nghiệp vụ
// (KHÔNG gồm employeeId, periodMonth, periodYear, status, audit fields).
export function validateUpdatePayload(body = {}) {
  if (body === null || typeof body !== 'object' || Array.isArray(body)) {
    return { error: toError('VALIDATION_ERROR', 'Body must be a JSON object', 'body') };
  }

  const forbidden = [
    'employeeId',
    'periodMonth',
    'periodYear',
    'grossSalary',
    'netSalary',
    'status',
    'createdBy',
    'updatedBy',
    'approvedBy',
    'approvedAt',
    'paidBy',
    'paidAt',
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
          `Field "${f}" is not allowed when updating a payroll record`,
          f,
        ),
      };
    }
  }

  const allowed = [
    'baseSalary',
    'allowances',
    'bonuses',
    'deductions',
    'workedDays',
    'standardWorkDays',
    'note',
  ];
  const present = allowed.filter((f) => body[f] !== undefined);
  if (present.length === 0) {
    return {
      error: toError(
        'VALIDATION_ERROR',
        'At least one of baseSalary, allowances, bonuses, deductions, workedDays, standardWorkDays, note must be provided',
        'body',
      ),
    };
  }

  const out = {};

  if (body.baseSalary !== undefined) {
    const r = validateMoney(body.baseSalary, 'baseSalary', { required: true });
    if (r.error) return { error: r.error };
    out.baseSalary = r.value;
  }
  if (body.allowances !== undefined) {
    const r = validateMoney(body.allowances, 'allowances', { required: true });
    if (r.error) return { error: r.error };
    out.allowances = r.value;
  }
  if (body.bonuses !== undefined) {
    const r = validateMoney(body.bonuses, 'bonuses', { required: true });
    if (r.error) return { error: r.error };
    out.bonuses = r.value;
  }
  if (body.deductions !== undefined) {
    const r = validateMoney(body.deductions, 'deductions', { required: true });
    if (r.error) return { error: r.error };
    out.deductions = r.value;
  }
  if (body.workedDays !== undefined) {
    const r = validateOptionalIntRange(body.workedDays, 'workedDays', {
      min: 0,
      max: WORKED_DAYS_MAX,
    });
    if (r.error) return { error: r.error };
    out.workedDays = r.value;
  }
  if (body.standardWorkDays !== undefined) {
    const r = validateOptionalIntRange(body.standardWorkDays, 'standardWorkDays', {
      min: 0,
      max: WORKED_DAYS_MAX,
    });
    if (r.error) return { error: r.error };
    out.standardWorkDays = r.value;
  }
  if (body.note !== undefined) {
    const r = validateString(body.note, 'note', { min: 0, max: 500, required: false });
    if (r.error) return { error: r.error };
    out.note = r.value;
  }

  return { value: out };
}
