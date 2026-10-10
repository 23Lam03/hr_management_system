/**
 * Mock data cho trang Quản lý chấm công (Phần 6).
 *
 * Quy tắc:
 * - Mỗi record gắn với employeeId có sẵn trong employeeMockData.js
 *   (Phần 5) - KHÔNG tạo danh sách nhân viên trùng lặp.
 * - Trạng thái ở mức "hiển thị" - mỗi status có nhãn tiếng Việt và tone
 *   để Badge có thể dùng.
 * - workHours, lateMinutes, earlyLeaveMinutes là dữ liệu đã chốt sẵn
 *   theo quy tắc ca làm demo (xem attendanceService.js). KHÔNG random
 *   tại runtime.
 */

export const ATTENDANCE_STATUSES = [
  { value: 'on_time',     label: 'Đúng giờ',      tone: 'success' },
  { value: 'late',        label: 'Đi muộn',        tone: 'warning' },
  { value: 'early_leave', label: 'Về sớm',         tone: 'warning' },
  { value: 'on_leave',    label: 'Nghỉ phép',      tone: 'pending' },
  { value: 'absent',      label: 'Vắng mặt',       tone: 'inactive' },
  { value: 'incomplete',  label: 'Thiếu dữ liệu',  tone: 'neutral' },
]

export const ATTENDANCE_STATUS_LABEL = ATTENDANCE_STATUSES.reduce((acc, s) => {
  acc[s.value] = s.label
  return acc
}, {})

/**
 * Quy tắc ca làm việc (demo).
 * - Bắt đầu: 08:00, kết thúc: 17:30.
 * - Ngưỡng đi muộn: 08:15.
 * - Ngưỡng về sớm: 17:00.
 * - Nghỉ trưa: 60 phút (trừ khi tính workHours).
 *
 * Đây là quy tắc mặc định phục vụ demo Phần 6. Sẽ được thay bằng cấu
 * hình ca làm việc từ backend khi tích hợp thật.
 */
export const DEFAULT_SHIFT_RULE = {
  startTime: '08:00',
  endTime: '17:30',
  lateGraceMinutes: 15,
  earlyLeaveGraceMinutes: 30,
  breakMinutes: 60,
}

