# HRM Backend — Audit Log API

> Phase 10 — Audit logging cho các thao tác nghiệp vụ quan trọng.

## 1. Mục đích

Audit Log API ghi nhận và tra cứu các thao tác nghiệp vụ đã thực hiện
thành công trong hệ thống HRM, phục vụ mục tiêu:

- Truy vết thao tác của admin/employee (ai làm gì, lúc nào, với tài nguyên nào).
- Hỗ trợ điều tra khi phát sinh sự cố dữ liệu (ví dụ: ai đã thay đổi lương).
- Đối chiếu tuân thủ quy trình nội bộ (ai duyệt/từ chối đơn nghỉ phép, ai huỷ bảng lương).

Audit Log **không phải** giải pháp chống giả mạo hoàn hảo. Cơ chế ghi log
là **best-effort** (xem §11), không dùng transaction với nghiệp vụ.

## 2. Kiến trúc ghi log

```
┌──────────────────┐
│  HTTP Request    │
└─────────┬────────┘
          │ (protect + authorize middleware)
          ▼
┌──────────────────┐
│  Controller      │  ← Service (business logic) returns success
└─────────┬────────┘
          │ after service success
          ▼
┌──────────────────┐
│ auditLogService  │  ← recordEvent({ actor, action, ... })
│  .recordEvent()  │
└─────────┬────────┘
          │ best-effort (errors swallowed + console.error)
          ▼
┌──────────────────┐
│  AuditLog model  │  ← MongoDB collection `auditlogs`
└──────────────────┘
```

Đặc điểm:

- **Server-side only.** Không có endpoint công khai cho phép client tự
  tạo/sửa/xoá audit log. Mọi event được tạo từ server code trong
  `controllers/*.js` sau khi service trả về kết quả thành công.
- **Best-effort.** Nếu ghi log thất bại (DB error, validation lỗi
  hiếm gặp), chỉ `console.error` server-side. Không throw ra controller
  nên không làm hỏng response nghiệp vụ.
- **Actor từ server context.** `req.user` đã được `protect` middleware
  verify và là nguồn duy nhất của `actorUserId` và `actorRole`.
- **Không transaction.** Phase 10 không thêm MongoDB session/transaction.
  Trong cùng một request, nếu nghiệp vụ commit nhưng audit log fail thì
  request vẫn trả 200. Đây là giới hạn đã nêu rõ trong §14.

## 3. Schema thực tế

`AuditLog` collection lưu mỗi event với schema:

| Field         | Type     | Required | Mô tả                                                       |
| ------------- | -------- | -------- | ----------------------------------------------------------- |
| `actorUserId` | ObjectId | optional | Ref `User`. Null với system event.                          |
| `actorRole`   | String   | optional | Enum: `admin` \| `employee`. Snapshot role tại thời điểm.  |
| `action`      | String   | yes      | Enum allowlist — xem §4.                                    |
| `resourceType`| String   | yes      | Enum allowlist — xem §4.                                    |
| `resourceId`  | String   | optional | ObjectId hex 24 chars của resource tương ứng.               |
| `description` | String   | optional | Mô tả ngắn (≤500 chars). Không chứa data nhạy cảm.          |
| `metadata`    | Mixed    | optional | Object — đã filter qua allowlist. Tối đa 32 keys, mỗi string ≤500 chars. |
| `status`      | String   | yes      | `success` \| `failure`.                                     |
| `createdAt`   | Date     | auto     | Timestamp.                                                  |
| `updatedAt`   | Date     | auto     | Timestamp.                                                  |

Indexes (không trùng):

- `{ createdAt: -1 }` — list mặc định theo thời gian.
- `{ actorUserId: 1, createdAt: -1 }` — filter theo actor.
- `{ action: 1, createdAt: -1 }` — filter theo action.
- `{ resourceType: 1, resourceId: 1, createdAt: -1 }` — filter theo resource.

## 4. Action / Resource Type được hỗ trợ

### Resource types

```
user, employee, department, position, attendance, leave_request, payroll, auth
```

### Actions (theo module)

| Module        | Actions                                                          |
| ------------- | ---------------------------------------------------------------- |
| Auth          | `auth.login.success`, `auth.logout`                              |
| Employee      | `employee.create`, `employee.update`, `employee.softDelete`      |
| Department    | `department.create`, `department.update`, `department.deactivate` |
| Position      | `position.create`, `position.update`, `position.deactivate`      |
| Attendance    | `attendance.create`, `attendance.update`                         |
| Leave Request | `leave.create`, `leave.update`, `leave.cancel`, `leave.approve`, `leave.reject` |
| Payroll       | `payroll.create`, `payroll.update`, `payroll.approve`, `payroll.markPaid`, `payroll.cancel` |

### Metadata allowlist (theo action)

