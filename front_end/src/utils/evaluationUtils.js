/**
 * evaluationUtils - các hàm tiện ích cho module đánh giá hiệu suất.
 *
 * Quy tắc demo:
 * - Mỗi tiêu chí có trọng số bằng nhau (=1) theo mặc định.
 * - Điểm hợp lệ 1–5.
 * - averageScore = mean(scores) trên các tiêu chí có score > 0
 *   (chưa chấm coi như chưa có điểm).
 * - Hiển thị tối đa 2 chữ số thập phân.
 */

export const MIN_SCORE = 1
export const MAX_SCORE = 5

export function isValidScore(score) {
  const n = Number(score)
  if (Number.isNaN(n)) return false
  if (n < MIN_SCORE || n > MAX_SCORE) return false
  return true
}

/**
 * Tính điểm trung bình từ danh sách tiêu chí.
 * - Bỏ qua tiêu chí có score <= 0 hoặc không hợp lệ.
 * - Trả về 0 nếu không có tiêu chí hợp lệ nào.
 */
export function calcAverageScore(criteriaScores = []) {
  const valid = criteriaScores
    .map((c) => Number(c.score))
    .filter((v) => Number.isFinite(v) && v >= MIN_SCORE && v <= MAX_SCORE)
  if (!valid.length) return 0
  const mean = valid.reduce((s, v) => s + v, 0) / valid.length
  return Math.round(mean * 100) / 100
}

/**
 * Lấy danh sách tiêu chí đã được chấm hợp lệ (1–5).
 */
export function getScoredCriteria(criteriaScores = []) {
  return criteriaScores.filter((c) => isValidScore(c.score))
}

/**
 * Tiến độ hoàn thành cycle = số evaluation đã completed hoặc published
 * trên tổng số nhân viên thuộc cycle.
 */
export function getCycleProgress(cycle, evaluations = []) {
  if (!cycle) return { completed: 0, total: 0, percent: 0 }
  const total = evaluations.length
  const completed = evaluations.filter(
    (e) => e.status === 'completed' || e.status === 'published',
  ).length
  const percent = total === 0 ? 0 : Math.round((completed / total) * 100)
  return { completed, total, percent }
}

/**
 * Validate đầy đủ 1 bản đánh giá (dùng cho nút "Hoàn thành").
 * - Yêu cầu tất cả tiêu chí required phải có điểm 1–5.
 * - generalComment tối thiểu 10 ký tự.
 */
export function validateFullEvaluation(payload, criteria = []) {
  const errors = {}
  for (const c of criteria) {
    if (!c.required) continue
    const v = payload.criteriaScores?.find((cs) => cs.criteriaId === c.id)?.score
    if (!isValidScore(v)) {
      errors[`criteria.${c.id}`] = `Vui lòng chấm điểm cho "${c.name}".`
    }
  }
  if (!payload.generalComment?.trim() || payload.generalComment.trim().length < 10) {
    errors.generalComment = 'Vui lòng nhập nhận xét chung (tối thiểu 10 ký tự).'
  }
  if (!payload.strengths?.trim()) {
    errors.strengths = 'Vui lòng nhập điểm mạnh.'
  }
  if (!payload.improvements?.trim()) {
    errors.improvements = 'Vui lòng nhập điểm cần cải thiện.'
  }
  return errors
}

/**
 * Validate cycle. Trả về errors object.
 */
export function validateCycle(payload) {
  const errors = {}
  if (!payload.name?.trim()) {
    errors.name = 'Vui lòng nhập tên kỳ đánh giá.'
  } else if (payload.name.trim().length < 5) {
    errors.name = 'Tên kỳ đánh giá phải có ít nhất 5 ký tự.'
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
  if (!payload.status) {
    errors.status = 'Vui lòng chọn trạng thái kỳ đánh giá.'
  }
  return errors
}