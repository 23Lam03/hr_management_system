#!/usr/bin/env node
// scripts/secret-scan.js — Phase 17
//
// Pure-Node secret scanner. Walks the repository, applies the
// patterns in `src/lib/secretPatterns.js`, and exits non-zero
// if any non-allowlisted match is found.
//
// IMPORTANT guarantees:
//   - The scanner NEVER prints the matched secret value. It
//     prints only the file path, line number, pattern id, and
//     severity. The matched value is replaced with a redacted
//     placeholder of the form `[REDACTED,len=NN]`.
//   - The scanner NEVER follows symlinks.
//   - The scanner NEVER descends into node_modules or the
//     patterns catalog itself (allowlist).
//   - The scanner is read-only: it does not modify any file.
//
// Exit codes:
//   0  no matches
//   1  one or more matches
//   2  invalid arguments

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  SECRET_PATTERNS,
  ALLOWLIST_LINE_PATTERNS,
  SCANNER_FILE_IGNORES,
} from '../src/lib/secretPatterns.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ROOT = path.resolve(__dirname, '..');

const args = process.argv.slice(2);
const ROOT_OVERRIDE = (() => {
  const i = args.indexOf('--root');
  if (i >= 0 && i + 1 < args.length) return path.resolve(args[i + 1]);
  return ROOT;
})();

const ONLY_PATHS = (() => {
  const i = args.indexOf('--only');
  if (i >= 0 && i + 1 < args.length) return [args[i + 1]];
  return null;
})();

const MAX_FILE_BYTES = 1024 * 1024; // 1 MiB

function shouldIgnoreFile(relPath) {
  return SCANNER_FILE_IGNORES.some((p) => {
    if (typeof p === 'string') return relPath.endsWith(p);
    return p.test(relPath);
  });
}

function isLineAllowlisted(line) {
  return ALLOWLIST_LINE_PATTERNS.some((p) => p.test(line));
}

function redact(value) {
  if (typeof value !== 'string') return '[REDACTED]';
  return `[REDACTED,len=${value.length}]`;
}

function walk(dir, baseDir) {
  const out = [];
  let entries;
  try {
    entries = fs.readdirSync(dir, { withFileTypes: true });
  } catch (_err) {
    return out;
  }
  for (const e of entries) {
    if (e.name.startsWith('.')) continue; // skip .git, .env*, etc.
    const full = path.join(dir, e.name);
    const rel = path.relative(baseDir, full);
    if (e.isDirectory()) {
      out.push(...walk(full, baseDir));
    } else if (e.isFile()) {
      out.push(rel);
    }
  }
  return out;
}

function scanFile(relPath) {
  const full = path.join(ROOT_OVERRIDE, relPath);
  let stat;
  try {
    stat = fs.statSync(full);
  } catch (_err) {
    return [];
  }
  if (stat.size > MAX_FILE_BYTES) return [];
  let content;
  try {
    content = fs.readFileSync(full, 'utf8');
  } catch (_err) {
    return [];
  }
  const findings = [];
  const lines = content.split('\n');
  for (let i = 0; i < lines.length; i += 1) {
    const line = lines[i];
    if (isLineAllowlisted(line)) continue;
    for (const p of SECRET_PATTERNS) {
      // Reset the regex state per call (since patterns are
      // module-level with /g).
      p.re.lastIndex = 0;
      let m = p.re.exec(line);
      while (m !== null) {
        findings.push({
          file: relPath,
          line: i + 1,
          pattern: p.id,
          severity: p.severity,
          match: redact(m[0]),
        });
        m = p.re.exec(line);
      }
    }
  }
  return findings;
}

function main() {
  const allFiles = ONLY_PATHS
    ? ONLY_PATHS.map((p) => path.relative(ROOT_OVERRIDE, p))
    : walk(ROOT_OVERRIDE, ROOT_OVERRIDE);

  const target = allFiles.filter((f) => !shouldIgnoreFile(f));
  const allFindings = [];
  for (const f of target) {
    const findings = scanFile(f);
    allFindings.push(...findings);
  }

  if (allFindings.length === 0) {
    process.stdout.write(
      `[secret-scan] OK: scanned ${target.length} files, 0 findings\n`,
    );
    process.exit(0);
  }

  // Group by severity for the summary line.
  const bySev = { critical: 0, high: 0, medium: 0, low: 0 };
  for (const f of allFindings) {
    if (bySev[f.severity] !== undefined) bySev[f.severity] += 1;
  }
  process.stdout.write(
    `[secret-scan] FAIL: ${allFindings.length} finding(s) ` +
      `critical=${bySev.critical} high=${bySev.high} ` +
      `medium=${bySev.medium} low=${bySev.low}\n`,
  );
  for (const f of allFindings) {
    process.stdout.write(
      `  ${f.severity.padEnd(8)} ${f.pattern}  ${f.file}:${f.line}  match=${f.match}\n`,
    );
  }
  process.stdout.write(
    '[secret-scan] values are redacted; investigate via git history / pre-commit hook.\n',
  );
  process.exit(1);
}

main();
