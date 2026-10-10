/**
 * Demo users - chỉ phục vụ giai đoạn Phần 3.
 * KHÔNG dùng để bảo mật thực sự. Khi backend Express + MongoDB sẵn sàng,
 * service sẽ gọi API và danh sách này sẽ bị loại bỏ.
 *
 * Mật khẩu chỉ lưu dạng plaintext trong RAM (chỉ mock demo), không bao giờ
 * ghi vào localStorage.
 */

export const DEMO_USERS = [
  {
    id: 'usr-admin-001',
    email: 'admin@hrm.local',
    password: 'Admin123!',
    role: 'admin',
    name: 'Nguyễn Minh Anh',
    avatarUrl: null,
  },
  {
    id: 'usr-emp-001',
    employeeId: 'emp-001',
    email: 'employee@hrm.local',
    password: 'Employee123!',
    role: 'employee',
    name: 'Trần Quốc Bảo',
    avatarUrl: null,
  },
]