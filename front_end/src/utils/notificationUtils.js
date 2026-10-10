/**
 * notificationUtils - tiện ích phục vụ Notification Management (Phần 14).
 *
 * - formatRelativeTime: Vừa xong / 5 phút trước / 2 giờ trước / Hôm qua / DD/MM/YYYY
 * - relatedEntityRoute: map tới route tương ứng với role.
 */

const PRETTY_TIME = new Intl.DateTimeFormat('vi-VN', {
  day: '2-digit',
  month: '2-digit',
  year: 'numeric',
  hour: '2-digit',
  minute: '2-digit',
})

const DATE_ONLY = new Intl.DateTimeFormat('vi-VN', {
  day: '2-digit',
  month: '2-digit',
  year: 'numeric',
})

/**
 * Trả về chuỗi tiếng Việt dễ đọc so với thời điểm hiện tại.
 *
 * @param {string|Date} value  ISO string hoặc Date object.
 * @param {Date} [now=new Date()]  thời điểm hiện tại (inject cho test).
 * @returns {string}
 */
export function formatRelativeTime(value, now = new Date()) {
  if (!value) return ''
  const d = value instanceof Date ? value : new Date(value)
  if (Number.isNaN(d.getTime())) return ''
  const diffMs = now.getTime() - d.getTime()
  if (diffMs < 0) return DATE_ONLY.format(d)
  const minute = 60 * 1000
  const hour = 60 * minute
  const day = 24 * hour
  if (diffMs < 30 * 1000) return 'Vừa xong'
  if (diffMs < hour) return `${Math.floor(diffMs / minute)} phút trước`
  if (diffMs < day) return `${Math.floor(diffMs / hour)} giờ trước`
  if (diffMs < 2 * day) return 'Hôm qua'
  if (diffMs < 7 * day) return `${Math.floor(diffMs / day)} ngày trước`
  return DATE_ONLY.format(d)
}

/**
 * Format thời gian đầy đủ DD/MM/YYYY HH:mm.
 */
export function formatFullDateTime(value) {
  if (!value) return ''
  const d = value instanceof Date ? value : new Date(value)
  if (Number.isNaN(d.getTime())) return ''
  return PRETTY_TIME.format(d)
}

const ENTITY_ROUTES = {
  leave: { admin: '/admin/leaves', employee: '/employee/leaves' },
  payroll: { admin: '/admin/payroll', employee: '/employee/payroll' },
  evaluation: { admin: '/admin/evaluations', employee: '/employee/evaluations' },
  training: { admin: '/admin/trainings', employee: '/employee/trainings' },
  benefit: { admin: '/admin/benefits', employee: '/employee/benefits' },
  contract: { admin: '/admin/contracts', employee: '/employee/contracts' },
  attendance: { admin: '/admin/attendance', employee: '/employee/attendance' },
}

export function relatedEntityRoute(type, role) {
  if (!type) return null
  const map = ENTITY_ROUTES[type]
  if (!map) return null
  return map[role] ?? null
}

export function relatedEntityLabel(type) {
  return {
    leave: 'đơn nghỉ phép',
    payroll: 'phiếu lương',
    evaluation: 'đánh giá hiệu suất',
    training: 'khóa đào tạo',
    benefit: 'phúc lợi',
    contract: 'hợp đồng',
    attendance: 'bảng chấm công',
  }[type] ?? 'liên quan'
}