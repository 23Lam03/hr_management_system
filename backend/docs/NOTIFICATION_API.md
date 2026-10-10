# Notification API — Phase 11

## 1. Mục đích

Hệ thống thông báo nội bộ cho HRM. Cho phép mỗi User:

* Xem danh sách thông báo của riêng mình.
* Đếm số thông báo chưa đọc.
* Xem chi tiết một thông báo.
* Đánh dấu một thông báo đã đọc.
* Đánh dấu tất cả thông báo chưa đọc đã đọc.

Thông báo được tạo **nội bộ** từ `notificationService` khi các nghiệp vụ
(Leave Request, Payroll) chuyển trạng thái. **Không có endpoint public**
nào cho phép client tự tạo thông báo giả mạo.

## 2. Model `Notification`

Schema (`src/models/notification.model.js`):

| Field              | Type                          | Bắt buộc | Mô tả                                                                 |
| ------------------ | ----------------------------- | -------- | --------------------------------------------------------------------- |
| `recipientUserId`  | ObjectId (ref `User`)         | yes      | User nhận thông báo; server set từ `req.user._id` hoặc quan hệ server. |
| `type`             | String (enum)                 | yes      | Allowlist (xem mục 3).                                                |
| `title`            | String ≤ 120                  | yes      | Server build từ template theo `type`.                                 |
| `message`          | String ≤ 500                  | yes      | Server build từ template theo `type`.                                 |
| `resourceType`     | enum (`leave_request`/`payroll`) | no       |                                                                       |
| `resourceId`       | String (ObjectId hex)         | no       |                                                                       |
| `isRead`           | Boolean                       | default false |                                                                   |
| `readAt`           | Date                          | default null  | Set khi mark-read thành công.                                    |
| `createdAt`        | Date                          | auto     |                                                                       |
| `updatedAt`        | Date                          | auto     |                                                                       |

Indexes:
* `{ recipientUserId: 1, createdAt: -1 }` — list mặc định.
* `{ recipientUserId: 1, isRead: 1, createdAt: -1 }` — unread count.

JSON serialization: bỏ `__v` qua transform.

## 3. Loại thông báo

Allowlist (lưu trong `NOTIFICATION_TYPES`):

* `leave_request_created`
* `leave_request_approved`
* `leave_request_rejected`
* `leave_request_cancelled`
* `payroll_created`
* `payroll_approved`
* `payroll_marked_paid`

### 3.1. Mẫu nội dung (template)

| Type                          | Title                          | Message                                                          |
| ----------------------------- | ------------------------------ | ---------------------------------------------------------------- |
| `leave_request_created`       | New leave request              | A new leave request is awaiting your review.                     |
| `leave_request_approved`      | Leave request approved         | Your leave request has been approved.                            |
| `leave_request_rejected`      | Leave request rejected         | Your leave request has been rejected.                            |
| `leave_request_cancelled`     | Leave request cancelled        | A leave request has been cancelled by the employee.               |
| `payroll_created`             | Payroll record created         | A new payroll record has been created for you.                   |
| `payroll_approved`            | Payroll approved               | Your payroll record has been approved.                           |
| `payroll_marked_paid`         | Payroll marked as paid         | Your payroll record has been marked as paid (internal status change). |

> Lưu ý: nội dung thông báo payroll **không lộ số tiền, breakdown hay chi
> tiết tài chính**. Service thông báo chỉ mang tính trạng thái nội bộ.

## 4. Quy tắc xác định người nhận

| Sự kiện                              | Người nhận                                                                 | Cách derive                                                                  |
| ------------------------------------ | -------------------------------------------------------------------------- | ---------------------------------------------------------------------------- |
| Employee tạo leave request           | Tất cả admin có `status: 'active'`                                         | `User.find({ role: 'admin', status: 'active' })`                             |
| Admin duyệt leave                    | Employee sở hữu đơn (qua `Employee.userId`)                                | `Employee.findById(leave.employeeId).userId`                                 |
| Admin từ chối leave                  | Employee sở hữu đơn                                                        | như trên                                                                     |
| Employee hủy leave                   | Tất cả admin active                                                        | như trên                                                                     |
| Admin tạo payroll                    | Employee sở hữu payroll                                                    | `Employee.findById(payroll.employeeId).userId`                                |
| Admin duyệt payroll                  | Employee sở hữu payroll                                                    | như trên                                                                     |
| Admin mark-paid payroll              | Employee sở hữu payroll                                                    | như trên                                                                     |

> Nếu Employee không liên kết User (`userId = null`) thì notification cho
> Employee đó được bỏ qua (best-effort). Hệ thống chưa có khái niệm
> "manager" hay "HR group" — tất cả admin active đều nhận.

## 5. Danh sách endpoint

Base URL: `/api/notifications`

