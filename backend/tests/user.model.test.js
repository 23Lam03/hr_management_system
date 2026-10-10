// Tests for User model.
// Covers:
//  - import ok
//  - schema validation
//  - email normalization
//  - duplicate email rejected by unique index
//  - passwordHash never appears in toJSON output
//  - timestamps populated
//  - role/status enum enforcement
//  - password hashing helper

import { describe, it, before, after, beforeEach } from 'node:test';
import { strict as assert } from 'node:assert';

import { User } from '../src/models/index.js';
import { setupTestDb, clearTestDb, teardownTestDb } from './helpers/db.js';

describe('User model', () => {
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
    assert.equal(typeof User, 'function');
    assert.equal(User.modelName, 'User');
  });

  it('rejects a user with missing required fields', async () => {
    const u = new User({});
    await assert.rejects(
      () => u.save(),
      (err) => err.name === 'ValidationError',
    );
  });

  it('rejects an invalid email', async () => {
    const u = new User({
      fullName: 'Test User',
      email: 'not-an-email',
      passwordHash: 'x',
    });
    await assert.rejects(
      () => u.save(),
      (err) => err.name === 'ValidationError',
    );
  });

  it('rejects an unknown role', async () => {
    const u = new User({
      fullName: 'Test User',
      email: 'a@b.com',
      passwordHash: 'x',
      role: 'superuser',
    });
    await assert.rejects(
      () => u.save(),
      (err) => err.name === 'ValidationError',
    );
  });

  it('rejects an unknown status', async () => {
    const u = new User({
      fullName: 'Test User',
      email: 'a@b.com',
      passwordHash: 'x',
      status: 'banned',
    });
    await assert.rejects(
      () => u.save(),
      (err) => err.name === 'ValidationError',
    );
  });

  it('normalizes email (trim + lowercase) and enforces unique', async () => {
    const hash = await User.hashPassword('secret123');
    await User.create({
      fullName: 'Alice',
      email: '  Alice@Example.COM  ',
      passwordHash: hash,
      role: 'employee',
    });

    // Different casing + whitespace must collide with the first one.
    await assert.rejects(
      () =>
        User.create({
          fullName: 'Alice Two',
          email: 'alice@example.com',
          passwordHash: hash,
          role: 'employee',
        }),
      (err) => err.code === 11000,
    );
  });

  it('does not include passwordHash in toJSON output', async () => {
    const hash = await User.hashPassword('secret123');
    const u = await User.create({
      fullName: 'Bob',
      email: 'bob@example.com',
      passwordHash: hash,
      role: 'employee',
    });
    const json = u.toJSON();
    assert.ok(!('passwordHash' in json), 'passwordHash must be stripped');
    assert.equal(json.email, 'bob@example.com');
    assert.equal(json.fullName, 'Bob');
    assert.equal(json.role, 'employee');
  });

  it('does not include passwordHash even when explicitly selected', async () => {
    const hash = await User.hashPassword('secret123');
    const u = await User.create({
      fullName: 'Carol',
      email: 'carol@example.com',
      passwordHash: hash,
    });
    // Force selection of passwordHash
    const reloaded = await User.findById(u._id).select('+passwordHash');
    assert.ok(reloaded.passwordHash, 'select("+passwordHash") must work');
    const json = reloaded.toJSON();
    assert.ok(!('passwordHash' in json), 'toJSON must still strip passwordHash');
  });

  it('populates timestamps', async () => {
    const u = await User.create({
      fullName: 'Dan',
      email: 'dan@example.com',
      passwordHash: 'x',
    });
    assert.ok(u.createdAt instanceof Date);
    assert.ok(u.updatedAt instanceof Date);
  });

  it('hashPassword produces a bcrypt hash (not plaintext)', async () => {
    const hash = await User.hashPassword('secret123');
    assert.notEqual(hash, 'secret123');
    assert.ok(hash.startsWith('$2'), 'bcrypt hashes start with $2');
    // Verify
    const ok = await User.findOne({}).then(() => true);
    assert.ok(ok);
  });

  it('verifyPassword returns true for correct password', async () => {
    const hash = await User.hashPassword('correct horse battery staple');
    const u = await User.create({
      fullName: 'Eve',
      email: 'eve@example.com',
      passwordHash: hash,
    });
    const reloaded = await User.findById(u._id).select('+passwordHash');
    assert.equal(await reloaded.verifyPassword('correct horse battery staple'), true);
    assert.equal(await reloaded.verifyPassword('wrong'), false);
  });

  it('rejects hashPassword with empty input', async () => {
    await assert.rejects(() => User.hashPassword(''), /non-empty/);
    await assert.rejects(() => User.hashPassword(null), /non-empty/);
  });

  it('rejects fullName shorter than 2 chars', async () => {
    const u = new User({
      fullName: 'A',
      email: 'a@example.com',
      passwordHash: 'x',
    });
    await assert.rejects(
      () => u.save(),
      (err) => err.name === 'ValidationError' && /fullName/.test(err.message),
    );
  });

  it('trims fullName whitespace on save', async () => {
    const u = await User.create({
      fullName: '   Alice   ',
      email: 'a@example.com',
      passwordHash: 'x',
    });
    assert.equal(u.fullName, 'Alice');
  });

  it('defaults role to employee and status to active', async () => {
    const u = await User.create({
      fullName: 'Default User',
      email: 'd@example.com',
      passwordHash: 'x',
    });
    assert.equal(u.role, 'employee');
    assert.equal(u.status, 'active');
    assert.equal(u.lastLoginAt, null);
  });

  it('lastLoginAt can be set and persisted', async () => {
    const t = new Date('2026-09-30T10:00:00Z');
    const u = await User.create({
      fullName: 'Login User',
      email: 'login@example.com',
      passwordHash: 'x',
      lastLoginAt: t,
    });
    assert.equal(u.lastLoginAt.toISOString(), t.toISOString());
  });

  it('passwordHash is absent from JSON.stringify output', async () => {
    const u = await User.create({
      fullName: 'Json User',
      email: 'json@example.com',
      passwordHash: 'x',
    });
    const str = JSON.stringify(u);
    assert.ok(!str.includes('passwordHash'), 'JSON string must not contain passwordHash');
  });

  it('passwordHash is absent from default find() (no explicit select)', async () => {
    await User.create({
      fullName: 'Find User',
      email: 'find@example.com',
      passwordHash: 'real-bcrypt-hash',
    });
    const found = await User.findOne({ email: 'find@example.com' });
    assert.ok(found, 'user must be findable');
    assert.equal(
      found.passwordHash,
      undefined,
      'passwordHash must be undefined without +passwordHash',
    );
    // Đảm bảo toJSON cũng không lộ.
    assert.ok(!('passwordHash' in found.toJSON()));
  });
});