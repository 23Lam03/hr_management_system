# Attendance Management API

> Phase 6: RESTful API quản lý chấm công cho HR Management System.
>
> - Base URL: `/api/attendance`
> - Authentication: Bearer JWT (lấy qua `POST /api/auth/login`)
> - Authorization:
>   - **Admin** được xem toàn hệ thống, tạo và sửa bản ghi.
>   - **Employee** chỉ được xem lịch sử chấm công của chính mình qua
>     endpoint `/me` hoặc xem chi tiết một bản ghi thuộc về mình.

---

## 1. Tổng quan endpoint

| Method | Path                          | Quyền        | Mô tả                                 |
| ------ | ----------------------------- | ------------ | ------------------------------------- |
| GET    | `/api/attendance`             | Admin        | Danh sách chấm công (phân trang)      |
| GET    | `/api/attendance/me`          | Auth (any)   | Lịch sử của chính user đăng nhập     |
| GET    | `/api/attendance/:id`         | Admin / Owner | Chi tiết một bản ghi                  |
| POST   | `/api/attendance`             | Admin        | Tạo bản ghi chấm công                |
| PATCH  | `/api/attendance/:id`         | Admin        | Cập nhật một phần                     |
| DELETE | `/api/attendance/:id`         | —            | **Không hỗ trợ** trong Phase 6 (xem §10) |

---

## 2. Quy tắc phân quyền

| Hành động                                     | Admin | Employee                                |
| --------------------------------------------- | ----- | --------------------------------------- |
| `GET /api/attendance` (list toàn hệ thống)   | ✔    | ✗ (`403`)                               |
| `GET /api/attendance/me`                      | ✔ (nếu có Employee) / ✗ (404) | ✔ (nếu có Employee) / ✗ (404) |
| `GET /api/attendance/:id` của chính mình      | ✔    | ✔                                       |
| `GET /api/attendance/:id` của người khác      | ✔    | ✗ (`404`, không `403`, tránh leak ID)  |
| `POST /api/attendance`                        | ✔    | ✗ (`403`)                               |
| `PATCH /api/attendance/:id`                   | ✔    | ✗ (`403`)                               |
| Tạo / sửa bản ghi cho Employee khác            | ✔    | ✗                                       |

- Không có token → `401 AUTH_MISSING`.
- Token sai / hết hạn → `401 TOKEN_INVALID` / `TOKEN_EXPIRED`.
- Token hợp lệ nhưng role không đủ → `403 FORBIDDEN`.
- Role trong token **không được tin** — middleware `protect` luôn reload
  user tươi từ DB trước khi kiểm tra role.

---

## 3. Schema tham chiếu

| Field         | Type     | Required | Default  | Notes                                              |
| ------------- | -------- | -------- | -------- | -------------------------------------------------- |
| `employeeId`  | ObjectId | ✔        | —        | ref `Employee`; phải tồn tại & chưa soft-delete   |
| `workDate`    | Date     | ✔        | —        | Ngày làm việc (UTC midnight); input `YYYY-MM-DD`   |
| `checkInAt`   | Date     | ✗        | `null`   | Thời điểm check-in (ISO 8601 datetime)            |
| `checkOutAt`  | Date     | ✗        | `null`   | Phải >= `checkInAt`                                |
| `status`      | String   | ✔        | —        | enum: `present`, `late`, `absent`, `leave`, `half_day` |
| `note`        | String   | ✗        | `""`     | max 500 ký tự                                       |
| `createdBy`   | ObjectId | ✗        | `null`   | ref `User`; tự set từ `req.user`                    |
| `updatedBy`   | ObjectId | ✗        | `null`   | ref `User`; tự set từ `req.user`                    |
| `createdAt`   | Date     | auto     | —        | timestamps                                          |
| `updatedAt`   | Date     | auto     | —        | timestamps                                          |

**Indexes**

- `{ employeeId: 1, workDate: 1 }` **unique** — một bản ghi / ngày / Employee.
- `{ employeeId: 1, workDate: -1 }` — tối ưu list theo Employee + sort workDate desc.

---

## 4. Quy tắc ngày giờ và timezone

Phase 6 chọn quy ước **lưu UTC, hiển thị ISO 8601**:

- **`workDate`** chỉ chấp nhận date string `YYYY-MM-DD`. Khi lưu vào DB,
  validator chuẩn hoá thành **UTC midnight** của ngày đó (ví dụ
  `2026-10-09` → `2026-10-09T00:00:00.000Z`). Cách này tránh lệch
  ngày do múi giờ máy client/server.
- **`checkInAt` / `checkOutAt`** chấp nhận ISO 8601 datetime đầy đủ
  (ví dụ `2026-10-09T08:30:00.000Z`). Lưu nguyên timestamp.
