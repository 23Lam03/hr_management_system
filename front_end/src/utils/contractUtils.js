/**
 * contractUtils - helpers cho module hợp đồng (Phần 13).
 */

import { CONTRACT_TYPES, CONTRACT_STATUSES } from '../data/contractMockData'

/**
 * Validate payload Contract (admin).
 */
export function validateContract(payload, { excludeId: _excludeId = null } = {}) {
  const errors = {}

  if (!payload.employeeId) {
    errors.employeeId = 'Vui lòng chọn nhân viên.'
  }

  if (!payload.contractCode?.trim()) {
    errors.contractCode = 'Vui lòng nhập mã hợp đồng.'
  } else if (!/^[A-Za-z0-9_-]+$/.test(payload.contractCode.trim())) {
    errors.contractCode = 'Mã hợp đồng chỉ gồm chữ, số, gạch ngang và gạch dưới.'
  }

  if (!payload.contractType || !CONTRACT_TYPES.find((t) => t.value === payload.contractType)) {
    errors.contractType = 'Vui lòng chọn loại hợp đồng.'
  }

  if (!payload.signedDate) {
    errors.signedDate = 'Vui lòng chọn ngày ký.'
  }
  if (!payload.effectiveDate) {
    errors.effectiveDate = 'Ngày hiệu lực không được để trống.'
  } else if (payload.signedDate && payload.effectiveDate < payload.signedDate) {
    // Cho phép effective trước ký (1 số trường hợp) - chỉ cảnh báo
    // Nhưng ở đây ta KHÔNG bắt buộc vì có thể do lịch sử.
  }

  if (payload.expiryDate && payload.effectiveDate && payload.expiryDate < payload.effectiveDate) {
    errors.expiryDate = 'Ngày hết hạn không được trước ngày hiệu lực.'
  }

  // Với HĐ không xác định thời hạn → không bắt buộc expiryDate
  // Với HĐ có thời hạn → vẫn có thể để trống (HĐ thử việc có thể không ghi trước)
  // → Không bắt buộc expiryDate ở đây.

  if (!payload.status || !CONTRACT_STATUSES.find((s) => s.value === payload.status)) {
    errors.status = 'Vui lòng chọn trạng thái.'
  }

  return errors
}

/**
 * Validate gia hạn.
 */
export function validateExtension(payload, currentExpiryDate) {
  const errors = {}
  if (!payload.newExpiryDate) {
    errors.newExpiryDate = 'Vui lòng chọn ngày hết hạn mới.'
  } else if (currentExpiryDate && payload.newExpiryDate <= currentExpiryDate) {
    errors.newExpiryDate = 'Ngày hết hạn mới phải sau ngày hết hạn hiện tại.'
  }
  return errors
}

/**
 * Tính số ngày giữa 2 ngày (chỉ phần date).
 * Trả về số ngày còn lại (dương nếu target > today; 0 nếu trùng; null nếu thiếu ngày).
 */
export function daysBetween(fromIso, toIso) {
  if (!fromIso || !toIso) return null
  const a = new Date(fromIso)
  const b = new Date(toIso)
  if (Number.isNaN(a.getTime()) || Number.isNaN(b.getTime())) return null
  const ms = b.setHours(0, 0, 0, 0) - a.setHours(0, 0, 0, 0)
  return Math.round(ms / (1000 * 60 * 60 * 24))
}

/**
 * Tính số ngày từ hôm nay tới expiryDate.
 */
export function daysUntil(expiryDate) {
  return daysBetween(new Date().toISOString().slice(0, 10), expiryDate)
}

/**
 * Hợp đồng "sắp hết hạn": còn ≤ thresholdDays, đang active, có expiryDate.
 */
export function isExpiringSoon(contract, thresholdDays = 30) {
  if (!contract || contract.status !== 'active' || !contract.expiryDate) return false
  const days = daysUntil(contract.expiryDate)
  return days !== null && days >= 0 && days <= thresholdDays
}