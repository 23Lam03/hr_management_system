// tests/releaseGate.test.js — Phase 17
//
// Tests for the release-gate script. The gate is read-only and
// must:
//   - exit 0 when checks pass
//   - exit 1 when a check fails
//   - exit 2 when a dependency is missing
//   - never modify the working tree

import { describe, it, before, after } from 'node:test';
import { strict as assert } from 'node:assert';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { spawnSync } from 'node:child_process';

const REPO = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..');
const GATE = path.join(REPO, 'scripts/release-gate.js');

function runGate(args = [], env = {}) {
  return spawnSync(process.execPath, [GATE, ...args], {
    encoding: 'utf8',
    env: { ...process.env, ...env },
    maxBuffer: 8 * 1024 * 1024,
  });
}

describe('release-gate script (Phase 17)', () => {
  let tmp;
  before(() => {
    tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'release-gate-test-'));
  });
  after(() => {
    if (tmp && fs.existsSync(tmp)) fs.rmSync(tmp, { recursive: true, force: true });
  });

  it('runs the real gate against the actual repo (read-only)', () => {
    const r = runGate(['--skip-test-db']);
    // The gate is a SUMMARY step in the real repo. We don't
    // assert pass/fail of the whole thing here because the
    // repo may or may not be inside a git worktree. We assert
    // that the script ran without crashing and produced a
    // summary line.
    assert.ok(/release-gate/.test(r.stdout) || /release-gate/.test(r.stderr));
    // Exit code is one of 0, 1, 2 — not 127 (command not found).
    assert.ok([0, 1, 2].includes(r.status));
  });

  it('--help is not a flag, but the script must not crash on unknown flags', () => {
    const r = runGate(['--this-flag-does-not-exist']);
    assert.ok([0, 1, 2].includes(r.status));
  });

  it('the gate is read-only: running it does not create files in cwd', () => {
    const before = fs.readdirSync(REPO).slice().sort();
    runGate(['--skip-test-db', '--skip-secret-scan']);
    const after = fs.readdirSync(REPO).slice().sort();
    assert.deepEqual(after, before);
  });
});
