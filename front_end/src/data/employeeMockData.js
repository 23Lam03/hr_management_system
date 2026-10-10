/**
 * Mock data cho trang Quản lý nhân viên (Phần 5).
 *
 * Quy tắc:
 * - ID dạng string. Một số ID khớp với DEMO_USERS để Sidebar/Auth vẫn hoạt
 *   động nhất (usr-admin-001, usr-emp-001).
 * - email & employeeCode duy nhất trong toàn bộ danh sách. Service CRUD sẽ
 *   kiểm tra lại ở runtime.
 * - KHÔNG dùng Math.random trong component; dữ liệu cố định tại đây.
 * - Schema tuân theo Phần 5 của đề bài.
 */

import { ADMIN_USER_ID, EMPLOYEE_USER_ID } from './dashboardMockData'

// ---------- Departments -----------------------------------------------------
// ID giữ ổn định để có thể tham chiếu chéo với Phần 4.
export const DEPARTMENTS = [
  { id: 'dept-eng',   name: 'Phòng Kỹ thuật' },
  { id: 'dept-hr',    name: 'Phòng Nhân sự' },
  { id: 'dept-mkt',   name: 'Phòng Marketing' },
  { id: 'dept-fin',   name: 'Phòng Tài chính' },
  { id: 'dept-sales', name: 'Phòng Kinh doanh' },
  { id: 'dept-cs',    name: 'Phòng Chăm sóc Khách hàng' },
  { id: 'dept-ops',   name: 'Phòng Vận hành' },
]

export const EMPLOYMENT_TYPES = [
  { value: 'full_time', label: 'Toàn thời gian' },
  { value: 'part_time', label: 'Bán thời gian' },
  { value: 'contract',  label: 'Hợp đồng' },
  { value: 'intern',    label: 'Thực tập sinh' },
]

export const EMPLOYMENT_TYPE_LABEL = EMPLOYMENT_TYPES.reduce((acc, t) => {
  acc[t.value] = t.label
  return acc
}, {})

export const EMPLOYMENT_STATUSES = [
  { value: 'active',   label: 'Đang làm việc', tone: 'active' },
  { value: 'on_leave', label: 'Đang nghỉ phép', tone: 'pending' },
  { value: 'inactive', label: 'Ngừng hoạt động', tone: 'inactive' },
]

export const EMPLOYMENT_STATUS_LABEL = EMPLOYMENT_STATUSES.reduce((acc, s) => {
  acc[s.value] = s.label
  return acc
}, {})

export const GENDERS = [
  { value: 'male',   label: 'Nam' },
  { value: 'female', label: 'Nữ' },
  { value: 'other',  label: 'Khác' },
]

export const GENDER_LABEL = GENDERS.reduce((acc, g) => {
  acc[g.value] = g.label
  return acc
}, {})

