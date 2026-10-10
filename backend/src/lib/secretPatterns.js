// lib/secretPatterns.js — Phase 17
//
// Regex patterns for detecting common secret formats. The
// intent is NOT to be exhaustive (no scanner is) — the intent
// is to catch the most common mistakes a developer would make
// when committing a config file or test fixture.
//
// Every pattern below is tested by `tests/secretPatterns.test.js`
// against:
//   - real-shape POSITIVE examples (synthetic test fixtures)
//   - the most common NEGATIVE examples (placeholders,
//     documentation, empty values, common code)
//
// The allowlist in `ALLOWLIST_LINE_PATTERNS` is applied as a
// filter on the LINE that contains the match. A line that
// matches the allowlist is considered safe and is not flagged.

export const SECRET_PATTERNS = Object.freeze([
  {
    id: 'mongodb_uri_with_password',
    description: 'MongoDB connection string with embedded password',
    // mongodb://user:pass@host or mongodb+srv://user:pass@host
    re: /mongodb(?:\+srv)?:\/\/[^/\s:@]+:[^/\s@]+@[^\s"'`<>]+/g,
    severity: 'critical',
  },
  {
    id: 'mongodb_credential_at',
    // mongodb://anyuser:something@host
    re: /mongodb(?:\+srv)?:\/\/[^\s"'`<>]*:[^\s"'`<>]*@[^\s"'`<>]+/g,
    description: 'MongoDB connection string with user:pass@host shape',
    severity: 'critical',
  },
  {
    id: 'jwt_token',
    description: 'Compact JWS (three base64url segments) accidentally committed',
    // Three base64url segments separated by dots
    re: /\beyJ[A-Za-z0-9_-]{8,}\.[A-Za-z0-9_-]{8,}\.[A-Za-z0-9_-]{8,}\b/g,
    severity: 'high',
  },
  {
    id: 'aws_access_key_id',
    description: 'AWS access key ID (AKIA/ASIA prefix, 20 chars)',
    re: /\b(?:AKIA|ASIA)[0-9A-Z]{16}\b/g,
    severity: 'critical',
  },
  {
    id: 'aws_secret_access_key',
    description: 'AWS secret access key (40-char base64 next to aws_secret_access_key=)',
    // 40 chars of base64, typically paired with "aws_secret_access_key="
    re: /aws[_-]?secret[_-]?access[_-]?key[_-]?(?:id)?\s*[:=]\s*["']?([A-Za-z0-9/+=]{40})\b/gi,
    severity: 'critical',
  },
  {
    id: 'github_personal_access_token',
    description: 'GitHub personal access token (ghp_ prefix)',
    re: /\bghp_[A-Za-z0-9]{30,}\b/g,
    severity: 'critical',
  },
  {
    id: 'github_oauth_token',
    description: 'GitHub OAuth token (gho_ prefix)',
    re: /\bgho_[A-Za-z0-9]{30,}\b/g,
    severity: 'critical',
  },
  {
    id: 'github_app_token',
    description: 'GitHub app token (ghu_/ghs_ prefix)',
    re: /\b(ghu|ghs)_[A-Za-z0-9]{30,}\b/g,
    severity: 'critical',
  },
  {
    id: 'slack_token',
    description: 'Slack token (xox[abprs]- prefix)',
    re: /\bxox[abprs]-[A-Za-z0-9-]{10,}\b/g,
    severity: 'critical',
  },
  {
    id: 'google_api_key',
    description: 'Google API key (AIza prefix, 39 chars)',
    re: /\bAIza[0-9A-Za-z\-_]{35}\b/g,
    severity: 'high',
  },
  {
    id: 'private_key_block',
    description: 'PEM private key header (well-known type)',
    // PEM private key header — the actual key contents may follow.
    re: /-----BEGIN (?:RSA |EC |DSA |OPENSSH |PGP )?PRIVATE KEY-----/g,
    severity: 'critical',
  },
  {
    id: 'pem_private_key_any',
    description: 'PEM private key header (any type)',
    re: /-----BEGIN [A-Z ]*PRIVATE KEY-----/g,
    severity: 'critical',
  },
  {
    id: 'generic_high_entropy_bearer',
    description: 'High-entropy Bearer token (accidental copy-paste of auth header)',
    // "Bearer <token>" with at least 24 alnum chars. Matches
    // accidental copy-paste of authorization headers.
    re: /\bBearer\s+[A-Za-z0-9_\-]{24,}\b/g,
    severity: 'high',
  },
  {
    id: 'jwt_secret_assignment',
    description: 'JWT_SECRET=... with a real-shape (non-placeholder) value',
    // "JWT_SECRET=..." with a value that is NOT a placeholder.
    re: /JWT_SECRET\s*[:=]\s*["'](?!change-me|please-change|replace-me|placeholder|example|your-secret|<[^>]+>)([^"'\s]{16,})["']/gi,
    severity: 'high',
  },
]);

// Lines that match an allowlist regex are considered safe. The
// list is intentionally narrow: every entry MUST have a
// justifying comment.
export const ALLOWLIST_LINE_PATTERNS = Object.freeze([
  // Files in this repo (e.g. lib/testDbGuard.js) reference
  // 127.0.0.1:27017/hrm_test_db. We must not flag those.
  /127\.0\.0\.1:27017\/hrm_test_db/,

  // The `.env.example` and doc files reference "change-me" /
  // "your-secret" / "example-secret" placeholders. The
  // assignment pattern above already rejects those; this catches
  // the prose that mentions them.
  /change-me|please-change|replace-me|placeholder|your-secret/,

  // The `mongodb+srv` substring appears in our own pattern
  // catalog; allow the catalog itself.
  /lib\/secretPatterns\.js|src\/lib\/testDbGuard\.js/,

  // The Phase 17 docs (CI_AND_SECURITY_GATES.md and
  // RELEASE_READINESS_CHECKLIST.md) explain what the patterns
  // are looking for and use real-shape strings as illustrative
  // examples. They are file-allowlisted in SCANNER_FILE_IGNORES.

  // Test fixtures under tests/ may use synthetic values like
  // "ghp_FAKEFAKEFAKEFAKEFAKEFAKEFAKEFAKE" — but we still
  // match those (because they are real-shape). The scanner is
  // expected to be run BEFORE tests/, not on tests/.

  // The empty bearer header "Bearer " with no token.
  /Bearer\s+$/,

  // When the surrounding line is a documentation line that
  // lists token prefixes in a prose form (e.g. "`ghp_`,
  // `gho_`"), we don't flag the inline backticked token.
  /`ghp_`|`gho_`|`ghu_`|`ghs_`|`xox\*`|`AIza\.\.\.`/,
]);

// Files that the scanner should ignore entirely. Keep the
// allowlist SMALL. Phase 17 default = node_modules + the audit
// log output (we are not the audit log host).
//
// IMPORTANT: We ignore the test files that intentionally use
// credential-shaped strings as fixtures. The scanner's job is
// to catch ACCIDENTAL commits, not to flag deliberate test
// inputs. If you add a new test that uses a credential-shape
// string, either (a) add it to the ignore list below with a
// comment explaining why, or (b) use a placeholder value that
// does not match any pattern.
export const SCANNER_FILE_IGNORES = Object.freeze([
  /^node_modules\//,
  /^coverage\//,
  /^\.git\//,
  /package-lock\.json$/,
  // The scanner itself: its own patterns reference credential
  // shapes deliberately. Self-scan must not false-positive.
  /src\/lib\/secretPatterns\.js$/,
  // The test-DB guard: it parses URIs that may carry
  // `mongodb+srv` shapes for the explicit purpose of rejecting
  // them.
  /src\/lib\/testDbGuard\.js$/,
  // Phase 12 test fixtures use credential-shaped URIs to verify
  // the rejection logic. These are deliberate.
  /tests\/helpers\.db\.test\.js$/,
  // Phase 13 deployment tests use real-shape JWT secrets to
  // verify the placeholder check. Deliberate.
  /tests\/security\.deployment\.test\.js$/,
  // Phase 17 test fixtures use credential-shaped values to
  // verify the scanner's detection logic. Deliberate.
  /tests\/secretPatterns\.test\.js$/,
  /tests\/secretScan\.test\.js$/,
  // Phase 17 testDbGuard tests use credential-shaped URIs to
  // verify the guard's rejection logic. Deliberate.
  /tests\/testDbGuard\.test\.js$/,
  // Phase 17 docs/CI_AND_SECURITY_GATES.md and
  // docs/RELEASE_READINESS_CHECKLIST.md include real-shape
  // strings as illustrative examples. Deliberate.
  /docs\/CI_AND_SECURITY_GATES\.md$/,
  /docs\/RELEASE_READINESS_CHECKLIST\.md$/,
]);
