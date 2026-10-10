# Database Design — HR Management System

> Phase 2: thiết kế schema cho 4 collection nền tảng (User, Employee,
> Department, Position) và kế hoạch cho các collection nghiệp vụ.
>
> Database: MongoDB (Mongoose 8, ESM).
> Database name (dev): `hrm_db`. Test dùng `hrm_test_db`.

---

## 1. Tổng quan 4 collection Phase 2

| Collection   | Mục đích                                                      |
| ------------ | ------------------------------------------------------------- |
| `users`      | Tài khoản đăng nhập. Không lưu plaintext password.            |
| `employees`  | Hồ sơ nhân viên (hành chính, lương, hợp đồng).               |
| `departments`| Phòng ban.                                                    |
| `positions`  | Chức danh / vị trí công việc.                                 |

---

## 2. `users`

| Field         | Type    | Required | Default     | Notes                                                        |
| ------------- | ------- | -------- | ----------- | ------------------------------------------------------------ |
| `_id`         | ObjectId| auto     | auto        |                                                              |
| `fullName`    | String  | ✔        | —           | trim; 2–120 ký tự                                            |
| `email`       | String  | ✔        | —           | trim+lowercase; unique; regex email; max 254                 |
| `passwordHash`| String  | ✔        | —           | bcrypt; **`select: false`**, **strip trong `toJSON`**        |
| `role`        | String  | ✔        | `employee`  | enum: `admin`, `employee`                                    |
| `status`      | String  | ✔        | `active`    | enum: `active`, `inactive`, `locked`                         |
| `lastLoginAt` | Date    | ✗        | `null`      | cập nhật khi đăng nhập thành công                            |
| `createdAt`   | Date    | auto     | —           | timestamps                                                   |
| `updatedAt`   | Date    | auto     | —           | timestamps                                                   |

**Indexes**

- `{ email: 1 }` unique — tự động từ `unique: true`
- `{ role: 1, status: 1 }` — hỗ trợ admin list / filter

**Quy tắc nghiệp vụ**

- Không lưu plaintext password. Controller phải hash trước khi gán.
- `passwordHash` không bao giờ xuất hiện trong response (cả `find` và `toJSON`).
- Email được chuẩn hoá (lowercase + trim) trước khi ghi → unique index
  phân biệt theo giá trị đã chuẩn hoá.
- Nâng cấp `role: 'admin'` chỉ do admin khác thực hiện qua API; controller
  phải enforce (Phase Auth).

---

## 3. `departments`

| Field               | Type     | Required | Default   | Notes                                              |
| ------------------- | -------- | -------- | --------- | -------------------------------------------------- |
| `_id`               | ObjectId | auto     | auto      |                                                    |
| `name`              | String   | ✔        | —         | trim; 2–120 ký tự; nén khoảng trắng thừa          |
| `code`              | String   | ✔        | —         | trim+uppercase; unique; 2–32 ký tự; `[A-Z0-9_-]+`  |
| `description`       | String   | ✗        | `""`      | trim; max 500 ký tự                                 |
| `managerEmployeeId` | ObjectId | ✗        | `null`    | ref `Employee`                                     |
| `status`            | String   | ✔        | `active`  | enum: `active`, `inactive`                         |
| `createdAt`         | Date     | auto     | —         | timestamps                                          |
| `updatedAt`         | Date     | auto     | —         | timestamps                                          |

**Indexes**

- `{ code: 1 }` unique
- `{ managerEmployeeId: 1 }`

**Quy tắc**

- `name` chỉ chuẩn hoá hiển thị; `code` là khoá tra cứu.
- Khi department bị set `inactive` KHÔNG tự xoá Employee hay Position.
- Không cascade.

---

## 4. `positions`