- `employee.create` / `update` / `softDelete`: `{ changedFields: string[] }` (chỉ tên field đã đổi, **không** log giá trị).
- `department.*` / `position.*`: tương tự employee.
- `attendance.create` / `update`: `{ changedFields: string[] }`.
- `leave.update`: `{ changedFields: string[] }`.
- `leave.approve` / `leave.reject` / `leave.cancel`: `{ fromStatus, toStatus }`.
- `payroll.update`: `{ changedFields: string[] }` (chỉ tên field — không lộ `baseSalary`, `bonuses`...).
- `payroll.approve` / `markPaid` / `cancel`: `{ fromStatus, toStatus }`.
- `auth.login.success` / `auth.logout`: `{ actorRole }` (không ghi email/password).

## 5. Endpoint đọc log

| Method | Path                  | Auth      | Mô tả                          |
| ------ | --------------------- | --------- | ------------------------------ |
| GET    | `/api/audit-logs`     | Admin     | List + filter + pagination     |
| GET    | `/api/audit-logs/:id` | Admin     | Chi tiết 1 record              |

**Không có** POST/PATCH/PUT/DELETE cho audit logs.

## 6. Quyền truy cập

- Mọi endpoint đều yêu cầu `protect` (JWT hợp lệ) + `authorize('admin')`.
- Employee có JWT hợp lệ trả **403 Forbidden**.
- Không có token / token hết hạn / token sai → **401 Unauthorized**.

## 7. Query params & pagination

`GET /api/audit-logs` chấp nhận:

| Param          | Type    | Mô tả                                                         |
| -------------- | ------- | ------------------------------------------------------------- |
| `page`         | integer | Default `1`. Min 1.                                           |
| `limit`        | integer | Default `20`. Service sẽ cap về `100` nếu lớn hơn.           |
| `actorUserId`  | ObjectId| Filter theo actor.                                            |
| `action`       | enum    | Một trong danh sách §4.                                       |
| `resourceType` | enum    | Một trong danh sách §4.                                       |
| `resourceId`   | ObjectId| Filter theo resource cụ thể.                                  |
| `startDate`    | YYYY-MM-DD | Lọc từ ngày (inclusive).                                  |
| `endDate`      | YYYY-MM-DD | Lọc đến ngày (inclusive).                                  |
| `sort`         | string  | Default `-createdAt`. Allowlist: `createdAt`, `action`, `resourceType`, `actorRole` với prefix `+` hoặc `-`. |

Ràng buộc:

- `startDate <= endDate` (nếu cả hai cùng có).
- Date range tối đa 366 ngày.
- Sort field ngoài allowlist → 400.
- ObjectId không hợp lệ → 400.

## 8. Response mẫu

### 8.1 List thành công

```http
GET /api/audit-logs?action=payroll.approve&page=1&limit=20
```

```json
{
  "success": true,
  "data": [
    {
      "_id": "6ac913ef664e192fa445e8fb",
      "actorUserId": "6ac913e4664e192fa445e8f0",
      "actorRole": "admin",
      "action": "payroll.approve",
      "resourceType": "payroll",
      "resourceId": "6ac913ea664e192fa445e8d5",
      "description": "Payroll approved",
      "metadata": { "fromStatus": "draft", "toStatus": "approved" },
      "status": "success",
      "createdAt": "2026-10-09T10:00:00.000Z",
      "updatedAt": "2026-10-09T10:00:00.000Z"
    }
  ],
  "pagination": {
    "page": 1,
    "limit": 20,
    "total": 1,
    "totalPages": 1
  }
}
```

### 8.2 Detail thành công

```json
{
  "success": true,
  "data": { "...": "single AuditLog object (same shape as item above)" }
}
```

## 9. HTTP errors có thể trả về

| Status | Code                  | Khi nào                                                  |
| ------ | --------------------- | -------------------------------------------------------- |
| 400    | `VALIDATION_ERROR`    | Query param sai (ObjectId không hợp lệ, date sai, sort sai, date range >366 ngày, startDate > endDate). |
| 401    | (auth middleware)     | Thiếu token / token sai / hết hạn.                       |
| 403    | (RBAC middleware)     | Không phải admin.                                        |
| 404    | `AUDIT_LOG_NOT_FOUND` | `GET /:id` với id không tồn tại.                         |
| 404    | (Express)             | Method không đăng ký (POST/PATCH/PUT/DELETE).            |

Error envelope chuẩn:

```json
{
  "success": false,
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "id must be a valid ObjectId",
    "field": "id"
  }
}
```

## 10. Quy tắc lọc dữ liệu nhạy cảm

`auditLogService.recordEvent()` lọc `metadata` qua allowlist.
Các key **bị cấm tuyệt đối** (xem `src/models/auditLog.model.js →
METADATA_FORBIDDEN_KEYS`):

- Xác thực: `password`, `passwordHash`, `oldPassword`, `newPassword`,
  `currentPassword`, `passwordResetToken`, `token`, `accessToken`,
  `refreshToken`, `jwt`, `authorization`, `cookie`, `set-cookie`,
  `secret`, `clientSecret`.
