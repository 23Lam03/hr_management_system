# Dashboard & Reports API

> Phase 9 — HRM Backend

Module tổng hợp số liệu nhân sự, chấm công, nghỉ phép và bảng lương phục vụ dashboard tổng quan
và các báo cáo quản trị. Tất cả endpoint đều **Admin-only**.

Base path:
- `/api/dashboard` — số liệu tổng quan
- `/api/reports` — báo cáo chi tiết theo nhóm

---

## 1. Mục đích

- Cung cấp số liệu thời gian thực cho dashboard quản trị.
- Tổng hợp báo cáo theo phòng ban, vị trí, loại hình làm việc, kỳ lương.
- Hỗ trợ trực quan hoá: line chart, bar chart, pie chart.

## 2. Xác thực & phân quyền

- Tất cả endpoint yêu cầu JWT Bearer token hợp lệ.
- **Chỉ Admin** (`role='admin'`) mới được truy cập. Employee gọi bất kỳ endpoint nào trong module này
  sẽ nhận 403 theo quy ước dự án.
- Lý do: số liệu tổng hợp toàn công ty chứa thông tin nhân sự và lương nhạy cảm.

## 3. Quy ước chung

### 3.1. Đếm nhân viên

- `total` = `COUNT(Employee WHERE isDeleted = false)`.
- `active` = `COUNT(Employee WHERE isDeleted = false AND employmentStatus = 'active')`.
- `inactive` = `total - active` (bao gồm `on_leave` và `inactive`).
- **Soft-deleted Employee (`isDeleted = true`) KHÔNG BAO GIỜ được tính**.

### 3.2. Khoảng ngày

- `startDate` / `endDate` chấp nhận định dạng `YYYY-MM-DD`, được chuẩn hoá về UTC midnight.
- `endDate` inclusive cả ngày đó (dùng `$lt endDate+1` trong query).
- `startDate <= endDate`.
- Khoảng ngày tối đa: **366 ngày** (chống quét toàn bộ DB).

### 3.3. Kỳ lương

- Kỳ lương là cặp `(periodMonth, periodYear)`. `periodMonth` ∈ 1..12, `periodYear` ∈ 2000..2100.
- Phải truyền cả hai, hoặc không truyền (mặc định = tháng trước).

### 3.4. Performance

- Mọi tổng hợp chạy bằng MongoDB aggregation (server-side). Không load collection về Node.js.
- Khi cần join Employee ↔ Department dùng `$lookup` (1 query duy nhất, không N+1).
- Tận dụng index hiện có: `isDeleted`, `status`, `workDate`, `startDate`, `(periodYear, periodMonth)`.
- KHÔNG dùng `$where`. KHÔNG tạo index mới.

### 3.5. Response format

```json
{
  "success": true,
  "data": { "...": "..." },
  "meta": { "generatedAt": "2026-10-09T..." }
}
```

## 4. Endpoints — Dashboard

### 4.1. `GET /api/dashboard/overview`

Tổng quan HRM. **Admin only**.

Response 200:
```json
{
  "success": true,
  "data": {
    "employees": { "total": 0, "active": 0, "inactive": 0 },
    "departments": { "active": 0 },
    "positions": { "active": 0 },
    "leaveRequests": { "pending": 0 },
    "attendance": { "recordsInMonth": 0 },
    "payroll": {
      "currentPeriod": {
        "periodMonth": 9,
        "periodYear": 2026,
        "count": 0,
        "totalNet": 0,
        "totalNetPaid": 0
      }
    }
  },
  "meta": { "generatedAt": "..." }
}
```

Ghi chú:
- `attendance.recordsInMonth` đếm bản ghi Attendance có `workDate` trong tháng hiện tại (UTC).
- `payroll.currentPeriod` mặc định = tháng trước (vì tháng hiện tại thường chưa chốt). Nếu muốn override,
  dùng `/api/dashboard/payroll-summary?periodMonth=X&periodYear=Y`.
- `totalNetPaid` chỉ tính các bản ghi `status='paid'`, KHÔNG tính `draft` / `approved`.

### 4.2. `GET /api/dashboard/attendance-summary`