| Field         | Type     | Required | Default   | Notes                                              |
| ------------- | -------- | -------- | --------- | -------------------------------------------------- |
| `_id`         | ObjectId | auto     | auto      |                                                    |
| `name`        | String   | ✔        | —         | trim; 2–120 ký tự                                  |
| `code`        | String   | ✔        | —         | trim+uppercase; unique; 2–32 ký tự; `[A-Z0-9_-]+`  |
| `description` | String   | ✗        | `""`      | max 500                                            |
| `departmentId`| ObjectId | ✗        | `null`    | ref `Department` (cho phép position chung)         |
| `status`      | String   | ✔        | `active`  | enum: `active`, `inactive`                         |
| `createdAt`   | Date     | auto     | —         | timestamps                                          |
| `updatedAt`   | Date     | auto     | —         | timestamps                                          |

**Indexes**

- `{ code: 1 }` unique
- `{ departmentId: 1 }`

**Quy tắc**

- KHÔNG lưu salary range / promotion level — chưa có đặc tả nghiệp vụ.

---

## 5. `employees`

| Field             | Type     | Required | Default   | Notes                                                   |
| ----------------- | -------- | -------- | --------- | ------------------------------------------------------- |
| `_id`             | ObjectId | auto     | auto      |                                                         |
| `employeeCode`    | String   | ✔        | —         | trim+uppercase; unique; `[A-Z0-9_-]+`                   |
| `userId`          | ObjectId | ✗        | `null`    | ref `User`; unique **partial** (chỉ áp dụng khi có)    |
| `fullName`        | String   | ✔        | —         | trim; nén khoảng trắng; 2–120 ký tự                    |
| `email`           | String   | ✔        | —         | trim+lowercase; unique; regex email                     |
| `phone`           | String   | ✗        | `""`      | max 20 ký tự                                            |
| `avatar`          | String   | ✗        | `null`    | URL/relative path                                       |
| `gender`          | String   | ✗        | `other`   | enum: `male`, `female`, `other`                         |
| `dateOfBirth`     | Date     | ✗        | `null`    |                                                         |
| `departmentId`    | ObjectId | ✗        | `null`    | ref `Department`                                        |
| `positionId`      | ObjectId | ✗        | `null`    | ref `Position`                                          |
| `position`        | String   | ✗        | `""`      | **denormalized cache** — xem ghi chú bên dưới           |
| `employmentType`  | String   | ✔        | —         | enum: `full_time`, `part_time`, `contract`, `intern`    |
| `hireDate`        | Date     | ✔        | —         | không cho phép trong tương lai                          |
| `managerId`       | ObjectId | ✗        | `null`    | ref `Employee` (self); không được trỏ tới chính nó      |
| `address`         | String   | ✗        | `""`      | max 500 ký tự                                           |
| `employmentStatus`| String   | ✔        | `active`  | enum: `active`, `on_leave`, `inactive`                  |
| `isDeleted`       | Boolean  | ✔        | `false`   | soft-delete flag (Phase 4)                              |
| `deletedAt`       | Date     | ✗        | `null`    | thời điểm xoá mềm                                      |
| `deletedBy`       | ObjectId | ✗        | `null`    | ref `User` — admin đã thực hiện xoá mềm                 |
| `createdAt`       | Date     | auto     | —         | timestamps                                               |
| `updatedAt`       | Date     | auto     | —         | timestamps                                               |

**Indexes**

- `{ employeeCode: 1 }` unique
- `{ email: 1 }` unique
- `{ userId: 1 }` unique **partial** (chỉ áp dụng khi userId tồn tại)
- `{ departmentId: 1 }`
- `{ positionId: 1 }`
- `{ managerId: 1 }`
- `{ isDeleted: 1 }` — **Phase 4** — hỗ trợ filter mặc định (loại trừ đã xoá mềm)
- `{ isDeleted: 1, createdAt: -1 }` — **Phase 4** — tối ưu list mặc định
- `{ isDeleted: 1, fullName: 1 }` — **Phase 4** — tối ưu search
- `{ isDeleted: 1 }` — tối ưu cho query list mặc định (loại trừ đã xoá mềm)
- `{ isDeleted: 1, createdAt: -1 }` — tối ưu sort theo ngày tạo
- `{ isDeleted: 1, fullName: 1 }` — tối ưu search theo họ tên

