// Tests for Position model.

import { describe, it, before, after, beforeEach } from 'node:test';
import { strict as assert } from 'node:assert';

import { Position } from '../src/models/index.js';
import { setupTestDb, clearTestDb, teardownTestDb } from './helpers/db.js';

describe('Position model', () => {
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
    assert.equal(Position.modelName, 'Position');
  });

  it('rejects missing name and code', async () => {
    const p = new Position({});
    await assert.rejects(() => p.save(), (e) => e.name === 'ValidationError');
  });

  it('rejects invalid code characters', async () => {
    const p = new Position({ name: 'Frontend Engineer', code: 'fe!1' });
    await assert.rejects(
      () => p.save(),
      (e) => e.name === 'ValidationError',
    );
  });

  it('normalizes code to uppercase + trim', async () => {
    const p = await Position.create({ name: 'Frontend Engineer', code: 'fe-eng' });
    assert.equal(p.code, 'FE-ENG');
  });

  it('rejects duplicate code', async () => {
    await Position.create({ name: 'Backend Engineer', code: 'BE' });
    await assert.rejects(
      () => Position.create({ name: 'Backend Engineer 2', code: 'BE' }),
      (e) => e.code === 11000,
    );
  });

  it('departmentId is optional', async () => {
    const p = await Position.create({ name: 'Intern', code: 'INTERN' });
    assert.equal(p.departmentId, null);
  });

  it('departmentId accepts ObjectId', async () => {
    const fakeId = '64b000000000000000000000';
    const p = await Position.create({
      name: 'FE',
      code: 'FE',
      departmentId: fakeId,
    });
    assert.equal(p.departmentId.toString(), fakeId);
  });

  it('rejects unknown status', async () => {
    const p = new Position({ name: 'Tester', code: 'TST', status: 'archived' });
    await assert.rejects(() => p.save(), (e) => e.name === 'ValidationError');
  });

  it('rejects name shorter than 2 chars', async () => {
    const p = new Position({ name: 'X', code: 'TST' });
    await assert.rejects(
      () => p.save(),
      (err) => err.name === 'ValidationError' && /name/.test(err.message),
    );
  });

  it('update with duplicate code (different casing) is rejected', async () => {
    await Position.create({ name: 'Frontend', code: 'FE' });
    const p2 = await Position.create({ name: 'Backend', code: 'BE' });
    p2.code = 'fe'; // normalize → 'FE' → trùng
    await assert.rejects(
      () => p2.save(),
      (err) => err.code === 11000,
    );
  });

  it('description is optional and defaults to empty string', async () => {
    const p = await Position.create({ name: 'NoDesc', code: 'ND' });
    assert.equal(p.description, '');
  });
});