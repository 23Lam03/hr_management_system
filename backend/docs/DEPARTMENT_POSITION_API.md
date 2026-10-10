# Department & Position Management API

> Phase 5: RESTful API quản lý phòng ban (Department) và chức vụ (Position)
> cho HR Management System.
>
> - Base URL: `/api/departments`, `/api/positions`
> - Authentication: Bearer JWT (lấy qua `POST /api/auth/login`)
> - Authorization: **Admin only** cho mọi endpoint quản trị.

---

## 1. Tổng quan endpoint

### 1.1. Departments

| Method | Path                                  | Quyền  | Mô tả                          |
| ------ | ------------------------------------- | ------ | ------------------------------ |
| GET    | `/api/departments`                    | Admin  | Danh sách phòng ban (phân trang) |
| POST   | `/api/departments`                    | Admin  | Tạo phòng ban mới              |
| GET    | `/api/departments/:id`                | Admin  | Chi tiết một phòng ban         |
| PATCH  | `/api/departments/:id`                | Admin  | Cập nhật một phần phòng ban    |
| PATCH  | `/api/departments/:id/deactivate`     | Admin  | Vô hiệu hóa phòng ban          |

### 1.2. Positions

| Method | Path                                  | Quyền  | Mô tả                          |
| ------ | ------------------------------------- | ------ | ------------------------------ |
| GET    | `/api/positions`                      | Admin  | Danh sách chức vụ (phân trang) |
| POST   | `/api/positions`                      | Admin  | Tạo chức vụ mới                |
| GET    | `/api/positions/:id`                  | Admin  | Chi tiết một chức vụ           |
| PATCH  | `/api/positions/:id`                  | Admin  | Cập nhật một phần chức vụ      |
| PATCH  | `/api/positions/:id/deactivate`       | Admin  | Vô hiệu hóa chức vụ            |

---

## 2. Quy tắc phân quyền

| Chức năng                          | Admin | Employee |
| ---------------------------------- | ----- | -------- |
| Xem danh sách Department / Position | ✔    | ✗        |
| Xem chi tiết                        | ✔    | ✗        |
| Tạo mới                            | ✔    | ✗        |
| Cập nhật                            | ✔    | ✗        |
| Vô hiệu hóa                         | ✔    | ✗        |

- Không có token → `401` `AUTH_MISSING`.
- Token không hợp lệ / hết hạn → `401` `TOKEN_INVALID` / `TOKEN_EXPIRED`.
- Token hợp lệ nhưng user là `employee` → `403` `FORBIDDEN`.
- Role trong token **không được tin** — middleware `protect` luôn reload
  user mới nhất từ DB trước khi kiểm tra role.

---

## 3. Response shape chuẩn

