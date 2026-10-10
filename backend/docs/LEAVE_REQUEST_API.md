# Leave Request API

Tài liệu cho module quản lý đơn nghỉ phép (Phase 7) — `backend/src`.

Base URL: `/api/leave-requests`

Tất cả endpoint yêu cầu JWT Bearer token (do middleware `protect` xử lý).
Một số endpoint yêu cầu role `admin` (do middleware `authorize('admin')` xử lý).

## 1. Mô hình dữ liệu

### `LeaveRequest`

| Field         | Type                | Bắt buộc | Mặc định | Ghi chú                                                                 |
|---------------|---------------------|----------|----------|-------------------------------------------------------------------------|
| `employeeId`  | ObjectId → Employee | Có       | —        | Chỉ Admin được truyền; Employee tự lấy từ `Employee.userId == req.user._id` |
| `leaveType`   | enum                | Có       | —        | `annual`, `sick`, `unpaid`, `other`                                       |
| `startDate`   | Date                | Có       | —        | UTC midnight; nhận `YYYY-MM-DD`                                          |
| `endDate`     | Date                | Có       | —        | `>= startDate`                                                            |
| `reason`      | string              | Có       | —        | 3–500 ký tự, không rỗng sau khi `trim()`                                  |
| `status`      | enum                | Có       | `pending`| `pending`, `approved`, `rejected`, `cancelled`                            |
| `reviewedBy`  | ObjectId → User     | Không    | `null`   | Server set khi Admin approve/reject                                       |
| `reviewedAt`  | Date                | Không    | `null`   | Server set khi Admin approve/reject                                       |
| `reviewNote`  | string              | Không    | `""`     | Tối đa 500 ký tự                                                         |
| `createdAt`   | Date                | auto     | —        | Mongoose timestamps                                                       |
| `updatedAt`   | Date                | auto     | —        | Mongoose timestamps                                                       |

### Trạng thái và quy tắc chuyển

```
       ┌──────────────┐
       │   pending    │  (mặc định khi tạo)
       └──┬───────┬───┘
          │       │
   approve (Admin)  │
          ▼       │
      approved     │
              cancel (Employee, idempotent)
                  ▼
              cancelled

       pending ──reject (Admin)──▶ rejected
```

- Tạo mới → luôn `pending`. Client không thể đặt status trong request body.
- Sửa (PATCH /:id) — chỉ Employee, chỉ khi đơn đang `pending`.
- Hủy (PATCH /:id/cancel) — chỉ Employee, chỉ khi `pending`. Idempotent.
- Duyệt (PATCH /:id/approve) — chỉ Admin, chỉ khi `pending`.
- Từ chối (PATCH /:id/reject) — chỉ Admin, chỉ khi `pending`.
- `approved` / `rejected` / `cancelled` là trạng thái cuối: không thể sửa/hủy/duyệt lại.

## 2. Quy tắc xung đột ngày nghỉ

Hai khoảng `[A_start, A_end]` và `[B_start, B_end]` giao nhau khi
`A_start <= B_end && A_end >= B_start` (chạm biên cũng tính là giao nhau).

Một đơn mới hoặc cập nhật bị từ chối (`409 LEAVE_OVERLAP`) nếu cùng
`employeeId` với **ít nhất một** đơn đang ở trạng thái `pending` hoặc
`approved` có khoảng ngày giao nhau. `rejected` và `cancelled` không chặn.

Áp dụng tại:
- Tạo đơn (`POST /`).
- Sửa đơn (`PATCH /:id`) — khi gửi `startDate` hoặc `endDate`. Đơn đang
  sửa bị loại trừ khỏi tập xung đột.
- Duyệt đơn (`PATCH /:id/approve`) — re-check để đảm bảo không có đơn
  pending nào khác giao nhau trước khi chuyển sang `approved`.

## 3. Phân quyền

### Authentication
- Mọi endpoint yêu cầu `Authorization: Bearer <jwt>`. Thiếu hoặc sai → `401`.

