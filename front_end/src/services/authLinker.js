/**
 * resolveEmployeeFromUser - liên kết tài khoản đăng nhập với nhân viên.
 *
 * Vì user.id trong demo (usr-admin-001, usr-emp-001) không trùng với
 * employeeId (emp-001, emp-002), ta tìm nhân viên theo email. Nếu tài
 * khoản chưa liên kết nhân viên, trả về null và UI sẽ hiển thị thông
 * báo rõ ràng.
 *
 * KHÔNG tự đoán người sở hữu đơn / phiếu lương - bắt buộc lookup.
 */

import { getEmployees } from './employeeService'

export function resolveEmployeeFromUser(user) {
  if (!user) return null
  const employees = getEmployees()
  // 1. Ưu tiên trùng email
  const byEmail = employees.find(
    (e) => e.email && user.email && e.email.toLowerCase() === user.email.toLowerCase(),
  )
  if (byEmail) return byEmail
  // 2. Nếu user.id trùng employeeId (phòng trường hợp backend gắn sẵn)
  const byId = employees.find((e) => e.id === user.id)
  if (byId) return byId
  return null
}