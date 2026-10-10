#!/usr/bin/env node
// scripts/release-gate.js — Phase 17
//
// Pre-release sanity check. Verifies that the local checkout
// is in a state where a release is sane:
//
//   1. The repository has a Git working tree (we use `git` to
//      read the version, branch, and dirty-state). If not, the
//      gate reports BLOCKED and exits non-zero.
//   2. The version in `package.json` is a valid SemVer. If not,
//      FAIL.
//   3. If `--require-clean` is passed, the working tree must be
//      clean. The default is to allow uncommitted docs / test
//      changes; `--require-clean` is for strict releases.
//   4. Required files exist: `docs/RELEASE_READINESS_CHECKLIST.md`,
//      `.env.example`, `package-lock.json`.
//   5. The test-DB guard must pass against the current
//      TEST_MONGODB_URI (or the default fallback).
//   6. The secret scanner must pass.
//
// Exit codes:
//   0  all checks pass
//   1  a check failed
//   2  BLOCKED — required dependency missing (e.g. git binary)
//
// The script is read-only. It does NOT push tags, does NOT
// publish packages, does NOT modify the working tree.

import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { resolveAndValidateTestUri } from '../src/lib/testDbGuard.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ROOT = path.resolve(__dirname, '..');

const args = process.argv.slice(2);
const REQUIRE_CLEAN = args.includes('--require-clean');
const SKIP_SECRET_SCAN = args.includes('--skip-secret-scan');
const SKIP_TEST_DB = args.includes('--skip-test-db');

function log(msg) {
  process.stdout.write(`[release-gate] ${msg}\n`);
}
function err(msg) {
  process.stderr.write(`[release-gate] ${msg}\n`);
}

const checks = [];
let hasFailure = false;
let hasBlocked = false;

function recordPass(name, detail = '') {
  checks.push({ name, status: 'PASS', detail });
}
function recordFail(name, detail = '') {
  hasFailure = true;
  checks.push({ name, status: 'FAIL', detail });
}
function recordBlocked(name, detail = '') {
  hasBlocked = true;
  checks.push({ name, status: 'BLOCKED', detail });
}

const SEMVER_RE = /^(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)(?:-((?:0|[1-9]\d*|\d*[a-zA-Z-][0-9a-zA-Z-]*)(?:\.(?:0|[1-9]\d*|\d*[a-zA-Z-][0-9a-zA-Z-]*))*))?(?:\+([0-9a-zA-Z-]+(?:\.[0-9a-zA-Z-]+)*))?$/;

// 1. Git availability
const gitCheck = spawnSync('git', ['--version'], { encoding: 'utf8' });
if (gitCheck.status !== 0) {
  recordBlocked('git-binary', 'git binary is not available');
} else {
  recordPass('git-binary', `git ${(gitCheck.stdout || '').trim().split(' ').pop()}`);
}

// 2. Inside a git working tree?
const insideCheck = spawnSync('git', ['rev-parse', '--is-inside-work-tree'], {
  encoding: 'utf8',
  cwd: ROOT,
});
if (insideCheck.status !== 0 || (insideCheck.stdout || '').trim() !== 'true') {
  recordBlocked('git-worktree', 'Not inside a Git working tree');
} else {
  recordPass('git-worktree', 'inside');
}

// 3. package.json version
const pkgPath = path.join(ROOT, 'package.json');
let pkg = null;
try {
  pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf8'));
} catch (e) {
  recordFail('package.json', `cannot read: ${e.message}`);
}
if (pkg) {
  if (typeof pkg.version === 'string' && SEMVER_RE.test(pkg.version)) {
    recordPass('package.version', `version=${pkg.version}`);
  } else {
    recordFail('package.version', `version="${pkg.version}" is not valid SemVer`);
  }
}

// 4. Required files
const requiredFiles = [
  'docs/RELEASE_READINESS_CHECKLIST.md',
  '.env.example',
  'package-lock.json',
  '.nvmrc',
];
for (const rel of requiredFiles) {
  const full = path.join(ROOT, rel);
  if (fs.existsSync(full)) {
    recordPass(`exists:${rel}`, 'present');
  } else {
    recordFail(`exists:${rel}`, 'missing');
  }
}

// 5. Working-tree cleanliness
if (insideCheck.status === 0) {
  const statusCheck = spawnSync('git', ['status', '--porcelain'], {
    encoding: 'utf8',
    cwd: ROOT,
  });
  const dirty = (statusCheck.stdout || '').trim().split('\n').filter(Boolean);
  if (dirty.length === 0) {
    recordPass('git.clean', 'no uncommitted changes');
  } else {
    if (REQUIRE_CLEAN) {
      recordFail(
        'git.clean',
        `${dirty.length} uncommitted change(s): ${dirty.slice(0, 5).join('; ')}`,
      );
    } else {
      // Soft: only flag for awareness, not a release blocker.
      recordPass(
        'git.clean',
        `${dirty.length} uncommitted change(s) (allowed; pass --require-clean to enforce)`,
      );
    }
  }
}

// 6. Test DB guard
if (!SKIP_TEST_DB) {
  try {
    const uri = resolveAndValidateTestUri();
    recordPass('test-db.guard', 'URI is valid for test usage');
    // We do NOT log the URI. Caller can `process.env.TEST_MONGODB_URI`
    // if they need to.
    void uri;
  } catch (e) {
    recordFail('test-db.guard', e.message);
  }
}

// 7. Secret scan
if (!SKIP_SECRET_SCAN) {
  const scanCheck = spawnSync(
    process.execPath,
    [path.join(__dirname, 'secret-scan.js'), '--root', ROOT],
    { encoding: 'utf8', maxBuffer: 8 * 1024 * 1024 },
  );
  if (scanCheck.status === 0) {
    recordPass('secret-scan', 'clean');
  } else if (scanCheck.status === 1) {
    recordFail('secret-scan', 'findings present (see [secret-scan] FAIL output above)');
  } else {
    recordBlocked('secret-scan', `scanner exited ${scanCheck.status}`);
  }
}

// Summary
for (const c of checks) {
  const status = c.status.padEnd(8);
  process.stdout.write(`  ${status} ${c.name}  ${c.detail}\n`);
}

if (hasBlocked) {
  process.stdout.write('[release-gate] BLOCKED: missing dependency or environment.\n');
  process.exit(2);
}
if (hasFailure) {
  process.stdout.write('[release-gate] FAIL: at least one check failed.\n');
  process.exit(1);
}
process.stdout.write('[release-gate] PASS: all checks green.\n');
process.exit(0);
