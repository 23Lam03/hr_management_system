/**
 * Mock data cho Notification Management (Phần 14).
 *
 * Quy tụ:
 * - recipientId tham chiếu về user id từ authMockData
 *   (usr-admin-001, usr-emp-001) hoặc employee id (emp-001...).
 * - Các relatedEntityId chỉ mang giá trị minh hoạ; module Notifications không
 *   kiểm tra sự tồn tại của các entity này ở runtime.
 */

export const NOTIFICATION_TYPES = [
  { value: 'system',     label: 'Hệ thống' },
  { value: 'leave',      label: 'Nghỉ phép' },
  { value: 'payroll',    label: 'Bảng lương' },
  { value: 'evaluation', label: 'Đánh giá' },
  { value: 'training',   label: 'Đào tạo' },
  { value: 'benefit',    label: 'Phúc lợi' },
  { value: 'contract',   label: 'Hợp đồng' },
  { value: 'attendance', label: 'Chấm công' },
]

export const NOTIFICATION_TYPE_LABEL = NOTIFICATION_TYPES.reduce((acc, t) => {
  acc[t.value] = t.label
  return acc
}, {})

export const NOTIFICATION_PRIORITIES = [
  { value: 'low',    label: 'Thấp',       tone: 'neutral' },
  { value: 'normal', label: 'Bình thường', tone: 'info' },
  { value: 'high',   label: 'Cao',         tone: 'danger' },
]

export const NOTIFICATION_PRIORITY_LABEL = NOTIFICATION_PRIORITIES.reduce((acc, p) => {
  acc[p.value] = p.label
  return acc
}, {})

export const NOTIFICATION_PRIORITY_TONE = NOTIFICATION_PRIORITIES.reduce((acc, p) => {
  acc[p.value] = p.tone
  return acc
}, {})

const day = (offset, time = '08:30:00') => {
  const d = new Date('2026-10-02T00:00:00+07:00')
  d.setDate(d.getDate() - offset)
  const [h, m, s] = time.split(':')
  d.setHours(Number(h), Number(m), Number(s))
  return d.toISOString()
}

const minutes = (n) => {
  const d = new Date('2026-10-02T08:30:00+07:00')
  d.setMinutes(d.getMinutes() - n)
  return d.toISOString()
}