Tổng hợp chấm công theo khoảng ngày. **Admin only**.

Query params:
- `startDate` (optional)
- `endDate` (optional)

Response 200:
```json
{
  "success": true,
  "data": {
    "range": { "startDate": "2026-09-01", "endDate": "2026-09-30" },
    "total": 12,
    "uniqueDays": 4,
    "byStatus": { "present": 5, "late": 3, "absent": 2, "leave": 1, "half_day": 1 },
    "byDepartment": [
      { "departmentId": "...", "name": "Engineering", "count": 8 },
      { "departmentId": null, "name": null, "count": 4 }
    ]
  }
}
```

Lỗi:
- 400 `VALIDATION_ERROR` — date không hợp lệ / `startDate > endDate` / range > 366 ngày.

### 4.3. `GET /api/dashboard/leave-summary`

Tổng hợp yêu cầu nghỉ phép theo khoảng ngày. **Admin only**.

Query params:
- `startDate` (optional)
- `endDate` (optional)
- `by` (`startDate` mặc định, hoặc `createdAt`) — chọn field để filter khoảng ngày.

Response 200:
```json
{
  "success": true,
  "data": {
    "range": { "startDate": "2026-10-01", "endDate": "2026-10-31", "filterBy": "startDate" },
    "total": 7,
    "byStatus": { "pending": 3, "approved": 2, "rejected": 1, "cancelled": 1 },
    "byLeaveType": { "annual": 4, "sick": 2, "unpaid": 0, "other": 1 }
  }
}
```

Ghi chú:
- Mặc định filter theo `startDate` (ngày bắt đầu nghỉ). Nếu muốn filter theo ngày tạo đơn, dùng `by=createdAt`.

### 4.4. `GET /api/dashboard/payroll-summary`

Tổng hợp bảng lương theo kỳ. **Admin only**.

Query params:
- `periodMonth` (optional, 1..12)
- `periodYear` (optional, 2000..2100)
- Phải truyền cả hai, hoặc không truyền gì (mặc định = tháng trước).

Response 200:
```json
{
  "success": true,
  "data": {
    "period": { "periodMonth": 10, "periodYear": 2026 },
    "count": 5,
    "byStatus": { "draft": 1, "approved": 2, "paid": 1, "cancelled": 1 },
    "totalBase": 50000000,
    "totalAllowances": 5000000,
    "totalBonuses": 2500000,
    "totalDeductions": 1000000,
    "totalGross": 57500000,
    "totalNet": 56500000,
    "totalNetApproved": 22600000,
    "totalNetPaid": 11300000
  }
}
```

Quy tắc:
- `totalNetPaid` chỉ tính `status='paid'`.
- `totalNetApproved` chỉ tính `status='approved'`.
- `draft` KHÔNG được tính vào `totalNetPaid` / `totalNetApproved`.
- `cancelled` được đếm trong `byStatus.cancelled` nhưng KHÔNG ảnh hưởng tổng tiền.
- KHÔNG cộng dữ liệu khác kỳ lương.

Lỗi:
- 400 — `periodMonth` / `periodYear` không hợp lệ; truyền 1 mà thiếu cái kia.

## 5. Endpoints — Reports

### 5.1. `GET /api/reports/employees`

Báo cáo nhân sự. **Admin only**. Không nhận query.

Response 200:
```json
{
  "success": true,
  "data": {
    "total": 12,
    "byEmploymentStatus": { "active": 10, "on_leave": 1, "inactive": 1 },
    "byDepartment": [
      { "departmentId": "...", "name": "Engineering", "count": 8 }
    ],
    "byPosition": [
      { "positionId": "...", "name": "Senior Engineer", "count": 5 }
    ],
    "byEmploymentType": { "full_time": 10, "part_time": 1, "contract": 1 },
    "byHireYear": [ { "year": 2024, "count": 5 }, { "year": 2025, "count": 7 } ]
  }
}
```

- `byHireYear` trả về từng năm có dữ liệu, sắp xếp tăng dần theo năm.
- Soft-deleted Employee không được tính.

### 5.2. `GET /api/reports/attendance`

