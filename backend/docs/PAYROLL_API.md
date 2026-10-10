# Payroll Management API

> Phase 8 — HRM Backend

Module quản lý bảng lương nhân viên theo từng kỳ (tháng/năm). Payroll là dữ liệu tài chính
cần kiểm toán, vì vậy API thiết kế theo nguyên tắc **server-computed, role-gated, immutable
after approval**.

Base path: `/api/payroll`

---

## 1. Mục đích

- Quản lý bảng lương của từng nhân viên cho mỗi kỳ lương `(periodMonth, periodYear)`.
- Đảm bảo **mỗi Employee chỉ có một bản ghi lương cho mỗi kỳ** (compound unique index).
- Tính toán `grossSalary` và `netSalary` phía server — client không thể áp đặt.
- Theo dõi vòng đời xử lý: `draft → approved → paid` (hoặc `cancelled`).

## 2. Điều kiện xác thực

- Tất cả endpoint yêu cầu JWT Bearer token hợp lệ.
- JWT cấp bởi `POST /api/auth/login` (Phase 3).
- Token phải còn hạn, user `active` (middleware `protect` re-load user từ DB mỗi request).

## 3. Phân quyền

| Endpoint | Admin | Employee |
|---|:---:|:---:|
| `GET /api/payroll` | ✓ | ✗ (403) |
| `GET /api/payroll/me` | ✓ (linked Employee) | ✓ (linked Employee) |
| `GET /api/payroll/:id` | ✓ (any) | ✓ (own only; 404 nếu của người khác) |
| `POST /api/payroll` | ✓ | ✗ (403) |
| `PATCH /api/payroll/:id` | ✓ | ✗ (403) |
| `PATCH /api/payroll/:id/approve` | ✓ | ✗ (403) |
| `PATCH /api/payroll/:id/mark-paid` | ✓ | ✗ (403) |
| `PATCH /api/payroll/:id/cancel` | ✓ | ✗ (403) |
| `DELETE /api/payroll/:id` | **không tồn tại** | **không tồn tại** |

Employee **không thể** tự ghi đè `employeeId` qua query param/body để xem lương người khác.
Cross-user access trả 404 (chống lộ ID).

## 4. Giả định nghiệp vụ & giới hạn

| Giả định | Ghi chú |
|---|---|
| **Công thức lương** | `grossSalary = baseSalary + allowances + bonuses`; `netSalary = grossSalary - deductions`. Làm tròn 2 chữ số thập phân. |
| **Kỳ lương** | `(periodMonth: 1..12, periodYear: 2000..2100)`. Một Employee chỉ có một bản ghi cho mỗi cặp. |
| **workedDays / standardWorkDays** | Admin nhập tay qua POST/PATCH. **KHÔNG** tự tính từ Attendance/LeaveRequest vì chưa có policy giờ làm chuẩn. |
| **Currency** | Đơn vị mặc định VND. Phase 8 chưa hỗ trợ đa tiền tệ. |
| **Thuế TNCN / BHXH / OT** | **Chưa hỗ trợ**. Các khoản này được kỳ vọng nằm trong `deductions` do admin nhập. |
| **Cổng thanh toán** | **Không tích hợp**. `mark-paid` chỉ ghi nhận trạng thái nghiệp vụ nội bộ. |
| **Soft-delete Employee** | Service chặn tạo mới / approve cho Employee đã soft-delete. Payroll cũ giữ nguyên (audit). |
| **DELETE Payroll** | **Không triển khai**. Payroll là dữ liệu tài chính cần kiểm toán. |
| **Đồng bộ trạng thái** | `paid` là terminal. Sau khi `approved` hoặc `paid` KHÔNG thể sửa các trường tiền. |

## 5. Schema

```js
Payroll = {
  _id: ObjectId,
  employeeId: ObjectId,                  // ref Employee
  periodMonth: Number (1..12),
  periodYear: Number (2000..2100),
  baseSalary: Number (>=0, <=1e15),
  allowances: Number (>=0, default 0),
  bonuses: Number (>=0, default 0),
  deductions: Number (>=0, default 0),
  grossSalary: Number (>=0, server-computed),
  netSalary: Number (>=0, server-computed),
  workedDays: Number (0..31) | null,
  standardWorkDays: Number (0..31) | null,
  note: String (<=500),
  status: 'draft' | 'approved' | 'paid' | 'cancelled',
  createdBy: ObjectId,                   // ref User
  updatedBy: ObjectId,                   // ref User
  approvedBy: ObjectId | null,
  approvedAt: Date | null,
  paidBy: ObjectId | null,
  paidAt: Date | null,
  createdAt: Date,
  updatedAt: Date,
}
```

