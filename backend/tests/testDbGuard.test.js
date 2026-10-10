// tests/testDbGuard.test.js — Phase 17
//
// Pure-function tests for validateTestUri / resolveAndValidateTestUri.
// The guard is the single chokepoint that decides whether a URI
// is safe for tests; getting it wrong has real safety consequences
// (e.g. running 800+ tests against an Atlas cluster).

import { describe, it } from 'node:test';
import { strict as assert } from 'node:assert';

import {
  validateTestUri,
  resolveAndValidateTestUri,
  _internal,
} from '../src/lib/testDbGuard.js';

describe('validateTestUri (Phase 17)', () => {
  describe('positive cases', () => {
    it('accepts the local fallback URI', () => {
      const r = validateTestUri('mongodb://127.0.0.1:27017/hrm_test_db');
      assert.equal(r.ok, true);
      assert.equal(r.host, '127.0.0.1');
      assert.equal(r.db, 'hrm_test_db');
    });

    it('accepts localhost with the same DB name', () => {
      const r = validateTestUri('mongodb://localhost:27017/test_db');
      assert.equal(r.ok, true);
      assert.equal(r.host, 'localhost');
    });

    it('accepts a private RFC1918 host with a *_test_* name', () => {
      const r = validateTestUri('mongodb://10.0.0.5:27017/hrm_test_e2e');
      assert.equal(r.ok, true);
    });

    it('accepts a .local hostname', () => {
      const r = validateTestUri('mongodb://ci-runner.local:27017/test_db');
      assert.equal(r.ok, true);
    });

    it('accepts tmp_db as a name', () => {
      const r = validateTestUri('mongodb://127.0.0.1:27017/tmp_db');
      assert.equal(r.ok, true);
    });
  });

  describe('rejects empty / non-string', () => {
    it('rejects empty string', () => {
      const r = validateTestUri('');
      assert.equal(r.ok, false);
      assert.equal(r.code, 'INVALID_URI');
    });
    it('rejects non-string', () => {
      const r = validateTestUri(null);
      assert.equal(r.ok, false);
    });
    it('rejects wrong scheme', () => {
      const r = validateTestUri('http://127.0.0.1:27017/test');
      assert.equal(r.ok, false);
      assert.equal(r.code, 'INVALID_URI');
    });
  });

  describe('rejects Atlas / public hostnames', () => {
    it('rejects *.mongodb.net (Atlas)', () => {
      const r = validateTestUri('mongodb://cluster0.abc123.mongodb.net/hrm_test_db');
      assert.equal(r.ok, false);
      assert.equal(r.code, 'PUBLIC_HOSTNAME');
    });

    it('rejects mongodb+srv:// for any non-loopback host', () => {
      const r = validateTestUri('mongodb+srv://cluster0.abc.mongodb.net/test_db');
      assert.equal(r.ok, false);
      // Either PUBLIC_HOSTNAME or SRV_NOT_ALLOWED is acceptable;
      // both correctly block the URI. The order of checks is an
      // internal detail.
      assert.ok(['PUBLIC_HOSTNAME', 'SRV_NOT_ALLOWED'].includes(r.code));
    });

    it('rejects an explicit atlas.* hostname', () => {
      const r = validateTestUri('mongodb://atlas.example.org:27017/test_db');
      assert.equal(r.ok, false);
    });

    it('rejects a public IPv4 address', () => {
      const r = validateTestUri('mongodb://8.8.8.8:27017/test_db');
      assert.equal(r.ok, false);
      assert.equal(r.code, 'PUBLIC_IP');
    });

    it('rejects an AWS-like hostname', () => {
      const r = validateTestUri('mongodb://mongo.example.amazonaws.com:27017/test_db');
      assert.equal(r.ok, false);
    });
  });

  describe('rejects credentials in the URI', () => {
    it('rejects user:pass@', () => {
      const r = validateTestUri('mongodb://user:secret@127.0.0.1:27017/test_db');
      assert.equal(r.ok, false);
      assert.equal(r.code, 'URI_HAS_CREDENTIALS');
    });

    it('rejects user-only (no password) — still a credential shape', () => {
      const r = validateTestUri('mongodb://user@127.0.0.1:27017/test_db');
      assert.equal(r.ok, false);
    });
  });

  describe('rejects unsafe database names', () => {
    it('rejects a production-shaped name (hrm_production)', () => {
      const r = validateTestUri('mongodb://127.0.0.1:27017/hrm_production');
      assert.equal(r.ok, false);
      assert.equal(r.code, 'UNSAFE_DB_NAME');
    });

    it('rejects a name without a recognized test suffix', () => {
      const r = validateTestUri('mongodb://127.0.0.1:27017/hrm_db');
      assert.equal(r.ok, false);
      assert.equal(r.code, 'UNSAFE_DB_NAME');
    });

    it('rejects an empty database name', () => {
      const r = validateTestUri('mongodb://127.0.0.1:27017/');
      assert.equal(r.ok, false);
      // Either NO_DB_NAME (empty path) or UNSAFE_DB_NAME (just /)
      // is acceptable. Both are valid rejections.
      assert.ok(['NO_DB_NAME', 'UNSAFE_DB_NAME'].includes(r.code));
    });
  });
});