Tất cả endpoint yêu cầu JWT (Bearer token) hợp lệ. `req.user._id` luôn
được sử dụng làm recipient; client không thể chỉ định `recipientUserId`
qua query hay body.

| Method | Path                              | Quyền        | Mô tả                                       |
| ------ | --------------------------------- | ------------ | ------------------------------------------- |
| GET    | `/api/notifications`              | Any user     | List thông báo của chính mình               |
| GET    | `/api/notifications/unread-count` | Any user     | Đếm thông báo chưa đọc                      |
| GET    | `/api/notifications/:id`          | Any user     | Chi tiết; chỉ chủ sở hữu                   |
| PATCH  | `/api/notifications/:id/read`     | Any user     | Đánh dấu 1 thông báo đã đọc                |
| PATCH  | `/api/notifications/read-all`     | Any user     | Đánh dấu tất cả chưa đọc đã đọc            |

**Không có** `POST`, `PUT`, `DELETE` cho `/api/notifications`.

## 6. Quyền truy cập

* Mọi endpoint yêu cầu `protect` middleware (JWT).
* User chỉ truy cập được thông báo của mình. Service so sánh
  `doc.recipientUserId === req.user._id` ở mọi thao tác.
* Khi User cố truy cập notification của người khác → trả `404
  NOTIFICATION_NOT_FOUND` (che giấu sự tồn tại, không trả 403).
* Không có role admin cho notification.

## 7. Query params

Cho `GET /api/notifications`:

| Param      | Type                  | Default        | Validate                                |
| ---------- | --------------------- | -------------- | --------------------------------------- |
| `page`     | integer ≥ 1           | 1              | reject nếu ngoài range                  |
| `limit`    | integer ≥ 1, ≤ 100    | 20             | service cap về 100                      |
| `isRead`   | boolean (`true`/`false`) | —            |                                         |
| `type`     | enum (mục 3)          | —              | reject nếu không trong allowlist        |
| `sort`     | string                | `-createdAt`   | allowlist: `createdAt`, `isRead`, `type` |

## 8. Pagination

Response shape:

```json
{
  "success": true,
  "data": [ /* Notification[] */ ],
  "pagination": {
    "page": 1,
    "limit": 20,
    "total": 5,
    "totalPages": 1
  }
}
```

## 9. Response mẫu

### 9.1. `GET /api/notifications`

```json
{
  "success": true,
  "data": [
    {
      "id": "66c7c0a0b9c0c0c0c0c0c0c0",
      "recipientUserId": "66c700000000000000000001",
      "type": "leave_request_approved",
      "title": "Leave request approved",
      "message": "Your leave request has been approved.",
      "resourceType": "leave_request",
      "resourceId": "66c700000000000000000010",
      "isRead": false,
      "readAt": null,
      "createdAt": "2026-04-09T12:00:00.000Z",
      "updatedAt": "2026-04-09T12:00:00.000Z"
    }
  ],
  "pagination": { "page": 1, "limit": 20, "total": 1, "totalPages": 1 }
}
```

### 9.2. `GET /api/notifications/unread-count`

```json
{ "success": true, "data": { "count": 2 } }
```

### 9.3. `GET /api/notifications/:id`

```json
{
  "success": true,
  "data": {
    "id": "...",
    "recipientUserId": "...",
    "type": "leave_request_approved",
    "title": "Leave request approved",
    "message": "Your leave request has been approved.",
    "resourceType": "leave_request",
    "resourceId": "...",
    "isRead": false,
    "readAt": null,
    "createdAt": "...",
    "updatedAt": "..."
  }
}
```

### 9.4. `PATCH /api/notifications/:id/read`

Lần đầu:

```json
{
  "success": true,
  "data": { "id": "...", "isRead": true, "readAt": "2026-04-09T12:01:00.000Z", ... }
}
```

Idempotent (đã đọc trước đó):

```json
{
  "success": true,
  "data": { "id": "...", "alreadyRead": true, "readAt": "2026-04-09T12:00:00.000Z" }
}
```

### 9.5. `PATCH /api/notifications/read-all`

```json
{ "success": true, "data": { "count": 3, "readAt": "2026-04-09T12:02:00.000Z" } }
```

## 10. Lỗi HTTP

| Status | Code                          | Nguyên nhân                                                 |
| ------ | ----------------------------- | ----------------------------------------------------------- |
| 400    | `VALIDATION_ERROR`            | Query param / path id sai định dạng.                        |
| 401    | (auth middleware)             | Thiếu/sai/hết hạn JWT.                                     |
| 404    | `NOTIFICATION_NOT_FOUND`      | Không tồn tại hoặc không thuộc User hiện tại.               |

## 11. Quy tắc mark-read / read-all