**Compound unique index:** `{ employeeId: 1, periodMonth: 1, periodYear: 1 }`.
Tên: `payroll_employee_period_unique`. Trùng → E11000 → HTTP 409 `DUPLICATE_PAYROLL`.

**Indexes phụ:**
- `{ status: 1, createdAt: -1 }` cho admin list filter.
- `{ periodYear: 1, periodMonth: 1, createdAt: -1 }` cho filter theo kỳ.

## 6. State transitions

```
        ┌─────────┐  cancel   ┌────────────┐
        │  draft  │──────────►│ cancelled  │
        └────┬────┘           └────────────┘
             │ approve
             ▼
        ┌─────────┐  cancel   ┌────────────┐
        │approved │──────────►│ cancelled  │
        └────┬────┘           └────────────┘
             │ mark-paid
             ▼
        ┌─────────┐
        │  paid   │  (terminal — không thể chỉnh, cancel, approve)
        └─────────┘
```

- **approve**: `draft → approved`. Idempotent: nếu đã `approved` thì trả 200 + `meta.alreadyApproved: true`.
- **mark-paid**: `approved → paid`. Idempotent: nếu đã `paid` thì trả 200 + `meta.alreadyPaid: true`.
- **cancel**: `draft/approved → cancelled`. Idempotent: nếu đã `cancelled` thì trả 200 + `meta.alreadyCancelled: true`.
- Khi không ở trạng thái nguồn hợp lệ → HTTP 409 `INVALID_STATE`.
- Sau khi `approved/paid`: PATCH cập nhật tiền → 409.
- `paid → approve/cancel` → 409.
- `approvedBy`, `approvedAt`, `paidBy`, `paidAt` set từ `req.user._id` / `new Date()` phía server. Client **không thể** override.

## 7. Công thức

```
grossSalary = round2(baseSalary + allowances + bonuses)
netSalary   = round2(grossSalary - deductions)
```

`round2(x) = Math.round(x * 100) / 100`.

## 8. Endpoints

### 8.1. `GET /api/payroll`

Danh sách phân trang. **Admin only**. Trả 403 nếu Employee gọi.

Query params:
- `page` (int, default 1, max 1,000,000)
- `limit` (int, default 20, max 100)
- `employeeId` (ObjectId, optional)
- `periodMonth` (int 1..12, optional)
- `periodYear` (int 2000..2100, optional)
- `status` (`draft|approved|paid|cancelled`, optional)
- `sort` (`+field` hoặc `-field`, allowlist: `createdAt`, `updatedAt`, `periodMonth`, `periodYear`, `status`, `grossSalary`, `netSalary`; default `-createdAt`)

Response 200:
```json
{
  "success": true,
  "data": [ { "...": "Payroll record" } ],
  "meta": {
    "pagination": { "page": 1, "limit": 20, "total": 5, "totalPages": 1 }
  }
}
```

### 8.2. `GET /api/payroll/me`

Self-list. Bỏ qua `employeeId` từ client (anti-spoof). Nếu user chưa có Employee liên kết (hoặc Employee đã soft-delete) → 404 `EMPLOYEE_NOT_FOUND`.

Cùng query params như 8.1 (trừ `employeeId`).

### 8.3. `GET /api/payroll/:id`

- Admin: xem bất kỳ.
- Employee: chỉ xem của linked Employee. Sai lệch → 404 (chống lộ).
- ID sai định dạng → 400 `VALIDATION_ERROR`.
- Không tồn tại → 404 `PAYROLL_NOT_FOUND`.

### 8.4. `POST /api/payroll`

Tạo mới. **Admin only**.

Body:
```json
{
  "employeeId": "ObjectId",
  "periodMonth": 10,
  "periodYear": 2026,
  "baseSalary": 10000000,
  "allowances": 1000000,
  "bonuses": 500000,
  "deductions": 200000,
  "workedDays": 22,
  "standardWorkDays": 22,
  "note": "thưởng Tết"
}
```

Field từ chối (kể cả khi gửi):
`grossSalary`, `netSalary`, `status`, `createdBy`, `updatedBy`, `approvedBy`, `approvedAt`, `paidBy`, `paidAt`, `createdAt`, `updatedAt`, `id`, `_id`.

