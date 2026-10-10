/**
 * Mock data cho Admin Dashboard & Employee Dashboard (Phần 4).
 *
 * Quy tắc:
 * - ID là string, gắn với DEMO_USERS (src/data/demoUsers.js) để Employee
 *   dashboard biết lấy dữ liệu của ai.
 * - Mọi số liệu đều xuất phát từ các bảng dưới đây. Không random mỗi lần
 *   render, không bịa phần trăm tăng trưởng. Tỷ lệ/tổng đều được tính từ
 *   dữ liệu thật trong `dashboardService.js`.
 * - Khi tích hợp Express + MongoDB, các bảng này sẽ được thay bằng API.
 */

// ---------- Reference IDs --------------------------------------------------
// Trùng với id trong src/data/demoUsers.js
export const ADMIN_USER_ID = 'usr-admin-001'
export const EMPLOYEE_USER_ID = 'usr-emp-001'

// ---------- Master: departments -------------------------------------------
export const DEPARTMENTS = [
  { id: 'dept-eng',   name: 'Phòng Kỹ thuật',     headcount: 42 },
  { id: 'dept-hr',    name: 'Phòng Nhân sự',       headcount: 12 },
  { id: 'dept-mkt',   name: 'Phòng Marketing',     headcount: 18 },
  { id: 'dept-fin',   name: 'Phòng Tài chính',     headcount: 14 },
  { id: 'dept-sales', name: 'Phòng Kinh doanh',    headcount: 28 },
  { id: 'dept-cs',    name: 'Phòng Chăm sóc KH',  headcount: 16 },
  { id: 'dept-ops',   name: 'Phòng Vận hành',      headcount: 22 },
]

// ---------- Master: employees ---------------------------------------------
export const EMPLOYEES = [
  // Admin
  {
    id: ADMIN_USER_ID,
    name: 'Nguyễn Minh Anh',
    email: 'admin@hrm.local',
    departmentId: 'dept-hr',
    jobTitle: 'Trưởng phòng Nhân sự',
    joinedAt: '2021-08-15',
    status: 'active',
  },
  // Demo employee (Trần Quốc Bảo)
  {
    id: EMPLOYEE_USER_ID,
    name: 'Trần Quốc Bảo',
    email: 'employee@hrm.local',
    departmentId: 'dept-hr',
    jobTitle: 'Chuyên viên Nhân sự',
    joinedAt: '2024-05-04',
    status: 'active',
  },
  // Còn lại - đảm bảo tổng headcount khớp DEPARTMENTS
  { id: 'emp-003', name: 'Lê Hoàng Phương',  email: 'hoangphuong@hrm.local',   departmentId: 'dept-mkt',   jobTitle: 'Content Marketing',  joinedAt: '2024-01-20', status: 'inactive' },
  { id: 'emp-004', name: 'Phan Thanh Tùng',   email: 'thanhtung@hrm.local',     departmentId: 'dept-fin',   jobTitle: 'Kế toán trưởng',     joinedAt: '2023-07-08', status: 'active' },
  { id: 'emp-005', name: 'Đỗ Khánh Linh',    email: 'khanhlinh@hrm.local',     departmentId: 'dept-eng',   jobTitle: 'Frontend Engineer',  joinedAt: '2024-09-15', status: 'active' },
  { id: 'emp-006', name: 'Ngô Hải Đăng',     email: 'haidang@hrm.local',       departmentId: 'dept-sales', jobTitle: 'Sales Manager',      joinedAt: '2022-11-02', status: 'active' },
  { id: 'emp-007', name: 'Vũ Kim Anh',       email: 'kimanh@hrm.local',        departmentId: 'dept-cs',    jobTitle: 'CSKH Lead',          joinedAt: '2023-03-19', status: 'active' },
  { id: 'emp-008', name: 'Bùi Đức Thành',    email: 'ducthanh@hrm.local',      departmentId: 'dept-eng',   jobTitle: 'Backend Engineer',   joinedAt: '2023-10-12', status: 'active' },
  { id: 'emp-009', name: 'Hoàng Gia Bảo',    email: 'giabao@hrm.local',        departmentId: 'dept-eng',   jobTitle: 'DevOps',             joinedAt: '2024-02-01', status: 'active' },
  { id: 'emp-010', name: 'Phạm Thị Mai',     email: 'maipham@hrm.local',       departmentId: 'dept-mkt',   jobTitle: 'Designer',           joinedAt: '2024-06-21', status: 'active' },
]

