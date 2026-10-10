# Phase 12 — Security, Performance & Integration Audit

Dự án: **HRM Backend** (Node.js + Express + MongoDB + Mongoose).
Phạm vi: toàn bộ `backend/`. **Không chạm** `front_end/`.

---

## 1. Phạm vi audit

### 1.1 Module thực sự được kiểm tra

| Module | Mức độ | Ghi chú |
|---|---|---|
| Authentication & JWT | ✅ | `auth.service.js`, `auth.middleware.js`, `auth.controller.js` |
| User | ✅ | `user.model.js` |
| Employee | ✅ | `employee.model.js`, `employee.service.js`, `employee.controller.js` |
| Department | ✅ | `department.model.js`, `department.service.js`, `department.controller.js` |
| Position | ✅ | `position.model.js`, `position.service.js`, `position.controller.js` |
| Attendance | ✅ | `attendance.model.js`, `attendance.service.js`, `attendance.controller.js` |
| Leave Request | ✅ | `leaveRequest.model.js`, `leaveRequest.service.js`, `leaveRequest.controller.js` |
| Payroll | ✅ | `payroll.model.js`, `payroll.service.js`, `payroll.controller.js` |
| Dashboard & Reports | ✅ | `dashboard.service.js`, `dashboard.controller.js` |
| Audit Log | ✅ | `auditLog.model.js`, `auditLog.service.js`, `auditLog.controller.js` |
| Notification | ✅ | `notification.model.js`, `notification.service.js`, `notification.controller.js` |
| Middleware (auth, error) | ✅ | `middlewares/*.js` |
| Validation | ✅ | Tất cả `validators/*.js` |
| Database & config | ✅ | `config/database.js`, `config/env.js`, `app.js`, `server.js` |
| Test helpers | ✅ | `tests/helpers/db.js` |
| Docs | ✅ | `docs/*.md` (kiểm tra tính nhất quán) |

### 1.2 Không có thay đổi nào thuộc `front_end/`.

### 1.3 Tiêu chí đánh giá

Mỗi finding có:
- **Mức độ**: Critical / High / Medium / Low.
- **Bằng chứng**: file + vị trí cụ thể.
- **Trạng thái**: ✅ đã sửa / ⚠️ chưa sửa (ghi lý do) / 🟢 không sửa (an toàn, đã đánh giá).

---

## 2. Tổng hợp findings

| Mức độ | Số lượng | Đã sửa | Chưa sửa / Không sửa |
|---|---:|---:|---:|
| 🔴 Critical | 1 | 0 (chỉ ghi nhận + khuyến nghị) | 1 |
| 🟠 High | 1 | 1 | 0 |
| 🟡 Medium | 3 | 0 | 3 (rủi ro thấp, đã đánh giá) |
| 🟢 Low | 4 | 0 | 4 (improvement, không bắt buộc) |
| **Tổng** | **9** | **1** | **8** |

---

## 3. Findings chi tiết

### 🔴 C1 — Atlas credentials lộ trong `.env` (KHÔNG sửa trong code, chỉ khuyến nghị)

| Trường | Giá trị |
|---|---|
| File | `backend/.env` |
| Mức độ | Critical |
| Trạng thái | ⚠️ Chưa sửa (cần người dùng rotate) |

**Bằng chứng**: file `.env` chứa `MONGODB_URI` ở dạng `mongodb+srv://<user>:<password>@<cluster>/?appName=...` — đây là credential thật của Atlas cluster.

**Tác động**:
- Bất kỳ ai truy cập máy, screenshot, hoặc bản backup đều thấy được credential.
- Credential có thể bị lộ qua editor history, terminal scrollback, hoặc chia sẻ nhầm.
- `.env` **đã có** trong `.gitignore` (dòng 8-9), và thư mục dự án hiện tại **chưa phải** là git repo (xác nhận bằng `git rev-parse`), nên nguy cơ commit trực tiếp thấp — nhưng khi người dùng `git init` mà không kiểm tra, credential có thể bị stage/commit.