- Hạ tầng: `mongoUri`, `dbUri`, `connectionString`.
- Tài chính (chi tiết): `baseSalary`, `allowances`, `bonuses`,
  `deductions`, `grossSalary`, `netSalary`, `creditCard`, `bankAccount`,
  `ssn`, `taxId`.
- Cá nhân: `email`, `phone`, `fullName`, `address`, `note`, `reviewNote`,
  `reason`.

Ngoài ra:

- Không log toàn bộ `req.body`, `req.headers` hay `req` object.
- Không log IP / user-agent (chưa có nhu cầu rõ ràng).
- `description` cap 500 chars.
- Mỗi value trong metadata cap 500 chars.
- Tổng số keys trong metadata cap 32.
- Mọi key có độ dài > 64 chars bị bỏ qua.

## 11. Chính sách khi ghi log thất bại

- Mọi lỗi khi ghi log (DB down, validation lỗi, ...) đều được
  `auditLogService` nuốt và `console.error` ra stderr.
- Không throw ra controller nên nghiệp vụ đã thành công vẫn trả response bình thường.
- Không trả stack trace hay message lỗi cho client.
- Không có retry. Không có buffer/queue.

**Hệ quả thực tế:** Audit log là best-effort, không đảm bảo 100% log
được ghi khi hệ thống gặp sự cố. Phase 10 chấp nhận giới hạn này vì
các phase trước chưa dùng MongoDB session/transaction. Phase sau có
thể cân nhắc chuyển sang outbox pattern nếu cần bảo đảm mạnh hơn.

## 12. Module đã tích hợp

| Module          | Endpoint ghi log                                                                    |
| --------------- | ----------------------------------------------------------------------------------- |
| Auth            | `POST /api/auth/login` (success), `POST /api/auth/logout`                            |
| Employee        | `POST /api/employees`, `PATCH /api/employees/:id`, `DELETE /api/employees/:id`      |
| Department      | `POST /api/departments`, `PATCH /api/departments/:id`, `PATCH /api/departments/:id/deactivate` |
| Position        | `POST /api/positions`, `PATCH /api/positions/:id`, `PATCH /api/positions/:id/deactivate` |
| Attendance      | `POST /api/attendance`, `PATCH /api/attendance/:id`                                 |
| Leave Request   | `POST /api/leave-requests`, `PATCH /api/leave-requests/:id`, `PATCH /api/leave-requests/:id/cancel`, `PATCH /api/leave-requests/:id/approve`, `PATCH /api/leave-requests/:id/reject` |
| Payroll         | `POST /api/payroll`, `PATCH /api/payroll/:id`, `PATCH /api/payroll/:id/approve`, `PATCH /api/payroll/:id/mark-paid`, `PATCH /api/payroll/:id/cancel` |

## 13. Module chưa tích hợp và lý do

| Module      | Lý do                                                                              |
| ----------- | ---------------------------------------------------------------------------------- |
| Dashboard   | Chỉ đọc, không có thao tác nghiệp vụ thay đổi trạng thái cần audit.               |
| Reports     | Chỉ đọc, không có mutation.                                                       |
| Health      | Chỉ kiểm tra trạng thái hệ thống, không có actor cụ thể.                          |
| `me` endpoints | Là đọc dữ liệu của chính user, không tạo/sửa/xoá.                          |

## 14. Giới hạn hiện tại và biện pháp chưa triển khai

- **Không có transaction** giữa nghiệp vụ và audit log. Có thể xảy ra
  trường hợp nghiệp vụ thành công nhưng audit log không ghi (do DB
  error). Best-effort.
- **Không có outbox pattern.** Nếu DB down, log bị mất.
- **Không có background job** để retry hoặc archive logs cũ.
- **Không có retention policy.** Logs tồn tại vĩnh viễn.
- **Không log IP / user-agent.** Chỉ log actor (id + role).
- **Không có thông báo real-time** khi có event nhạy cảm.
- **Không có export logs** qua API.

Các mục trên là trade-off đã chọn cho Phase 10. Phase sau có thể
bổ sung nếu cần.

## 15. Cách chạy test

```bash
cd backend
npm test                 # chạy toàn bộ test suite (687 tests / 102 suites)
npm run syntax-check     # validate cú pháp tất cả file JS trong src/
TEST_MONGODB_URI=mongodb://127.0.0.1:27017/hrm_test_db \
  npx node --test tests/auditLog.model.test.js   # chỉ model
TEST_MONGODB_URI=mongodb://127.0.0.1:27017/hrm_test_db \
  npx node --test tests/auditLog.service.test.js # chỉ service
TEST_MONGODB_URI=mongodb://127.0.0.1:27017/hrm_test_db \
  npx node --test tests/auditLog.api.test.js     # chỉ API + integration
```

Lưu ý: khi chạy trực tiếp với `npx node --test`, cần set
`TEST_MONGODB_URI` trỏ về DB test (mặc định trong script `npm test` đã
được set).
