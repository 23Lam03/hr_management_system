/**
 * benefitUtils - helpers cho module phúc lợi (Phần 12).
 */

import {
  BENEFIT_TYPES,
  BENEFIT_STATUSES,
  VALUE_UNITS,
} from '../data/benefitMockData'

/**
 * Validate payload Benefit (admin).
 */
export function validateBenefit(payload, { excludeId: _excludeId = null } = {}) {
  const errors = {}

  if (!payload.code?.trim()) {
    errors.code = 'Vui lòng nhập mã phúc lợi.'
  } else if (!/^[A-Za-z0-9_-]+$/.test(payload.code.trim())) {
    errors.code = 'Mã phúc lợi chỉ gồm chữ, số, gạch ngang và gạch dưới.'
  }

  if (!payload.name?.trim()) {
    errors.name = 'Tên phúc lợi không được để trống.'
  } else if (payload.name.trim().length < 3) {
    errors.name = 'Tên phúc lợi phải có ít nhất 3 ký tự.'
  }

  if (!payload.type || !BENEFIT_TYPES.find((t) => t.value === payload.type)) {
    errors.type = 'Vui lòng chọn loại phúc lợi.'
  }

  if (!payload.status || !BENEFIT_STATUSES.find((s) => s.value === payload.status)) {
    errors.status = 'Vui lòng chọn trạng thái.'
  }

  if (!payload.startDate) {
    errors.startDate = 'Vui lòng chọn ngày bắt đầu.'
  }
  if (payload.endDate && payload.startDate && payload.endDate < payload.startDate) {
    errors.endDate = 'Ngày kết thúc không được trước ngày bắt đầu.'
  }

  if (payload.value !== undefined && payload.value !== null && payload.value !== '') {
    const n = Number(payload.value)
    if (Number.isNaN(n)) {
      errors.value = 'Giá trị phải là số hợp lệ.'
    } else if (n < 0) {
      errors.value = 'Không cho phép giá trị âm.'
    }
  }

  if (payload.valueUnit && !VALUE_UNITS.find((u) => u.value === payload.valueUnit)) {
    errors.valueUnit = 'Đơn vị giá trị không hợp lệ.'
  }

  return errors
}

/**
 * Đếm số nhân viên đang active trên 1 benefit.
 */
export function getActiveAssignees(records = []) {
  return records.filter((r) => r.status === 'active').length
}

export function getExpiredAssignees(records = []) {
  return records.filter((r) => r.status === 'expired').length
}

export function getCancelledAssignees(records = []) {
  return records.filter((r) => r.status === 'cancelled').length
}

export function isAssigneeActive(r) {
  if (!r) return false
  if (r.status !== 'active') return false
  const today = new Date().toISOString().slice(0, 10)
  if (r.endDate && r.endDate < today) return false
  return true
}