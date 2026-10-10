// Tests for Department model.

import { describe, it, before, after, beforeEach } from 'node:test';
import { strict as assert } from 'node:assert';

import { Department } from '../src/models/index.js';
import { setupTestDb, clearTestDb, teardownTestDb } from './helpers/db.js';

describe('Department model', () => {
  before(async () => {
    await setupTestDb();
  });
  after(async () => {
    await teardownTestDb();
  });
  beforeEach(async () => {
    await clearTestDb();
  });

  it('imports without error', () => {
    assert.equal(Department.modelName, 'Department');
  });

  it('rejects missing required name and code', async () => {
    const d = new Department({});
    await assert.rejects(() => d.save(), (e) => e.name === 'ValidationError');
  });

  it('rejects invalid code characters (forces uppercase + safe chars)', async () => {
    const d = new Department({
      name: 'Phòng IT',
      code: 'it-dept!', // contains '!' and lowercase
    });
    await assert.rejects(
      () => d.save(),
      (err) => err.name === 'ValidationError',
    );
  });

  it('normalizes code to uppercase + trim', async () => {
    const d = await Department.create({ name: 'Phòng IT', code: '  it  ' });
    assert.equal(d.code, 'IT');
    assert.equal(d.name, 'Phòng IT');
  });

  it('rejects duplicate code (unique index)', async () => {
    await Department.create({ name: 'Phòng IT', code: 'IT' });
    await assert.rejects(
      () => Department.create({ name: 'Phòng IT khác', code: 'IT' }),
      (err) => err.code === 11000,
    );
  });

  it('rejects unknown status enum', async () => {
    const d = new Department({ name: 'Phòng Marketing', code: 'MKT', status: 'archived' });
    await assert.rejects(() => d.save(), (e) => e.name === 'ValidationError');
  });

  it('defaults status to active', async () => {
    const d = await Department.create({ name: 'Phòng HR', code: 'HR' });
    assert.equal(d.status, 'active');
  });

  it('collapses multiple spaces in name', async () => {
    const d = await Department.create({
      name: '   Phòng   Nhân    Sự   ',
      code: 'HR-NS',
    });
    assert.equal(d.name, 'Phòng Nhân Sự');
  });

  it('managerEmployeeId is optional and accepts ObjectId', async () => {
    const fakeId = '64b000000000000000000000';
    const d = await Department.create({
      name: 'Phòng KT',
      code: 'KT',
      managerEmployeeId: fakeId,
    });
    assert.equal(d.managerEmployeeId.toString(), fakeId);
  });

  it('rejects name shorter than 2 chars', async () => {
    const d = new Department({ name: 'A', code: 'AB' });
    await assert.rejects(
      () => d.save(),
      (err) => err.name === 'ValidationError' && /name/.test(err.message),
    );
  });

  it('update with duplicate code (different casing) is rejected', async () => {
    await Department.create({ name: 'Phòng A', code: 'AAA' });
    const d2 = await Department.create({ name: 'Phòng B', code: 'BBB' });
    d2.code = 'aaa'; // normalize thành 'AAA' → trùng
    await assert.rejects(
      () => d2.save(),
      (err) => err.code === 11000,
    );
  });

  it('description is optional and defaults to empty string', async () => {
    const d = await Department.create({ name: 'Phòng NoDesc', code: 'ND' });
    assert.equal(d.description, '');
  });
});