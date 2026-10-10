# Employee Management API

> Phase 4: RESTful API quản lý nhân viên cho HR Management System.
> Base URL: `/api/employees`
>
> Tất cả endpoint yêu cầu `Authorization: Bearer <token>`, trừ khi
> có ghi chú khác. Token lấy từ `POST /api/auth/login`.

## 1. Tổng quan endpoint

| Method | Path                  | Quyền        | Mô tả                                |
| ------ | --------------------- | ------------ | ------------------------------------ |
| GET    | `/api/employees`      | Admin        | Lấy danh sách nhân viên (phân trang) |
| POST   | `/api/employees`      | Admin        | Tạo nhân viên mới                    |
| GET    | `/api/employees/:id`  | Admin / Self | Xem chi tiết nhân viên               |
| PATCH  | `/api/employees/:id`  | Admin        | Cập nhật nhân viên (partial)         |
| DELETE | `/api/employees/:id`  | Admin        | Xóa mềm nhân viên                    |

### Quy tắc phân quyền

| Chức năng                     | Admin | Employee |
| ----------------------------- | ----- | -------- |
| Xem danh sách toàn bộ         | Có    | Không    |
| Xem chi tiết bất kỳ nhân viên | Có    | Không    |
| Xem hồ sơ chính mình          | Có    | Có       |
| Tạo nhân viên                 | Có    | Không    |
| Cập nhật nhân viên            | Có    | Không    |
| Xóa mềm nhân viên             | Có    | Không    |

**Lưu ý quan trọng về 404 vs 403**:
- Khi một Employee cố gọi `GET /api/employees/:id` với ID của người
  khác, hệ thống trả về **404 thay vì 403**.
- Lý do: trả 403 sẽ xác nhận rằng ID đó tồn tại → lộ thông tin.
  Trả 404 đảm bảo client không phân biệt được "ID không tồn tại" và
  "ID tồn tại nhưng bạn không có quyền".
- Quy ước này áp dụng nhất quán cho mọi endpoint detail.

### Cơ chế xóa mềm

- Phase 4 bổ sung 3 field: `isDeleted` (boolean, mặc định `false`),
  `deletedAt` (Date | null), `deletedBy` (User ref | null).
- Mặc định, danh sách và detail KHÔNG trả về nhân viên đã xóa mềm.
- Admin có thể truy cập bản ghi đã xóa mềm bằng query
  `?includeDeleted=true` (chỉ áp dụng cho endpoint list).
- `DELETE` là idempotent: gọi lần thứ hai trên bản ghi đã xóa trả
  về 200 với `meta.alreadyDeleted = true` (không tạo thêm side effect).
- Không tự động xóa / vô hiệu hóa User liên kết khi xóa mềm Employee.

## 2. Authentication

Tất cả request cần header:

```
Authorization: Bearer <JWT_TOKEN>
Content-Type: application/json
```

Lấy token qua `POST /api/auth/login` với body `{ "email", "password" }`.

> Không commit token thật, mật khẩu thật, hay MongoDB URI vào source
> hay documentation.

## 3. Response shape chuẩn

Mọi response đều theo format:

```json
{ "success": true, "data": ... }
```

List endpoint trả thêm `pagination`:

```json
{
  "success": true,
  "data": [ ... ],
  "pagination": {
    "page": 1,
    "limit": 10,
    "total": 25,
    "totalPages": 3
  }
}
```

Lỗi trả về:

```json
{
  "success": false,
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "field is required",
    "field": "fullName"
  }
}
```

## 4. Status codes

| Status | Ý nghĩa                                                |
| ------ | ------------------------------------------------------ |
| 200    | OK (list, detail, update, soft-delete)                 |
| 201    | Created (POST /api/employees)                          |
| 400    | Validation error hoặc ObjectId sai                     |
| 401    | Thiếu / sai Bearer token                               |
| 403    | Không đủ role (vd. employee gọi admin-only endpoint)  |
| 404    | Nhân viên không tồn tại / không có quyền xem          |
| 409    | Duplicate key (employeeCode / email / userId)          |
| 422    | Vi phạm business rule (vd. position không khớp dept)   |
| 500    | Lỗi nội bộ                                             |

## 5. GET /api/employees — List

### Query parameters