export const ATTENDANCE_RECORDS = [
  // Ngày 2026-10-01 (hôm nay theo mốc thời gian hệ thống)
  { id: 'att-001', employeeId: 'emp-001', date: '2026-10-01', checkIn: '07:55', checkOut: '17:35', workHours: 8.67, lateMinutes: 0, earlyLeaveMinutes: 0, status: 'on_time', note: '' },
  { id: 'att-002', employeeId: 'emp-002', date: '2026-10-01', checkIn: '08:02', checkOut: '17:30', workHours: 8.47, lateMinutes: 0, earlyLeaveMinutes: 0, status: 'on_time', note: '' },
  { id: 'att-003', employeeId: 'emp-005', date: '2026-10-01', checkIn: '08:25', checkOut: '17:32', workHours: 8.12, lateMinutes: 25, earlyLeaveMinutes: 0, status: 'late', note: 'Họp team muộn 20 phút' },
  { id: 'att-004', employeeId: 'emp-006', date: '2026-10-01', checkIn: '08:00', checkOut: '16:45', workHours: 7.75, lateMinutes: 0, earlyLeaveMinutes: 45, status: 'early_leave', note: 'Ra sớm đón con' },
  { id: 'att-005', employeeId: 'emp-007', date: '2026-10-01', checkIn: '07:50', checkOut: '17:35', workHours: 8.75, lateMinutes: 0, earlyLeaveMinutes: 0, status: 'on_time', note: '' },
  { id: 'att-006', employeeId: 'emp-008', date: '2026-10-01', checkIn: '08:18', checkOut: '17:30', workHours: 8.20, lateMinutes: 18, earlyLeaveMinutes: 0, status: 'late', note: '' },
  { id: 'att-007', employeeId: 'emp-009', date: '2026-10-01', checkIn: '08:05', checkOut: '17:30', workHours: 8.42, lateMinutes: 0, earlyLeaveMinutes: 0, status: 'on_time', note: '' },
  { id: 'att-008', employeeId: 'emp-010', date: '2026-10-01', checkIn: '08:10', checkOut: '17:25', workHours: 8.25, lateMinutes: 0, earlyLeaveMinutes: 5, status: 'early_leave', note: '' },
  { id: 'att-009', employeeId: 'emp-011', date: '2026-10-01', checkIn: '08:00', checkOut: '17:30', workHours: 8.50, lateMinutes: 0, earlyLeaveMinutes: 0, status: 'on_time', note: '' },
  { id: 'att-010', employeeId: 'emp-015', date: '2026-10-01', checkIn: '08:30', checkOut: '17:35', workHours: 8.08, lateMinutes: 30, earlyLeaveMinutes: 0, status: 'late', note: 'Kẹt xe' },

  // Ngày 2026-09-30
  { id: 'att-011', employeeId: 'emp-001', date: '2026-09-30', checkIn: '07:55', checkOut: '17:30', workHours: 8.58, lateMinutes: 0, earlyLeaveMinutes: 0, status: 'on_time', note: '' },
  { id: 'att-012', employeeId: 'emp-002', date: '2026-09-30', checkIn: '08:00', checkOut: '17:30', workHours: 8.50, lateMinutes: 0, earlyLeaveMinutes: 0, status: 'on_time', note: '' },
  { id: 'att-013', employeeId: 'emp-005', date: '2026-09-30', checkIn: '08:20', checkOut: '17:30', workHours: 8.17, lateMinutes: 20, earlyLeaveMinutes: 0, status: 'late', note: '' },
  { id: 'att-014', employeeId: 'emp-007', date: '2026-09-30', checkIn: null,    checkOut: null,    workHours: 0,    lateMinutes: 0,  earlyLeaveMinutes: 0,  status: 'on_leave', note: 'Nghỉ phép năm' },
  { id: 'att-015', employeeId: 'emp-008', date: '2026-09-30', checkIn: '08:10', checkOut: '17:30', workHours: 8.33, lateMinutes: 0,  earlyLeaveMinutes: 0,  status: 'on_time', note: '' },

  // Ngày 2026-09-29
  { id: 'att-016', employeeId: 'emp-001', date: '2026-09-29', checkIn: '07:50', checkOut: '17:30', workHours: 8.67, lateMinutes: 0,  earlyLeaveMinutes: 0,  status: 'on_time', note: '' },
  { id: 'att-017', employeeId: 'emp-005', date: '2026-09-29', checkIn: '08:35', checkOut: '17:30', workHours: 7.92, lateMinutes: 35, earlyLeaveMinutes: 0,  status: 'late',    note: 'Kẹt xe giờ cao điểm' },
  { id: 'att-018', employeeId: 'emp-006', date: '2026-09-29', checkIn: '07:55', checkOut: '16:00', workHours: 7.08, lateMinutes: 0,  earlyLeaveMinutes: 90, status: 'early_leave', note: 'Có việc gia đình' },
  { id: 'att-019', employeeId: 'emp-009', date: '2026-09-29', checkIn: null,    checkOut: null,    workHours: 0,    lateMinutes: 0,  earlyLeaveMinutes: 0,  status: 'absent', note: 'Không báo nghỉ' },
  { id: 'att-020', employeeId: 'emp-010', date: '2026-09-29', checkIn: '08:05', checkOut: '17:30', workHours: 8.42, lateMinutes: 0,  earlyLeaveMinutes: 0,  status: 'on_time', note: '' },

  // Ngày 2026-09-28
  { id: 'att-021', employeeId: 'emp-002', date: '2026-09-28', checkIn: '08:00', checkOut: '17:30', workHours: 8.50, lateMinutes: 0,  earlyLeaveMinutes: 0,  status: 'on_time', note: '' },
  { id: 'att-022', employeeId: 'emp-005', date: '2026-09-28', checkIn: '08:22', checkOut: null,    workHours: 0,    lateMinutes: 22, earlyLeaveMinutes: 0,  status: 'incomplete', note: 'Chưa chấm công ra' },
  { id: 'att-023', employeeId: 'emp-008', date: '2026-09-28', checkIn: '08:00', checkOut: '17:30', workHours: 8.50, lateMinutes: 0,  earlyLeaveMinutes: 0,  status: 'on_time', note: '' },
  { id: 'att-024', employeeId: 'emp-014', date: '2026-09-28', checkIn: null,    checkOut: null,    workHours: 0,    lateMinutes: 0,  earlyLeaveMinutes: 0,  status: 'on_leave', note: 'Nghỉ phép' },

  // Ngày 2026-09-25
  { id: 'att-025', employeeId: 'emp-001', date: '2026-09-25', checkIn: '07:55', checkOut: '17:30', workHours: 8.58, lateMinutes: 0,  earlyLeaveMinutes: 0,  status: 'on_time', note: '' },
  { id: 'att-026', employeeId: 'emp-002', date: '2026-09-25', checkIn: '08:00', checkOut: '17:30', workHours: 8.50, lateMinutes: 0,  earlyLeaveMinutes: 0,  status: 'on_time', note: '' },
  { id: 'att-027', employeeId: 'emp-005', date: '2026-09-25', checkIn: '08:40', checkOut: '17:30', workHours: 7.83, lateMinutes: 40, earlyLeaveMinutes: 0,  status: 'late', note: '' },
  { id: 'att-028', employeeId: 'emp-007', date: '2026-09-25', checkIn: '08:00', checkOut: '17:30', workHours: 8.50, lateMinutes: 0,  earlyLeaveMinutes: 0,  status: 'on_time', note: '' },
]