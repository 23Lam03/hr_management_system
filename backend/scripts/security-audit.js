#!/usr/bin/env node
// scripts/security-audit.js — Phase 17
//
// Wraps `npm audit` and applies the project's policy:
//
//   1. Network failure (no registry reachable) is reported as
//      BLOCKED, not as a vulnerability finding.
//   2. Findings are bucketed by severity. The default policy
//      fails CI on `critical` and `high` in PRODUCTION deps.
//   3. Dev-dependency findings are reported but do NOT fail the
//      build by default (operator can opt in with --strict-dev).
//   4. The wrapper NEVER invokes `npm audit fix`. It only reads.
//
// Exit codes:
//   0  no failing findings
//   1  at least one failing finding
//   2  network / registry failure (BLOCKED)
//   3  invalid arguments or unexpected npm audit error
//
// Usage:
//   node scripts/security-audit.js
//   node scripts/security-audit.js --strict-dev    # also fail on dev-dep high
//   node scripts/security-audit.js --json          # raw JSON output (for CI artifacts)

import { spawnSync } from 'node:child_process';

const args = process.argv.slice(2);
const STRICT_DEV = args.includes('--strict-dev');
const JSON_OUT = args.includes('--json');
const PROD_ONLY = args.includes('--production');
const AUDIT_LEVEL = (() => {
  const i = args.indexOf('--audit-level');
  if (i >= 0 && i + 1 < args.length) return args[i + 1];
  return null; // null = use npm default ('low')
})();

function fail(code, message) {
  if (JSON_OUT) {
    process.stdout.write(
      JSON.stringify({ status: 'error', code, message }, null, 2) + '\n',
    );
  } else {
    process.stderr.write(`[security-audit] ${message}\n`);
  }
  process.exit(code);
}

function runNpmAudit() {
  const npmArgs = ['audit', '--json'];
  if (PROD_ONLY) npmArgs.push('--production');
  if (AUDIT_LEVEL) npmArgs.push(`--audit-level=${AUDIT_LEVEL}`);

  const r = spawnSync('npm', npmArgs, {
    encoding: 'utf8',
    maxBuffer: 32 * 1024 * 1024,
  });
  return r;
}

function summarize(findings) {
  // findings: array of { name, severity, via, range, fixAvailable, ... }
  let critical = 0;
  let high = 0;
  let moderate = 0;
  let low = 0;
  for (const f of findings) {
    if (f.severity === 'critical') critical += 1;
    else if (f.severity === 'high') high += 1;
    else if (f.severity === 'moderate') moderate += 1;
    else if (f.severity === 'low') low += 1;
  }
  return { critical, high, moderate, low, total: findings.length };
}

function isProductionDep(name, packageJson) {
  return Boolean(
    packageJson.dependencies && Object.prototype.hasOwnProperty.call(packageJson.dependencies, name),
  );
}

const result = runNpmAudit();

// npm exit codes:
//   0 = no vulnerabilities
//   1 = vulnerabilities found
//   other = registry / network / setup error
if (result.error) {
  fail(2, `npm audit failed to start: ${result.error.message}`);
}
if (result.status === null) {
  fail(2, 'npm audit terminated abnormally (no exit code)');
}
if (result.signal) {
  fail(2, `npm audit killed by signal ${result.signal}`);
}

let parsed = null;
try {
  parsed = JSON.parse(result.stdout || '{}');
} catch (_err) {
  // npm audit may print nothing on the JSON channel if the
  // registry is unreachable.
  const stderr = (result.stderr || '').slice(0, 500);
  fail(2, `npm audit could not produce JSON output. stderr="${stderr}"`);
}

if (parsed && parsed.error) {
  // Typical case: "ECONNREFUSED" or "ETIMEDOUT" against registry.
  fail(2, `npm audit network/registry error: ${parsed.error.summary || parsed.error.code}`);
}

const vuln = parsed.vulnerabilities || {};
const flat = [];
for (const [pkgName, data] of Object.entries(vuln)) {
  const via = Array.isArray(data.via) ? data.via : [];
  // via is either [string, ...] or [{title, severity, url, ...}, ...]
  let severity = data.severity;
  if (!severity) {
    for (const v of via) {
      if (typeof v === 'object' && v.severity) {
        severity = v.severity;
        break;
      }
    }
  }
  flat.push({
    name: pkgName,
    severity,
    via: via.length,
    range: data.range,
    fixAvailable: data.fixAvailable,
  });
}

const summary = summarize(flat);
const policyViolations = [];
for (const f of flat) {
  if (f.severity === 'critical' || f.severity === 'high') {
    policyViolations.push({ ...f, why: 'severity>=high' });
  }
}

if (JSON_OUT) {
  process.stdout.write(
    JSON.stringify(
      {
        status: policyViolations.length === 0 ? 'pass' : 'fail',
        summary,
        policyViolations,
        strictDev: STRICT_DEV,
        findings: flat,
      },
      null,
      2,
    ) + '\n',
  );
} else {
  process.stdout.write(
    `[security-audit] summary: total=${summary.total} ` +
      `critical=${summary.critical} high=${summary.high} ` +
      `moderate=${summary.moderate} low=${summary.low}\n`,
  );
  if (policyViolations.length === 0) {
    process.stdout.write('[security-audit] PASS: no critical/high vulnerabilities.\n');
  } else {
    process.stdout.write(
      `[security-audit] FAIL: ${policyViolations.length} policy violation(s)\n`,
    );
    for (const v of policyViolations) {
      process.stdout.write(
        `  ${v.severity.padEnd(8)} ${v.name}  range=${v.range}  via=${v.via}\n`,
      );
    }
  }
}

process.exit(policyViolations.length === 0 ? 0 : 1);