**Ghi chú quan trọng**

1. **Trường `position` (text) là cache denormalized**, không thay thế cho
   `positionId`. Lý do: frontend hiện tại (`front_end/src/data/employeeMockData.js`)
   đang dùng `position` dưới dạng chuỗi tự do (vd. "Frontend Engineer").
   Khi chuyển sang dùng `positionId`, có thể bỏ trường này hoặc auto-fill
   từ `Position.name` ở controller. **Cần xác nhận với team FE trước khi
   bỏ.**

2. **`employmentStatus` enum dùng theo dữ liệu frontend hiện tại**:
   `active`, `on_leave`, `inactive`. Đề bài gợi ý enum tối thiểu;
   chưa thêm `terminated` vì mock data không dùng. Khi nghiệp vụ cần
   `terminated` (nghỉ việc / sa thải), sẽ mở rộng enum trong Phase CRUD.

---

## 6. Quan hệ giữa các collection

```
        ┌──────────┐  1   0..1  ┌────────────┐
        │  User    │◄───────────┤ Employee   │
        └──────────┘ userId     └────────────┘
                                     │  │
                            managerId│  │departmentId
                                     │  ▼
                              ┌──────────┐
                              │  Dept.   │  1  ◄──── managerEmployeeId
                              └──────────┘
                                     ▲
                                     │departmentId
                              ┌──────────┐
                              │ Position │
                              └──────────┘
```

| Quan hệ                              | Cardinality | Cách implement                                |
| ------------------------------------ | ----------- | --------------------------------------------- |
| User ↔ Employee                      | 1 ↔ 0..1    | `Employee.userId` (unique partial)            |
| Employee → Department                | n → 0..1    | `Employee.departmentId`                       |
| Employee → Position                  | n → 0..1    | `Employee.positionId`                         |
| Employee → Employee (manager)        | n → 0..1    | `Employee.managerId` (self-reference)         |
| Department → Employee (manager)      | 1 → 0..1    | `Department.managerEmployeeId`                |
| Position → Department                | n → 0..1    | `Position.departmentId`                       |

**Lưu ý về foreign-key validation**

- MongoDB không tự enforce ref-existence. Khi tạo Employee với
  `departmentId` không tồn tại, save sẽ thành công ở DB-level.
- **Controller (Phase CRUD) phải kiểm tra ref-existence** trước khi save.
- Cast lỗi (vd. `departmentId: "abc"`) sẽ bị Mongoose trả
  `ValidationError` ở schema-level — đã test.

---

## 7. Quy tắc xử lý dữ liệu trùng

| Trường hợp                          | Hành vi                                                |
| ----------------------------------- | ------------------------------------------------------ |
| Trùng `users.email`                 | Mongo `E11000` → controller trả 409 `DUPLICATE_KEY`   |
| Trùng `employees.email`             | Mongo `E11000` → 409                                   |
| Trùng `employees.employeeCode`      | Mongo `E11000` → 409                                   |
| Trùng `employees.userId`            | Mongo `E11000` → 409                                   |
| Trùng `departments.code`            | Mongo `E11000` → 409                                   |
| Trùng `positions.code`              | Mongo `E11000` → 409                                   |
| 2 Employee cùng `userId: null`      | **Cho phép** (partial index loại trừ null)             |
| 2 Department cùng `managerEmployeeId: null` | Cho phép                                       |

**Lưu ý kỹ thuật quan trọng**: Mongoose `unique: true` với `sparse: true`
**KHÔNG đủ** khi schema có `default: null`, vì Mongoose vẫn serialize
`userId: null` vào BSON. Ta dùng `partialFilterExpression: { userId:
{ $exists: true, $type: 'objectId' } }` để đảm bảo index bỏ qua
documents không có userId hợp lệ.

---

## 8. Quy tắc xoá / ngừng hoạt động