- **Query `startDate` / `endDate`**: cũng chỉ chấp nhận `YYYY-MM-DD`.
  `endDate` được hiểu là **inclusive cả ngày đó** — backend sẽ tự
  convert thành `$lt: endDate + 1 ngày`.
- Client chịu trách nhiệm chuyển đổi sang timezone hiển thị
  (ví dụ `Asia/Ho_Chi_Minh`) nếu cần.

---

## 5. Quy tắc chống trùng bản ghi

- **Một bản ghi duy nhất cho mỗi cặp `(employeeId, workDate)`** —
  enforce bằng unique compound index trong MongoDB.
- Khi tạo trùng → `409 DUPLICATE_ATTENDANCE`.
- Khi cập nhật mà kết quả cuối cùng trùng `(employeeId, workDate)` của
  một bản ghi khác → `409 DUPLICATE_ATTENDANCE`.
- Cùng Employee trên hai ngày khác nhau → OK.
- Hai Employee khác nhau trên cùng một ngày → OK.
- `workDate` chuẩn hoá về UTC midnight nên hai request
  `2026-10-09` và `2026-10-09T00:00:00Z` được tính là cùng một ngày.

---

## 6. Response shape chuẩn

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
    "field": "employeeId"
  }
}
```

---

## 7. Status codes

| Status | Ý nghĩa                                                |
| ------ | ------------------------------------------------------ |
| 200    | OK (list, detail, update)                              |
| 201    | Created (POST)                                         |
| 400    | Validation error / ObjectId sai / Reference không tồn tại |
| 401    | Thiếu / sai Bearer token                               |
| 403    | Không đủ role                                           |
| 404    | Resource không tồn tại / không có quyền xem (anti-leak) |
| 409    | Duplicate `(employeeId, workDate)`                     |

---

## 8. GET /api/attendance — List (Admin)

### Query parameters

| Param       | Type      | Default     | Mô tả                                            |
| ----------- | --------- | ----------- | ------------------------------------------------- |
| `page`      | int       | 1           | Số trang (≥ 1)                                    |
| `limit`     | int       | 10          | 1–100                                              |
| `employeeId`| ObjectId  | —           | Lọc theo Employee                                  |
| `status`    | string    | —           | enum: `present`, `late`, `absent`, `leave`, `half_day` |
| `startDate` | `YYYY-MM-DD` | —        | Lọc `workDate >= startDate`                       |
| `endDate`   | `YYYY-MM-DD` | —        | Lọc `workDate <= endDate` (inclusive)             |
| `sortBy`    | string    | `workDate`  | allowlist: `workDate`, `checkInAt`, `checkOutAt`, `createdAt`, `updatedAt` |
| `sortOrder` | string    | `desc`      | `asc` hoặc `desc`                                 |

Ví dụ:

```http
GET /api/attendance?page=1&limit=10&employeeId=64b000000000000000000010&startDate=2026-10-01&endDate=2026-10-31&status=present
Authorization: Bearer <token>
```

### Response (200)

```json
{
  "success": true,
  "data": [
    {
      "_id": "...",
      "employeeId": "64b000000000000000000010",
      "workDate": "2026-10-09T00:00:00.000Z",
      "checkInAt": "2026-10-09T01:30:00.000Z",
      "checkOutAt": "2026-10-09T10:00:00.000Z",
      "status": "present",
      "note": "",
      "createdBy": "64b000000000000000000099",
      "updatedBy": null,
      "createdAt": "2026-10-09T11:00:00.000Z",
      "updatedAt": "2026-10-09T11:00:00.000Z"
    }
  ],
  "pagination": { "page": 1, "limit": 10, "total": 1, "totalPages": 1 }
}
```

### Lỗi

| Status | Code              | Khi nào                                              |
| ------ | ----------------- | ----------------------------------------------------- |
| 400    | `VALIDATION_ERROR` | `limit > 100`, `sortBy` ngoài allowlist, `status` sai enum, sai format ngày, `startDate > endDate` |

---

## 9. GET /api/attendance/me — Self history

- Endpoint này **không nhận** `employeeId` từ client. Hệ thống tự suy
  ra Employee từ `req.user._id` thông qua `Employee.userId`.
- Nếu user chưa liên kết Employee → `404 EMPLOYEE_NOT_FOUND`.
- Admin không có Employee liên kết cũng nhận `404` (chỉ Admin dùng
  `GET /api/attendance?employeeId=...` để xem của người khác).
- Nếu Admin có liên kết Employee (hiếm), `/me` sẽ trả về lịch sử
  của chính Admin đó.

### Query parameters

Giống endpoint list, ngoại trừ không có `employeeId`:

| Param       | Default     | Mô tả                            |
| ----------- | ----------- | --------------------------------- |
| `page`      | 1           | Số trang                          |
| `limit`     | 10          | 1–100                              |
| `status`    | —           | enum                              |
| `startDate` | —           | `YYYY-MM-DD`                      |
| `endDate`   | —           | `YYYY-MM-DD` (inclusive)          |
| `sortBy`    | `workDate`  | allowlist                         |
| `sortOrder` | `desc`      | `asc` / `desc`                    |

### Response (200)

Cùng shape `data + pagination` như list Admin.

---

## 10. GET /api/attendance/:id — Detail

- Admin: xem bất kỳ bản ghi nào.
- Employee: chỉ xem được bản ghi thuộc Employee liên kết với mình.
  Truy cập bản ghi của người khác → `404 ATTENDANCE_NOT_FOUND`
  (không `403`, tránh leak sự tồn tại của ID).

| Status | Code                    |
| ------ | ----------------------- |
| 200    | (success)               |
| 400    | `VALIDATION_ERROR`      |
| 404    | `ATTENDANCE_NOT_FOUND`  |

---

## 11. POST /api/attendance — Create (Admin)

### Request body

| Field         | Required | Type     | Notes                                                |
| ------------- | -------- | -------- | ---------------------------------------------------- |
| `employeeId`  | ✔        | ObjectId | Phải tồn tại và chưa soft-delete                     |
| `workDate`    | ✔        | string   | `YYYY-MM-DD`                                         |
| `status`      | ✔        | string   | enum: `present`, `late`, `absent`, `leave`, `half_day` |
| `checkInAt`   | ✗        | string   | ISO 8601 datetime                                    |
| `checkOutAt`  | ✗        | string   | ISO 8601 datetime; phải >= `checkInAt`               |
| `note`        | ✗        | string   | max 500                                              |

Các field **không được phép** gửi lên: `_id`, `__v`, `createdAt`,
`updatedAt`, `createdBy`, `updatedBy`. Tất cả sẽ bị từ chối với
`400 VALIDATION_ERROR`.

`createdBy` và `updatedBy` được set tự động từ `req.user._id`.

### Ví dụ

```http
POST /api/attendance
Authorization: Bearer <token>
Content-Type: application/json

