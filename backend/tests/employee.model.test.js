// Tests for Employee model.
// Covers:
//  - basic validation
//  - duplicate employeeCode rejected
//  - duplicate email rejected
//  - a User can only be linked to one Employee
//  - many Employees without userId can coexist
//  - invalid ObjectId references are still allowed at create time
//    (Mongo doesn't check ref existence; that's an application-level
//    concern handled in controllers).
//  - managerId cannot equal the employee's own _id
//  - timestamps
//  - employmentStatus enum
//  - hireDate cannot be in the future

import { describe, it, before, after, beforeEach } from 'node:test';
import { strict as assert } from 'node:assert';

import { Employee, User, Department, Position } from '../src/models/index.js';
import { setupTestDb, clearTestDb, teardownTestDb } from './helpers/db.js';

describe('Employee model', () => {
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
    assert.equal(Employee.modelName, 'Employee');
  });

  it('requires employeeCode, fullName, email, employmentType, hireDate', async () => {
    const e = new Employee({});
    await assert.rejects(
      () => e.save(),
      (err) => err.name === 'ValidationError',
    );
  });

  it('rejects hireDate in the future', async () => {
    const future = new Date(Date.now() + 1000 * 60 * 60 * 24 * 30);
    const e = new Employee({
      employeeCode: 'NV0001',
      fullName: 'Future Person',
      email: 'f@example.com',
      employmentType: 'full_time',
      hireDate: future,
    });
    await assert.rejects(
      () => e.save(),
      (err) => err.name === 'ValidationError',
    );
  });

  it('rejects unknown employmentType', async () => {
    const e = new Employee({
      employeeCode: 'NV0001',
      fullName: 'Alice',
      email: 'x@example.com',
      employmentType: 'freelance',
      hireDate: new Date('2024-01-01'),
    });
    await assert.rejects(
      () => e.save(),
      (err) => err.name === 'ValidationError',
    );
  });

  it('rejects unknown employmentStatus', async () => {
    const e = new Employee({
      employeeCode: 'NV0001',
      fullName: 'Alice',
      email: 'x@example.com',
      employmentType: 'full_time',
      hireDate: new Date('2024-01-01'),
      employmentStatus: 'terminated',
    });
    await assert.rejects(
      () => e.save(),
      (err) => err.name === 'ValidationError',
    );
  });

  it('rejects unknown gender', async () => {
    const e = new Employee({
      employeeCode: 'NV0001',
      fullName: 'Alice',
      email: 'x@example.com',
      employmentType: 'full_time',
      hireDate: new Date('2024-01-01'),
      gender: 'unknown',
    });
    await assert.rejects(
      () => e.save(),
      (err) => err.name === 'ValidationError',
    );
  });

  it('rejects duplicate employeeCode', async () => {
    await Employee.create({
      employeeCode: 'NV0001',
      fullName: 'Alice',
      email: 'a@example.com',
      employmentType: 'full_time',
      hireDate: new Date('2024-01-01'),
    });
    await assert.rejects(
      () =>
        Employee.create({
          employeeCode: 'NV0001',
          fullName: 'Bob',
          email: 'b@example.com',
          employmentType: 'full_time',
          hireDate: new Date('2024-01-01'),
        }),
      (err) => err.code === 11000,
    );
  });

  it('rejects duplicate email', async () => {
    await Employee.create({
      employeeCode: 'NV0001',
      fullName: 'Alice',
      email: 'a@example.com',
      employmentType: 'full_time',
      hireDate: new Date('2024-01-01'),
    });
    await assert.rejects(
      () =>
        Employee.create({
          employeeCode: 'NV0002',
          fullName: 'Bob',
          email: 'A@Example.com',
          employmentType: 'full_time',
          hireDate: new Date('2024-01-01'),
        }),
      (err) => err.code === 11000,
    );
  });

  it('normalizes employeeCode to uppercase + email to lowercase', async () => {
    const e = await Employee.create({
      employeeCode: '  nv0001  ',
      fullName: '  Alice  Two  ',
      email: '  Alice@Example.COM  ',
      employmentType: 'full_time',
      hireDate: new Date('2024-01-01'),
    });
    assert.equal(e.employeeCode, 'NV0001');
    assert.equal(e.email, 'alice@example.com');
    assert.equal(e.fullName, 'Alice Two');
  });

  it('multiple employees without userId coexist', async () => {
    await Employee.create({
      employeeCode: 'NV0001',
      fullName: 'Alice',
      email: 'a@example.com',
      employmentType: 'full_time',
      hireDate: new Date('2024-01-01'),
    });
    await Employee.create({
      employeeCode: 'NV0002',
      fullName: 'Bob',
      email: 'b@example.com',
      employmentType: 'full_time',
      hireDate: new Date('2024-01-01'),
    });
    const count = await Employee.countDocuments({ userId: null });
    assert.equal(count, 2);
  });

  it('a User can only be linked to one Employee (unique sparse index)', async () => {
    const u = await User.create({
      fullName: 'Alice',
      email: 'a@example.com',
      passwordHash: 'hash',
    });
    await Employee.create({
      employeeCode: 'NV0001',
      userId: u._id,
      fullName: 'Alice Emp',
      email: 'alice-emp@example.com',
      employmentType: 'full_time',
      hireDate: new Date('2024-01-01'),
    });
    await assert.rejects(
      () =>
        Employee.create({
          employeeCode: 'NV0002',
          userId: u._id, // same userId!
          fullName: 'Bob Emp',
          email: 'b@example.com',
          employmentType: 'full_time',
          hireDate: new Date('2024-01-01'),
        }),
      (err) => err.code === 11000,
    );
  });

  it('managerId cannot be the employee themselves', async () => {
    // Pre-create to get an _id, then attempt self-reference.
    const e = await Employee.create({
      employeeCode: 'NV0001',
      fullName: 'Alice',
      email: 'a@example.com',
      employmentType: 'full_time',
      hireDate: new Date('2024-01-01'),
    });
    e.managerId = e._id;
    await assert.rejects(
      () => e.save(),
      (err) =>
        err.name === 'ValidationError' &&
        /managerId/.test(err.message),
    );
  });

  it('accepts valid ObjectId references that point to existing Department/Position', async () => {
    // Tạo Department + Position thật để verify ObjectId references
    const dept = await Department.create({ name: 'IT', code: 'IT' });
    const pos = await Position.create({ name: 'Engineer', code: 'ENG' });
    const e = await Employee.create({
      employeeCode: 'NV0001',
      fullName: 'Alice',
      email: 'a@example.com',
      employmentType: 'full_time',
      hireDate: new Date('2024-01-01'),
      departmentId: dept._id,
      positionId: pos._id,
    });
    assert.equal(e.departmentId.toString(), dept._id.toString());
    assert.equal(e.positionId.toString(), pos._id.toString());
  });

  it('rejects invalid ObjectId for references (CastError)', async () => {
    const e = new Employee({
      employeeCode: 'NV0001',
      fullName: 'Alice',
      email: 'a@example.com',
      employmentType: 'full_time',
      hireDate: new Date('2024-01-01'),
      departmentId: 'not-a-valid-id',
    });
    // Mongoose 8 surfaces ObjectId cast failures as ValidationError
    // with a "departmentId: Cast to ObjectId failed" message. We assert
    // the error mentions the bad field rather than matching err.name.
    await assert.rejects(
      () => e.save(),
      (err) =>
        err.name === 'ValidationError' &&
        /departmentId/.test(err.message),
    );
  });

  it('populates timestamps', async () => {
    const e = await Employee.create({
      employeeCode: 'NV0001',
      fullName: 'Alice',
      email: 'a@example.com',
      employmentType: 'full_time',
      hireDate: new Date('2024-01-01'),
    });
    assert.ok(e.createdAt instanceof Date);
    assert.ok(e.updatedAt instanceof Date);
  });

  it('does not expose __v in toJSON', async () => {
    const e = await Employee.create({
      employeeCode: 'NV0001',
      fullName: 'Alice',
      email: 'a@example.com',
      employmentType: 'full_time',
      hireDate: new Date('2024-01-01'),
    });
    const json = e.toJSON();
    assert.ok(!('__v' in json));
  });

  it('rejects employeeCode shorter than 2 chars', async () => {
    const e = new Employee({
      employeeCode: 'N',
      fullName: 'Alice',
      email: 'short@example.com',
      employmentType: 'full_time',
      hireDate: new Date('2024-01-01'),
    });
    await assert.rejects(
      () => e.save(),
      (err) => err.name === 'ValidationError' && /employeeCode/.test(err.message),
    );
  });

  it('rejects employeeCode with invalid characters', async () => {
    const e = new Employee({
      employeeCode: 'NV 0001!',
      fullName: 'Alice',
      email: 'inv@example.com',
      employmentType: 'full_time',
      hireDate: new Date('2024-01-01'),
    });
    await assert.rejects(
      () => e.save(),
      (err) => err.name === 'ValidationError' && /employeeCode/.test(err.message),
    );
  });

  it('update with duplicate email is rejected', async () => {
    await Employee.create({
      employeeCode: 'NV0001',
      fullName: 'Alice',
      email: 'alice@example.com',
      employmentType: 'full_time',
      hireDate: new Date('2024-01-01'),
    });
    const second = await Employee.create({
      employeeCode: 'NV0002',
      fullName: 'Bob',
      email: 'bob@example.com',
      employmentType: 'full_time',
      hireDate: new Date('2024-01-01'),
    });
    // Cố gắng đổi email của Bob thành email của Alice
    second.email = 'ALICE@example.com'; // cùng giá trị sau normalize
    await assert.rejects(
      () => second.save(),
      (err) => err.code === 11000,
    );
  });

  it('update can change userId to a different User (still unique)', async () => {
    const u1 = await User.create({
      fullName: 'User One',
      email: 'u1@example.com',
      passwordHash: 'x',
    });
    const u2 = await User.create({
      fullName: 'User Two',
      email: 'u2@example.com',
      passwordHash: 'x',
    });
    const e = await Employee.create({
      employeeCode: 'NV0001',
      userId: u1._id,
      fullName: 'Alice',
      email: 'a@example.com',
      employmentType: 'full_time',
      hireDate: new Date('2024-01-01'),
    });
    e.userId = u2._id;
    const saved = await e.save();
    assert.equal(saved.userId.toString(), u2._id.toString());
  });

  it('cannot update employee to use a userId already linked to another Employee', async () => {
    const u = await User.create({
      fullName: 'User',
      email: 'shared@example.com',
      passwordHash: 'x',
    });
    const e1 = await Employee.create({
      employeeCode: 'NV0001',
      userId: u._id,
      fullName: 'Alice',
      email: 'a@example.com',
      employmentType: 'full_time',
      hireDate: new Date('2024-01-01'),
    });
    const e2 = await Employee.create({
      employeeCode: 'NV0002',
      fullName: 'Bob',
      email: 'b@example.com',
      employmentType: 'full_time',
      hireDate: new Date('2024-01-01'),
    });
    e2.userId = u._id; // cùng userId với e1
    await assert.rejects(
      () => e2.save(),
      (err) => err.code === 11000,
    );
    // Đảm bảo e1.userId không bị ảnh hưởng.
    const reloaded = await Employee.findById(e1._id);
    assert.equal(reloaded.userId.toString(), u._id.toString());
  });

  it('managerId can reference another Employee', async () => {
    const manager = await Employee.create({
      employeeCode: 'NV-MGR',
      fullName: 'Manager Person',
      email: 'mgr@example.com',
      employmentType: 'full_time',
      hireDate: new Date('2024-01-01'),
    });
    const report = await Employee.create({
      employeeCode: 'NV-EMP',
      managerId: manager._id,
      fullName: 'Report Person',
      email: 'rpt@example.com',
      employmentType: 'full_time',
      hireDate: new Date('2024-01-01'),
    });
    assert.equal(report.managerId.toString(), manager._id.toString());
  });

  it('populate userId returns User document', async () => {
    const u = await User.create({
      fullName: 'User',
      email: 'pop@example.com',
      passwordHash: 'x',
    });
    const e = await Employee.create({
      employeeCode: 'NV-POP',
      userId: u._id,
      fullName: 'Alice',
      email: 'a-pop@example.com',
      employmentType: 'full_time',
      hireDate: new Date('2024-01-01'),
    });
    const populated = await Employee.findById(e._id).populate('userId');
    assert.ok(populated.userId);
    assert.equal(populated.userId.email, 'pop@example.com');
    // passwordHash không được populate lộ (do User schema có select:false + transform)
    assert.equal(populated.userId.passwordHash, undefined);
    const json = populated.userId.toJSON();
    assert.ok(!('passwordHash' in json));
  });

  it('deleting a User does NOT cascade delete the Employee (intentional)', async () => {
    const u = await User.create({
      fullName: 'User',
      email: 'del@example.com',
      passwordHash: 'x',
    });
    const e = await Employee.create({
      employeeCode: 'NV-DEL',
      userId: u._id,
      fullName: 'Alice',
      email: 'a-del@example.com',
      employmentType: 'full_time',
      hireDate: new Date('2024-01-01'),
    });
    await User.deleteOne({ _id: u._id });
    const stillThere = await Employee.findById(e._id);
    assert.ok(stillThere, 'Employee must still exist after User deletion');
    // userId vẫn trỏ tới id đã xoá (dangling ref) — controller CRUD sẽ
    // xử lý cleanup ở phase sau. Đây là design choice đã documented.
    assert.equal(stillThere.userId.toString(), u._id.toString());
  });

  it('JSON.stringify does not leak sensitive Mongoose internals', async () => {
    const e = await Employee.create({
      employeeCode: 'NV-JS',
      fullName: 'Alice',
      email: 'js@example.com',
      employmentType: 'full_time',
      hireDate: new Date('2024-01-01'),
    });
    const str = JSON.stringify(e);
    assert.ok(!str.includes('__v'), '__v must not leak in JSON.stringify');
  });

  // --- Soft-delete (Phase 4) -----------------------------------------

  it('defaults isDeleted to false on a fresh document', async () => {
    const e = await Employee.create({
      employeeCode: 'NV-SD1',
      fullName: 'Alice',
      email: 'sd1@example.com',
      employmentType: 'full_time',
      hireDate: new Date('2024-01-01'),
    });
    assert.equal(e.isDeleted, false);
    assert.equal(e.deletedAt, null);
    assert.equal(e.deletedBy, null);
  });

  it('supports setting isDeleted + deletedAt + deletedBy on save', async () => {
    const u = await User.create({
      fullName: 'Admin',
      email: 'admin-sd@example.com',
      passwordHash: 'x',
    });
    const e = await Employee.create({
      employeeCode: 'NV-SD2',
      fullName: 'Alice',
      email: 'sd2@example.com',
      employmentType: 'full_time',
      hireDate: new Date('2024-01-01'),
    });
    e.isDeleted = true;
    e.deletedAt = new Date();
    e.deletedBy = u._id;
    const saved = await e.save();
    assert.equal(saved.isDeleted, true);
    assert.ok(saved.deletedAt instanceof Date);
    assert.equal(saved.deletedBy.toString(), u._id.toString());
  });

  it('soft-delete fields are persisted (findById reflects them)', async () => {
    const e = await Employee.create({
      employeeCode: 'NV-SD3',
      fullName: 'Alice',
      email: 'sd3@example.com',
      employmentType: 'full_time',
      hireDate: new Date('2024-01-01'),
    });
    e.isDeleted = true;
    e.deletedAt = new Date();
    await e.save();
    const reloaded = await Employee.findById(e._id);
    assert.equal(reloaded.isDeleted, true);
    assert.ok(reloaded.deletedAt instanceof Date);
  });
});