### Authorization theo role

| Endpoint                                         | Admin | Employee |
|--------------------------------------------------|:-----:|:--------:|
| `GET    /api/leave-requests`                     |  ✔   |   ✘ (403)|
| `GET    /api/leave-requests/me`                  |  ✔   |   ✔ (chỉ của mình) |
| `GET    /api/leave-requests/:id`                 |  ✔   |   ✔ (chỉ của mình, 404 nếu khác) |
| `POST   /api/leave-requests`                     |  ✔ (cần `employeeId`) | ✔ (tự lấy từ `Employee.userId`) |
| `PATCH  /api/leave-requests/:id`                 |  ✘ (403 — dùng approve/reject) | ✔ (chỉ đơn `pending` của mình) |
| `PATCH  /api/leave-requests/:id/cancel`          |  ✘ (403 — dùng reject) | ✔ (chỉ đơn `pending` của mình) |
| `PATCH  /api/leave-requests/:id/approve`         |  ✔   |   ✘ (403)|
| `PATCH  /api/leave-requests/:id/reject`          |  ✔   |   ✘ (403)|

### Quy tắc sở hữu
- Employee chỉ truy cập đơn của Employee có `userId == req.user._id`.
- Truy cập đơn của người khác → `404 LEAVE_REQUEST_NOT_FOUND` (không `403`)
  để tránh tiết lộ sự tồn tại của đơn.
- Endpoint `/me` không nhận `employeeId` từ client; luôn lấy từ user đăng nhập.
- User chưa liên kết Employee → `404 EMPLOYEE_NOT_FOUND` cho cả `POST` và `/me`.

## 4. Endpoints

### 4.1 `GET /api/leave-requests` (Admin only)

Lấy danh sách đơn có phân trang.

**Query parameters**

| Param        | Type     | Mặc định | Ghi chú |
|--------------|----------|----------|---------|
| `employeeId` | ObjectId | —        | Lọc theo Employee |
| `status`     | enum     | —        | `pending`, `approved`, `rejected`, `cancelled` |
| `leaveType`  | enum     | —        | `annual`, `sick`, `unpaid`, `other` |
| `startDate`  | YYYY-MM-DD | —      | Lọc đơn có `startDate >= startDate` |
| `endDate`    | YYYY-MM-DD | —      | Lọc đơn có `endDate <= endDate` (inclusive) |
| `page`       | int      | 1        | ≥ 1 |
| `limit`      | int      | 20       | 1..100 |
| `sort`       | string   | `-createdAt` | Allowlist: `createdAt`, `updatedAt`, `startDate`, `endDate`, `leaveType`, `status` (kèm `-` cho desc) |

**Response 200**

```json
{
  "success": true,
  "data": [ { "...LeaveRequest..." } ],
  "pagination": { "page": 1, "limit": 20, "total": 42, "totalPages": 3 }
}
```

### 4.2 `GET /api/leave-requests/me` (Any user)

Lấy danh sách đơn của Employee liên kết với user hiện tại.
`employeeId` query param (nếu gửi) bị bỏ qua. Cùng filter/pagination như
endpoint admin.

**Response 200** — giống 4.1.
**Response 404** — khi user chưa liên kết Employee.

### 4.3 `POST /api/leave-requests` (Any user)

Tạo đơn mới. Trạng thái luôn `pending`.

**Body (Employee)**

```json
{
  "leaveType": "annual",
  "startDate": "2026-12-01",
  "endDate": "2026-12-05",
  "reason": "Family vacation"
}
```

**Body (Admin tạo thay)**

```json
{
  "employeeId": "65f...",
  "leaveType": "sick",
  "startDate": "2026-12-01",
  "endDate": "2026-12-02",
  "reason": "Sick leave"
}
```

**Response 201**

```json
{ "success": true, "data": { "_id": "...", "status": "pending", "...": "..." } }
```

**Lỗi**