{
  "employeeId": "64b000000000000000000010",
  "workDate": "2026-10-09",
  "status": "present",
  "checkInAt": "2026-10-09T01:30:00.000Z",
  "checkOutAt": "2026-10-09T10:00:00.000Z"
}
```

### Response (201)

```json
{
  "success": true,
  "data": {
    "_id": "...",
    "employeeId": "64b000000000000000000010",
    "workDate": "2026-10-09T00:00:00.000Z",
    "status": "present",
    "createdBy": "64b000000000000000000099",
    "updatedBy": "64b000000000000000000099",
    "createdAt": "...",
    "updatedAt": "..."
  }
}
```

### Lỗi

| Status | Code                                       |
| ------ | ------------------------------------------ |
| 400    | `VALIDATION_ERROR` (thiếu field, sai enum, sai format ngày, checkOut < checkIn) |
| 400    | `VALIDATION_ERROR` (field: `employeeId`) khi Employee không tồn tại / soft-deleted |
| 409    | `DUPLICATE_ATTENDANCE` (đã có bản ghi cùng `employeeId` + `workDate`) |

---

## 12. PATCH /api/attendance/:id — Update (Admin)

- Allowlist: `employeeId`, `workDate`, `checkInAt`, `checkOutAt`, `status`, `note`.
- Body phải có ít nhất 1 field trong allowlist.
- Có thể clear `checkInAt` / `checkOutAt` / `note` bằng `null` hoặc `""`.
- `updatedBy` tự động set từ `req.user._id`.

### Lỗi

| Status | Code                                       |
| ------ | ------------------------------------------ |
| 400    | `VALIDATION_ERROR` (sai ObjectId / enum / format ngày / unknown field / body rỗng) |
| 400    | `VALIDATION_ERROR` (field: `employeeId`) khi Employee không tồn tại / soft-deleted |
| 404    | `ATTENDANCE_NOT_FOUND`                     |
| 409    | `DUPLICATE_ATTENDANCE` sau khi đổi `employeeId` / `workDate` mà trùng với bản ghi khác |

---

## 13. DELETE /api/attendance/:id — Không hỗ trợ trong Phase 6

**Endpoint `DELETE /api/attendance/:id` KHÔNG được triển khai** trong
Phase 6. Lý do:

1. **Bảo toàn dữ liệu chấm công**: chấm công là dữ liệu audit,
   cần giữ lại lịch sử để tính lương, đánh giá, giải trình.
2. **Chưa có cơ chế soft-delete thống nhất**: nếu thêm `isDeleted`
   / `deletedAt` / `deletedBy` giống Employee, cần thống nhất với
   team về chính sách lưu trữ và thời gian xóa sau cùng.
3. **Tạm thời dùng `status: 'absent'`** nếu cần đánh dấu "không có
   dữ liệu" cho ngày đó.

Khi cần DELETE, sẽ triển khai theo một trong hai hướng:
- (a) Bổ sung `isDeleted` / `deletedAt` / `deletedBy` cho Attendance
      (cần kế hoạch lưu trữ rõ ràng).
- (b) Hard-delete an toàn chỉ khi bản ghi đó chưa được dùng trong
      module khác (payroll, evaluation). Hiện tại không có module nào
      tham chiếu Attendance.

---

## 14. Error codes tổng hợp

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
| `EMPLOYEE_NOT_FOUND`          | 404  | User không có Employee liên kết (dùng cho `/me`)  |
| `ATTENDANCE_NOT_FOUND`        | 404  | ID không tồn tại / không có quyền xem             |
| `DUPLICATE_ATTENDANCE`        | 409  | Trùng `(employeeId, workDate)`                    |
| `INTERNAL_SERVER_ERROR`       | 500  | Lỗi không mong đợi                                |

---

## 15. Security notes

- **Bearer token bắt buộc** cho mọi endpoint.
- **Employee không thể spoof `employeeId`**: tất cả quyền sở hữu
  đều suy ra từ `req.user._id` → `Employee.userId`. Client không
  thể truyền `employeeId` qua `/me`.
- **404 thay vì 403** khi Employee cố đọc bản ghi của người khác —
  tránh leak ID existence.
- **Search / query** không nhận object MongoDB nguyên bản — allowlist
  validator chỉ cho phép các field / enum đã định nghĩa.
- **`createdBy` / `updatedBy`**: client không thể tự set; service
  lấy từ `req.user._id` (đã được `protect` middleware xác thực tươi
  từ DB mỗi request).
- **`passwordHash` / JWT / secrets**: không bao giờ xuất hiện trong
  response.
- **Stack trace / DB internals**: chỉ log server-side, không trả về
  client ở production.

---

## 16. Ví dụ curl

```bash
# Lấy token
curl -X POST http://localhost:5000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"admin@example.com","password":"<password>"}'