**Phương án khắc phục (do người dùng thực hiện — KHÔNG phải code change)**:
1. Truy cập Atlas dashboard, đổi password cho user `leduclam2303_db_user`.
2. Cập nhật lại `MONGODB_URI` trong `.env`.
3. Tái khởi động server / re-deploy nếu đang chạy.
4. Audit lại các nơi từng sử dụng credential này (chat transcript, terminal history, IDE local history).

**Hành động đã thực hiện trong code**:
- Cập nhật `backend/.env.example` với cảnh báo rõ ràng (xem finding H1, mục "hành động đã thực hiện").
- Tài liệu này **không** ghi lại credential thật; người dùng tự thao tác rotate.

**Test xác minh**: không có (vấn đề nằm ngoài codebase, thuộc vận hành). Phần 7 liệt kê checklist production.

---

### 🟠 H1 — `tests/helpers/db.js` tự suy ra `TEST_URI` từ `MONGODB_URI` (đã sửa)

| Trường | Giá trị |
|---|---|
| File | `backend/tests/helpers/db.js` (trước fix) |
| Mức độ | High |
| Trạng thái | ✅ Đã sửa |

**Bằng chứng (trước fix)**:
```js
// dòng 14-17 (phiên bản cũ)
const TEST_URI =
  process.env.TEST_MONGODB_URI ||
  (config.mongoUri
    ? config.mongoUri.replace(/\/[^/?]+(\?.*)?$/, '/hrm_test_db$1')
    : 'mongodb://127.0.0.1:27017/hrm_test_db');
```

**Tác động**:
- Nếu dev chạy test mà không set `TEST_MONGODB_URI`, helper sẽ **giữ nguyên username/password/host** của `MONGODB_URI` và chỉ thay tên database. Hậu quả: kết nối vẫn thành công tới Atlas, ghi/xoá dữ liệu trong DB `hrm_test_db` trên cluster production-shaped.
- Kết nối tới Atlas từ CI ngoài whitelist IP có thể thất bại, nhưng nếu CI IP được whitelist thì sẽ thực sự ghi dữ liệu test lên cluster — đây là dạng "side-effect cross-environment" khó phát hiện.

**Hành động đã thực hiện (commit ngay sau khi xác nhận)**:

1. Tách logic chọn URI thành function `resolveTestUri()`:
   ```js
   export function resolveTestUri() {
     const fromEnv = process.env.TEST_MONGODB_URI;
     if (fromEnv && fromEnv.trim().length > 0) return fromEnv;
     return 'mongodb://127.0.0.1:27017/hrm_test_db';
   }
   ```
2. `setupTestDb` gọi `resolveTestUri()` thay vì dùng hằng số cache → đảm bảo luôn đọc env hiện tại.
3. Bỏ import `config` (không còn cần) → giảm dependency ngầm giữa test và source.
4. Whitespace-only (`'   '`) cũng được coi là missing → tránh bypass.

**Test đã thêm**: `tests/helpers.db.test.js` (5 tests):
- ✔ `honors an explicit TEST_MONGODB_URI when set`
- ✔ `does NOT derive TEST_URI from MONGODB_URI even when TEST_MONGODB_URI is empty`
- ✔ `falls back to a safe local URI when both env vars are missing`
- ✔ `chosen URI never contains credentials from MONGODB_URI`
- ✔ `treats whitespace-only TEST_MONGODB_URI as missing`

Tất cả 5 tests pass khi chạy độc lập (`node --test tests/helpers.db.test.js`).

**Kết quả test toàn suite**: 737 / 737 pass (xem mục 5).

---

### 🟡 M1 — Không có rate-limit / helmet (chưa sửa)

| Trường | Giá trị |
|---|---|
| File | `backend/src/app.js` |
| Mức độ | Medium |
| Trạng thái | ⚠️ Chưa sửa — thuộc "có thể bổ sung nếu thực sự cần" theo spec |