| Param            | Type    | Default | Mô tả                                              |
| ---------------- | ------- | ------- | --------------------------------------------------- |
| `page`           | int     | 1       | Số trang (>= 1)                                     |
| `limit`          | int     | 10      | Số bản ghi / trang (1-100)                          |
| `search`         | string  | ""      | Tìm theo `fullName`, `employeeCode`, hoặc `email`    |
| `departmentId`   | ObjectId| —       | Lọc theo phòng ban                                  |
| `positionId`     | ObjectId| —       | Lọc theo chức danh                                  |
| `employmentStatus` | string | —      | enum: `active`, `on_leave`, `inactive`              |
| `sortBy`         | string  | createdAt | enum: `fullName`, `employeeCode`, `hireDate`, `createdAt`, `updatedAt` |
| `sortOrder`      | string  | desc    | enum: `asc`, `desc`                                 |
| `includeDeleted` | boolean | false   | Admin only. Lấy cả bản ghi đã xóa mềm               |

### Ví dụ request

```http
GET /api/employees?page=1&limit=10&search=alice&sortBy=fullName&sortOrder=asc
Authorization: Bearer <token>
```

### Response mẫu

```json
{
  "success": true,
  "data": [
    {
      "_id": "64b000000000000000000001",
      "employeeCode": "NV0001",
      "userId": "64b000000000000000000099",
      "fullName": "Alice Wonderland",
      "email": "alice@example.com",
      "phone": "+1 555 0100",
      "avatar": null,
      "gender": "female",
      "dateOfBirth": "1995-04-12T00:00:00.000Z",
      "departmentId": "64b000000000000000000010",
      "positionId": "64b000000000000000000020",
      "position": "Engineer",
      "employmentType": "full_time",
      "hireDate": "2024-01-01T00:00:00.000Z",
      "managerId": null,
      "address": "",
      "employmentStatus": "active",
      "isDeleted": false,
      "deletedAt": null,
      "deletedBy": null,
      "createdAt": "2024-01-01T08:00:00.000Z",
      "updatedAt": "2024-01-01T08:00:00.000Z"
    }
  ],
  "pagination": {
    "page": 1,
    "limit": 10,
    "total": 1,
    "totalPages": 1
  }
}
```

### Quy tắc

- `search` là substring (case-insensitive) khớp với `fullName`,
  `employeeCode` hoặc `email`. Các ký tự regex metacharacter được
  escape — chuỗi `.*` không phải là pattern, là chuỗi cần tìm.
- Bản ghi đã `isDeleted=true` bị loại khỏi danh sách mặc định.
  Admin có thể thêm `?includeDeleted=true` để lấy cả.
- `passwordHash` không bao giờ xuất hiện trong response (cả ở nested
  fields từ populate).
- Validation:
  - `limit > 100` → 400 `VALIDATION_ERROR`
  - `sortBy` không nằm trong allowlist → 400
  - `sortOrder` không phải `asc`/`desc` → 400
  - `departmentId` / `positionId` sai format ObjectId → 400
  - `employmentStatus` không nằm trong enum → 400

## 6. GET /api/employees/:id — Detail

### Path parameters

| Param | Type     | Mô tả              |
| ----- | -------- | ------------------ |
| `id`  | ObjectId | ID của nhân viên   |

### Ví dụ

```http
GET /api/employees/64b000000000000000000001
Authorization: Bearer <token>
```

### Response mẫu (200)

```json
{
  "success": true,
  "data": { "...": "single employee object" }
}
```

### Quy tắc

- Admin: xem được bất kỳ nhân viên nào.
- Employee: chỉ xem được hồ sơ của chính mình. Nếu `id` không trỏ
  về Employee có `userId === req.user._id` → **404**.
- ID sai định dạng → 400.
- ID hợp lệ nhưng không tồn tại → 404.
- Bản ghi đã xóa mềm:
  - Non-admin → 404.
  - Admin → vẫn xem được.

## 7. POST /api/employees — Create

### Request body (các field được phép)

| Field            | Required | Type          | Notes                                  |
| ---------------- | -------- | ------------- | -------------------------------------- |
| `employeeCode`   | ✔        | string        | 2-32 chars; `[A-Z0-9_-]+`; uppercase   |
| `fullName`       | ✔        | string        | 2-120 chars                            |
| `email`          | ✔        | string        | email format; normalize to lowercase    |
| `employmentType` | ✔        | string        | `full_time`, `part_time`, `contract`, `intern` |
| `hireDate`       | ✔        | ISO date      | Không trong tương lai                   |
| `userId`         | ✗        | ObjectId      | Phải tồn tại và chưa liên kết Employee khác |
| `departmentId`   | ✗        | ObjectId      | Phải tồn tại và `active`               |
| `positionId`     | ✗        | ObjectId      | Phải tồn tại và `active`; nếu có `departmentId` thì phải khớp |
| `position`       | ✗        | string        | Cache denormalized; auto-fill OK       |
| `phone`          | ✗        | string        | 6-20 chars                             |
| `avatar`         | ✗        | string (URL)  |                                        |
| `gender`         | ✗        | string        | `male`, `female`, `other`              |
| `dateOfBirth`    | ✗        | ISO date      |                                        |
| `managerId`      | ✗        | ObjectId      | Ref tới Employee khác                  |
| `address`        | ✗        | string        | max 500 chars                          |
| `employmentStatus` | ✗      | string        | `active` (default), `on_leave`, `inactive` |