# List (admin)
curl "http://localhost:5000/api/attendance?startDate=2026-10-01&endDate=2026-10-31" \
  -H "Authorization: Bearer <TOKEN>"

# Self history
curl http://localhost:5000/api/attendance/me \
  -H "Authorization: Bearer <TOKEN>"

# Detail
curl http://localhost:5000/api/attendance/64b000000000000000000010 \
  -H "Authorization: Bearer <TOKEN>"

# Create
curl -X POST http://localhost:5000/api/attendance \
  -H "Authorization: Bearer <TOKEN>" \
  -H "Content-Type: application/json" \
  -d '{
    "employeeId":"64b000000000000000000010",
    "workDate":"2026-10-09",
    "status":"present",
    "checkInAt":"2026-10-09T01:30:00.000Z",
    "checkOutAt":"2026-10-09T10:00:00.000Z"
  }'

# Update
curl -X PATCH http://localhost:5000/api/attendance/64b000000000000000000010 \
  -H "Authorization: Bearer <TOKEN>" \
  -H "Content-Type: application/json" \
  -d '{"status":"late","note":"Traffic jam"}'
```

---

## 17. Cách test bằng Postman

1. **Login** để lấy token:
   - `POST http://localhost:<port>/api/auth/login`
   - Body: `{"email": "<admin-email>", "password": "<password>"}`
   - Response: copy `data.token`.

2. **Set Authorization** trong Postman:
   - Tab **Authorization** → Type: **Bearer Token** → dán token.

3. **Test các endpoint**:
   - `GET http://localhost:<port>/api/attendance?page=1&limit=10`
   - `GET http://localhost:<port>/api/attendance/me`
   - `GET http://localhost:<port>/api/attendance/<id>`
   - `POST http://localhost:<port>/api/attendance` — body JSON.
   - `PATCH http://localhost:<port>/api/attendance/<id>` — body JSON.

4. **Test nhân viên**:
   - Tạo Employee có `userId` trỏ vào một `employee` user qua
     `POST /api/employees` (Admin).
   - Tạo Attendance cho Employee đó (Admin).
   - Login với `employee` user → gọi `/me` sẽ thấy lịch sử.
   - Thử gọi `/api/attendance/<id của người khác>` → nhận `404`.