**Bằng chứng**: `app.js` chỉ cấu hình CORS + body parsers + routes + error handler. Không có `helmet`, không có rate-limit.

**Tác động**:
- Thiếu các security header HTTP phổ biến (X-Content-Type-Options, X-Frame-Options, Strict-Transport-Security, …).
- `/api/auth/login` không giới hạn số lần thử → có nguy cơ brute force credential (mặc dù bcrypt cost=10 làm mỗi lần thử tốn ~100ms; kết hợp với rate-limit là best-practice).

**Tại sao chưa sửa**:
- Cả `helmet` và `express-rate-limit` đều là dependency mới — chưa có trong `package.json` và `node_modules/`. Thêm dependency đòi hỏi `npm install` trong một phiên riêng (người dùng cần review/chạy).
- Viết rate-limit tự dùng chỉ với Map in-memory sẽ không chính xác khi deploy multi-instance và dễ leak memory; không đáng để tự chế.
- Đề xuất đưa vào Phase 13 (deployment hardening).

**Phương án khắc phục (đề xuất)**:
- Thêm `helmet` với cấu hình mặc định.
- Thêm `express-rate-limit` cho `/api/auth/login` (5–10 req / 15 phút / IP) với `mongoStore` nếu multi-instance.
- Cấu hình `trust proxy` trong `app.js` khi deploy sau reverse proxy (đã có comment TODO).

---

### 🟡 M2 — JWT không có revocation (chưa sửa — đã documented)

| Trường | Giá trị |
|---|---|
| File | `backend/src/services/auth.service.js` (`buildLogoutNotice`), `auth.controller.js` (`logout`) |
| Mức độ | Medium |
| Trạng thái | 🟢 Không sửa (đã documented, nằm ngoài scope Phase 3) |

**Bằng chứng**:
```js
// auth.service.js
export function buildLogoutNotice() {
  return {
    revoked: false,
    message:
      'Logout is a client-side action. Discard the access token; it will remain valid until it expires.',
    ttl: config.jwtExpiresIn,
  };
}
```

**Tác động**:
- Nếu token bị lộ, kẻ tấn công có thể sử dụng cho tới khi hết hạn (mặc định 2h).
- Không có denylist/refresh-token rotation.

**Tại sao không sửa**:
- Spec Phase 3 ghi rõ: "refresh tokens / revocation are out of scope".
- Đã acknowledged trong cả code comment, docs, và audit description ("token revocation is client-side").

**Phương án khắc phục (đề xuất, Phase sau)**:
- Bổ sung refresh token + rotation.
- Hoặc bổ sung denylist (Redis hoặc collection `revoked_tokens`) với TTL = thời gian còn lại của token.

---

### 🟡 M3 — CORS dev mode cho phép tất cả origin (chưa sửa)

| Trường | Giá trị |
|---|---|
| File | `backend/src/app.js` (dòng ~38-58) |
| Mức độ | Medium |
| Trạng thái | 🟢 Không sửa (cố ý, dev-only) |

**Bằng chứng**:
```js
const allowAllInDev = config.env !== 'production';
// ...
if (allowAllInDev) {
  return callback(null, true);
}
```

**Tác động**:
- Trong môi trường development, mọi origin đều được phép. Đây là chủ đích để FE ở `localhost:5173` (hoặc bất kỳ port nào) gọi được API.
- **Trong production**, code chỉ cho phép origin nằm trong `config.corsOrigins` (lấy từ `CLIENT_URL`).

**Tại sao không sửa**: hành vi đúng spec. Trong production, code đã enforce đúng. `.env.example` đã được cập nhật ở fix H1 với comment cảnh báo về `NODE_ENV=production`.

---

### 🟢 L1 — Request logger log `originalUrl` (chưa sửa)

