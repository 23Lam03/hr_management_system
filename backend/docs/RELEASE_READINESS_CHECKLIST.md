# Release Readiness Checklist — HRM Backend (Phase 17)

> Tài liệu này mô tả các bước mà operator phải hoàn tất trước, trong và sau khi phát hành một bản release.
> Mỗi hạng mục được gắn một trong ba nhãn:
>
> - **[AUTO-CI]** — tự động chạy bởi `.github/workflows/ci.yml`.
> - **[OPERATOR]** — người vận hành phải xác minh thủ công (qua checklist, log, dashboard, v.v.).
> - **[EXTERNAL]** — phụ thuộc vào hạ tầng / dịch vụ bên ngoài mà repo này không kiểm soát.
>
> Phase 17 chỉ tự động hóa các hạng mục **[AUTO-CI]**. Hai nhóm còn lại luôn phải có con người xác nhận.

---

## 1. Pre-release

Trước khi tag một bản release.

| # | Hạng mục | Loại | Bằng chứng xác minh |
|---|---|---|---|
| 1.1 | CI pass (lint + test + audit + secret scan) | [AUTO-CI] | GitHub Actions run màu xanh trên PR / push |
| 1.2 | `npm run syntax-check` pass | [AUTO-CI] | Step `lint > Syntax check` màu xanh |
| 1.3 | Toàn bộ test suite pass | [AUTO-CI] | Step `test` màu xanh, số test = expected |
| 1.4 | Secret scanner sạch (không có credential trong source) | [AUTO-CI] | Step `lint > Secret scan` màu xanh, log `[secret-scan] OK: 0 findings` |
| 1.5 | `npm run security:audit` không có critical/high ở production deps | [AUTO-CI] | Step `audit` màu xanh (BLOCKED ≠ FAIL — xem §6) |
| 1.6 | Test-DB guard chấp nhận URI mà CI dùng | [AUTO-CI] | Step `test > Validate test MongoDB URI` chạy thành công |
| 1.7 | Migration / schema / index changes đã được review | [OPERATOR] | PR review chấp thuận; `git diff` kiểm tra |
| 1.8 | `.env.example` được cập nhật cho mọi biến mới | [OPERATOR] | Diff giữa `.env.example` và `.env` (ngoại trừ giá trị) |
| 1.9 | Không có credential trong source code (review bằng `git diff` + secret scan) | [AUTO-CI] + [OPERATOR] | CI pass + review mắt thường |
| 1.10 | API compatibility đã được đánh giá (không gãy client nếu không có version bump major) | [OPERATOR] | PR notes ghi rõ breaking / non-breaking |
| 1.11 | Tài liệu vận hành (docs/CI_AND_SECURITY_GATES.md, docs/PRODUCTION_DEPLOYMENT.md) cập nhật | [OPERATOR] | Review nội dung doc trong PR |
| 1.12 | `package.json` version đúng SemVer (major.minor.patch[-prerelease]) | [OPERATOR] | `npm run release:check` (gating script) |

---

## 2. Pre-deployment

Trước khi rollout lên production.

| # | Hạng mục | Loại | Bằng chứng xác minh |
|---|---|---|---|
| 2.1 | Đã rotate mọi Atlas credential từng bị lộ (commit trước đây / leak) | [OPERATOR] | Atlas activity log không còn key cũ |
| 2.2 | `JWT_SECRET` production mới, đủ mạnh (>= 32 bytes ngẫu nhiên) | [OPERATOR] | `openssl rand -hex 32` được paste vào secret manager |
| 2.3 | MongoDB Atlas IP allowlist giới hạn theo CIDR / VPC peering | [EXTERNAL] | Atlas Network Access dashboard |
| 2.4 | Production dùng HTTPS (TLS) | [EXTERNAL] | Reverse proxy / load balancer config |
| 2.5 | `TRUST_PROXY` được cấu hình đúng với reverse proxy (`1`, `loopback`, ...) | [OPERATOR] | `src/config/env.js` assertion pass khi boot |
| 2.6 | `CLIENT_URL`, CORS, `NODE_ENV=production` đã xác minh | [OPERATOR] | `npm start` không fail config-validation |
| 2.7 | Backup MongoDB Atlas có policy (PIT / continuous) và đã restore-test trong vòng 90 ngày | [EXTERNAL] | Atlas Backup tab + runbook restore |
| 2.8 | Process supervisor / PaaS (systemd, PM2, k8s, Render, Fly) cấu hình restart + health probe | [EXTERNAL] | Process config trong repo infra |
| 2.9 | Rate limiting đã được cân nhắc cho mô hình single-instance vs multi-instance (dùng store ngoài nếu multi) | [OPERATOR] | Config review |
| 2.10 | Health checks `/api/health/livez` và `/api/health/readyz` tích hợp load balancer | [OPERATOR] | LB health check URL trỏ đúng |
| 2.11 | Logging + metrics + request ID được thu thập tập trung | [EXTERNAL] | Datadog / Loki / Prometheus scrape OK |
| 2.12 | Alert sink kết nối receiver thật (Slack / PagerDuty / webhook) | [EXTERNAL] | Test alert thử trong staging |
| 2.13 | Audit cleanup job đã lên lịch (`scripts/cleanup-audit-logs.js` qua cron) | [OPERATOR] | Crontab / k8s CronJob |
| 2.14 | Secrets cấu hình qua môi trường triển khai / secret manager (KHÔNG trong `.env` ship lên image) | [OPERATOR] | Image diff không chứa `.env` |