Tất cả response đều theo format:

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
    "field": "name"
  }
}
```

---

## 4. Status codes

| Status | Ý nghĩa                                                |
| ------ | ------------------------------------------------------ |
| 200    | OK (list, detail, update, deactivate)                  |
| 201    | Created (POST)                                         |
| 400    | Validation error / ObjectId sai / Reference không tồn tại |
| 401    | Thiếu / sai Bearer token                               |
| 403    | Không đủ role                                           |
| 404    | Resource không tồn tại                                  |
| 409    | Duplicate key (code)                                    |

---

## 5. Schema tham chiếu

### 5.1. Department

| Field               | Type     | Required | Default  | Notes                                              |
| ------------------- | -------- | -------- | -------- | -------------------------------------------------- |
| `name`              | String   | ✔        | —        | 2–120 ký tự; nén khoảng trắng                     |
| `code`              | String   | ✔        | —        | unique; 2–32 ký tự; `[A-Z0-9_-]+`; uppercase       |
| `description`       | String   | ✗        | `""`     | max 500 ký tự                                       |
| `managerEmployeeId` | ObjectId | ✗        | `null`   | ref `Employee`; không được là soft-deleted        |
| `status`            | String   | ✔        | `active` | enum: `active`, `inactive`                         |

### 5.2. Position

| Field         | Type     | Required | Default  | Notes                                              |
| ------------- | -------- | -------- | -------- | -------------------------------------------------- |
| `name`        | String   | ✔        | —        | 2–120 ký tự                                        |
| `code`        | String   | ✔        | —        | unique; 2–32 ký tự; `[A-Z0-9_-]+`; uppercase       |
| `description` | String   | ✗        | `""`     | max 500                                            |
| `departmentId`| ObjectId | ✗        | `null`   | ref `Department`; phải active nếu cung cấp         |
| `status`      | String   | ✔        | `active` | enum: `active`, `inactive`                         |

---

## 6. Quy tắc Pagination / Search / Filter / Sort

Áp dụng cho cả hai resource:

- **Pagination**: `page` (mặc định 1, ≥ 1), `limit` (mặc định 10, 1–100).
- **Search**: substring (case-insensitive) trên `name` và `code`. Ký tự
  regex metacharacter (`.*+?^${}()|[]\`) được escape — chuỗi `.*` là
  chuỗi tìm kiếm, không phải pattern.
- **Filter**:
  - `status`: enum (`active`, `inactive`).
  - Department: (chỉ `status`).
  - Position: `status` + `departmentId` (ObjectId).
- **Sort allowlist**: `name`, `code`, `createdAt`, `updatedAt`.
- **Sort order**: `asc` hoặc `desc` (mặc định `desc`).
- Client chỉ được truyền tên field nằm trong allowlist; truyền ngoài
  allowlist → `400 VALIDATION_ERROR`.

---

## 7. GET /api/departments — List

### Query parameters

| Param       | Type    | Default    | Mô tả                                  |
| ----------- | ------- | ---------- | --------------------------------------- |
| `page`      | int     | 1          | Số trang (≥ 1)                          |
| `limit`     | int     | 10         | Số bản ghi / trang (1–100)              |
| `search`    | string  | `""`       | Tìm theo `name` hoặc `code`             |
| `status`    | string  | —          | `active` hoặc `inactive`                |
| `sortBy`    | string  | `createdAt`| allowlist: `name`, `code`, `createdAt`, `updatedAt` |
| `sortOrder` | string  | `desc`     | `asc` hoặc `desc`                       |

### Ví dụ

```http
GET /api/departments?page=1&limit=10&search=IT&status=active&sortBy=name&sortOrder=asc
Authorization: Bearer <token>
```

### Response (200)

```json
{
  "success": true,
  "data": [
    {
      "_id": "...",
      "name": "Information Technology",
      "code": "IT",
      "description": "IT team",
      "managerEmployeeId": null,
      "status": "active",
      "createdAt": "2024-01-01T08:00:00.000Z",
      "updatedAt": "2024-01-01T08:00:00.000Z"
    }
  ],
  "pagination": { "page": 1, "limit": 10, "total": 1, "totalPages": 1 }
}
```

### Lỗi thường gặp

| Status | Code              | Khi nào                                              |
| ------ | ----------------- | ----------------------------------------------------- |
| 400    | `VALIDATION_ERROR` | `limit > 100`, `sortBy` ngoài allowlist, `status` sai enum |

---

## 8. GET /api/departments/:id — Detail

```http
GET /api/departments/64b000000000000000000010
Authorization: Bearer <token>
```

| Status | Code                    | Khi nào                          |
| ------ | ----------------------- | --------------------------------- |
| 200    | (success)               | Trả về object phòng ban          |
| 400    | `VALIDATION_ERROR`      | ID sai format                     |
| 404    | `DEPARTMENT_NOT_FOUND`  | Không tìm thấy phòng ban         |

---

## 9. POST /api/departments — Create

### Request body

| Field               | Required | Type      | Notes                                       |
| ------------------- | -------- | --------- | ------------------------------------------- |
| `name`              | ✔        | string    | 2–120 chars                                  |
| `code`              | ✔        | string    | 2–32 chars; `[A-Z0-9_-]+`; uppercase         |
| `description`       | ✗        | string    | max 500 chars                                |
| `managerEmployeeId` | ✗        | ObjectId  | Phải tồn tại; không được soft-deleted        |
| `status`            | ✗        | string    | `active` (default), `inactive`               |

Các field **không được phép** gửi lên: `_id`, `__v`, `createdAt`,
`updatedAt`, hoặc bất kỳ field nào ngoài danh sách trên.

### Ví dụ

```http
POST /api/departments
Authorization: Bearer <token>
Content-Type: application/json

