/**
 * Mock data cho Support Management (Phần 15).
 *
 * Quy tắc:
 * - requesterId tham chiếu về user id trong demoUsers (usr-emp-001...)
 *   hoặc id nhân viên (emp-001...). Vì AuthContext.user.id = usr-emp-001,
 *   nên tất cả request của employee đều dùng requesterId = usr-emp-001
 *   để Employee chỉ thấy request của chính mình.
 * - assignedTo tham chiếu về usr-admin-001.
 */

export const SUPPORT_CATEGORIES = [
  { value: 'account',    label: 'Tài khoản',     icon: 'account' },
  { value: 'attendance', label: 'Chấm công',     icon: 'attendance' },
  { value: 'leave',      label: 'Nghỉ phép',     icon: 'leave' },
  { value: 'payroll',    label: 'Bảng lương',    icon: 'payroll' },
  { value: 'benefit',    label: 'Phúc lợi',      icon: 'benefit' },
  { value: 'contract',   label: 'Hợp đồng',      icon: 'contract' },
  { value: 'training',   label: 'Đào tạo',       icon: 'training' },
  { value: 'evaluation', label: 'Đánh giá',      icon: 'evaluation' },
  { value: 'technical',  label: 'Kỹ thuật',      icon: 'technical' },
  { value: 'other',      label: 'Khác',          icon: 'other' },
]

export const SUPPORT_CATEGORY_LABEL = SUPPORT_CATEGORIES.reduce((acc, c) => {
  acc[c.value] = c.label
  return acc
}, {})

export const SUPPORT_PRIORITIES = [
  { value: 'low',    label: 'Thấp',       tone: 'neutral' },
  { value: 'normal', label: 'Bình thường', tone: 'info' },
  { value: 'high',   label: 'Cao',        tone: 'danger' },
]

export const SUPPORT_PRIORITY_LABEL = SUPPORT_PRIORITIES.reduce((acc, p) => {
  acc[p.value] = p.label
  return acc
}, {})

export const SUPPORT_PRIORITY_TONE = SUPPORT_PRIORITIES.reduce((acc, p) => {
  acc[p.value] = p.tone
  return acc
}, {})

export const SUPPORT_STATUSES = [
  { value: 'open',                   label: 'Mới',                    tone: 'info' },
  { value: 'in_progress',            label: 'Đang xử lý',             tone: 'warning' },
  { value: 'waiting_for_employee',   label: 'Chờ nhân viên phản hồi', tone: 'pending' },
  { value: 'resolved',               label: 'Đã giải quyết',          tone: 'success' },
  { value: 'closed',                 label: 'Đã đóng',                tone: 'neutral' },
  { value: 'cancelled',              label: 'Đã hủy',                 tone: 'inactive' },
]

export const SUPPORT_STATUS_LABEL = SUPPORT_STATUSES.reduce((acc, s) => {
  acc[s.value] = s.label
  return acc
}, {})

export const SUPPORT_STATUS_TONE = SUPPORT_STATUSES.reduce((acc, s) => {
  acc[s.value] = s.tone
  return acc
}, {})

const EMPLOYEE_USER_ID = 'usr-emp-001'
const ADMIN_USER_ID = 'usr-admin-001'

const day = (offset, time = '08:30:00') => {
  const d = new Date('2026-10-02T00:00:00+07:00')
  d.setDate(d.getDate() - offset)
  const [h, m, s] = time.split(':')
  d.setHours(Number(h), Number(m), Number(s))
  return d.toISOString()
}