---

## 3. Post-deployment

Trong vòng 30 phút đầu sau khi rollout.

| # | Hạng mục | Loại | Bằng chứng xác minh |
|---|---|---|---|
| 3.1 | `/api/health/livez` trả 200 | [AUTO-CI] probe / [OPERATOR] | `curl` / health-check dashboard |
| 3.2 | `/api/health/readyz` trả 200 (DB connected) | [AUTO-CI] probe / [OPERATOR] | `curl` |
| 3.3 | Đăng nhập + refresh token rotation hoạt động | [OPERATOR] | Smoke test thủ công qua UI / curl |
| 3.4 | Phân quyền RBAC: admin / manager / employee đọc đúng resource | [OPERATOR] | Smoke test theo matrix |
| 3.5 | Log có request ID; metrics có request counter; cảnh báo lọt vào alert sink | [OPERATOR] | Log search + dashboard |
| 3.6 | Kết nối DB + index tồn tại (không phải vừa tạo nóng) | [OPERATOR] | `db.collection.getIndexes()` |
| 3.7 | Error rate / latency / CPU / RAM trong ngưỡng baseline | [OPERATOR] | APM dashboard |
| 3.8 | Backup policy đang chạy (job gần nhất < 24h) | [EXTERNAL] | Atlas / S3 / disk snapshot log |
| 3.9 | Audit retention / cleanup đang chạy đúng lịch | [OPERATOR] | Crontab / k8s history |

---

## 4. Rollback

Khi cần quay về bản trước.

| # | Hạng mục | Loại | Bằng chứng xác minh |
|---|---|---|---|
| 4.1 | Xác định bản release trước (git tag / image tag) | [OPERATOR] | `git tag --sort=-v:refname | head` |
| 4.2 | Xác định cách quay lại: redeploy image cũ / revert commit / switch k8s deployment | [OPERATOR] | Runbook cụ thể cho môi trường |
| 4.3 | Migration không tương thích: KHÔNG tự động revert schema; viết migration "down" riêng | [OPERATOR] | Migration log + DBA review |
| 4.4 | KHÔNG xóa dữ liệu / KHÔNG chạy migration phá hủy để "rollback" | [OPERATOR] | Runbook cấm các thao tác này |
| 4.5 | Điều kiện kích hoạt rollback (SLO breach > 15 phút, error rate > 5%, alert nghiêm trọng) | [OPERATOR] | Runbook § "Rollback triggers" |
| 4.6 | Người chịu trách nhiệm phê duyệt rollback (on-call lead / SRE) | [OPERATOR] | On-call schedule |
| 4.7 | Ghi nhận sự cố: timeline, người xử lý, hành động, follow-up | [OPERATOR] | Postmortem doc trong 24h |
| 4.8 | Sau rollback: chạy lại §3 (Post-deployment) trên bản cũ | [OPERATOR] | Checklist §3 |

---

## 5. Quy ước Versioning

- Bump **MAJOR** khi thay đổi API contract (path, payload, status code) theo cách không tương thích ngược.
- Bump **MINOR** khi thêm feature / endpoint mới mà KHÔNG phá client cũ.
- Bump **PATCH** khi sửa bug / refactor không đổi behavior.
- Tiền tố `-rc.N` cho release candidate, `-alpha.N` / `-beta.N` cho pre-release.

Phase 17 khởi tạo version `0.1.0` (chưa ổn định API; Phase 17 chỉ thêm CI/CD gates).

---

## 6. Phân biệt PASS / FAIL / BLOCKED

Khi chạy `npm run security:audit` hoặc CI audit step:

- **PASS** — registry phản hồi, không có critical/high.
- **FAIL** — registry phản hồi, có ít nhất một critical/high.
- **BLOCKED** — registry KHÔNG phản hồi (mạng, sandbox, v.v.). KHÔNG được coi là PASS.

Một kết quả BLOCKED cần operator chạy lại khi có mạng, hoặc nâng cấp CI lên môi trường có whitelist npm registry.

---

## 7. Lưu ý về CI không có network

Nếu CI bị chặn network tới npm registry:

- Secret scan + syntax check + test (với Mongo service) VẪN chạy bình thường.
- Audit step sẽ BLOCKED. Không xem BLOCKED là xanh; operator phải retry.

---

## 8. Những thứ Phase 17 KHÔNG tự động hóa

Danh sách tỉnh táo để operator không tin tưởng quá mức:

- Rotation credential thật (Atlas user, JWT secret, refresh secret).
- Atlas IP allowlist.
- HTTPS / TLS termination.
- Backup / restore drill.
- Alert receiver wiring thật (Slack / PagerDuty).
- Load balancer health-check config.
- Process supervisor / restart policy.
- API contract review (cần con người đọc OpenAPI / client code).

---

Tài liệu này được sinh ra bởi Phase 17. Mọi thay đổi cần review kèm PR.