Các field KHÔNG được phép gửi lên (sẽ bị từ chối với 400):
`_id`, `__v`, `createdAt`, `updatedAt`, `passwordHash`, `role`,
`isDeleted`, `deletedAt`, `deletedBy`, và bất kỳ field nào không
nằm trong danh sách trên.

### Ví dụ

```http
POST /api/employees
Authorization: Bearer <token>
Content-Type: application/json

{
  "employeeCode": "NV0001",
  "fullName": "Alice Wonderland",
  "email": "alice@example.com",
  "employmentType": "full_time",
  "hireDate": "2024-01-01",
  "departmentId": "64b000000000000000000010",
  "positionId": "64b000000000000000000020",
  "phone": "+1 555 0100"
}
```

### Response mẫu (201)

```json
{
  "success": true,
  "data": { "...": "newly created employee" }
}
```

### Quy tắc nghiệp vụ

- Không tự tạo User. Nếu `userId` được gửi, server kiểm tra User tồn
  tại và chưa được liên kết.
- Không tự động nâng role lên `admin`.
- `employeeCode` và `email` phải unique. Trùng → 409 với code
  `DUPLICATE_EMPLOYEE_CODE` / `DUPLICATE_EMAIL`.
- Nếu cả `departmentId` và `positionId` đều có, position's
  `departmentId` (nếu có) phải khớp → nếu không → 422
  `POSITION_DEPARTMENT_MISMATCH`.
- `hireDate` không được trong tương lai → 400.

## 8. PATCH /api/employees/:id — Update

### Path parameters

| Param | Type     | Mô tả              |
| ----- | -------- | ------------------ |
| `id`  | ObjectId | ID của nhân viên   |

### Request body

- Phải chứa ít nhất 1 field được phép.
- Chỉ các field trong allowlist được chấp nhận (cùng allowlist
  với create, ngoại trừ `employeeCode`).
- Field không hợp lệ → 400 `VALIDATION_ERROR`.

### Ví dụ

```http
PATCH /api/employees/64b000000000000000000001
Authorization: Bearer <token>
Content-Type: application/json

{
  "fullName": "Alice Updated",
  "phone": "+1 555 9999"
}
```

### Response mẫu (200)

```json
{
  "success": true,
  "data": { "...": "updated employee" }
}
```

### Quy tắc

- Không cho cập nhật `_id`, `__v`, `createdAt`, `updatedAt`,
  `passwordHash`, `role`, `isDeleted`, `deletedAt`, `deletedBy`.
- Validate lại các field được gửi (Mongoose validation chạy).
- Nếu đổi `departmentId` / `positionId` → kiểm tra ref-existence và
  compatibility (xem phần create).
- Nếu đổi `userId`:
  - User phải tồn tại.
  - User chưa liên kết với Employee khác (ngoại trừ chính employee
    đang update).
  - Có thể unlink bằng cách gửi `"userId": null`.
- Duplicate `employeeCode` / `email` / `userId` (khác employee hiện
  tại) → 409.

## 9. DELETE /api/employees/:id — Soft delete

### Path parameters

| Param | Type     | Mô tả              |
| ----- | -------- | ------------------ |
| `id`  | ObjectId | ID của nhân viên   |

### Ví dụ

```http
DELETE /api/employees/64b000000000000000000001
Authorization: Bearer <token>
```

### Response mẫu (200)

```json
{
  "success": true,
  "data": {
    "_id": "...",
    "isDeleted": true,
    "deletedAt": "2024-06-15T10:30:00.000Z",
    "deletedBy": "64b000000000000000000099",
    "...": "..."
  },
  "meta": {
    "alreadyDeleted": false,
    "message": "Employee soft-deleted successfully"
  }
}
```

Gọi lần thứ hai trên cùng ID → 200 với `meta.alreadyDeleted: true`.

### Quy tắc