// ---------- Attendance: 7 ngày gần nhất (công ty) -------------------------
// value = số ngày công hợp lệ; late = đi muộn; absent = vắng
export const ATTENDANCE_LAST_7_DAYS = [
  { date: '2026-09-25', day: 'T2', present: 148, late: 5,  absent: 3 },
  { date: '2026-09-26', day: 'T3', present: 152, late: 2,  absent: 2 },
  { date: '2026-09-27', day: 'T4', present: 149, late: 4,  absent: 3 },
  { date: '2026-09-28', day: 'T5', present: 151, late: 3,  absent: 2 },
  { date: '2026-09-29', day: 'T6', present: 150, late: 1,  absent: 5 },
  { date: '2026-09-30', day: 'T7', present: 110, late: 2,  absent: 4 },
  { date: '2026-10-01', day: 'CN', present: 12,  late: 0,  absent: 0 },
]

// ---------- Leave requests ------------------------------------------------
export const LEAVE_REQUESTS = [
  {
    id: 'lr-001',
    employeeId: EMPLOYEE_USER_ID,
    type: 'Nghỉ phép năm',
    from: '2026-10-10',
    to: '2026-10-12',
    days: 3,
    status: 'pending',
    reason: 'Về quê có việc gia đình',
    submittedAt: '2026-09-28',
  },
  {
    id: 'lr-002',
    employeeId: EMPLOYEE_USER_ID,
    type: 'Nghỉ ốm',
    from: '2026-09-15',
    to: '2026-09-16',
    days: 2,
    status: 'approved',
    reason: 'Cảm cúm',
    submittedAt: '2026-09-15',
  },
  {
    id: 'lr-003',
    employeeId: 'emp-003',
    type: 'Nghỉ phép năm',
    from: '2026-10-02',
    to: '2026-10-04',
    days: 3,
    status: 'pending',
    reason: 'Du lịch cùng gia đình',
    submittedAt: '2026-09-30',
  },
  {
    id: 'lr-004',
    employeeId: 'emp-006',
    type: 'Nghỉ không lương',
    from: '2026-10-15',
    to: '2026-10-15',
    days: 1,
    status: 'pending',
    reason: 'Việc riêng',
    submittedAt: '2026-09-29',
  },
  {
    id: 'lr-005',
    employeeId: 'emp-007',
    type: 'Nghỉ phép năm',
    from: '2026-09-20',
    to: '2026-09-22',
    days: 3,
    status: 'approved',
    reason: 'Nghỉ ngơi',
    submittedAt: '2026-09-18',
  },
]

// ---------- Payroll periods -----------------------------------------------
export const PAYROLL_PERIODS = [
  {
    id: 'pay-2026-09',
    employeeId: EMPLOYEE_USER_ID,
    period: 'Tháng 09/2026',
    gross: 18_500_000,
    net: 16_250_000,
    paidAt: '2026-09-30',
    status: 'paid',
  },
  {
    id: 'pay-2026-08',
    employeeId: EMPLOYEE_USER_ID,
    period: 'Tháng 08/2026',
    gross: 18_500_000,
    net: 16_250_000,
    paidAt: '2026-08-31',
    status: 'paid',
  },
  {
    id: 'pay-admin-2026-09',
    employeeId: ADMIN_USER_ID,
    period: 'Tháng 09/2026',
    gross: 32_000_000,
    net: 27_500_000,
    paidAt: '2026-09-30',
    status: 'paid',
  },
]

// ---------- Training ------------------------------------------------------
export const TRAINING_COURSES = [
  {
    id: 'tr-001',
    title: 'Onboarding HRM System',
    provider: 'Nội bộ',
    durationHours: 2,
    dueAt: '2026-10-15',
    progress: 60,
    required: true,
  },
  {
    id: 'tr-002',
    title: 'Bảo mật thông tin & GDPR',
    provider: 'Cybersecurity Hub',
    durationHours: 4,
    dueAt: '2026-11-05',
    progress: 25,
    required: true,
  },
  {
    id: 'tr-003',
    title: 'Kỹ năng giao tiếp nội bộ',
    provider: 'Soft Skills VN',
    durationHours: 3,
    dueAt: '2026-12-01',
    progress: 0,
    required: false,
  },
]

