/**
 * Mock Security Activity cho AD-HRM11 (Phần 16).
 *
 * LƯU Ý:
 * - IP / User Agent chỉ là mock.
 * - Không lấy IP thật của user.
 * - Không log password, token hay dữ liệu nhạy cảm.
 */

const ADMIN_USER_ID = 'usr-admin-001'
const EMPLOYEE_USER_ID = 'usr-emp-001'

const minutes = (n) => {
  const d = new Date('2026-10-02T08:30:00+07:00')
  d.setMinutes(d.getMinutes() - n)
  return d.toISOString()
}

const hours = (n, minute = 0) => {
  const d = new Date('2026-10-02T08:30:00+07:00')
  d.setHours(d.getHours() - n, minute)
  return d.toISOString()
}

const days = (n, h = 8, m = 30) => {
  const d = new Date('2026-10-02T00:00:00+07:00')
  d.setDate(d.getDate() - n)
  d.setHours(h, m, 0)
  return d.toISOString()
}

export const SECURITY_ACTIVITIES = [
  {
    id: 'security-activity-001',
    type: 'security_setting_update',
    actorId: ADMIN_USER_ID,
    actorName: 'Nguyễn Minh Anh',
    description: 'Admin đã cập nhật thiết lập bảo mật hệ thống.',
    status: 'success',
    ipAddress: '192.168.1.10',
    userAgent: 'Chrome 124 / Windows 11',
    createdAt: minutes(15),
  },
  {
    id: 'security-activity-002',
    type: 'login',
    actorId: ADMIN_USER_ID,
    actorName: 'Nguyễn Minh Anh',
    description: 'Đăng nhập vào hệ thống quản trị.',
    status: 'success',
    ipAddress: '192.168.1.10',
    userAgent: 'Chrome 124 / Windows 11',
    createdAt: minutes(20),
  },
  {
    id: 'security-activity-003',
    type: 'login',
    actorId: 'unknown-001',
    actorName: 'admin@hrm.local',
    description: 'Đăng nhập thất bại do sai mật khẩu (lần 2).',
    status: 'failed',
    ipAddress: '203.0.113.45',
    userAgent: 'Firefox 127 / Linux',
    createdAt: minutes(45),
  },
  {
    id: 'security-activity-004',
    type: 'password_change',
    actorId: EMPLOYEE_USER_ID,
    actorName: 'Trần Quốc Bảo',
    description: 'Nhân viên đã thay đổi mật khẩu cá nhân.',
    status: 'success',
    ipAddress: '10.0.0.21',
    userAgent: 'Safari 17 / macOS',
    createdAt: hours(2),
  },
  {
    id: 'security-activity-005',
    type: 'account_lock',
    actorId: ADMIN_USER_ID,
    actorName: 'Nguyễn Minh Anh',
    description: 'Khóa tài khoản employee-005 do đăng nhập sai 5 lần.',
    status: 'success',
    ipAddress: '192.168.1.10',
    userAgent: 'Chrome 124 / Windows 11',
    createdAt: hours(4),
  },
  {
    id: 'security-activity-006',
    type: 'logout',
    actorId: EMPLOYEE_USER_ID,
    actorName: 'Trần Quốc Bảo',
    description: 'Đăng xuất khỏi cổng nhân viên.',
    status: 'success',
    ipAddress: '10.0.0.21',
    userAgent: 'Safari 17 / macOS',
    createdAt: hours(6),
  },
  {
    id: 'security-activity-007',
    type: 'login',
    actorId: EMPLOYEE_USER_ID,
    actorName: 'Trần Quốc Bảo',
    description: 'Đăng nhập vào cổng nhân viên.',
    status: 'success',
    ipAddress: '10.0.0.21',
    userAgent: 'Safari 17 / macOS',
    createdAt: hours(7),
  },
  {
    id: 'security-activity-008',
    type: 'login',
    actorId: 'unknown-002',
    actorName: 'employee@hrm.local',
    description: 'Đăng nhập thất bại do tài khoản bị khóa tạm thời.',
    status: 'failed',
    ipAddress: '203.0.113.45',
    userAgent: 'Edge 124 / Windows 11',
    createdAt: hours(8),
  },
  {
    id: 'security-activity-009',
    type: 'account_unlock',
    actorId: ADMIN_USER_ID,
    actorName: 'Nguyễn Minh Anh',
    description: 'Mở khóa tài khoản employee-008 theo yêu cầu.',
    status: 'success',
    ipAddress: '192.168.1.10',
    userAgent: 'Chrome 124 / Windows 11',
    createdAt: days(1, 10, 5),
  },
  {
    id: 'security-activity-010',
    type: 'security_setting_update',
    actorId: ADMIN_USER_ID,
    actorName: 'Nguyễn Minh Anh',
    description: 'Admin đã bật giới hạn số lần đăng nhập thất bại.',
    status: 'success',
    ipAddress: '192.168.1.10',
    userAgent: 'Chrome 124 / Windows 11',
    createdAt: days(1, 9, 12),
  },
  {
    id: 'security-activity-011',
    type: 'login',
    actorId: 'unknown-003',
    actorName: 'admin@hrm.local',
    description: 'Đăng nhập thất bại do sai mật khẩu (lần 1).',
    status: 'failed',
    ipAddress: '203.0.113.99',
    userAgent: 'Chrome 124 / Linux',
    createdAt: days(1, 8, 0),
  },
  {
    id: 'security-activity-012',
    type: 'password_change',
    actorId: ADMIN_USER_ID,
    actorName: 'Nguyễn Minh Anh',
    description: 'Admin đã thay đổi mật khẩu quản trị.',
    status: 'success',
    ipAddress: '192.168.1.10',
    userAgent: 'Chrome 124 / Windows 11',
    createdAt: days(2),
  },
  {
    id: 'security-activity-013',
    type: 'login',
    actorId: ADMIN_USER_ID,
    actorName: 'Nguyễn Minh Anh',
    description: 'Đăng nhập hệ thống thành công.',
    status: 'success',
    ipAddress: '192.168.1.10',
    userAgent: 'Chrome 124 / Windows 11',
    createdAt: days(3, 9, 30),
  },
  {
    id: 'security-activity-014',
    type: 'logout',
    actorId: ADMIN_USER_ID,
    actorName: 'Nguyễn Minh Anh',
    description: 'Đăng xuất khỏi hệ thống.',
    status: 'success',
    ipAddress: '192.168.1.10',
    userAgent: 'Chrome 124 / Windows 11',
    createdAt: days(3, 17, 45),
  },
  {
    id: 'security-activity-015',
    type: 'security_setting_update',
    actorId: ADMIN_USER_ID,
    actorName: 'Nguyễn Minh Anh',
    description: 'Admin đã tắt xác thực hai yếu tố trong cấu hình mô phỏng.',
    status: 'success',
    ipAddress: '192.168.1.10',
    userAgent: 'Chrome 124 / Windows 11',
    createdAt: days(4),
  },
]