{
  "name": "Information Technology",
  "code": "IT",
  "description": "IT department",
  "managerEmployeeId": "64b000000000000000000099"
}
```

### Response (201)

```json
{ "success": true, "data": { "_id": "...", "name": "Information Technology", ... } }
```

### Lỗi

| Status | Code                          | Khi nào                                    |
| ------ | ----------------------------- | ------------------------------------------ |
| 400    | `VALIDATION_ERROR`            | Thiếu field bắt buộc, code sai format, name < 2 chars |
| 400    | `VALIDATION_ERROR` (field: `managerEmployeeId`) | Manager không tồn tại / soft-deleted |
| 409    | `DUPLICATE_DEPARTMENT_CODE`   | Trùng `code`                               |

---

## 10. PATCH /api/departments/:id — Update

- Body phải có ít nhất 1 field trong allowlist.
- Chỉ chấp nhận các field: `name`, `code`, `description`,
  `managerEmployeeId`, `status`.
- Có thể unlink `managerEmployeeId` bằng cách gửi `null`.

### Lỗi

| Status | Code                                       |
| ------ | ------------------------------------------ |
| 400    | `VALIDATION_ERROR` (sai ObjectId / enum / unknown field) |
| 404    | `DEPARTMENT_NOT_FOUND`                     |
| 409    | `DUPLICATE_DEPARTMENT_CODE`                 |

---

## 11. PATCH /api/departments/:id/deactivate — Soft deactivation

- Set `status: 'inactive'`.
- **Idempotent**: gọi lần 2 trên cùng ID trả `200` với
  `meta.alreadyDeactivated: true` (không tạo side effect mới).
- **Không xóa** Employee / Position / các liên kết khác.
- Sau khi deactivate:
  - Department vẫn còn trong DB.
  - Employee / Position **vẫn trỏ tới** Department này.
  - Khi tạo Position mới với `departmentId` của Department đã inactive
    → `400 VALIDATION_ERROR`.
  - Khi tạo Employee mới với `departmentId` của Department đã inactive
    → `400 VALIDATION_ERROR` (giữ nguyên quy tắc Phase 4).

### Response (200)

```json
{
  "success": true,
  "data": { "_id": "...", "status": "inactive", ... },
  "meta": {
    "alreadyDeactivated": false,
    "message": "Department deactivated successfully"
  }
}
```

---

## 12. GET /api/positions — List

### Query parameters

| Param          | Type      | Default     | Mô tả                                          |
| -------------- | --------- | ----------- | ----------------------------------------------- |
| `page`         | int       | 1           | Số trang (≥ 1)                                  |
| `limit`        | int       | 10          | 1–100                                           |
| `search`       | string    | `""`        | Tìm theo `name` hoặc `code`                     |
| `status`       | string    | —           | `active` hoặc `inactive`                        |
| `departmentId` | ObjectId  | —           | Lọc theo phòng ban                              |
| `sortBy`       | string    | `createdAt` | allowlist giống Department                      |
| `sortOrder`    | string    | `desc`      | `asc` hoặc `desc`                               |

Ví dụ:

```http
GET /api/positions?page=1&limit=10&search=Developer&status=active&departmentId=64b000000000000000000010
```

---

## 13. GET /api/positions/:id — Detail

| Status | Code                    |
| ------ | ----------------------- |
| 200    | (success)               |
| 400    | `VALIDATION_ERROR`      |
| 404    | `POSITION_NOT_FOUND`    |

---

## 14. POST /api/positions — Create

| Field          | Required | Type     | Notes                                |
| -------------- | -------- | -------- | ------------------------------------ |
| `name`         | ✔        | string   | 2–120 chars                          |
| `code`         | ✔        | string   | 2–32 chars; `[A-Z0-9_-]+`; uppercase |
| `description`  | ✗        | string   | max 500 chars                        |
| `departmentId` | ✗        | ObjectId | Phải tồn tại và `active`             |
| `status`       | ✗        | string   | `active` (default), `inactive`       |

| Status | Code                                              |
| ------ | ------------------------------------------------- |
| 400    | `VALIDATION_ERROR` (thiếu field, sai enum / ObjectId / unknown field) |
| 400    | `VALIDATION_ERROR` (field: `departmentId`) khi Department không tồn tại hoặc inactive |
| 409    | `DUPLICATE_POSITION_CODE`                         |

---

## 15. PATCH /api/positions/:id — Update

- Allowlist: `name`, `code`, `description`, `departmentId`, `status`.
- Có thể unlink `departmentId` bằng `null`.
- Khi đổi `departmentId`: phải tồn tại và `active`; nếu không → `400`.

---

## 16. PATCH /api/positions/:id/deactivate — Soft deactivation

- Set `status: 'inactive'`.
- **Idempotent** (giống Department).
- **Không xóa** Employee tham chiếu tới Position này. Employee vẫn giữ
  liên kết lịch sử.
- Sau khi deactivate, các rule validate nghiệm vụ Phase 4 vẫn áp dụng:
  Position inactive sẽ bị Employee service từ chối khi tạo Employee mới.

---

## 17. Bảo toàn liên kết dữ liệu

| Hành động                                  | Cascade? | Ghi chú                              |
| ------------------------------------------ | -------- | ------------------------------------ |
| Set `Department.status = inactive`         | ✗        | Employee / Position vẫn thuộc nó     |
| Set `Position.status = inactive`           | ✗        | Employee vẫn trỏ tới Position đó    |
| Xóa (hard delete) Department / Position    | ✗        | Phase 5 **không cung cấp** endpoint xóa cứng. Chỉ deactivate. |

Lý do: bảo toàn lịch sử HRM. Khi deactivate một Department:
- Bản ghi Department vẫn còn.
- `Employee.departmentId` không bị thay đổi.
- `Position.departmentId` không bị thay đổi.
- Tuy nhiên **không thể tạo mới** Employee / Position với `departmentId`
  trỏ vào Department đã inactive.
- Manager reference (`Department.managerEmployeeId`) vẫn giữ nguyên
  nhưng người quản lý không thể được tham chiếu mới nếu đã soft-deleted.

---

## 18. Error codes tổng hợp

| Code                          | HTTP | Ý nghĩa                                          |
| ----------------------------- | ---- | ------------------------------------------------ |
| `VALIDATION_ERROR`            | 400  | Request body / param không hợp lệ                |
| `BAD_REQUEST`                 | 400  | Body không phải object                            |
| `AUTH_MISSING`                | 401  | Thiếu `Authorization` header                     |
| `AUTH_FORMAT`                 | 401  | Header sai format `Bearer <token>`               |
| `TOKEN_EXPIRED`               | 401  | JWT hết hạn                                       |
| `TOKEN_INVALID`               | 401  | JWT sai / malformed                              |
| `USER_NOT_FOUND`              | 401  | User trong token không tồn tại                    |
| `USER_INACTIVE`               | 401  | User không active                                  |
| `FORBIDDEN`                   | 403  | Role không đủ quyền                               |
| `NOT_FOUND`                   | 404  | Route không tồn tại                                |
| `DEPARTMENT_NOT_FOUND`        | 404  | Department ID không tồn tại                       |
| `POSITION_NOT_FOUND`          | 404  | Position ID không tồn tại                         |
| `DUPLICATE_KEY`               | 409  | Duplicate (generic fallback)                      |
| `DUPLICATE_DEPARTMENT_CODE`   | 409  | Trùng `Department.code`                          |
| `DUPLICATE_POSITION_CODE`     | 409  | Trùng `Position.code`                            |
| `INTERNAL_SERVER_ERROR`       | 500  | Lỗi không mong đợi                                |

---

## 19. Security notes

- **Bearer token bắt buộc** cho mọi endpoint (trừ health).
- **Không thể bypass role** bằng cách sửa query / body. `protect`
  middleware reload user mỗi request.
- **Search** escape regex metacharacter — chống ReDoS / pattern injection.
- **Allowlist** cho `sortBy`, `filters`, các field create/update — chống
  NoSQL injection và field injection.
- **`managerEmployeeId`** được verify tồn tại + không soft-deleted.
- **`departmentId`** (trong Position) được verify tồn tại + active.
- **Stack trace / DB internals** không bao giờ trả về client ở
  production — chỉ log server-side.
- **`passwordHash`** không bao giờ xuất hiện trong response (Phase 3
  vẫn giữ nguyên).

---

## 20. Ví dụ curl

```bash
# Lấy token
curl -X POST http://localhost:5000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"admin@example.com","password":"<password>"}'

# List departments
curl http://localhost:5000/api/departments \
  -H "Authorization: Bearer <TOKEN>"

# Tạo department
curl -X POST http://localhost:5000/api/departments \
  -H "Authorization: Bearer <TOKEN>" \
  -H "Content-Type: application/json" \
  -d '{"name":"Information Technology","code":"IT"}'

# Update department
curl -X PATCH http://localhost:5000/api/departments/64b000000000000000000010 \
  -H "Authorization: Bearer <TOKEN>" \
  -H "Content-Type: application/json" \
  -d '{"description":"Updated description"}'

# Deactivate department
curl -X PATCH http://localhost:5000/api/departments/64b000000000000000000010/deactivate \
  -H "Authorization: Bearer <TOKEN>"

# List positions
curl "http://localhost:5000/api/positions?status=active" \
  -H "Authorization: Bearer <TOKEN>"

# Tạo position
curl -X POST http://localhost:5000/api/positions \
  -H "Authorization: Bearer <TOKEN>" \
  -H "Content-Type: application/json" \
  -d '{"name":"Frontend Engineer","code":"FE","departmentId":"64b000000000000000000010"}'
```