// Map training theo employee: mỗi employee có 1 list các khóa đang theo học.
// Trong demo chỉ gán cho employee user; admin xem danh sách tổng.
export const EMPLOYEE_TRAININGS = [
  { employeeId: EMPLOYEE_USER_ID, courseId: 'tr-001' },
  { employeeId: EMPLOYEE_USER_ID, courseId: 'tr-002' },
  { employeeId: EMPLOYEE_USER_ID, courseId: 'tr-003' },
]

// ---------- Notifications -------------------------------------------------
export const NOTIFICATIONS = [
  {
    id: 'nt-001',
    employeeId: EMPLOYEE_USER_ID,
    title: 'Đơn nghỉ phép của bạn đang chờ duyệt',
    description: 'Yêu cầu nghỉ từ 10/10 đến 12/10 đang được quản lý xem xét.',
    createdAt: '2026-09-29T08:30:00+07:00',
    read: false,
  },
  {
    id: 'nt-002',
    employeeId: EMPLOYEE_USER_ID,
    title: 'Phiếu lương tháng 9 đã có',
    description: 'Bạn có thể xem chi tiết tại mục Phiếu lương.',
    createdAt: '2026-09-30T09:15:00+07:00',
    read: false,
  },
  {
    id: 'nt-003',
    employeeId: EMPLOYEE_USER_ID,
    title: 'Khóa học "Bảo mật thông tin" sắp đến hạn',
    description: 'Hoàn thành trước 05/11 để không ảnh hưởng đánh giá KPI.',
    createdAt: '2026-09-27T14:00:00+07:00',
    read: true,
  },
  {
    id: 'nt-004',
    employeeId: ADMIN_USER_ID,
    title: 'Có 3 đơn nghỉ phép đang chờ duyệt',
    description: 'Vui lòng xử lý trong hôm nay.',
    createdAt: '2026-09-30T17:45:00+07:00',
    read: false,
  },
]

// ---------- Recent activities (admin) -------------------------------------
export const ACTIVITIES = [
  {
    id: 'act-001',
    actorId: ADMIN_USER_ID,
    actorName: 'Nguyễn Minh Anh',
    action: 'đã duyệt đơn nghỉ phép của',
    targetName: 'Vũ Kim Anh',
    targetType: 'employee',
    createdAt: '2026-09-30T16:12:00+07:00',
  },
  {
    id: 'act-002',
    actorId: 'emp-005',
    actorName: 'Đỗ Khánh Linh',
    action: 'đã cập nhật hồ sơ cá nhân',
    targetName: '',
    targetType: 'profile',
    createdAt: '2026-09-30T14:08:00+07:00',
  },
  {
    id: 'act-003',
    actorId: 'emp-009',
    actorName: 'Hoàng Gia Bảo',
    action: 'đã hoàn thành khóa học',
    targetName: 'Git nâng cao',
    targetType: 'training',
    createdAt: '2026-09-30T11:32:00+07:00',
  },
  {
    id: 'act-004',
    actorId: 'emp-006',
    actorName: 'Ngô Hải Đăng',
    action: 'đã gửi đơn nghỉ phép',
    targetName: '',
    targetType: 'leave',
    createdAt: '2026-09-29T18:01:00+07:00',
  },
  {
    id: 'act-005',
    actorId: 'emp-010',
    actorName: 'Phạm Thị Mai',
    action: 'đã đăng ký khóa học',
    targetName: 'Kỹ năng thuyết trình',
    targetType: 'training',
    createdAt: '2026-09-29T09:45:00+07:00',
  },
]

// ---------- Attendance per employee (employee dashboard) ------------------
export const EMPLOYEE_ATTENDANCE = {
  [EMPLOYEE_USER_ID]: {
    todayStatus: 'working', // working | off | leave
    checkIn: '08:02',
    checkOut: null, // chưa checkout
    weekSummary: {
      daysWorked: 4,
      lateCount: 0,
      leaveDays: 1,
      absentDays: 0,
      totalWorkingDays: 5,
    },
    monthSummary: {
      daysWorked: 18,
      lateCount: 2,
      leaveDays: 2,
      absentDays: 0,
      totalWorkingDays: 22,
    },
  },
  [ADMIN_USER_ID]: {
    todayStatus: 'working',
    checkIn: '07:55',
    checkOut: null,
    weekSummary: {
      daysWorked: 4,
      lateCount: 0,
      leaveDays: 0,
      absentDays: 0,
      totalWorkingDays: 5,
    },
    monthSummary: {
      daysWorked: 19,
      lateCount: 1,
      leaveDays: 0,
      absentDays: 0,
      totalWorkingDays: 22,
    },
  },
}