export const NOTIFICATIONS = [
  // Admin (recipient = usr-admin-001)
  {
    id: 'notification-001',
    title: 'Đơn nghỉ phép mới',
    message: 'Trần Quốc Bảo vừa gửi đơn nghỉ phép 2 ngày, cần phê duyệt.',
    type: 'leave',
    priority: 'normal',
    recipientType: 'admin',
    recipientId: 'usr-admin-001',
    relatedEntityType: 'leave',
    relatedEntityId: 'leave-001',
    isRead: false,
    createdAt: minutes(5),
    readAt: null,
  },
  {
    id: 'notification-002',
    title: 'Bảng lương tháng 09/2026 đã sẵn sàng',
    message: 'Đã có thể tạo và phê duyệt bảng lương cho 15 nhân viên.',
    type: 'payroll',
    priority: 'high',
    recipientType: 'admin',
    recipientId: 'usr-admin-001',
    relatedEntityType: 'payroll',
    relatedEntityId: 'payroll-2026-09',
    isRead: false,
    createdAt: minutes(60),
    readAt: null,
  },
  {
    id: 'notification-003',
    title: 'Đánh giá KPI quý 3 sắp đến hạn',
    message: 'Vòng đánh giá Q3 sẽ đóng vào ngày 10/10.',
    type: 'evaluation',
    priority: 'normal',
    recipientType: 'admin',
    recipientId: 'usr-admin-001',
    relatedEntityType: 'evaluation',
    relatedEntityId: 'cycle-q3-2026',
    isRead: true,
    createdAt: day(1),
    readAt: day(1, '10:15:00'),
  },
  {
    id: 'notification-004',
    title: 'Hợp đồng sắp hết hạn',
    message: 'HĐ của Trần Quốc Bảo hết hạn trong 30 ngày.',
    type: 'contract',
    priority: 'high',
    recipientType: 'admin',
    recipientId: 'usr-admin-001',
    relatedEntityType: 'contract',
    relatedEntityId: 'ct-003',
    isRead: false,
    createdAt: day(0, '07:00:00'),
    readAt: null,
  },
  {
    id: 'notification-005',
    title: 'Bảo trì hệ thống',
    message: 'Hệ thống sẽ bảo trì từ 02:00 - 03:00 ngày 05/10.',
    type: 'system',
    priority: 'low',
    recipientType: 'admin',
    recipientId: 'usr-admin-001',
    relatedEntityType: null,
    relatedEntityId: null,
    isRead: true,
    createdAt: day(3),
    readAt: day(3, '09:00:00'),
  },
  {
    id: 'notification-006',
    title: 'Đăng ký đào tạo mới',
    message: 'Có 3 nhân viên đăng ký khóa "React nâng cao & Patterns".',
    type: 'training',
    priority: 'low',
    recipientType: 'admin',
    recipientId: 'usr-admin-001',
    relatedEntityType: 'training',
    relatedEntityId: 'tc-002',
    isRead: false,
    createdAt: day(0, '09:00:00'),
    readAt: null,
  },

  // Employee (recipient = usr-emp-001 / emp-002)
  {
    id: 'notification-101',
    title: 'Đơn nghỉ phép đã được duyệt',
    message: 'Đơn nghỉ phép của bạn đã được phê duyệt bởi Admin.',
    type: 'leave',
    priority: 'normal',
    recipientType: 'employee',
    recipientId: 'usr-emp-001',
    relatedEntityType: 'leave',
    relatedEntityId: 'leave-001',
    isRead: false,
    createdAt: minutes(5),
    readAt: null,
  },
  {
    id: 'notification-102',
    title: 'Bảng lương tháng 09/2026 đã được cập nhật',
    message: 'Phiếu lương tháng 09 đã có. Vui lòng kiểm tra.',
    type: 'payroll',
    priority: 'normal',
    recipientType: 'employee',
    recipientId: 'usr-emp-001',
    relatedEntityType: 'payroll',
    relatedEntityId: 'payroll-emp-002-2026-09',
    isRead: false,
    createdAt: minutes(120),
    readAt: null,
  },
  {
    id: 'notification-103',
    title: 'Kết quả đánh giá hiệu suất',
    message: 'Kết quả đánh giá Q3 đã được công bố.',
    type: 'evaluation',
    priority: 'normal',
    recipientType: 'employee',
    recipientId: 'usr-emp-001',
    relatedEntityType: 'evaluation',
    relatedEntityId: 'eval-emp-002-q3',
    isRead: true,
    createdAt: day(1),
    readAt: day(1, '14:00:00'),
  },
  {
    id: 'notification-104',
    title: 'Khóa đào tạo mới mở đăng ký',
    message: 'Khóa "Kỹ năng giao tiếp và thuyết trình" đang mở đăng ký.',
    type: 'training',
    priority: 'normal',
    recipientType: 'employee',
    recipientId: 'usr-emp-001',
    relatedEntityType: 'training',
    relatedEntityId: 'tc-001',
    isRead: false,
    createdAt: day(0, '08:00:00'),
    readAt: null,
  },
  {
    id: 'notification-105',
    title: 'Phúc lợi mới',
    message: 'Bạn vừa được gán phúc lợi "Khám sức khỏe định kỳ".',
    type: 'benefit',
    priority: 'low',
    recipientType: 'employee',
    recipientId: 'usr-emp-001',
    relatedEntityType: 'benefit',
    relatedEntityId: 'bn-004',
    isRead: true,
    createdAt: day(2),
    readAt: day(2, '11:00:00'),
  },
  {
    id: 'notification-106',
    title: 'Hợp đồng sắp hết hạn',
    message: 'Hợp đồng của bạn sắp hết hạn trong 30 ngày.',
    type: 'contract',
    priority: 'high',
    recipientType: 'employee',
    recipientId: 'usr-emp-001',
    relatedEntityType: 'contract',
    relatedEntityId: 'ct-003',
    isRead: false,
    createdAt: day(0, '07:00:00'),
    readAt: null,
  },
  {
    id: 'notification-107',
    title: 'Chấm công tháng 09',
    message: 'Bảng chấm công tháng 09 đã được cập nhật.',
    type: 'attendance',
    priority: 'low',
    recipientType: 'employee',
    recipientId: 'usr-emp-001',
    relatedEntityType: 'attendance',
    relatedEntityId: 'attendance-emp-002-2026-09',
    isRead: true,
    createdAt: day(2),
    readAt: day(2, '17:00:00'),
  },
  {
    id: 'notification-108',
    title: 'Đơn nghỉ phép bị từ chối',
    message: 'Đơn nghỉ phép ngày 15/10 không được duyệt.',
    type: 'leave',
    priority: 'normal',
    recipientType: 'employee',
    recipientId: 'usr-emp-001',
    relatedEntityType: 'leave',
    relatedEntityId: 'leave-002',
    isRead: false,
    createdAt: day(0, '11:30:00'),
    readAt: null,
  },
  {
    id: 'notification-109',
    title: 'Thông báo bảo trì',
    message: 'Hệ thống sẽ bảo trì từ 02:00 - 03:00 ngày 05/10.',
    type: 'system',
    priority: 'low',
    recipientType: 'employee',
    recipientId: 'usr-emp-001',
    relatedEntityType: null,
    relatedEntityId: null,
    isRead: true,
    createdAt: day(3),
    readAt: day(3, '09:00:00'),
  },
]