* `PATCH /:id/read` chỉ chủ sở hữu mới thực hiện được.
* Server set `isRead: true` và `readAt: new Date()`.
* Idempotent: nếu đã đọc, `readAt` KHÔNG bị update, response trả
  `alreadyRead: true` cùng giá trị `readAt` cũ.
* `PATCH /read-all` chỉ cập nhật notification của User hiện tại, chỉ các
  bản ghi `isRead: false`. Trả về `count` (số bản ghi thực sự cập nhật).
* Không cho client gửi `readAt` từ body. Service tự set.

## 12. Chống thông báo trùng

* `leave.cancel` (Employee): nếu status đã `cancelled` (idempotent
  replay), service trả `meta.alreadyCancelled: true`. Controller kiểm tra
  trước khi dispatch.
* `payroll.approve`: nếu status đã `approved`, service trả
  `meta.alreadyApproved: true`. Controller kiểm tra.
* `payroll.markPaid`: tương tự với `meta.alreadyPaid`.
* `leave.approve` / `leave.reject`: service từ chối nếu status không
  phải `pending` (409 INVALID_STATE) — không tạo notification nếu state
  transition bị từ chối.
* Mỗi notification là một document độc lập. Không có unique compound
  index `(recipientUserId, type, resourceId)` vì cùng resource có thể
  phát sinh nhiều notification theo luồng (ví dụ payroll_created →
  payroll_approved → payroll_marked_paid).

## 13. Chính sách khi tạo notification thất bại

* `createNotification` là **best-effort**: lỗi được nuốt và
  `console.error` (không log toàn bộ stack, không log secret).
* Thao tác nghiệp vụ (POST leave, PATCH payroll...) KHÔNG bị fail khi
  notification thất bại. Response trả 200/201 cho nghiệp vụ chính.
* Ngược lại: nếu nghiệp vụ chính fail, notification **không** được tạo
  vì controller gọi dispatch sau khi service trả về thành công.
* Hệ thống chưa hỗ trợ transactional outbox; đây là giới hạn đã ghi
  nhận.

## 14. Module đã tích hợp

* **Leave Request** (`src/controllers/leaveRequest.controller.js`):
  * `create` → `leave_request_created` (notify all admins)
  * `cancel` → `leave_request_cancelled` (notify all admins, khi status
    chuyển thực sự)
  * `approve` → `leave_request_approved` (notify owner Employee)
  * `reject` → `leave_request_rejected` (notify owner Employee)
* **Payroll** (`src/controllers/payroll.controller.js`):
  * `create` → `payroll_created` (notify owner Employee)
  * `approve` → `payroll_approved` (notify owner Employee, khi state
    chuyển thực sự)
  * `markPaid` → `payroll_marked_paid` (notify owner Employee, khi
    state chuyển thực sự)

## 15. Module chưa tích hợp

| Module     | Lý do                                                                                          |
| ---------- | ---------------------------------------------------------------------------------------------- |
| Attendance | Thay đổi attendance quá thường xuyên. Phase 11 không tạo notification tránh spam.               |
| Employee   | CRUD nhân viên chỉ ảnh hưởng admin (audit log), không tạo notification.                        |
| Department | Tương tự — chỉ admin quản lý, không thông báo cho employee.                                   |
| Position   | Tương tự.                                                                                      |
| Auth       | Login/logout đã có audit log; không tạo notification để tránh phụ thuộc.                       |
| Audit Log  | Admin-only, không gửi notification.                                                            |

## 16. Giới hạn hiện tại

* Không có "manager" hay "HR group" — tất cả admin active đều nhận.
* Không có notification preferences / unsubscribe.
* Không hỗ trợ push (email, push, websocket). Chỉ REST polling.
* Không có giao dịch nguyên tử giữa business mutation và notification
  creation (best-effort).
* Không có DELETE endpoint (chính sách giữ lịch sử).
* Không cho client custom `title` / `message` (template-only).
* Không hỗ trợ batch mark-read; chỉ 1-by-1 hoặc read-all.

## 17. Cách chạy test

Trong `backend/`:

```bash
npm test                    # chạy tất cả 732 tests
TEST_MONGODB_URI=mongodb://127.0.0.1:27017/hrm_test_db \
  npx node --test tests/notification.model.test.js
TEST_MONGODB_URI=mongodb://127.0.0.1:27017/hrm_test_db \
  npx node --test tests/notification.api.test.js
npm run syntax-check
```

### File test

* `tests/notification.model.test.js` — 12 tests cho schema, validation,
  indexes, JSON serialization.
* `tests/notification.api.test.js` — 33 tests cho:
  * Auth & ownership
  * Unread count & mark-read / read-all
  * Filters & pagination
  * Anti-tampering (POST/PUT/DELETE không tồn tại)
  * Integration với Leave Request
  * Integration với Payroll