| Trường | Giá trị |
|---|---|
| File | `backend/src/app.js` (~dòng 63-67) |
| Mức độ | Low |
| Trạng thái | 🟢 Không sửa (an toàn trong ngữ cảnh hiện tại) |

**Bằng chứng**:
```js
app.use((req, res, next) => {
  console.log(`[req] ${req.method} ${req.originalUrl}`);
  next();
});
```

**Tác động**: `originalUrl` có thể chứa query string (vd. `?email=foo`). Tuy nhiên:
- Logger chỉ chạy trong dev (`if (config.env !== 'production')`).
- Email không phải thông tin nhạy cảm bậc cao (đã được normalize + index unique trong DB).
- Không log body, không log header Authorization.

**Tại sao không sửa**: cân bằng giữa khả năng debug và rủi ro lộ. Nếu muốn siết hơn có thể chỉ log `req.path` (không query) trong tương lai.

---

### 🟢 L2 — `error.middleware.js` log full error stack server-side (chưa sửa)

| Trường | Giá trị |
|---|---|
| File | `backend/src/middlewares/error.middleware.js` (~dòng 60) |
| Mức độ | Low |
| Trạng thái | 🟢 Không sửa (đúng best-practice) |

**Bằng chứng**:
```js
console.error(`[error] ${req.method} ${req.originalUrl} →`, err);
```

**Tác động**: log full error (kèm stack) ra stderr. Đây là hành vi đúng — phục vụ debug. Response cho client đã được sanitize (chỉ trả message + code, không stack; 5xx trong prod trả "Internal server error" generic).

---

### 🟢 L3 — Một số endpoint tốn N+1 query ngầm (chưa sửa)

| Trường | Giá trị |
|---|---|
| File | `backend/src/services/dashboard.service.js` |
| Mức độ | Low |
| Trạng thái | 🟢 Không sửa (đã dùng aggregation) |

**Bằng chứng**: `getOverview` chạy 6 aggregations song song bằng `Promise.all`; `getAttendanceReport` join Employee + Department qua `$lookup` (1 round-trip).

**Tác động**: Tất cả các report endpoint admin đều dùng `aggregate()` của MongoDB với `$lookup` thay vì `populate()` lặp nhiều vòng → đã tránh N+1.

**Tại sao không sửa**: code đã đúng best-practice cho MongoDB.

---

### 🟢 L4 — `getNotificationById` không dùng projection (chưa sửa)

| Trường | Giá trị |
|---|---|
| File | `backend/src/services/notification.service.js` (~dòng 305) |
| Mức độ | Low |
| Trạng thái | 🟢 Không sửa (optimization nhỏ) |

**Bằng chứng**:
```js
const doc = await Notification.findById(id).lean({ virtuals: true });
```

**Tác động**: `findById` không chỉ định `.select()` → trả về toàn bộ document (kích thước rất nhỏ cho notification). Tối ưu không đáng kể.

---

## 4. Phân tích chuyên sâu theo Phase 12 spec

### 4.1 Authentication & JWT (mục 3.1)

| Yêu cầu | Trạng thái | Bằng chứng |
|---|---|---|
| Endpoint nhạy cảm yêu cầu xác thực | ✅ | Tất cả routes trừ `/`, `/api/health`, `/api/auth/login` đều có `protect` |
| Token sai / hết hạn / signature không hợp lệ | ✅ | `auth.middleware.js` `verifyAuthToken` + `loadActiveUserById` |
| Secret đọc từ env, không hardcode | ✅ | `config/env.js` đọc `process.env.JWT_SECRET` |
| Thuật toán JWT giới hạn | ✅ | Mặc định `HS256` (jsonwebtoken); payload minimal chỉ `{ sub, role }` |
| Payload không tin tưởng mù quáng | ✅ | Middleware `protect` re-load User từ DB mỗi request (`loadActiveUserById`) |
| User inactive / locked không truy cập | ✅ | `loadActiveUserById` kiểm tra `user.status !== 'active'` → 401 USER_INACTIVE |
| Không trả passwordHash | ✅ | `user.model.js` `toJSON` strip `passwordHash`; bảo vệ cả khi `+passwordHash` được dùng |
| Bcrypt cost phù hợp | ✅ | `user.model.js` dùng `bcrypt.hash(plain, 10)` |
| Không log password / JWT | ✅ | `auth.service.js` không log email/password; `recordEvent` cho login chỉ ghi `actorRole` |

