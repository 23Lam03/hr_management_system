// Unit tests cho helpers/db.js — Phase 12 audit.
//
// Bám sát behavior hiện tại của helper, đồng thời khóa hóa
// quyết định bảo mật Phase 12: helper KHÔNG ĐƯỢC tự suy ra URI
// từ MONGODB_URI (vì có thể chứa credentials của production-shaped URI).
//
// Những test này chỉ kiểm tra logic chọn URI, KHÔNG cố ý kết nối DB
// (để chạy được khi MongoDB không có sẵn trên CI ngoài dev local).

import { describe, it, before, after } from 'node:test';
import { strict as assert } from 'node:assert';

import { resolveTestUri } from './helpers/db.js';

describe('helpers/db.js — resolveTestUri (Phase 12)', () => {
  let originalTestUri;
  let originalMongoUri;

  before(() => {
    originalTestUri = process.env.TEST_MONGODB_URI;
    originalMongoUri = process.env.MONGODB_URI;
  });

  after(() => {
    // Khôi phục env sau khi xong cả describe.
    if (originalTestUri === undefined) delete process.env.TEST_MONGODB_URI;
    else process.env.TEST_MONGODB_URI = originalTestUri;
    if (originalMongoUri === undefined) delete process.env.MONGODB_URI;
    else process.env.MONGODB_URI = originalMongoUri;
  });

  it('honors an explicit TEST_MONGODB_URI when set', () => {
    process.env.TEST_MONGODB_URI = 'mongodb://127.0.0.1:27017/hrm_test_explicit';
    process.env.MONGODB_URI = 'mongodb+srv://user:secret@cluster.example/prod?retryWrites=true';
    assert.equal(resolveTestUri(), 'mongodb://127.0.0.1:27017/hrm_test_explicit');
  });

  it('does NOT derive TEST_URI from MONGODB_URI even when TEST_MONGODB_URI is empty', () => {
    process.env.TEST_MONGODB_URI = '';
    process.env.MONGODB_URI = 'mongodb+srv://user:secret@cluster.example/prod?retryWrites=true';
    // Helper phải fallback về local URI an toàn, KHÔNG dùng Atlas URI
    // chứa credentials.
    assert.equal(resolveTestUri(), 'mongodb://127.0.0.1:27017/hrm_test_db');
  });

  it('falls back to a safe local URI when both env vars are missing', () => {
    delete process.env.TEST_MONGODB_URI;
    delete process.env.MONGODB_URI;
    assert.equal(resolveTestUri(), 'mongodb://127.0.0.1:27017/hrm_test_db');
  });

  it('chosen URI never contains credentials from MONGODB_URI', () => {
    process.env.TEST_MONGODB_URI = '';
    process.env.MONGODB_URI = 'mongodb+srv://alice:wonderland@cluster0.example/admin';
    const uri = resolveTestUri();
    // Không được phép chứa "alice:wonderland" hay "@cluster0".
    assert.ok(!uri.includes('alice'), 'TEST_URI must not leak user from MONGODB_URI');
    assert.ok(!uri.includes('wonderland'), 'TEST_URI must not leak password from MONGODB_URI');
    assert.ok(!uri.includes('cluster0.example'), 'TEST_URI must not leak host from MONGODB_URI');
  });

  it('treats whitespace-only TEST_MONGODB_URI as missing', () => {
    process.env.TEST_MONGODB_URI = '   ';
    process.env.MONGODB_URI = 'mongodb+srv://bob:builder@somewhere/prod';
    assert.equal(resolveTestUri(), 'mongodb://127.0.0.1:27017/hrm_test_db');
  });
});