| Hành động                          | Cascade? | Ghi chú                                   |
| ---------------------------------- | -------- | ----------------------------------------- |
| Xoá `User`                         | KHÔNG    | Controller Phase CRUD phải set `userId = null` trên Employee liên quan trước khi xoá User (hoặc reject). |
| Xoá `Employee`                     | KHÔNG    | Manager references giữ nguyên (dangling ref). Phase 4 dùng soft-delete thay vì xoá cứng. |
| Set `Department.status = inactive` | KHÔNG    | Employee vẫn thuộc phòng ban đó.          |
| Xoá `Department`                   | KHÔNG    | Cân nhắc reject nếu còn Employee.         |
| Xoá `Position`                     | KHÔNG    | Cân nhắc reject nếu còn Employee.         |

Phase 2 chưa có API CRUD. Khi implement ở phase sau, mỗi thao tác xoá
phải có 1 hàm `beforeDelete()` kiểm tra ràng buộc nghiệp vụ.

### 8.1. Soft-delete (Phase 4)

Phase 4 bổ sung cơ chế xoá mềm cho `Employee`. Thay vì xoá cứng, hệ
thống đánh dấu bản ghi là đã xoá thông qua các field:

- `isDeleted: Boolean` (mặc định `false`)
- `deletedAt: Date | null`
- `deletedBy: ObjectId<User> | null`

**Quy tắc**

- Mặc định, mọi danh sách (list) và chi tiết đều loại trừ bản ghi
  có `isDeleted = true`. Admin có thể truy cập lại bằng query
  `includeDeleted=true` ở GET list.
- Xoá mềm là idempotent: gọi DELETE hai lần liên tiếp trả về
  200 với `meta.alreadyDeleted = true` ở lần thứ hai.
- KHÔNG xoá / khoá / thay đổi `status` User liên kết khi Employee
  bị xoá mềm.
- KHÔNG tự xoá cứng. Khi cần audit, dữ liệu gốc vẫn còn trong DB
  với cờ `isDeleted`.
- Các test đã cover default, set, persist sau save.

---

## 9. Các giả định cần xác nhận

| # | Giả định                                                                                              | Tác động nếu sai                                                                              |
| - | ------------------------------------------------------------------------------------------------------ | ---------------------------------------------------------------------------------------------- |
| 1 | `position` (text) là cache denormalized; FE sẽ chuyển sang dùng `positionId`.                        | Có thể bỏ field `position` ở phase CRUD.                                                       |
| 2 | `employmentStatus` enum = `active \| on_leave \| inactive`. Chưa có `terminated`.                     | Cần mở rộng enum khi có nghiệp vụ nghỉ việc.                                                   |
| 3 | User chưa liên kết Employee được tạo tự do (qua `registerEmployee` tương lai).                          | Phase Auth phải hỗ trợ flow "tạo Employee trước, gắn User sau".                                |
| 4 | Manager có thể đứng ngoài Department của Employee mà họ quản lý.                                       | Không enforce ở schema; controller có thể thêm soft check.                                      |
| 5 | Một Department có thể có nhiều Manager trong tương lai (matrix org).                                   | Hiện tại `managerEmployeeId` không unique — đã chuẩn bị.                                       |
| 6 | Email Employee là business email, có thể khác với User.email.                                          | Có thể bỏ unique trên email Employee nếu cần, nhưng FE hiện tại đang check unique ở client.     |

---

## 10. Kế hoạch các collection nghiệp vụ Phase tiếp theo

> **Chỉ lập kế hoạch — KHÔNG tạo model trong Phase 2.**