Báo cáo chấm công theo khoảng ngày. **Admin only**.

Query params:
- `startDate`, `endDate` (giống §4.2)

Response 200:
```json
{
  "success": true,
  "data": {
    "range": { "startDate": "2026-09-01", "endDate": "2026-09-30" },
    "total": 12,
    "byStatus": { "present": 5, "late": 3, "absent": 2, "leave": 1, "half_day": 1 },
    "byEmployee": [
      { "employeeId": "...", "fullName": "Nguyễn Văn A", "employeeCode": "NV0001", "count": 22 }
    ],
    "byDepartment": [
      { "departmentId": "...", "name": "Engineering", "count": 8 }
    ]
  }
}
```

- `byEmployee` giới hạn top 50 theo `count desc` để tránh trả quá nhiều.
- KHÔNG tự tính số giờ làm / ngày công (model chưa lưu đủ).

### 5.3. `GET /api/reports/leave-requests`

Báo cáo nghỉ phép theo khoảng ngày. **Admin only**.

Query params:
- `startDate`, `endDate`

Response 200:
```json
{
  "success": true,
  "data": {
    "range": { "startDate": "2026-10-01", "endDate": "2026-10-31", "filterBy": "startDate" },
    "total": 7,
    "byStatus": { "pending": 3, "approved": 2, "rejected": 1, "cancelled": 1 },
    "byLeaveType": { "annual": 4, "sick": 2, "unpaid": 0, "other": 1 },
    "byEmployee": [
      { "employeeId": "...", "fullName": "...", "employeeCode": "NV0001", "count": 2 }
    ],
    "byDepartment": [
      { "departmentId": "...", "name": "Engineering", "count": 5 }
    ]
  }
}
```

Ghi chú:
- Filter mặc định theo `startDate` (ngày bắt đầu nghỉ) — khác với dashboard cho phép chọn
  `createdAt` / `startDate`. Báo cáo nhất quán theo `startDate` để phản ánh dải ngày nghỉ thực tế.

### 5.4. `GET /api/reports/payroll`

Báo cáo bảng lương theo kỳ. **Admin only**.

Query params:
- `periodMonth`, `periodYear` (giống §4.4)

Response 200: giống `dashboard/payroll-summary` (§4.4).

## 6. Mã lỗi HTTP

| Code | Ý nghĩa |
|---|---|
| 200 | Thành công |
| 400 | Query params không hợp lệ (date format, range, period ngoài 1..12/2000..2100, thiếu 1 trong 2 của period) |
| 401 | Thiếu / sai JWT |
| 403 | Token hợp lệ nhưng role không phải admin |
| 500 | Lỗi nội bộ (không lộ stack) |

## 7. Soft-delete handling

- **Employee có `isDeleted`**: tất cả report/dashboard đều filter `isDeleted: { $ne: true }` hoặc
  dùng `employmentStatus` để phân loại. Soft-deleted Employee KHÔNG BAO GIỜ xuất hiện trong báo cáo.
- **Department / Position** KHÔNG có soft-delete. Chỉ `status` (active/inactive). Reports đếm theo
  `status='active'`.
- **Attendance / LeaveRequest / Payroll** KHÔNG có soft-delete.

## 8. Công thức tổng hợp (lặp lại để dễ tra cứu)

| Chỉ số | Công thức |
|---|---|
| `employees.total` | `COUNT(Employee WHERE isDeleted=false)` |
| `employees.active` | `COUNT(Employee WHERE isDeleted=false AND employmentStatus='active')` |
| `employees.inactive` | `total - active` |
| `departments.active` | `COUNT(Department WHERE status='active')` |
| `positions.active` | `COUNT(Position WHERE status='active')` |
| `leaveRequests.pending` | `COUNT(LeaveRequest WHERE status='pending')` |
| `attendance.recordsInMonth` | `COUNT(Attendance WHERE workDate in [monthStart, monthEnd])` |
| `payroll.totalGross` | `SUM(Payroll.grossSalary WHERE periodMonth=X AND periodYear=Y)` |
| `payroll.totalNet` | `SUM(Payroll.netSalary WHERE periodMonth=X AND periodYear=Y)` |
| `payroll.totalNetPaid` | `SUM(Payroll.netSalary WHERE status='paid' AND periodMonth=X AND periodYear=Y)` |
| `payroll.totalNetApproved` | `SUM(Payroll.netSalary WHERE status='approved' AND periodMonth=X AND periodYear=Y)` |