Response 201:
```json
{
  "success": true,
  "data": {
    "employeeId": "...",
    "periodMonth": 10,
    "periodYear": 2026,
    "baseSalary": 10000000,
    "allowances": 1000000,
    "bonuses": 500000,
    "deductions": 200000,
    "grossSalary": 11500000,
    "netSalary": 11300000,
    "workedDays": 22,
    "standardWorkDays": 22,
    "note": "thưởng Tết",
    "status": "draft",
    "createdBy": "...",
    "updatedBy": "...",
    "approvedBy": null,
    "approvedAt": null,
    "paidBy": null,
    "paidAt": null,
    "createdAt": "...",
    "updatedAt": "..."
  }
}
```

Lỗi:
- 400 — `employeeId` thiếu / không hợp lệ / không tồn tại / soft-deleted; money NaN/âm/overflow; period ngoài range; field bị cấm.
- 409 — `DUPLICATE_PAYROLL` (đã có bản ghi cùng `employeeId` + `periodMonth` + `periodYear`).

### 8.5. `PATCH /api/payroll/:id`

Cập nhật. **Admin only**. Chỉ khi `status === 'draft'`. Các trường khả dụng:
`baseSalary`, `allowances`, `bonuses`, `deductions`, `workedDays`, `standardWorkDays`, `note`.

Field từ chối (kể cả khi gửi):
`employeeId`, `periodMonth`, `periodYear`, `grossSalary`, `netSalary`, `status`, tất cả audit fields, `id`, `_id`.

Lỗi:
- 400 — không truyền field nào; field cấm; money invalid.
- 404 — không tồn tại.
- 409 — `INVALID_STATE` (status đã `approved/paid/cancelled`).

### 8.6. `PATCH /api/payroll/:id/approve`

Admin only. `draft → approved`. Ghi `approvedBy = req.user._id`, `approvedAt = now`.

- Nếu status ≠ `draft` (kể cả `approved`) → 200 idempotent (nếu đã approved) hoặc 409.
- Nếu Employee liên kết bị soft-delete → 409 `EMPLOYEE_DELETED`.

### 8.7. `PATCH /api/payroll/:id/mark-paid`

Admin only. `approved → paid`. Ghi `paidBy = req.user._id`, `paidAt = now`.

- Nếu status = `draft` → 409 `INVALID_STATE`.
- Idempotent khi đã `paid`.

### 8.8. `PATCH /api/payroll/:id/cancel`

Admin only. `draft/approved → cancelled`.

- Nếu status = `paid` → 409.
- Idempotent khi đã `cancelled`.

### 8.9. DELETE (không hỗ trợ)

`DELETE /api/payroll/:id` → 404 (route không tồn tại).

## 9. Ví dụ lỗi

```json
// 400 — validation
{ "success": false, "error": { "code": "VALIDATION_ERROR", "message": "baseSalary must be a finite number", "field": "baseSalary" } }

// 401 — thiếu token
{ "success": false, "error": { "code": "AUTH_MISSING", "message": "Authorization header is required" } }

// 403 — sai role
{ "success": false, "error": { "code": "FORBIDDEN", "message": "You do not have permission to access this resource" } }

// 404 — không tồn tại / cross-user
{ "success": false, "error": { "code": "PAYROLL_NOT_FOUND", "message": "Payroll record not found" } }

// 409 — trùng kỳ
{ "success": false, "error": { "code": "DUPLICATE_PAYROLL", "message": "A payroll record already exists for this employee and period (periodMonth, periodYear)", "field": "employeeId" } }

// 409 — state không cho phép
{ "success": false, "error": { "code": "INVALID_STATE", "message": "Cannot update a payroll record in status \"approved\"", "field": "status" } }
```

## 10. Cách chạy test

```bash
cd backend
npm test                                  # toàn bộ suite (gồm Payroll)
TEST_MONGODB_URI=mongodb://127.0.0.1:27017/hrm_test_db \
  node --test --test-concurrency=1 tests/payroll.model.test.js
TEST_MONGODB_URI=mongodb://127.0.0.1:27017/hrm_test_db \
  node --test --test-concurrency=1 tests/payroll.api.test.js
npm run syntax-check                      # validate tất cả .js với node --check
```

Test DB: `hrm_test_db` riêng biệt với `MONGODB_URI` development. Helper `tests/helpers/db.js`
tự động dùng `TEST_MONGODB_URI` nếu có.

## 11. Phần chưa hỗ trợ