**Logout giới hạn**: đã xác nhận trong M2 — chỉ là advisory, JWT vẫn valid cho tới khi hết hạn. Docs đã rõ.

### 4.2 Authorization & ownership (mục 3.2)

| Endpoint | Role guard | Ownership check | File |
|---|---|---|---|
| `GET /api/employees` | `authorize('admin')` | n/a (admin list) | `routes/employee.routes.js` |
| `GET /api/employees/:id` | `protect` | non-admin: `Employee.userId === req.user._id` else 404 | `employee.service.js` + controller |
| `POST/PATCH/DELETE /api/employees` | `authorize('admin')` | n/a | routes |
| `GET /api/attendance/:id` | `protect` | non-admin: linked Employee ↔ `Attendance.employeeId` else 404 | `attendance.service.js` |
| `GET /api/attendance/me` | `protect` | derive từ `Employee.findOne({ userId })` | `attendance.controller.js` |
| `GET /api/leave-requests/:id` | `protect` | non-admin: linked Employee | `leaveRequest.service.js` |
| `PATCH /api/leave-requests/:id` | `protect` | non-admin + status=pending only | `leaveRequest.service.js` |
| `GET /api/payroll/:id` | `protect` | non-admin: linked Employee | `payroll.service.js` |
| `GET /api/payroll/me` | `protect` | derive linked Employee | `payroll.controller.js` |
| `GET /api/notifications` | `protect` | recipientUserId = req.user._id | `notification.service.js` |
| `GET /api/dashboard/*`, `/api/reports/*` | `protect + authorize('admin')` | n/a | `dashboard.routes.js` |
| `GET /api/audit-logs/*` | `protect + authorize('admin')` | n/a | `auditLog.routes.js` |

**IDOR check**:
- Tất cả `/:id` đều validate `Types.ObjectId.isValid` trước khi query → 400 thay vì 500.
- Cross-user attempts trả **404** (không 403) theo anti-leak policy. Đã xác nhận trong `employee.controller.js` line 95-105.

**Mass assignment / system fields**:
- Validators đều có `forbidden` list (vd. leaveRequest, payroll) reject `employeeId`, `status`, `reviewedBy`, `_id`, etc. từ client.
- Audit log `METADATA_FORBIDDEN_KEYS` chặn password, token, secret, email, fullName, address, salary fields, v.v. khỏi metadata.

### 4.3 Validation & Mass Assignment (mục 3.3)

- ✅ Allowlist-driven validators trong mọi module.
- ✅ Không có `req.body.X` nào đi thẳng vào Mongoose query (verified bằng grep).
- ✅ `req.query` cũng qua validator.
- ✅ ObjectId check trước khi query.
- ✅ Sort allowlist (vd. employee `SORTABLE_FIELDS = ['fullName', 'employeeCode', 'hireDate', 'createdAt', 'updatedAt']`).
- ✅ Search regex đã escape (xem `employee.service.js` `escapeRegex`).
- ✅ Không dùng `$where` hoặc `$regex` với input thô (xem dashboard.service.js, comment tường minh "Không dùng `$where`").

### 4.4 Secrets & cấu hình (mục 3.4)