- `400` — payload không hợp lệ / thiếu field / enum sai / ngày sai.
- `404` — Employee chưa liên kết (Employee role) hoặc `employeeId` không tồn tại.
- `409 LEAVE_OVERLAP` — đã có đơn pending/approved trùng ngày.

### 4.4 `GET /api/leave-requests/:id` (Any user)

- Admin: xem mọi đơn.
- Employee: chỉ đơn của mình. Đơn của người khác → `404`.

**Response 200** — `LeaveRequest` object.
**Lỗi** — `400` (id sai format), `404` (không tồn tại / không phải của mình).

### 4.5 `PATCH /api/leave-requests/:id` (Employee, chỉ đơn `pending` của mình)

Cập nhật các trường nghiệp vụ: `leaveType`, `startDate`, `endDate`, `reason`.
Không cho phép: `status`, `reviewedBy`, `reviewedAt`, `reviewNote`, `employeeId`,
`createdAt`, `updatedAt`, `id`, `_id`.

**Body** — ít nhất một trong các field trên.

**Response 200** — `LeaveRequest` đã cập nhật.
**Lỗi** — `400` (payload sai), `404` (không phải của mình / không tồn tại),
`409 INVALID_STATE` (đơn không ở `pending`), `409 LEAVE_OVERLAP` (sau khi cập nhật).

Admin gọi endpoint này → `403 FORBIDDEN` (phải dùng approve/reject).

### 4.6 `PATCH /api/leave-requests/:id/cancel` (Employee, chỉ đơn `pending` của mình)

Hủy đơn. Idempotent: gọi lần hai trả về cùng bản ghi với
`meta.alreadyCancelled: true`.

**Response 200**

```json
{ "success": true, "data": { "...": "...", "status": "cancelled" },
  "meta": { "alreadyCancelled": false } }
```

**Lỗi** — `404`, `409 INVALID_STATE` (nếu `approved` / `rejected`).
Admin gọi → `403`.

### 4.7 `PATCH /api/leave-requests/:id/approve` (Admin only)

Duyệt đơn `pending`. Trước khi duyệt, hệ thống re-check overlap để chặn
trường hợp hai đơn pending cùng thời gian được duyệt tuần tự.

**Body** (optional)

```json
{ "reviewNote": "OK, enjoy your vacation" }
```

**Response 200** — `LeaveRequest` đã approve, kèm `reviewedBy`, `reviewedAt`.

**Lỗi** — `400`, `404`, `409 INVALID_STATE`, `409 LEAVE_OVERLAP`.

### 4.8 `PATCH /api/leave-requests/:id/reject` (Admin only)

Từ chối đơn `pending`.

**Body** (optional) — `{ "reviewNote": "..." }`.

**Response 200** — `LeaveRequest` đã reject, kèm `reviewedBy`, `reviewedAt`.

**Lỗi** — `400`, `404`, `409 INVALID_STATE`.

## 5. Mã lỗi

| HTTP | Code                | Ý nghĩa                                                |
|------|---------------------|----------------------------------------------------------|
| 400  | `VALIDATION_ERROR`  | Payload / query / id không hợp lệ                        |
| 401  | `AUTH_MISSING` / `AUTH_FORMAT` / `TOKEN_INVALID` / `TOKEN_EXPIRED` | Thiếu hoặc sai token |
| 403  | `FORBIDDEN`         | Sai role hoặc thao tác không được phép                   |
| 404  | `EMPLOYEE_NOT_FOUND`| User chưa liên kết Employee                              |
| 404  | `LEAVE_REQUEST_NOT_FOUND` | Không tồn tại hoặc không phải của mình           |
| 409  | `INVALID_STATE`     | Trạng thái đơn không cho phép thao tác                   |
| 409  | `LEAVE_OVERLAP`     | Trùng khoảng ngày với đơn `pending` / `approved` khác    |
| 500  | `INTERNAL_SERVER_ERROR` | Lỗi server (không tiết lộ chi tiết)                  |