## 9. Giới hạn

| Giới hạn | Mô tả |
|---|---|
| Khoảng ngày tối đa | 366 ngày (đối với attendance, leave) |
| Phạm vi kỳ lương | periodMonth 1..12, periodYear 2000..2100 |
| Top-N byEmployee | 50 bản ghi (reports/attendance, reports/leave-requests) |
| Kỳ lương mặc định | Tháng trước (UTC) |

## 10. Chỉ số chưa thể hỗ trợ (do model hiện tại)

| Chỉ số | Lý do |
|---|---|
| Tổng số giờ làm / OT | Attendance có `checkInAt`/`checkOutAt` nhưng chưa có policy giờ làm chuẩn |
| Số ngày công thực tế / chuẩn | Payroll có `workedDays`/`standardWorkDays` admin nhập tay; Phase 9 không tự tính |
| Headcount biến động theo tháng | Không lưu `joinedDepartmentAt` / `leftAt` |
| Tiền tệ | Single currency. Không có field `currency` |
| Cross-department payroll totals | Cần tránh đếm trùng; chỉ thống kê theo `status` |
| Trend / time-series | Phase 9 chỉ trả số liệu tổng quan; nếu cần vẽ trend theo tháng có thể dùng MongoDB `$group` theo `periodYear/periodMonth` (mở rộng sau) |

## 11. Cách chạy test

```bash
cd backend
npm test                                        # toàn bộ (625 tests, gồm Dashboard/Reports)
TEST_MONGODB_URI=mongodb://127.0.0.1:27017/hrm_test_db \
  node --test --test-concurrency=1 tests/dashboard.api.test.js
npm run syntax-check
```

## 12. Ví dụ Postman

### 12.1. Lấy token admin

```
POST /api/auth/login
Content-Type: application/json

{ "email": "admin@example.com", "password": "Test1234!" }
```

Response: `data.token`.

### 12.2. Dashboard overview

```
GET /api/dashboard/overview
Authorization: Bearer <admin-token>
```

### 12.3. Attendance summary theo tháng

```
GET /api/dashboard/attendance-summary?startDate=2026-09-01&endDate=2026-09-30
Authorization: Bearer <admin-token>
```

### 12.4. Leave summary theo kỳ

```
GET /api/dashboard/leave-summary?startDate=2026-10-01&endDate=2026-10-31&by=startDate
Authorization: Bearer <admin-token>
```

### 12.5. Payroll summary theo kỳ cụ thể

```
GET /api/dashboard/payroll-summary?periodMonth=10&periodYear=2026
Authorization: Bearer <admin-token>
```

### 12.6. Employee report

```
GET /api/reports/employees
Authorization: Bearer <admin-token>
```

### 12.7. Attendance report

```
GET /api/reports/attendance?startDate=2026-09-01&endDate=2026-09-30
Authorization: Bearer <admin-token>
```

### 12.8. Leave-requests report

```
GET /api/reports/leave-requests?startDate=2026-10-01&endDate=2026-10-31
Authorization: Bearer <admin-token>
```

### 12.9. Payroll report

```
GET /api/reports/payroll?periodMonth=10&periodYear=2026
Authorization: Bearer <admin-token>
```

### 12.10. Test lỗi

- `GET /api/dashboard/overview` không có token → 401.
- `GET /api/dashboard/overview` với employee token → 403.
- `GET /api/dashboard/attendance-summary?startDate=oops` → 400.
- `GET /api/dashboard/attendance-summary?startDate=2024-01-01&endDate=2026-12-31` → 400 (range > 366 days).
- `GET /api/dashboard/payroll-summary?periodMonth=13` → 400.
- `GET /api/dashboard/payroll-summary?periodMonth=10` (thiếu year) → 400.