export const SUPPORT_REQUESTS = [
  {
    id: 'support-001',
    subject: 'Không thể xem bảng lương tháng 09/2026',
    description:
      'Tôi không thể xem chi tiết bảng lương tháng 09, hệ thống báo lỗi "Không có dữ liệu".',
    category: 'payroll',
    priority: 'high',
    status: 'in_progress',
    requesterId: EMPLOYEE_USER_ID,
    assignedTo: ADMIN_USER_ID,
    createdAt: day(2),
    updatedAt: day(1, '14:20:00'),
    resolvedAt: null,
    messages: [
      {
        id: 'message-001',
        senderId: EMPLOYEE_USER_ID,
        senderRole: 'employee',
        message: 'Tôi không thể xem chi tiết bảng lương tháng 09, hệ thống báo lỗi.',
        createdAt: day(2),
      },
      {
        id: 'message-002',
        senderId: ADMIN_USER_ID,
        senderRole: 'admin',
        message:
          'Chào bạn, bộ phận HR đang kiểm tra dữ liệu. Phiếu lương sẽ được cập nhật trong ngày.',
        createdAt: day(1, '10:15:00'),
      },
    ],
  },
  {
    id: 'support-002',
    subject: 'Yêu cầu chỉnh sửa ngày nghỉ phép',
    description:
      'Đơn nghỉ phép từ 05/10 - 07/10 cần thay đổi thành 06/10 - 08/10 do lịch công tác.',
    category: 'leave',
    priority: 'normal',
    status: 'resolved',
    requesterId: EMPLOYEE_USER_ID,
    assignedTo: ADMIN_USER_ID,
    createdAt: day(5),
    updatedAt: day(3, '09:00:00'),
    resolvedAt: day(3, '09:00:00'),
    messages: [
      {
        id: 'message-003',
        senderId: EMPLOYEE_USER_ID,
        senderRole: 'employee',
        message: 'Tôi muốn điều chỉnh ngày nghỉ phép đã đăng ký.',
        createdAt: day(5),
      },
      {
        id: 'message-004',
        senderId: ADMIN_USER_ID,
        senderRole: 'admin',
        message: 'Đơn đã được điều chỉnh. Vui lòng kiểm tra lại.',
        createdAt: day(3, '09:00:00'),
      },
    ],
  },
  {
    id: 'support-003',
    subject: 'Đăng ký tham gia khóa đào tạo',
    description: 'Tôi muốn đăng ký khóa đào tạo React nâng cao nhưng hệ thống báo hết chỗ.',
    category: 'training',
    priority: 'low',
    status: 'open',
    requesterId: EMPLOYEE_USER_ID,
    assignedTo: null,
    createdAt: day(0, '09:15:00'),
    updatedAt: day(0, '09:15:00'),
    resolvedAt: null,
    messages: [
      {
        id: 'message-005',
        senderId: EMPLOYEE_USER_ID,
        senderRole: 'employee',
        message: 'Hệ thống báo hết chỗ khi đăng ký. Tôi có thể đăng ký danh sách chờ không?',
        createdAt: day(0, '09:15:00'),
      },
    ],
  },
  {
    id: 'support-004',
    subject: 'Phúc lợi khám sức khỏe định kỳ',
    description: 'Tôi chưa thấy phúc lợi khám sức khỏe được cập nhật trong hồ sơ.',
    category: 'benefit',
    priority: 'normal',
    status: 'waiting_for_employee',
    requesterId: EMPLOYEE_USER_ID,
    assignedTo: ADMIN_USER_ID,
    createdAt: day(1),
    updatedAt: day(0, '11:00:00'),
    resolvedAt: null,
    messages: [
      {
        id: 'message-006',
        senderId: EMPLOYEE_USER_ID,
        senderRole: 'employee',
        message: 'Tôi chưa thấy phúc lợi khám sức khỏe định kỳ.',
        createdAt: day(1),
      },
      {
        id: 'message-007',
        senderId: ADMIN_USER_ID,
        senderRole: 'admin',
        message:
          'Phúc lợi đã được duyệt. Bạn có thể xem chi tiết trong mục Phúc lợi của tôi. Vui lòng xác nhận lại nhé.',
        createdAt: day(0, '11:00:00'),
      },
    ],
  },
  {
    id: 'support-005',
    subject: 'Lỗi đăng nhập hệ thống',
    description: 'Tôi liên tục bị đăng xuất khi vào trang chấm công.',
    category: 'technical',
    priority: 'high',
    status: 'in_progress',
    requesterId: EMPLOYEE_USER_ID,
    assignedTo: ADMIN_USER_ID,
    createdAt: day(0, '07:45:00'),
    updatedAt: day(0, '08:30:00'),
    resolvedAt: null,
    messages: [
      {
        id: 'message-008',
        senderId: EMPLOYEE_USER_ID,
        senderRole: 'employee',
        message: 'Trình duyệt tự đăng xuất khi vào chấm công, rất khó chịu.',
        createdAt: day(0, '07:45:00'),
      },
      {
        id: 'message-009',
        senderId: ADMIN_USER_ID,
        senderRole: 'admin',
        message: 'Bộ phận kỹ thuật đang kiểm tra. Bạn vui lòng thử lại sau 30 phút.',
        createdAt: day(0, '08:30:00'),
      },
    ],
  },
  {
    id: 'support-006',
    subject: 'Hợp đồng lao động sắp hết hạn',
    description: 'Tôi muốn biết thủ tục gia hạn hợp đồng trước khi hết hạn 30 ngày.',
    category: 'contract',
    priority: 'normal',
    status: 'closed',
    requesterId: EMPLOYEE_USER_ID,
    assignedTo: ADMIN_USER_ID,
    createdAt: day(7),
    updatedAt: day(6, '10:00:00'),
    resolvedAt: day(6, '10:00:00'),
    messages: [
      {
        id: 'message-010',
        senderId: EMPLOYEE_USER_ID,
        senderRole: 'employee',
        message: 'Hợp đồng sắp hết hạn, tôi cần biết thủ tục gia hạn.',
        createdAt: day(7),
      },
      {
        id: 'message-011',
        senderId: ADMIN_USER_ID,
        senderRole: 'admin',
        message:
          'Hợp đồng đã được tự động gia hạn. Bạn kiểm tra trong mục Hợp đồng của tôi nhé.',
        createdAt: day(6, '10:00:00'),
      },
    ],
  },
  {
    id: 'support-007',
    subject: 'Chấm công thiếu ngày 28/09',
    description: 'Bảng chấm công của tôi thiếu check-in ngày 28/09, đã quét vân tay thành công.',
    category: 'attendance',
    priority: 'normal',
    status: 'cancelled',
    requesterId: EMPLOYEE_USER_ID,
    assignedTo: null,
    createdAt: day(4),
    updatedAt: day(3, '08:00:00'),
    resolvedAt: null,
    messages: [
      {
        id: 'message-012',
        senderId: EMPLOYEE_USER_ID,
        senderRole: 'employee',
        message: 'Chấm công ngày 28/09 bị thiếu, nhờ kiểm tra lại.',
        createdAt: day(4),
      },
      {
        id: 'message-013',
        senderId: EMPLOYEE_USER_ID,
        senderRole: 'employee',
        message: 'Đã tự kiểm tra lại và thấy dữ liệu đã được cập nhật. Hủy yêu cầu này.',
        createdAt: day(3, '08:00:00'),
      },
    ],
  },
  {
    id: 'support-008',
    subject: 'Yêu cầu cập nhật email cá nhân',
    description: 'Tôi cần cập nhật email cá nhân trong hồ sơ từ abc@gmail.com sang abc@company.com.',
    category: 'account',
    priority: 'low',
    status: 'open',
    requesterId: EMPLOYEE_USER_ID,
    assignedTo: null,
    createdAt: day(0, '10:00:00'),
    updatedAt: day(0, '10:00:00'),
    resolvedAt: null,
    messages: [
      {
        id: 'message-014',
        senderId: EMPLOYEE_USER_ID,
        senderRole: 'employee',
        message: 'Tôi cần cập nhật email trong hồ sơ.',
        createdAt: day(0, '10:00:00'),
      },
    ],
  },
  {
    id: 'support-009',
    subject: 'Câu hỏi về đánh giá KPI Q3',
    description: 'Tôi muốn hỏi rõ hơn về tiêu chí đánh giá KPI của quý 3.',
    category: 'evaluation',
    priority: 'low',
    status: 'open',
    requesterId: EMPLOYEE_USER_ID,
    assignedTo: null,
    createdAt: day(0, '11:30:00'),
    updatedAt: day(0, '11:30:00'),
    resolvedAt: null,
    messages: [
      {
        id: 'message-015',
        senderId: EMPLOYEE_USER_ID,
        senderRole: 'employee',
        message: 'Cho tôi xin thông tin chi tiết về KPI Q3.',
        createdAt: day(0, '11:30:00'),
      },
    ],
  },
  {
    id: 'support-010',
    subject: 'Khác - Góp ý cải thiện giao diện',
    description: 'Phần dashboard có thể hiển thị thêm các widget tiện ích.',
    category: 'other',
    priority: 'low',
    status: 'open',
    requesterId: EMPLOYEE_USER_ID,
    assignedTo: null,
    createdAt: day(0, '13:00:00'),
    updatedAt: day(0, '13:00:00'),
    resolvedAt: null,
    messages: [
      {
        id: 'message-016',
        senderId: EMPLOYEE_USER_ID,
        senderRole: 'employee',
        message: 'Góp ý thêm widget cho dashboard.',
        createdAt: day(0, '13:00:00'),
      },
    ],
  },
]