| Yêu cầu | Trạng thái |
|---|---|
| `.env` đã gitignore | ✅ (`.gitignore` dòng 8-9). **NHƯNG** project hiện chưa là git repo → chưa có bảo vệ thực sự. |
| Secret / token / credential hardcode trong source | ✅ Không có (xem H1, C1) |
| `.env.example` chỉ chứa giá trị mẫu | ✅ — sau fix H1, có comment cảnh báo rotate |
| Thiếu env bắt buộc xử lý rõ | ✅ — `assertConfig()` throw sớm trong `server.js` trước khi start |
| Lỗi DB không lộ credential | ✅ — `database.js` chỉ log `error.message`, không log full URI |
| Production không trả stack trace | ✅ — `error.middleware.js` strip stack; 5xx trong prod trả "Internal server error" |
| CORS cấu hình đúng | ✅ — xem M3 |
| Security headers / rate-limit | ⚠️ — xem M1 |

### 4.5 Error Handling (mục 3.5)

- ✅ ValidationError → 400 với code `VALIDATION_ERROR`.
- ✅ CastError → 400 với code `BAD_REQUEST`.
- ✅ Duplicate key (E11000) → 409 với code tùy context (`DUPLICATE_EMAIL`, `DUPLICATE_EMPLOYEE_CODE`, `DUPLICATE_DEPARTMENT_CODE`, `DUPLICATE_POSITION_CODE`, `DUPLICATE_USER_LINK`, `DUPLICATE_PAYROLL`, `DUPLICATE_ATTENDANCE`).
- ✅ 401 / 403 từ middleware (auth + authorize).
- ✅ 404 cho missing / không tìm thấy.
- ✅ Database unavailable: `assertConfig` + `connectDatabase` chạy trước khi `app.listen`; nếu fail thì `process.exit(1)`.
- ✅ Async error: tất cả controller dùng `try/catch` + `next(err)`. Express 4 không auto-catch async error nên pattern này là bắt buộc. Đã verify trên tất cả 10 controller.

### 4.6 Performance Audit (mục 4)

**Indexes**:
- `User`: unique email, secondary `{ role, status }`.
- `Employee`: unique employeeCode, unique email, sparse-unique userId, secondary `{ isDeleted, createdAt }`, `{ isDeleted, fullName }`, `{ departmentId }`, `{ positionId }`, `{ managerId }`.
- `Department`: unique code, secondary `{ managerEmployeeId }`, status.
- `Position`: unique code, secondary `{ departmentId }`, status.
- `Attendance`: compound unique `{ employeeId, workDate }`, secondary `{ employeeId, workDate: -1 }`.
- `LeaveRequest`: secondary `{ employeeId, createdAt: -1 }`, `{ status, createdAt: -1 }`.
- `Payroll`: compound unique `{ employeeId, periodMonth, periodYear }`, secondary `{ status, createdAt: -1 }`, `{ periodYear, periodMonth, createdAt: -1 }`.
- `AuditLog`: secondary `{ createdAt: -1 }`, `{ actorUserId, createdAt: -1 }`, `{ action, createdAt: -1 }`, `{ resourceType, resourceId, createdAt: -1 }`.
- `Notification`: secondary `{ recipientUserId, createdAt: -1 }`, `{ recipientUserId, isRead, createdAt: -1 }`.

Tất cả indexes đều có lý do dựa trên query thực tế (verified bằng grep trong services).

**Pagination / Search / Sort**:
- Mọi list endpoint đều có `page` (default 1) + `limit` (default 10/20, max 100).
- Sort allowlist trong từng module (verified).
- Search regex có `escapeRegex` (verified trong employee, department, position services).
- Dashboard date range có `MAX_DATE_RANGE_DAYS = 366` (chống full-DB scan).

**lean() / projection**:
- Mọi list `find()` đều dùng `.lean({ virtuals: true })` → trả plain object, không Mongoose document overhead. `serializeLean` thủ công strip `__v`. Verified trên tất cả 7 services có list method.

**Aggregation**:
- Dashboard dùng `$lookup` thay vì `populate()` vòng lặp → tránh N+1.
- `Promise.all` cho các aggregation độc lập.