// ---------- Employees ------------------------------------------------------
export const EMPLOYEES = [
  {
    id: 'emp-001',
    employeeCode: 'NV0001',
    fullName: 'Nguyễn Minh Anh',
    email: 'admin@hrm.local',
    phone: '0901 234 567',
    avatar: null,
    gender: 'female',
    dateOfBirth: '1990-03-12',
    departmentId: 'dept-hr',
    position: 'Trưởng phòng Nhân sự',
    employmentType: 'full_time',
    hireDate: '2021-08-15',
    managerId: null,
    managerName: '—',
    address: '12 Trần Hưng Đạo, Quận 1, TP.HCM',
    status: 'active',
    createdAt: '2021-08-15T08:00:00+07:00',
    updatedAt: '2026-09-30T17:00:00+07:00',
  },
  {
    id: 'emp-002',
    employeeCode: 'NV0002',
    fullName: 'Trần Quốc Bảo',
    userId: 'usr-emp-001',
    email: 'employee@hrm.local',
    phone: '0902 345 678',
    avatar: null,
    gender: 'male',
    dateOfBirth: '1995-07-21',
    departmentId: 'dept-hr',
    position: 'Chuyên viên Nhân sự',
    employmentType: 'full_time',
    hireDate: '2024-05-04',
    managerId: 'emp-001',
    managerName: 'Nguyễn Minh Anh',
    address: '45 Lý Tự Trọng, Quận 1, TP.HCM',
    status: 'active',
    createdAt: '2024-05-04T08:30:00+07:00',
    updatedAt: '2026-09-30T17:00:00+07:00',
  },
  {
    id: 'emp-003',
    employeeCode: 'NV0003',
    fullName: 'Lê Hoàng Phương',
    phone: '0903 456 789',
    avatar: null,
    email: 'hoangphuong@hrm.local',
    gender: 'female',
    dateOfBirth: '1996-11-02',
    departmentId: 'dept-mkt',
    position: 'Content Marketing',
    employmentType: 'full_time',
    hireDate: '2024-01-20',
    managerId: 'emp-008',
    managerName: 'Trương Thanh Hà',
    address: '78 Pasteur, Quận 3, TP.HCM',
    status: 'on_leave',
    createdAt: '2024-01-20T09:00:00+07:00',
    updatedAt: '2026-09-30T17:00:00+07:00',
  },
  {
    id: 'emp-004',
    employeeCode: 'NV0004',
    fullName: 'Phan Thanh Tùng',
    phone: '0904 567 890',
    avatar: null,
    email: 'thanhtung@hrm.local',
    gender: 'male',
    dateOfBirth: '1988-02-18',
    departmentId: 'dept-fin',
    position: 'Kế toán trưởng',
    employmentType: 'full_time',
    hireDate: '2023-07-08',
    managerId: null,
    managerName: '—',
    address: '99 Nguyễn Huệ, Quận 1, TP.HCM',
    status: 'active',
    createdAt: '2023-07-08T08:00:00+07:00',
    updatedAt: '2026-09-30T17:00:00+07:00',
  },
  {
    id: 'emp-005',
    employeeCode: 'NV0005',
    fullName: 'Đỗ Khánh Linh',
    phone: '0905 678 901',
    avatar: null,
    email: 'khanhlinh@hrm.local',
    gender: 'female',
    dateOfBirth: '1998-09-09',
    departmentId: 'dept-eng',
    position: 'Frontend Engineer',
    employmentType: 'full_time',
    hireDate: '2024-09-15',
    managerId: 'emp-006',
    managerName: 'Ngô Hải Đăng',
    address: '18 Phan Xích Long, Quận Bình Thạnh, TP.HCM',
    status: 'active',
    createdAt: '2024-09-15T09:00:00+07:00',
    updatedAt: '2026-09-30T17:00:00+07:00',
  },
  {
    id: 'emp-006',
    employeeCode: 'NV0006',
    fullName: 'Ngô Hải Đăng',
    phone: '0906 789 123',
    avatar: null,
    email: 'haidang@hrm.local',
    gender: 'male',
    dateOfBirth: '1985-05-22',
    departmentId: 'dept-eng',
    position: 'Engineering Manager',
    employmentType: 'full_time',
    hireDate: '2022-11-02',
    managerId: null,
    managerName: '—',
    address: '256 Xô Viết Nghệ Tĩnh, Quận Bình Thạnh, TP.HCM',
    status: 'active',
    createdAt: '2022-11-02T08:00:00+07:00',
    updatedAt: '2026-09-30T17:00:00+07:00',
  },
  {
    id: 'emp-007',
    employeeCode: 'NV0007',
    fullName: 'Vũ Kim Anh',
    phone: '0907 890 234',
    avatar: null,
    email: 'kimanh@hrm.local',
    gender: 'female',
    dateOfBirth: '1993-12-01',
    departmentId: 'dept-cs',
    position: 'CSKH Lead',
    employmentType: 'full_time',
    hireDate: '2023-03-19',
    managerId: null,
    managerName: '—',
    address: '02 Võ Văn Tần, Quận 3, TP.HCM',
    status: 'active',
    createdAt: '2023-03-19T09:00:00+07:00',
    updatedAt: '2026-09-30T17:00:00+07:00',
  },
  {
    id: 'emp-008',
    employeeCode: 'NV0008',
    fullName: 'Bùi Đức Thành',
    phone: '0908 901 345',
    avatar: null,
    email: 'ducthanh@hrm.local',
    gender: 'male',
    dateOfBirth: '1992-08-30',
    departmentId: 'dept-eng',
    position: 'Backend Engineer',
    employmentType: 'full_time',
    hireDate: '2023-10-12',
    managerId: 'emp-006',
    managerName: 'Ngô Hải Đăng',
    address: '34 Điện Biên Phủ, Quận Bình Thạnh, TP.HCM',
    status: 'active',
    createdAt: '2023-10-12T09:00:00+07:00',
    updatedAt: '2026-09-30T17:00:00+07:00',
  },
  {
    id: 'emp-009',
    employeeCode: 'NV0009',
    fullName: 'Hoàng Gia Bảo',
    phone: '0909 012 456',
    avatar: null,
    email: 'giabao@hrm.local',
    gender: 'male',
    dateOfBirth: '1997-04-15',
    departmentId: 'dept-eng',
    position: 'DevOps',
    employmentType: 'full_time',
    hireDate: '2024-02-01',
    managerId: 'emp-006',
    managerName: 'Ngô Hải Đăng',
    address: '67 Bạch Đằng, Quận Tân Bình, TP.HCM',
    status: 'active',
    createdAt: '2024-02-01T09:00:00+07:00',
    updatedAt: '2026-09-30T17:00:00+07:00',
  },
  {
    id: 'emp-010',
    employeeCode: 'NV0010',
    fullName: 'Phạm Thị Mai',
    phone: '0910 123 567',
    avatar: null,
    email: 'maipham@hrm.local',
    gender: 'female',
    dateOfBirth: '1999-06-25',
    departmentId: 'dept-mkt',
    position: 'Designer',
    employmentType: 'contract',
    hireDate: '2024-06-21',
    managerId: 'emp-003',
    managerName: 'Lê Hoàng Phương',
    address: '120 Cộng Hòa, Quận Tân Bình, TP.HCM',
    status: 'active',
    createdAt: '2024-06-21T09:00:00+07:00',
    updatedAt: '2026-09-30T17:00:00+07:00',
  },
  {
    id: 'emp-011',
    employeeCode: 'NV0011',
    fullName: 'Trương Thanh Hà',
    phone: '0911 234 678',
    avatar: null,
    email: 'thanhha@hrm.local',
    gender: 'female',
    dateOfBirth: '1987-01-14',
    departmentId: 'dept-mkt',
    position: 'Marketing Manager',
    employmentType: 'full_time',
    hireDate: '2022-03-10',
    managerId: null,
    managerName: '—',
    address: '88 Hai Bà Trưng, Quận 1, TP.HCM',
    status: 'active',
    createdAt: '2022-03-10T09:00:00+07:00',
    updatedAt: '2026-09-30T17:00:00+07:00',
  },
  {
    id: 'emp-012',
    employeeCode: 'NV0012',
    fullName: 'Đặng Quốc Trung',
    phone: '0912 345 789',
    avatar: null,
    email: 'quoctrung@hrm.local',
    gender: 'male',
    dateOfBirth: '2000-10-05',
    departmentId: 'dept-eng',
    position: 'Backend Intern',
    employmentType: 'intern',
    hireDate: '2026-08-01',
    managerId: 'emp-006',
    managerName: 'Ngô Hải Đăng',
    address: '5 Lê Hồng Phong, Quận 10, TP.HCM',
    status: 'inactive',
    createdAt: '2026-08-01T09:00:00+07:00',
    updatedAt: '2026-09-30T17:00:00+07:00',
  },
  {
    id: 'emp-013',
    employeeCode: 'NV0013',
    fullName: 'Nguyễn Phương Trinh',
    phone: '0913 456 890',
    avatar: null,
    email: 'phuongtrinh@hrm.local',
    gender: 'female',
    dateOfBirth: '1994-08-19',
    departmentId: 'dept-sales',
    position: 'Sales Executive',
    employmentType: 'full_time',
    hireDate: '2023-01-15',
    managerId: null,
    managerName: '—',
    address: '21 Nguyễn Thị Minh Khai, Quận 1, TP.HCM',
    status: 'active',
    createdAt: '2023-01-15T09:00:00+07:00',
    updatedAt: '2026-09-30T17:00:00+07:00',
  },
  {
    id: 'emp-014',
    employeeCode: 'NV0014',
    fullName: 'Bạch Công Minh',
    phone: '0914 567 012',
    avatar: null,
    email: 'congminh@hrm.local',
    gender: 'male',
    dateOfBirth: '1996-12-30',
    departmentId: 'dept-ops',
    position: 'Operations Specialist',
    employmentType: 'part_time',
    hireDate: '2025-05-20',
    managerId: null,
    managerName: '—',
    address: '14 Đồng Khởi, Quận 1, TP.HCM',
    status: 'on_leave',
    createdAt: '2025-05-20T09:00:00+07:00',
    updatedAt: '2026-09-30T17:00:00+07:00',
  },
  {
    id: 'emp-015',
    employeeCode: 'NV0015',
    fullName: 'Tạ Minh Thư',
    phone: '0915 678 123',
    avatar: null,
    email: 'minhthu@hrm.local',
    gender: 'female',
    dateOfBirth: '1991-04-08',
    departmentId: 'dept-fin',
    position: 'Kế toán viên',
    employmentType: 'full_time',
    hireDate: '2024-11-12',
    managerId: 'emp-004',
    managerName: 'Phan Thanh Tùng',
    address: '90 Trần Đình Xu, Quận 1, TP.HCM',
    status: 'active',
    createdAt: '2024-11-12T09:00:00+07:00',
    updatedAt: '2026-09-30T17:00:00+07:00',
  },
]

// Gợi ý ID kế tiếp cho service khi thêm mới.
export const NEXT_ID_HINT = 'emp-016'

// Gợi ý mã nhân viên kế tiếp - giữ format NVxxxx 4 chữ số.
export function nextEmployeeCode(existing = EMPLOYEES) {
  let max = 0
  for (const e of existing) {
    const m = /^NV(\d+)$/.exec(e.employeeCode || '')
    if (m) {
      const n = parseInt(m[1], 10)
      if (n > max) max = n
    }
  }
  return `NV${String(max + 1).padStart(4, '0')}`
}

// Sanity-check: trùng khớp user id chính giữa Phần 4 và Phần 5.
export const ADMIN_EMPLOYEE_ID = ADMIN_USER_ID
export const EMPLOYEE_EMPLOYEE_ID = EMPLOYEE_USER_ID