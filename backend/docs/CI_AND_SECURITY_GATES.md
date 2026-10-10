# CI & Security Gates — HRM Backend (Phase 17)

> Tài liệu vận hành cho GitHub Actions workflow, secret scanning, dependency audit và test-database guard.
> Đọc kèm `docs/RELEASE_READINESS_CHECKLIST.md` để biết cách gate này kết nối với quy trình release.

---

## 1. Tổng quan pipeline

Workflow `ci.yml` chạy 4 job độc lập, theo thứ tự:

```
  lint          (no DB needed)
   │
   ├─▶ test      (MongoDB service container)
   │
   └─▶ audit     (cần npm registry)
        │
        └─▶ release-gate   (summary; không chặn)
```

- **lint**: syntax check + secret scan. Không yêu cầu network ngoài repo.
- **test**: chạy `npm test` với `mongodb:7` service. Có thể chạy offline tới Mongo local.
- **audit**: gọi `npm audit` qua wrapper `scripts/security-audit.js`. Cần network tới registry.
- **release-gate**: chạy `scripts/release-gate.js` chỉ để in summary. Không chặn, không push.

### Quyền tối thiểu

`GITHUB_TOKEN` chỉ có `contents: read`. Không có `packages: write`, `deployments: write`, `id-token: write`, `pages: write`, hay `actions: write`. Workflow không thể tự deploy, push tag hay publish package.

### Concurrency

`concurrency.group = ci-${{ workflow }}-${{ ref }}` với `cancel-in-progress: true`. Khi có push mới lên cùng một ref, các run cũ bị hủy để tiết kiệm CI minutes.

### Trigger

- `push` và `pull_request` trên `main` và `master`.
- `workflow_dispatch` cho manual run (operator-triggered).

---

## 2. Cấu hình CI

### Repository secrets cần thiết

Mặc định workflow KHÔNG cần GitHub secret. Lý do:
- MongoDB test chạy trên service container trong CI runner.
- JWT secret trong test dùng giá trị literal `ci-jwt-secret-do-not-use-in-production-1234567890` (đủ dài để vượt `assertConfig` của test, KHÔNG phải secret thật).
- Audit chạy `npm audit` không cần token.

Nếu sau này cần scan bằng GitHub Advanced Security secret-scanning API hoặc gửi alert tới receiver, phải thêm secret tương ứng VÀ document rõ trong PR.

### Thay đổi Node version

`backend/.nvmrc` quyết định Node version. Sửa file này để bump version.

Hiện tại matrix:
- `node: ['20.x']` (test job) — pinned qua `.nvmrc`.
- `mongo: ['7.0']` (test job).

Khi bump Node, cũng phải đảm bảo `package.json` `engines.node` còn tương thích.

---

## 3. Chạy CI trên máy local

Trước khi push, operator có thể chạy thủ công:

```bash
cd backend

# 1. Syntax check (rất nhanh, không cần DB)
npm run ci:syntax

# 2. Secret scan
npm run ci:secret-scan

# 3. Audit
npm run ci:audit
# Có thể trả BLOCKED nếu không có mạng. Đó không phải PASS.

# 4. Test (cần MongoDB local)
npm run ci:test

# 5. Release gate (summary; KHÔNG push)
npm run release:check
```

Nếu tất cả PASS, push branch lên và mở PR.

---

## 4. Secret Scanning

### Cách hoạt động

`scripts/secret-scan.js` quét toàn bộ repo (trừ `node_modules/`, lockfile, và các file fixture đã allowlist). Mỗi dòng được khớp với các regex trong `src/lib/secretPatterns.js`. Nếu khớp VÀ dòng không nằm trong `ALLOWLIST_LINE_PATTERNS`, scanner exit 1.

### Patterns được phát hiện

- `mongodb://user:pass@host` (Atlas, prod, dev — bất kỳ có credential).
- `mongodb+srv://` với credential.
- Compact JWS (3 base64url segments).
- AWS access key ID (AKIA/ASIA), AWS secret access key (40-char base64).
- GitHub tokens (`ghp_`, `gho_`, `ghu_`, `ghs_`).
- Slack tokens (`xox*`).
- Google API key (`AIza...`).
- PEM private key headers.
- `Bearer <token>` với 24+ alnum chars.
- `JWT_SECRET="real-shape value"` (loại trừ placeholder).

### Allowlist

- `ALLOWLIST_LINE_PATTERNS` lọc từng dòng (placeholder, doc reference).
- `SCANNER_FILE_IGNORES` lọc cả file (test fixtures dùng credential-shape làm input cho test rejection).

Để thêm file test mới có chứa credential-shape fixtures: thêm regex vào `SCANNER_FILE_IGNORES` VỚI comment giải thích. Không tắt pattern.

### Scanner không in secret

Scanner in `match=[REDACTED,len=NN]` thay vì giá trị thật. Nếu bạn thấy giá trị thật bị lộ, đó là bug — mở issue ngay.