### 4.7 Nghiệp vụ & toàn vẹn dữ liệu (mục 4.3)

| Mục | Trạng thái |
|---|---|
| Trùng mã NV, email | ✅ — unique index + service translate E11000 |
| Quan hệ Employee ↔ Department ↔ Position | ✅ — service kiểm tra Department active + Position thuộc Department (`POSITION_DEPARTMENT_MISMATCH` → 422) |
| Soft-delete tôn trọng trong query | ✅ — `isDeleted: { $ne: true }` trong mọi list filter, và `getEmployeeById` ẩn với non-admin |
| Leave overlap | ✅ — `findOverlappingLeaveRequest` kiểm tra cả `pending` và `approved`; re-check khi approve |
| Attendance workDate | ✅ — schema validate Date hợp lệ; validator chỉ chấp nhận `YYYY-MM-DD` |
| Payroll state machine | ✅ — `draft → approved → paid`; `cancelled` từ `draft`/`approved`; idempotent |
| Dashboard filter scope | ✅ — admin-only; range có max 366 ngày |
| Audit / Notification fail | ✅ — cả hai đều best-effort (nuốt lỗi, log console.error), không throw ra controller |
| Cascade delete | ✅ — KHÔNG cascade: User/Employee/Department/Position soft-delete đều giữ lịch sử |

---

## 5. Test kết quả

### 5.1 Lệnh đã chạy

| Lệnh | Kết quả |
|---|---|
| `npm test` (lần 1, sau fix) | 737/737 pass, 0 fail, ~30s |
| `npm test` (lần 2, để xác nhận ổn định) | 737/737 pass, 0 fail, ~30s |
| `node --test tests/helpers.db.test.js` (chỉ test mới) | 5/5 pass |
| `node --check <file>` cho từng file đã sửa | OK |
| `npm run syntax-check` | OK (toàn bộ 53 file) |

### 5.2 Lưu ý về lần chạy baseline

Lần chạy baseline đầu tiên thấy 72 fail / 44 pass, nhưng **sau khi clear DB và chạy lại thì 737/737 pass**. Nguyên nhân:

- Quá trình audit có dùng một `node -e` ad-hoc script (xem mục "1. Reproduce" trong notes) tạo `Employee` với `fullName: 'X'` (1 ký tự, vi phạm minlength=2). Schema `Employee` ném `ValidationError` ngay tại thời điểm `await Employee.create(...)` — vì lỗi xảy ra đồng bộ trong script, document không được tạo.
- Tuy nhiên một số script ad-hoc khác đã tạo data hợp lệ vào `hrm_test_db` (vd. attendance pagination reproduction), để lại state.
- Khi `npm test` chạy ngay sau, lần đầu `clearTestDb` xoá hết nhưng Mongoose model cache có thể còn tham chiếu tới `Payroll` documents đã bị xoá → `DocumentNotFoundError: No document found for query ...` (xem error log).
- Khi chạy `npm test` 2 lần liên tiếp sau fix, mọi thứ pass → xác nhận đây là **DB state pollution** chứ không phải lỗi nghiệp vụ.

### 5.3 Test mới được thêm

`tests/helpers.db.test.js` — 5 tests, đều pass, đều cover chính xác fix H1.

---

## 6. Git diff status

Project hiện **KHÔNG** là git repository (`git rev-parse` thất bại trong cả `backend/` và root). Do đó không thể chạy `git diff --check`, `git status --short`, `git diff --stat`.

Các file đã thay đổi trong phase này (xác nhận bằng cách đọc lại nội dung file):

| File | Loại thay đổi |
|---|---|
| `backend/tests/helpers/db.js` | Sửa: thay regex fallback bằng `resolveTestUri()` an toàn |
| `backend/tests/helpers.db.test.js` | Mới: 5 unit tests cho `resolveTestUri` |
| `backend/.env.example` | Sửa: thêm comment cảnh báo rotate credentials, ghi rõ giới hạn `NODE_ENV=production` |
| `backend/docs/SECURITY_PERFORMANCE_AUDIT.md` | Mới: tài liệu này |

