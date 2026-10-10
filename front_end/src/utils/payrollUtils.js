/**
 * payrollUtils - các hàm tính toán tiền lương demo.
 *
 * Công thức MINH HOẠ (KHÔNG phải công thức thuế / BHXH thật tại Việt Nam):
 *   grossSalary    = baseSalary + allowance + bonus + overtimePay
 *   totalDeduction = insuranceDeduction + taxDeduction + otherDeduction
 *   netSalary      = grossSalary - totalDeduction
 *
 * Lưu ý:
 * - Không làm tròn nhiều lần trong quá trình tính.
 * - Khi nghiệp vụ chính thức (thuế TNCN, BHXH, BHYT, BHTN...) được phê
 *   duyệt, hàm calcPayroll() là nơi duy nhất cần cập nhật.
 */

/** Chuẩn hoá input tiền về số nguyên >= 0. Trả về null nếu NaN. */
function toNonNegativeNumber(value) {
  if (value === null || value === undefined || value === '') return 0
  const n = Number(value)
  if (Number.isNaN(n)) return null
  return Math.max(0, Math.round(n))
}

/** Chuẩn hoá về số (cho phép âm nếu cần, vd các khoản cần cho phép âm). */
function toNumber(value) {
  if (value === null || value === undefined || value === '') return 0
  const n = Number(value)
  if (Number.isNaN(n)) return null
  return n
}

/**
 * Tính lại các trường tổng dựa trên các thành phần.
 * - Các giá trị đầu vào phải là số hợp lệ.
 * - Trả về object { grossSalary, totalDeduction, netSalary } dưới dạng số.
 */
export function calcPayroll({
  baseSalary = 0,
  allowance = 0,
  bonus = 0,
  overtimePay = 0,
  insuranceDeduction = 0,
  taxDeduction = 0,
  otherDeduction = 0,
} = {}) {
  const base = toNumber(baseSalary) ?? 0
  const allow = toNumber(allowance) ?? 0
  const bn = toNumber(bonus) ?? 0
  const ot = toNumber(overtimePay) ?? 0
  const ins = toNumber(insuranceDeduction) ?? 0
  const tax = toNumber(taxDeduction) ?? 0
  const other = toNumber(otherDeduction) ?? 0

  const gross = base + allow + bn + ot
  const deduction = ins + tax + other
  const net = gross - deduction
  return {
    grossSalary: Math.round(gross),
    totalDeduction: Math.round(deduction),
    netSalary: Math.round(net),
  }
}

/** Chuẩn hoá toàn bộ payload payroll (áp dụng quy tắc nhập liệu demo). */
export function normalizePayrollPayload(payload = {}) {
  return {
    baseSalary: toNonNegativeNumber(payload.baseSalary) ?? 0,
    allowance: toNonNegativeNumber(payload.allowance) ?? 0,
    bonus: toNonNegativeNumber(payload.bonus) ?? 0,
    overtimePay: toNonNegativeNumber(payload.overtimePay) ?? 0,
    insuranceDeduction: toNonNegativeNumber(payload.insuranceDeduction) ?? 0,
    taxDeduction: toNonNegativeNumber(payload.taxDeduction) ?? 0,
    otherDeduction: toNonNegativeNumber(payload.otherDeduction) ?? 0,
  }
}

/** Validate lương thực nhận có hợp lệ không (không âm, không quá lớn). */
export function isNetSalaryValid({ grossSalary, totalDeduction }) {
  if (!Number.isFinite(grossSalary) || !Number.isFinite(totalDeduction)) return false
  const net = grossSalary - totalDeduction
  if (net < 0) return false
  return true
}

/** Lấy tổng quỹ lương các record đã cho. */
export function sumNetSalary(records = []) {
  return records.reduce((acc, r) => acc + (Number(r?.netSalary) || 0), 0)
}

/** Trả về danh sách tháng/năm có payroll (để build dropdown kỳ lương). */
export function listPayrollPeriods(records = []) {
  const set = new Set()
  for (const r of records) {
    if (r?.month && r?.year) {
      set.add(`${r.year}-${String(r.month).padStart(2, '0')}`)
    }
  }
  return Array.from(set).sort().reverse()
}

/** Validate dữ liệu tiền - cho phép 0 và số nguyên dương. */
export function isValidMoney(value) {
  if (value === '' || value === null || value === undefined) return false
  const n = Number(value)
  if (Number.isNaN(n)) return false
  if (n < 0) return false
  return true
}