- **Thuế TNCN, BHXH/BHYT/BHTN**: chưa có công thức. Admin nhập tay vào `deductions` nếu cần.
- **Làm thêm giờ (OT), phạt, holiday pay**: chưa có module riêng. Phase 9+ có thể tách thành
  `payroll_adjustments` hoặc thêm field `overtimeHours`, `overtimePay`.
- **Đa tiền tệ**: chưa hỗ trợ. Có thể thêm `currency: 'VND' | 'USD'` sau.
- **Tích hợp kế toán / cổng thanh toán ngân hàng**: ngoài phạm vi.
- **Tự động tính số ngày công** từ Attendance/LeaveRequest: cần policy rõ ràng
  (giờ làm chuẩn, holiday list, OT rule) trước khi triển khai.
- **Soft-delete Payroll**: không hỗ trợ. Bản ghi tài chính cần audit nguyên vẹn.
- **Điều chỉnh sau khi paid**: cần luồng riêng (vd. `payroll_adjustment`); chưa triển khai.

## 12. Hướng dẫn test bằng Postman

### Bước 1 — Tạo Admin User

Gọi endpoint Phase 3 để có admin. Phase 3 chỉ cho phép tạo user với role `employee`.
Để tạo admin, dùng một trong các cách:

1. **Qua MongoDB shell trực tiếp** (khuyến nghị cho test):
   ```js
   // Sau khi tạo user qua POST /api/auth/register (role=employee mặc định)
   // Promote thành admin:
   use hrm_db
   db.users.updateOne({ email: "admin@example.com" }, { $set: { role: "admin" } })
   ```
2. **Tạo sẵn bằng seed script** nếu team cung cấp.

Sau đó login để lấy token:
```
POST /api/auth/login
Content-Type: application/json

{ "email": "admin@example.com", "password": "Test1234!" }
```

Response trả về `data.token`. Dùng token này cho header `Authorization: Bearer <token>`.

### Bước 2 — Tạo Employee + User liên kết

Dùng token admin tạo Employee (Phase 4):

```
POST /api/employees
Authorization: Bearer <admin-token>
Content-Type: application/json

{
  "employeeCode": "NV0001",
  "userId": "<userId-của-employee-user>",
  "fullName": "Nguyễn Văn A",
  "email": "nguyenvana@example.com",
  "employmentType": "full_time",
  "hireDate": "2024-01-01"
}
```

`userId` (optional): liên kết Employee với 1 User đã tạo trước đó. Nếu không truyền,
Employee sẽ không có tài khoản đăng nhập (chỉ dùng cho HR nội bộ).

### Bước 3 — Tạo Payroll record

```
POST /api/payroll
Authorization: Bearer <admin-token>
Content-Type: application/json

{
  "employeeId": "<employeeId>",
  "periodMonth": 10,
  "periodYear": 2026,
  "baseSalary": 10000000,
  "allowances": 1000000,
  "bonuses": 500000,
  "deductions": 200000,
  "workedDays": 22,
  "standardWorkDays": 22,
  "note": "thưởng Tết"
}
```

Response sẽ trả về `grossSalary: 11500000`, `netSalary: 11300000` (do server tính).

### Bước 4 — Test với Employee token

Đăng nhập với user đã liên kết Employee → lấy `employeeToken`:

```
GET /api/payroll/me
Authorization: Bearer <employee-token>
```

Trả về danh sách bảng lương của Employee đó. Không cần / không được truyền `employeeId`.

```
GET /api/payroll/<payrollId>
Authorization: Bearer <employee-token>
```

Nếu payrollId là của Employee khác → 404. Nếu của chính mình → 200.

### Bước 5 — State transitions

```
PATCH /api/payroll/<payrollId>/approve      # draft → approved
PATCH /api/payroll/<payrollId>/mark-paid    # approved → paid
PATCH /api/payroll/<payrollId>/cancel       # draft/approved → cancelled
```

Tất cả đều cần admin token.

### Bước 6 — Kiểm tra lỗi

Gửi request sai để kiểm tra response:
- POST không `employeeId` → 400 `VALIDATION_ERROR`.
- POST trùng `(employeeId, periodMonth, periodYear)` → 409 `DUPLICATE_PAYROLL`.
- POST với `grossSalary: 999999` (client cố set) → 400 `VALIDATION_ERROR` (field forbidden).
- PATCH sau khi `paid` → 409 `INVALID_STATE`.
- PATCH `/approve` với `approvedBy` do client gửi → bị bỏ qua; server vẫn dùng `req.user._id`.