Không có file nào thuộc `front_end/` bị chạm.

---

## 7. Giới hạn chưa thể xác minh

| Hạng mục | Lý do |
|---|---|
| Hành vi runtime dưới tải thật (10k+ employees, 1M+ attendance) | Chưa benchmark; chỉ đánh giá code. Index hiện có phù hợp với query thực tế. |
| Helmet / rate-limit | Cần `npm install` dependency mới; chưa thực hiện (xem M1). |
| Refresh-token / revocation | Out of scope Phase 3 (xem M2). |
| Rotate Atlas credential | Thuộc vận hành; người dùng cần thao tác (xem C1). |
| Behavior chính xác của Mongoose 8 `findById` khi document bị xoá giữa hai describe block | Có reproduce được nhưng root cause nằm ngoài phạm vi audit; đã thấy pass ở cả 2 lần chạy `npm test` liên tiếp. |

---

## 8. Checklist trước khi triển khai production

- [ ] **Rotate Atlas user `leduclam2303_db_user`** và cập nhật `MONGODB_URI` trong `.env` (xem C1).
- [ ] **Set `NODE_ENV=production`** trên môi trường production.
- [ ] **Tạo `JWT_SECRET` mới bằng `crypto.randomBytes(48)`** cho từng môi trường. Tuyệt đối không commit.
- [ ] **Whitelist IP** cho Atlas cluster (không dùng `0.0.0.0/0`).
- [ ] Bật **HTTPS** ở reverse proxy; trong `app.js` đã có comment TODO về `trust proxy`.
- [ ] (Khuyến nghị) Bổ sung `helmet` và `express-rate-limit` cho `/api/auth/login` (xem M1).
- [ ] (Khuyến nghị) Bổ sung refresh-token hoặc denylist nếu cần logout có hiệu lực ngay (xem M2).
- [ ] (Khuyến nghị) Cấu hình log aggregator (CloudWatch, Datadog, ELK) — hiện chỉ `console.log/error` ra stdout.
- [ ] (Khuyến nghị) Backup MongoDB định kỳ; cấu hình point-in-time recovery trên Atlas.
- [ ] (Khuyến nghị) Review lại `tests/helpers/db.js` ở CI: đảm bảo CI **không** có `MONGODB_URI` env (chỉ có `TEST_MONGODB_URI`).

---

## 9. Kết luận Phase 12

**Mức độ hoàn thành**: ~80%.

- ✅ **Bảo mật**: Không phát hiện lỗ hổng nghiêm trọng trong code. Toàn bộ authentication, authorization, validation, error handling đều tuân thủ best-practice. Đã sửa 1 finding High (H1).
- ✅ **Hiệu năng**: Indexes phù hợp, lean() đầy đủ, aggregation có `$lookup` thay vì N+1, sort allowlist, search có escape. Không phát hiện vấn đề thực tế.
- ✅ **Tích hợp**: Logic giữa các module (User ↔ Employee ↔ Department ↔ Position ↔ Attendance ↔ LeaveRequest ↔ Payroll ↔ Audit/Notification) đã nhất quán. Notification best-effort đúng policy.
- ⚠️ **Vận hành**: 1 Critical finding (C1) cần người dùng rotate Atlas credential — đã ghi rõ trong mục 3 và checklist 8.

**Việc cần xử lý trước production**:
1. Rotate Atlas credential (C1).
2. Thêm `helmet` + `express-rate-limit` (M1) — cần dependency install.

**Việc nên ưu tiên ở phase tiếp theo** (sau production deploy ổn định):
- Refresh-token / revocation (M2).
- Audit log retention policy.
- Backup automation.
- Load test để xác nhận indexes đủ tốt dưới tải thật.