| Collection         | Mục đích                                       | Quan hệ chính                                |
| ------------------ | ---------------------------------------------- | -------------------------------------------- |
| `attendances`      | Chấm công hằng ngày                            | n → 1 Employee                              |
| `leave_requests`   | Đơn nghỉ phép                                  | n → 1 Employee; n → 1 approver (Employee)   |
| `payroll_records`  | Phiếu lương theo kỳ                            | n → 1 Employee                              |
| `evaluations`      | Đánh giá nhân viên theo chu kỳ                | n → 1 Employee (người được đánh giá); n → 1 evaluator (Employee) |
| `trainings`        | Khoá đào tạo + assignment                      | n ↔ n Employee                               |
| `benefits`         | Phúc lợi + assignment                          | n ↔ n Employee                               |
| `contracts`        | Hợp đồng lao động                              | n → 1 Employee                               |
| `notifications`    | Thông báo trong hệ thống                       | n → 1 Employee (recipient)                   |
| `support_requests` | Yêu cầu hỗ trợ (ticket nội bộ)                | n → 1 Employee (requester)                   |
| `recruitments`     | Tin tuyển dụng + ứng viên                      | độc lập; aggregate vào Employee khi onboard |
| `promotions`       | Lịch sử thăng chức / điều chỉnh lương          | n → 1 Employee                               |
| `reports`          | Báo cáo (snapshot / aggregate)                 | phụ thuộc các collection khác                |
| `system_settings`  | Cấu hình hệ thống (key-value)                  | singleton                                    |

Các model này sẽ được tạo theo từng phase nghiệp vụ, có tham chiếu về
`Employee._id` và `User._id` đã có ở Phase 2.

---

## 11. Test coverage

Test framework: Node built-in `node --test` (zero dependency). DB test
riêng: `hrm_test_db`.

**Tổng: 205 tests, tất cả PASS, 0 FAIL.**

| File test                          | Số test | Trạng thái |
| ---------------------------------- | ------ | ---------- |
| `tests/user.model.test.js`         | 19     | ✔          |
| `tests/employee.model.test.js`     | 28     | ✔          |
| `tests/department.model.test.js`   | 12     | ✔          |
| `tests/position.model.test.js`     | 11     | ✔          |
| `tests/health.regression.test.js`  | 3      | ✔          |
| `tests/auth.service.test.js`       | 23     | ✔          |
| `tests/auth.api.test.js`           | 18     | ✔          |
| `tests/employee.api.test.js`       | 67     | ✔          (Phase 4) |
| `tests/employee.validator.test.js` | 22     | ✔          (Phase 4) |

**Các test case đã cover theo yêu cầu đề bài Phần 2:**

| Yêu cầu                                              | Test cases chính                                                |
| ----------------------------------------------------- | --------------------------------------------------------------- |
| Models import được                                    | `imports without error` (mỗi model)                             |
| Schema validation hoạt động                           | `rejects missing required fields`, `rejects invalid email`, ... |
| Email User trùng bị từ chối ở DB                      | `normalizes email (trim + lowercase) and enforces unique`       |
| Employee code trùng bị từ chối                        | `rejects duplicate employeeCode`                                |
| Một User không liên kết nhiều Employee                | `a User can only be linked to one Employee (unique sparse index)`|
| Nhiều Employee chưa có userId tồn tại                 | `multiple employees without userId coexist`                     |
| Update edge case: email/code/userId unique             | `update with duplicate email is rejected`, `cannot update employee to use a userId already linked to another Employee`|
| References không hợp lệ được xử lý                    | `rejects invalid ObjectId for references (CastError)`           |
| Timestamps hoạt động                                  | `populates timestamps` (cả 4 model)                             |
| passwordHash không xuất hiện trong JSON                | 3 test: `toJSON`, `JSON.stringify`, `default find()` (không `select('+passwordHash')`) |
| Cascade delete — KHÔNG cascade                        | `deleting a User does NOT cascade delete the Employee`          |
| populate ref vẫn giữ an toàn passwordHash              | `populate userId returns User document` (verify passwordHash undefined sau populate) |
| Health check vẫn hoạt động                             | `health.regression.test.js` (3 test: 200 connected, 503 disconnect) |

Test data dùng `@example.com` hoặc domain rõ ràng là test fixture;
không dùng dữ liệu thật.

---

## 12. Lệnh tiện ích

```bash
# Chạy tất cả model tests (dùng DB hrm_test_db)
npm test

# Chỉ chạy syntax check
npm run syntax-check

# Boot dev
npm run dev
```
