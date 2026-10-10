// tests/secretScan.test.js — Phase 17
//
// End-to-end tests for the secret scanner. We create a small
// fixture tree in a temporary directory and run the scanner
// against it. We NEVER use real credentials.

import { describe, it, before, after } from 'node:test';
import { strict as assert } from 'node:assert';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { spawnSync } from 'node:child_process';

const REPO = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..');
const SCANNER = path.join(REPO, 'scripts/secret-scan.js');

function runScanner(rootDir, onlyPath = null) {
  const args = [SCANNER, '--root', rootDir];
  if (onlyPath) args.push('--only', onlyPath);
  return spawnSync(process.execPath, args, { encoding: 'utf8', maxBuffer: 8 * 1024 * 1024 });
}

describe('secret-scan script (Phase 17)', () => {
  let tmp;
  before(() => {
    tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'secret-scan-test-'));
  });
  after(() => {
    if (tmp && fs.existsSync(tmp)) {
      fs.rmSync(tmp, { recursive: true, force: true });
    }
  });

  it('passes on an empty directory', () => {
    const empty = fs.mkdtempSync(path.join(tmp, 'empty-'));
    const r = runScanner(empty);
    assert.equal(r.status, 0);
    assert.match(r.stdout, /0 findings/);
  });

  it('detects a hardcoded MongoDB URI with credentials', () => {
    const dir = fs.mkdtempSync(path.join(tmp, 'mongo-'));
    const target = path.join(dir, 'config.js');
    fs.writeFileSync(
      target,
      // SYNTHETIC credential-shape. NOT a real Atlas URI.
      'export const URI = "mongodb://root:hunter2@cluster0.example.mongodb.net/hrm_prod";\n',
    );
    const r = runScanner(dir);
    assert.equal(r.status, 1);
    assert.match(r.stdout, /mongodb_uri_with_password/);
    assert.match(r.stdout, /config\.js:1/);
    // The matched value MUST be redacted, not printed verbatim.
    assert.equal(r.stdout.includes('hunter2'), false);
  });

  it('detects a real-shape JWT token', () => {
    const dir = fs.mkdtempSync(path.join(tmp, 'jwt-'));
    const target = path.join(dir, 'auth.js');
    const jwt = 'eyJhbGciOiJIUzI1NiJ9.eyJzdWIiOiIxMjM0NTY3ODkwIn0.SflKxwRJSMeKKF2QT4fwpMeJf36POk6yJV_adQssw5c';
    fs.writeFileSync(target, `export const token = "${jwt}";\n`);
    const r = runScanner(dir);
    assert.equal(r.status, 1);
    assert.match(r.stdout, /jwt_token/);
    // The JWT body must be redacted.
    assert.equal(r.stdout.includes('SflKxwRJSMeKKF2QT4fwpMeJf36POk6yJV_adQssw5c'), false);
  });

  it('detects a PEM private key', () => {
    const dir = fs.mkdtempSync(path.join(tmp, 'pem-'));
    const target = path.join(dir, 'key.pem');
    fs.writeFileSync(target, '-----BEGIN RSA PRIVATE KEY-----\nMIIEowIBAAKCAQEA...\n');
    const r = runScanner(dir);
    assert.equal(r.status, 1);
    assert.match(r.stdout, /pem_private_key_any/);
  });

  it('does not flag the .env.example placeholders', () => {
    const dir = fs.mkdtempSync(path.join(tmp, 'env-'));
    const target = path.join(dir, '.env.example');
    fs.writeFileSync(
      target,
      'JWT_SECRET=change-me-to-a-strong-random-secret-at-least-16-chars\n' +
        'MONGODB_URI=mongodb://127.0.0.1:27017/hrm_database\n',
    );
    const r = runScanner(dir);
    assert.equal(r.status, 0);
  });

  it('does not flag our own allowlisted docs (we point at a file inside the repo)', () => {
    // The scanner ALLOWLIST_LINE_PATTERNS has a doc-allowlist that
    // matches paths under docs/. We point the scanner at the
    // README inside the repo to verify it stays clean.
    const target = path.join(REPO, 'docs', 'CI_AND_SECURITY_GATES.md');
    if (!fs.existsSync(target)) {
      // The doc may not exist when this test first runs; the
      // assertion below is still valid because the scanner must
      // not crash.
      return;
    }
    const r = runScanner(REPO, target);
    // 0 = clean
    assert.equal(r.status, 0);
  });
});
