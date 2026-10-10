/**
 * trainingUtils - helpers cho module đào tạo (Phần 11).
 */

import {
  TRAINING_CATEGORIES,
  TRAINING_FORMATS,
  TRAINING_STATUSES,
} from '../data/trainingMockData'

export const MIN_CAPACITY = 1
export const MAX_CAPACITY = 1000

/**
 * Validate payload khóa đào tạo.
 * Trả về object errors.
 *
 * @param {Object} payload
 * @param {string|null} excludeId - khi sửa, loại trừ khóa hiện tại khỏi check trùng code
 */
export function validateTraining(payload, { excludeId: _excludeId = null } = {}) {
  const errors = {}

  if (!payload.name?.trim()) {
    errors.name = 'Vui lòng nhập tên khóa đào tạo.'
  } else if (payload.name.trim().length < 5) {
    errors.name = 'Tên khóa đào tạo phải có ít nhất 5 ký tự.'
  }

  if (!payload.code?.trim()) {
    errors.code = 'Vui lòng nhập mã khóa học.'
  } else if (!/^[A-Za-z0-9_-]+$/.test(payload.code.trim())) {
    errors.code = 'Mã khóa học chỉ gồm chữ, số, gạch ngang và gạch dưới.'
  }

  if (!payload.category || !TRAINING_CATEGORIES.find((c) => c.value === payload.category)) {
    errors.category = 'Vui lòng chọn danh mục đào tạo.'
  }

  if (!payload.format || !TRAINING_FORMATS.find((f) => f.value === payload.format)) {
    errors.format = 'Vui lòng chọn hình thức đào tạo.'
  } else {
    // Nếu trực tuyến / kết hợp bắt buộc meetingUrl
    if ((payload.format === 'online' || payload.format === 'hybrid') && !payload.meetingUrl?.trim()) {
      errors.meetingUrl = 'Vui lòng nhập đường dẫn học trực tuyến.'
    }
    if ((payload.format === 'offline' || payload.format === 'hybrid') && !payload.location?.trim()) {
      errors.location = 'Vui lòng nhập địa điểm tổ chức.'
    }
  }

  if (!payload.instructor?.trim()) {
    errors.instructor = 'Vui lòng nhập tên giảng viên.'
  }

  if (!payload.startDate) {
    errors.startDate = 'Vui lòng chọn ngày bắt đầu.'
  }
  if (!payload.endDate) {
    errors.endDate = 'Vui lòng chọn ngày kết thúc.'
  }
  if (payload.startDate && payload.endDate && payload.endDate < payload.startDate) {
    errors.endDate = 'Ngày kết thúc không được trước ngày bắt đầu.'
  }
  if (!payload.registrationDeadline) {
    errors.registrationDeadline = 'Vui lòng chọn hạn đăng ký.'
  } else if (payload.startDate && payload.registrationDeadline > payload.startDate) {
    errors.registrationDeadline = 'Hạn đăng ký không được sau ngày bắt đầu.'
  }

  const capacity = Number(payload.capacity)
  if (!capacity || !Number.isInteger(capacity) || capacity < MIN_CAPACITY || capacity > MAX_CAPACITY) {
    errors.capacity = `Sức chứa phải là số nguyên từ ${MIN_CAPACITY} đến ${MAX_CAPACITY}.`
  }

  const duration = Number(payload.durationHours)
  if (!duration || duration <= 0) {
    errors.durationHours = 'Thời lượng phải lớn hơn 0 giờ.'
  } else if (duration > 1000) {
    errors.durationHours = 'Thời lượng không hợp lệ (>1000 giờ).'
  }

  if (!payload.status || !TRAINING_STATUSES.find((s) => s.value === payload.status)) {
    errors.status = 'Vui lòng chọn trạng thái khóa học.'
  }

  if (!payload.description?.trim()) {
    errors.description = 'Vui lòng nhập mô tả khóa học.'
  }

  return errors
}

/**
 * Validate payload cập nhật tiến độ / kết quả.
 */
export function validateParticipantProgress(payload) {
  const errors = {}

  if (payload.progress !== undefined && payload.progress !== null && payload.progress !== '') {
    const p = Number(payload.progress)
    if (Number.isNaN(p) || p < 0 || p > 100) {
      errors.progress = 'Tiến độ phải nằm trong khoảng 0–100%.'
    }
  }

  if (payload.score !== undefined && payload.score !== null && payload.score !== '') {
    const s = Number(payload.score)
    if (Number.isNaN(s) || s < 0 || s > 100) {
      errors.score = 'Điểm phải nằm trong khoảng 0–100.'
    }
  }

  return errors
}

/**
 * Đếm số đăng ký đang active (= không cancelled).
 */
export function getActiveParticipantsCount(participants = []) {
  return participants.filter((p) => p.registrationStatus !== 'cancelled').length
}

/**
 * Đếm số đã xác nhận.
 */
export function getConfirmedParticipantsCount(participants = []) {
  return participants.filter((p) => p.registrationStatus === 'confirmed').length
}

/**
 * Đếm số hoàn thành (learningStatus=completed).
 */
export function getCompletedParticipantsCount(participants = []) {
  return participants.filter((p) => p.learningStatus === 'completed').length
}

/**
 * Kiểm tra còn chỗ để đăng ký / thêm học viên.
 */
export function hasAvailableSlot(training, participants = []) {
  if (!training) return false
  const active = getActiveParticipantsCount(participants)
  return active < (training.capacity || 0)
}