## 6. Định dạng response chuẩn

Thành công:

```json
{ "success": true, "data": <T>, "pagination"?: {...}, "meta"?: {...} }
```

Lỗi:

```json
{
  "success": false,
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "...",
    "field": "startDate"
  }
}
```

## 7. Quyết định nghiệp vụ đã chốt

1. **Admin PATCH /:id bị từ chối (403).** Admin dùng `POST /` để tạo và
   `PATCH /:id/approve` hoặc `/reject` để xử lý. Endpoint PATCH thường
   dành cho Employee chỉnh đơn pending của mình.
2. **Admin PATCH /:id/cancel bị từ chối (403).** Admin dùng `/reject`.
3. **Tạo mới luôn `pending`.** Client không gửi được `status`,
   `reviewedBy`, `reviewedAt`, `reviewNote`, `createdAt`, `updatedAt`.
4. **Sửa chỉ khi `pending`.** Sửa đơn đã approved/rejected/cancelled → 409.
5. **Hủy chỉ khi `pending`.** Đơn approved không hủy được; Admin phải reject
   trước nếu muốn hủy.
6. **Overlap check chỉ chặn `pending` và `approved`.** Đơn `rejected` /
   `cancelled` không chặn đơn mới cùng ngày.
7. **Overlap bao gồm chạm biên.** `[01, 05]` và `[05, 10]` giao nhau.
8. **Re-check overlap khi approve.** Đảm bảo hai đơn pending cùng ngày
   không được duyệt tuần tự cả hai.
9. **Ngày lưu UTC midnight.** Tránh lệch do timezone. Validator chấp nhận
   `YYYY-MM-DD`.
10. **Pagination cap 100.** Không trả toàn bộ danh sách.
11. **Sort allowlist.** Chỉ các field an toàn, prefix `-` cho desc.
12. **Idempotent cancel.** Lần thứ hai trả `200` với `meta.alreadyCancelled`.
13. **Employee thiếu liên kết hoặc đã soft-delete → 404.** `findLinkedEmployeeForUser`
    lọc `isDeleted: { $ne: true }`. Áp dụng cho `POST`, `GET /me`, `PATCH /:id`,
    `PATCH /:id/cancel`, `GET /:id`. Admin tạo hộ cũng qua `assertEmployeeActive`
    → trả `400` với field `employeeId` nếu Employee đã soft-delete.
14. **Admin tạo thay cần `employeeId`.** Thiếu → 400 với field=`employeeId`.
15. **Date range filter dùng overlap semantics.** Khi Admin lọc
    `startDate=..&endDate=..`, danh sách trả về các đơn có KHUNG NGHỈ
    giao nhau với `[startDate, endDate]` (không phải `startDate` của đơn
    nằm trong khoảng). Nghĩa là một đơn kéo dài `[2026-11-15, 2026-12-15]`
    sẽ xuất hiện khi filter `startDate=2026-12-01&endDate=2026-12-31` vì
    hai khoảng giao nhau.

## 8. Giả định

- `Employee.userId` là liên kết User–Employee. User có thể chưa có Employee
  (chưa onboard) — endpoint trả 404 thay vì tự tạo.
- Chưa hỗ trợ soft-delete Employee cascade: nếu Employee bị soft-delete,
  các đơn cũ vẫn còn để audit. Service chỉ chặn tạo mới trên Employee đã
  soft-delete.
- Chưa hỗ trợ DELETE endpoint. Hủy đơn = chuyển sang `cancelled`.
- Không đảm bảo chống race condition giữa check overlap và write: trong
  môi trường phân tán, hai request có thể cùng pass check. Hệ thống
  không dùng transaction; người vận hành cần xử lý race qua quy trình.

## 9. Tests

- `tests/leaveRequest.model.test.js` — schema, enum, validation, default.
- `tests/leaveRequest.api.test.js` — authorization, CRUD, overlap, cancel,
  approve, reject, regression Phase 1–6.