- Set `isDeleted=true`, `deletedAt=now`, `deletedBy=req.user._id`.
- KHÔNG xóa bản ghi.
- KHÔNG thay đổi User liên kết (status vẫn `active`).
- Bản ghi đã xóa mềm không xuất hiện trong list mặc định; admin có
  thể thêm `?includeDeleted=true` để xem.

## 10. Error codes

| Code                          | HTTP | Ý nghĩa                                          |
| ----------------------------- | ---- | ------------------------------------------------ |
| `VALIDATION_ERROR`            | 400  | Request body / param không hợp lệ                |
| `BAD_REQUEST`                 | 400  | Body không phải object                            |
| `AUTH_MISSING`                | 401  | Thiếu `Authorization` header                     |
| `AUTH_FORMAT`                 | 401  | Header không đúng format `Bearer <token>`         |
| `TOKEN_EXPIRED`               | 401  | JWT hết hạn                                       |
| `TOKEN_INVALID`               | 401  | JWT sai signature / malformed                     |
| `USER_NOT_FOUND`              | 401  | User trong token không tồn tại                    |
| `USER_INACTIVE`               | 401  | User trong token không active                     |
| `FORBIDDEN`                   | 403  | Role không đủ quyền                               |
| `NOT_FOUND`                   | 404  | Route không tồn tại                                |
| `EMPLOYEE_NOT_FOUND`          | 404  | Employee ID không tồn tại / không có quyền xem   |
| `DUPLICATE_KEY`               | 409  | Duplicate (generic fallback)                      |
| `DUPLICATE_EMPLOYEE_CODE`     | 409  | Trùng `employeeCode`                              |
| `DUPLICATE_EMAIL`             | 409  | Trùng `email`                                     |
| `DUPLICATE_USER_LINK`         | 409  | User đã liên kết với Employee khác                |
| `POSITION_DEPARTMENT_MISMATCH`| 422  | Position không thuộc Department chỉ định          |
| `MANAGER_INVALID`             | 422  | `managerId` không hợp lệ                          |
| `INTERNAL_SERVER_ERROR`       | 500  | Lỗi không mong đợi                                |

## 11. Security notes

- **Bearer token bắt buộc** cho mọi endpoint. Không có session, không
  có cookie-based auth.
- **Client không thể bypass** role check bằng query string.
  `req.user.role` được load tươi từ DB bởi `protect` middleware mỗi
  request.
- **Search string** được escape regex metacharacter trước khi đưa
  vào MongoDB query — không có nguy cơ ReDoS hay query injection.
- **NoSQL injection** phòng chống bằng allowlist query parser —
  client không gửi được object lạ vào query (vd. `{"$gt": ""}`).
- **passwordHash** không bao giờ xuất hiện trong response (cả ở
  top-level và ở nested fields). Bảo vệ bởi:
  - `User` schema: `select: false` cho query mặc định + `toJSON`
    transform strip.
  - `Employee` API: không đọc `passwordHash` ở bất kỳ layer nào.
- **Stack trace / DB internals** không bao giờ trả về client ở
  production — chỉ log server-side.
- **404 thay vì 403** cho non-owner detail access: tránh leak ID
  existence.
- **Soft-delete** không thể bypass bằng cách update `isDeleted` qua
  API — field này nằm ngoài allowlist update.

## 12. Curl examples

> Thay `<TOKEN>` bằng JWT thật. Không commit token thật.

```bash
# Login (lấy token)
curl -X POST http://localhost:5000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"admin@example.com","password":"<password>"}'

# List
curl http://localhost:5000/api/employees \
  -H "Authorization: Bearer <TOKEN>"

# Detail
curl http://localhost:5000/api/employees/64b000000000000000000001 \
  -H "Authorization: Bearer <TOKEN>"

# Create
curl -X POST http://localhost:5000/api/employees \
  -H "Authorization: Bearer <TOKEN>" \
  -H "Content-Type: application/json" \
  -d '{
    "employeeCode":"NV0001",
    "fullName":"Alice",
    "email":"alice@example.com",
    "employmentType":"full_time",
    "hireDate":"2024-01-01"
  }'

# Update
curl -X PATCH http://localhost:5000/api/employees/64b000000000000000000001 \
  -H "Authorization: Bearer <TOKEN>" \
  -H "Content-Type: application/json" \
  -d '{"fullName":"Alice Updated"}'

# Soft delete
curl -X DELETE http://localhost:5000/api/employees/64b000000000000000000001 \
  -H "Authorization: Bearer <TOKEN>"
```