### Phát hiện credential thật trong Git history

Nếu CI chạy trên main và thấy finding, KHÔNG tự động rewrite history. Bước xử lý:

1. Rotate credential thật NGAY tại provider (Atlas, GitHub, v.v.).
2. Xóa file khỏi working tree, commit, push.
3. Sau khi push, đánh dấu credential cũ là đã rotate.
4. Lên lịch history rewrite (BFG / git filter-repo) trong cửa sổ bảo trì, khi đã phê duyệt.

---

## 5. Dependency Audit

### Wrapper: `scripts/security-audit.js`

Không gọi thẳng `npm audit`. Wrapper chuẩn hóa policy:

- **PASS** — không có critical/high.
- **FAIL** — có critical hoặc high.
- **BLOCKED** — registry không phản hồi. Không phải PASS.

### Policy mặc định

| Severity | Production deps | Dev deps |
|---|---|---|
| critical | FAIL | FAIL |
| high | FAIL | FAIL |
| moderate | report only | report only |
| low | report only | report only |

Operator có thể pass `--strict-dev` để nâng dev-dep lên cùng policy với production.

### KHÔNG tự động fix

Wrapper KHÔNG gọi `npm audit fix` hay `npm audit fix --force`. Operator phải tự:

1. Đọc GHSA / CVE ID.
2. Đánh giá ảnh hưởng.
3. Update thủ công (bump patch / minor, hoặc pin known-good).

### Cấu hình khi registry bị chặn

Khi CI chạy trong môi trường không có network ra ngoài (sandbox, on-prem runner):

- Audit step sẽ return `exit 2` (BLOCKED).
- Workflow sẽ fail.
- Cần whitelist `registry.npmjs.org` (HTTPS) cho runner, hoặc dùng mirror nội bộ.

---

## 6. Test-DB Guard

### Cách hoạt động

`src/lib/testDbGuard.js` cung cấp `resolveAndValidateTestUri()`. Bất kỳ test setup nào cũng nên gọi hàm này trước khi mở connection.

### Quy tắc chấp nhận

- Scheme `mongodb://` (KHÔNG chấp nhận `mongodb+srv://` ngoại trừ loopback — và ngay cả loopback cũng không có ý nghĩa với srv).
- Host: `127.0.0.1`, `localhost`, `::1`, hoặc RFC1918 (10/8, 172.16/12, 192.168/16), hoặc `.local` / `.internal`.
- KHÔNG có user/pass trong URI.
- DB name khớp một trong các pattern: `test_*`, `*_test`, `hrm_test_*`, `integration_*`, `e2e_*`, `ci_*`, `tmp_*`, `ephemeral_*`, `scratch_*`.

### Quy tắc từ chối

- `*.mongodb.net`, `*.mongodb.com`, `*.atlas.*` (Atlas / cloud).
- Public IPv4.
- URI có `user:pass@`.
- DB name: `hrm_production`, `hrm`, `prod`, hoặc bất kỳ tên nào không match allowlist.

### Error message

Khi URI bị reject, error message nói LÝ DO và MÃ LỖI, KHÔNG echo URI. Đây là yêu cầu bảo mật: log có thể bị scrape.

### Sử dụng

Trong CI:

```yaml
- name: Validate test MongoDB URI
  env:
    TEST_MONGODB_URI: mongodb://127.0.0.1:27017/hrm_test_db
  run: node -e "import('./src/lib/testDbGuard.js').then(m => m.resolveAndValidateTestUri())"
```

Trong local:

```bash
npm run test:guard
```

---

## 7. Khắc phục sự cố thường gặp

### Audit step fail với `EAI_AGAIN` hoặc `ECONNREFUSED`

Network tới `registry.npmjs.org` bị chặn. Whitelist hoặc dùng mirror.

### Secret scan fail với `mongodb_uri_with_password` trong file test

Thêm regex vào `SCANNER_FILE_IGNORES` (trong `src/lib/secretPatterns.js`) với comment giải thích. KHÔNG tắt pattern.

### Test fail với `Refusing to use TEST_MONGODB_URI: ...`

URI test đang trỏ tới host không được phép. Kiểm tra:

- `TEST_MONGODB_URI` (không phải `MONGODB_URI`).
- Hostname là `127.0.0.1` hoặc `localhost` (không phải `db.local`).
- DB name có chứa `test` hoặc match allowlist.

### Workflow không trigger

- Kiểm tra branch name có nằm trong `on.push.branches` / `on.pull_request.branches` không.
- Branch `feature/*` sẽ KHÔNG trigger `push`, nhưng VẪN trigger pull_request khi mở PR vào `main`.

---

## 8. Tài liệu liên quan

- `docs/RELEASE_READINESS_CHECKLIST.md` — checklist 4 giai đoạn release.
- `docs/PRODUCTION_DEPLOYMENT.md` — production deployment guide.
- `docs/SECURITY_PERFORMANCE_AUDIT.md` — Phase 12 audit.
- `README.md` — overview.