describe('resolveAndValidateTestUri (Phase 17)', () => {
  it('uses TEST_MONGODB_URI from env when present', () => {
    const uri = resolveAndValidateTestUri({
      env: { TEST_MONGODB_URI: 'mongodb://127.0.0.1:27017/hrm_test_db' },
    });
    assert.equal(uri, 'mongodb://127.0.0.1:27017/hrm_test_db');
  });

  it('falls back to the local default when env is missing', () => {
    const uri = resolveAndValidateTestUri({ env: {} });
    assert.equal(uri, 'mongodb://127.0.0.1:27017/hrm_test_db');
  });

  it('NEVER falls back to MONGODB_URI (no silent prod connection)', () => {
    // Even if MONGODB_URI looks production-shaped, the function
    // must NOT use it. It only considers TEST_MONGODB_URI and
    // the hard-coded local fallback.
    const r = (() => {
      try {
        resolveAndValidateTestUri({
          env: { MONGODB_URI: 'mongodb://user:pass@cluster0.abc.mongodb.net/hrm' },
        });
        return null;
      } catch (e) {
        return e;
      }
    })();
    // The function should succeed (using the local fallback)
    // because MONGODB_URI is ignored.
    assert.equal(r, null);
  });

  it('throws an error with NO URI leak on validation failure', () => {
    let caught = null;
    try {
      resolveAndValidateTestUri({
        env: { TEST_MONGODB_URI: 'mongodb://user:pass@cluster0.abc.mongodb.net/hrm_test_db' },
      });
    } catch (e) {
      caught = e;
    }
    assert.ok(caught);
    // The error message must NOT include the credentials.
    assert.equal(caught.message.includes('user:pass'), false);
    assert.equal(caught.message.includes('cluster0.abc'), false);
  });
});

describe('internal helpers (Phase 17)', () => {
  it('SAFE_HOSTNAMES is intentionally small', () => {
    assert.ok(_internal.SAFE_HOSTNAMES.length <= 10);
    assert.ok(_internal.SAFE_HOSTNAMES.includes('127.0.0.1'));
  });

  it('isPublicIPv4 treats private and loopback as non-public', () => {
    assert.equal(_internal.isPublicIPv4('127.0.0.1'), false);
    assert.equal(_internal.isPublicIPv4('10.0.0.1'), false);
    assert.equal(_internal.isPublicIPv4('192.168.0.1'), false);
    assert.equal(_internal.isPublicIPv4('172.16.0.1'), false);
    assert.equal(_internal.isPublicIPv4('169.254.0.1'), false);
  });

  it('isPublicIPv4 flags public addresses', () => {
    assert.equal(_internal.isPublicIPv4('8.8.8.8'), true);
    assert.equal(_internal.isPublicIPv4('1.1.1.1'), true);
  });
});
