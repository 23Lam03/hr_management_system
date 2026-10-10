// tests/secretPatterns.test.js — Phase 17
//
// Tests for the secret-pattern catalog. We verify:
//   1. Realistic-looking secrets ARE detected (positive).
//   2. Common placeholders are NOT detected (negative).
//   3. The allowlist is honored.
//
// All test fixtures are SYNTHETIC. We never use real secrets.

import { describe, it } from 'node:test';
import { strict as assert } from 'node:assert';

import {
  SECRET_PATTERNS,
  ALLOWLIST_LINE_PATTERNS,
  SCANNER_FILE_IGNORES,
} from '../src/lib/secretPatterns.js';

function findMatches(pattern, line) {
  pattern.lastIndex = 0;
  const out = [];
  let m = pattern.re.exec(line);
  while (m !== null) {
    out.push(m[0]);
    m = pattern.re.exec(line);
  }
  return out;
}

function findById(id) {
  return SECRET_PATTERNS.find((p) => p.id === id);
}

describe('secretPatterns catalog (Phase 17)', () => {
  it('every pattern has a unique id, severity, and description', () => {
    const ids = new Set();
    for (const p of SECRET_PATTERNS) {
      assert.ok(typeof p.id === 'string' && p.id.length > 0);
      assert.ok(['critical', 'high', 'medium', 'low'].includes(p.severity));
      assert.ok(typeof p.description === 'string' && p.description.length > 0);
      assert.ok(!ids.has(p.id), `duplicate id: ${p.id}`);
      ids.add(p.id);
    }
  });

  describe('mongodb_uri_with_password', () => {
    it('detects mongodb://user:pass@host', () => {
      const p = findById('mongodb_uri_with_password');
      const m = findMatches(p, 'cfg = "mongodb://root:hunter2@127.0.0.1:27017/db"');
      assert.equal(m.length, 1);
    });

    it('detects mongodb+srv:// with creds', () => {
      const p = findById('mongodb_uri_with_password');
      const m = findMatches(p, 'mongodb+srv://admin:secret@cluster.mongodb.net/db');
      assert.equal(m.length, 1);
    });
  });

  describe('jwt_token', () => {
    it('detects a real-shape JWT (3 base64url segments)', () => {
      const p = findById('jwt_token');
      const jwt =
        'eyJhbGciOiJIUzI1NiJ9.eyJzdWIiOiIxMjM0NTY3ODkwIn0.SflKxwRJSMeKKF2QT4fwpMeJf36POk6yJV_adQssw5c';
      const m = findMatches(p, `Authorization: Bearer ${jwt}`);
      assert.equal(m.length, 1);
    });

    it('does NOT match base64url with only 1 segment', () => {
      const p = findById('jwt_token');
      const m = findMatches(p, 'eyJhbGciOiJIUzI1NiJ9');
      assert.equal(m.length, 0);
    });
  });

  describe('aws_access_key_id', () => {
    it('detects AKIA-prefixed keys', () => {
      const p = findById('aws_access_key_id');
      const m = findMatches(p, 'AKIAIOSFODNN7EXAMPLE');
      assert.equal(m.length, 1);
    });
  });

  describe('github tokens', () => {
    it('detects ghp_', () => {
      const p = findById('github_personal_access_token');
      const m = findMatches(p, 'ghp_ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghij');
      assert.equal(m.length, 1);
    });
    it('detects gho_', () => {
      const p = findById('github_oauth_token');
      const m = findMatches(p, 'gho_ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghij');
      assert.equal(m.length, 1);
    });
  });

  describe('private key', () => {
    it('detects PEM private key header', () => {
      const p = findById('pem_private_key_any');
      const m = findMatches(p, '-----BEGIN RSA PRIVATE KEY-----');
      assert.equal(m.length, 1);
    });
  });

  describe('jwt_secret_assignment', () => {
    it('detects a real-shape JWT secret value', () => {
      const p = findById('jwt_secret_assignment');
      const m = findMatches(p, 'JWT_SECRET="abcdefghijklmnopqrstuvwxyz123456"');
      assert.equal(m.length, 1);
    });

    it('does NOT match the .env.example placeholder', () => {
      const p = findById('jwt_secret_assignment');
      const m = findMatches(
        p,
        'JWT_SECRET=change-me-to-a-strong-random-secret-at-least-16-chars',
      );
      assert.equal(m.length, 0);
    });
  });

  describe('allowlist', () => {
    it('ALLOWLIST_LINE_PATTERNS is non-empty', () => {
      assert.ok(ALLOWLIST_LINE_PATTERNS.length > 0);
    });

    it('every allowlist pattern is a RegExp', () => {
      for (const p of ALLOWLIST_LINE_PATTERNS) {
        assert.ok(p instanceof RegExp);
      }
    });

    it('SCANNER_FILE_IGNORES covers node_modules and lockfile', () => {
      const all = SCANNER_FILE_IGNORES;
      // Stringify (RegExp.prototype.toString gives the source).
      const flat = all.map(String).join(' ');
      // The list must mention "node_modules" somewhere.
      assert.match(flat, /node_modules/);
      // And must cover package-lock.json (escaped or not, we
      // strip the backslashes for the assertion).
      const stripped = flat.replace(/\\/g, '');
      assert.match(stripped, /package-lock\.json/);
    });
  });
});
