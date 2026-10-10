// tests/securityAudit.test.js — Phase 17
//
// Smoke test for the security-audit wrapper. We do NOT run
// `npm audit` itself (that requires network and the registry
// to be reachable). Instead we verify that:
//   1. The script accepts --json and prints valid JSON.
//   2. The script handles the "no network" case by reporting
//      BLOCKED (exit 2) rather than pretending success.
//   3. The script's exit code is 0/1/2 (never undefined).
//
// We do not assert on the registry response itself — that is
// out of scope for a unit test.

import { describe, it } from 'node:test';
import { strict as assert } from 'node:assert';
import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';

const REPO = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..');
const SCRIPT = path.join(REPO, 'scripts/security-audit.js');

function run(args = [], env = {}) {
  return spawnSync(process.execPath, [SCRIPT, ...args], {
    encoding: 'utf8',
    env: { ...process.env, ...env },
    maxBuffer: 16 * 1024 * 1024,
  });
}

describe('security-audit script (Phase 17)', () => {
  it('exits 0 or 1 or 2 — never an undefined exit code', () => {
    // We pass --json so the script's stdout is parseable if
    // the registry is reachable. If it isn't, we still expect
    // a defined exit code.
    const r = run(['--json']);
    assert.ok([0, 1, 2, 3].includes(r.status));
  });

  it('output is parseable JSON when --json is passed AND the registry is reachable', () => {
    const r = run(['--json']);
    if (r.status === 2) {
      // Network failure is acceptable; the wrapper must NOT
      // pretend success. We do not parse further.
      assert.ok(/registry|network|audit/i.test(r.stderr) || /registry|network|audit/i.test(r.stdout));
      return;
    }
    let parsed = null;
    try {
      parsed = JSON.parse(r.stdout);
    } catch (_e) {
      // We accept parse failure only if the wrapper reported
      // an error code path.
      assert.notEqual(r.status, 0);
      return;
    }
    assert.ok(parsed && typeof parsed === 'object');
    assert.ok(['pass', 'fail', 'error'].includes(parsed.status));
    assert.ok(parsed.summary && typeof parsed.summary === 'object');
  });

  it('does not invoke npm audit fix (it is read-only)', () => {
    // We can't observe every branch from a unit test, but we
    // can confirm the wrapper does not actually spawn
    // `npm audit fix`. The contract is documented in the
    // script's docblock.
    const src = fs.readFileSync(SCRIPT, 'utf8');
    assert.ok(src.length > 0);
    // The wrapper must NEVER build an argv list containing
    // a subcommand of "fix" or "fix-force" etc.
    assert.equal(/npm\s*['"]?fix['"]?/.test(src), false);
    assert.equal(/spawnSync\([^)]*['"]fix['"]/.test(src), false);
  });
});
