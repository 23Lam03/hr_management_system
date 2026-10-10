// Unit tests for the Employee validator (no DB, no HTTP).

import { describe, it } from 'node:test';
import { strict as assert } from 'node:assert';

import {
  validateListQuery,
  validateCreatePayload,
  validateUpdatePayload,
  validateIdParam,
} from '../src/validators/employee.validator.js';

describe('Employee validator', () => {
  describe('validateListQuery', () => {
    it('returns defaults for empty query', () => {
      const v = validateListQuery({});
      assert.equal(v.error, undefined);
      assert.equal(v.value.page, 1);
      assert.equal(v.value.limit, 10);
      assert.equal(v.value.search, '');
      assert.deepEqual(v.value.filters, {});
      assert.equal(v.value.sortBy, 'createdAt');
      assert.equal(v.value.sortOrder, 'desc');
      assert.equal(v.value.includeDeleted, false);
    });

    it('rejects limit > 100', () => {
      const v = validateListQuery({ limit: '500' });
      assert.equal(v.error.status, 400);
      assert.equal(v.error.field, 'limit');
    });

    it('rejects sortBy outside allowlist', () => {
      const v = validateListQuery({ sortBy: 'passwordHash' });
      assert.equal(v.error.status, 400);
      assert.equal(v.error.field, 'sortBy');
    });

    it('rejects sortOrder outside asc/desc', () => {
      const v = validateListQuery({ sortOrder: 'sideways' });
      assert.equal(v.error.status, 400);
    });

    it('rejects invalid ObjectId in departmentId', () => {
      const v = validateListQuery({ departmentId: 'not-an-id' });
      assert.equal(v.error.status, 400);
      assert.equal(v.error.field, 'departmentId');
    });

    it('rejects invalid employmentStatus enum', () => {
      const v = validateListQuery({ employmentStatus: 'terminated' });
      assert.equal(v.error.status, 400);
    });

    it('accepts valid query', () => {
      const v = validateListQuery({
        page: '2',
        limit: '20',
        search: 'alice',
        sortBy: 'fullName',
        sortOrder: 'asc',
        employmentStatus: 'active',
      });
      assert.equal(v.error, undefined);
      assert.equal(v.value.page, 2);
      assert.equal(v.value.limit, 20);
      assert.equal(v.value.search, 'alice');
      assert.equal(v.value.sortBy, 'fullName');
      assert.equal(v.value.sortOrder, 'asc');
      assert.equal(v.value.filters.employmentStatus, 'active');
    });
  });

  describe('validateCreatePayload', () => {
    it('requires employeeCode, fullName, email, employmentType, hireDate', () => {
      const v = validateCreatePayload({});
      assert.equal(v.error.status, 400);
    });

    it('rejects unknown fields', () => {
      const v = validateCreatePayload({
        employeeCode: 'NV0001',
        fullName: 'Alice',
        email: 'a@example.com',
        employmentType: 'full_time',
        hireDate: '2024-01-01',
        passwordHash: 'evil',
      });
      assert.equal(v.error.status, 400);
      assert.equal(v.error.field, 'passwordHash');
    });

    it('rejects malformed email', () => {
      const v = validateCreatePayload({
        employeeCode: 'NV0001',
        fullName: 'Alice',
        email: 'not-an-email',
        employmentType: 'full_time',
        hireDate: '2024-01-01',
      });
      assert.equal(v.error.status, 400);
      assert.equal(v.error.field, 'email');
    });

    it('rejects future hireDate', () => {
      const future = new Date(Date.now() + 1000 * 60 * 60 * 24 * 365).toISOString();
      const v = validateCreatePayload({
        employeeCode: 'NV0001',
        fullName: 'Alice',
        email: 'a@example.com',
        employmentType: 'full_time',
        hireDate: future,
      });
      assert.equal(v.error.status, 400);
      assert.equal(v.error.field, 'hireDate');
    });

    it('rejects unknown employmentType', () => {
      const v = validateCreatePayload({
        employeeCode: 'NV0001',
        fullName: 'Alice',
        email: 'a@example.com',
        employmentType: 'freelance',
        hireDate: '2024-01-01',
      });
      assert.equal(v.error.status, 400);
    });

    it('normalizes email to lowercase', () => {
      const v = validateCreatePayload({
        employeeCode: 'NV0001',
        fullName: 'Alice',
        email: '  Alice@Example.COM  ',
        employmentType: 'full_time',
        hireDate: '2024-01-01',
      });
      assert.equal(v.error, undefined);
      assert.equal(v.value.email, 'alice@example.com');
    });

    it('rejects invalid ObjectId for departmentId', () => {
      const v = validateCreatePayload({
        employeeCode: 'NV0001',
        fullName: 'Alice',
        email: 'a@example.com',
        employmentType: 'full_time',
        hireDate: '2024-01-01',
        departmentId: 'not-an-id',
      });
      assert.equal(v.error.status, 400);
      assert.equal(v.error.field, 'departmentId');
    });
  });

  describe('validateUpdatePayload', () => {
    it('rejects empty body', () => {
      const v = validateUpdatePayload({});
      assert.equal(v.error.status, 400);
    });

    it('rejects unknown fields', () => {
      const v = validateUpdatePayload({ role: 'admin' });
      assert.equal(v.error.status, 400);
      assert.equal(v.error.field, 'role');
    });

    it('accepts a partial update', () => {
      const v = validateUpdatePayload({ fullName: 'New Name' });
      assert.equal(v.error, undefined);
      assert.equal(v.value.fullName, 'New Name');
    });

    it('allows unlinking userId with null', () => {
      const v = validateUpdatePayload({ userId: null });
      assert.equal(v.error, undefined);
      assert.equal(v.value.userId, null);
    });

    it('rejects bad userId', () => {
      const v = validateUpdatePayload({ userId: 'not-an-id' });
      assert.equal(v.error.status, 400);
    });
  });

  describe('validateIdParam', () => {
    it('accepts a valid 24-char hex', () => {
      const v = validateIdParam('64b000000000000000000000');
      assert.equal(v.error, undefined);
      assert.equal(v.id, '64b000000000000000000000');
    });

    it('rejects short string', () => {
      const v = validateIdParam('abc');
      assert.equal(v.error.status, 400);
    });

    it('rejects non-string', () => {
      const v = validateIdParam(123);
      assert.equal(v.error.status, 400);
    });
  });
});
