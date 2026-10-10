/**
 * Mock data cho Quản lý phúc lợi (Phần 12).
 *
 * Quy tắc:
 * - Benefit tham chiếu employeeId từ employeeMockData (emp-001 ... emp-015).
 * - KHÔNG random. Toàn bộ dữ liệu cố định tại đây.
 * - Trạng thái Benefit: draft | active | paused | expired.
 * - Trạng thái EmployeeBenefit: active | expired | cancelled.
 * - Giá trị phúc lợi (value) là dữ liệu minh hoạ; KHÔNG phải tỷ lệ / mức
 *   bảo hiểm / phụ cấp theo quy định pháp luật.
 */

export const BENEFIT_TYPES = [
  { value: 'insurance', label: 'Bảo hiểm' },
  { value: 'allowance', label: 'Phụ cấp' },
  { value: 'healthcare', label: 'Chăm sóc sức khỏe' },
  { value: 'training',   label: 'Hỗ trợ đào tạo' },
  { value: 'welfare',    label: 'Phúc lợi khác' },
]

export const BENEFIT_TYPE_LABEL = BENEFIT_TYPES.reduce((acc, t) => {
  acc[t.value] = t.label
  return acc
}, {})

export const BENEFIT_STATUSES = [
  { value: 'draft',   label: 'Bản nháp',      tone: 'inactive' },
  { value: 'active',  label: 'Đang hoạt động', tone: 'success' },
  { value: 'paused',  label: 'Tạm dừng',       tone: 'warning' },
  { value: 'expired', label: 'Hết hạn',        tone: 'neutral' },
]

export const BENEFIT_STATUS_LABEL = BENEFIT_STATUSES.reduce((acc, s) => {
  acc[s.value] = s.label
  return acc
}, {})

export const EMPLOYEE_BENEFIT_STATUSES = [
  { value: 'active',    label: 'Đang hưởng',  tone: 'success' },
  { value: 'expired',   label: 'Đã hết hạn',  tone: 'neutral' },
  { value: 'cancelled', label: 'Đã hủy',      tone: 'inactive' },
]

export const EMPLOYEE_BENEFIT_STATUS_LABEL = EMPLOYEE_BENEFIT_STATUSES.reduce((acc, s) => {
  acc[s.value] = s.label
  return acc
}, {})

export const VALUE_UNITS = [
  { value: 'vnd_month', label: 'VNĐ / tháng' },
  { value: 'vnd_year',  label: 'VNĐ / năm' },
  { value: 'percent',   label: '% lương' },
  { value: 'times',     label: 'Lần / năm' },
  { value: 'fixed',     label: 'Giá trị cố định' },
]

export const VALUE_UNIT_LABEL = VALUE_UNITS.reduce((acc, u) => {
  acc[u.value] = u.label
  return acc
}, {})

/**
 * Seed chương trình phúc lợi.
 */
export const BENEFITS = [
  {
    id: 'bn-001',
    code: 'PL-001',
    name: 'Bảo hiểm sức khỏe toàn diện',
    type: 'insurance',
    description: 'Chương trình bảo hiểm sức khỏe nhóm cho nhân viên và người phụ thuộc. Đây là dữ liệu demo.',
    value: 1500000,
    valueUnit: 'vnd_month',
    eligibility: 'Toàn thời gian, sau khi ký hợp đồng chính thức (dữ liệu minh hoạ).',
    startDate: '2026-01-01',
    endDate: '2026-12-31',
    status: 'active',
    departmentIds: [],
    createdAt: '2025-12-01T08:00:00+07:00',
    updatedAt: '2026-09-30T09:00:00+07:00',
  },
  {
    id: 'bn-002',
    code: 'PL-002',
    name: 'Phụ cấp ăn trưa',
    type: 'allowance',
    description: 'Phụ cấp ăn trưa hàng tháng cho nhân viên văn phòng. Đây là dữ liệu demo.',
    value: 800000,
    valueUnit: 'vnd_month',
    eligibility: 'Nhân viên chính thức làm việc tại văn phòng (minh hoạ).',
    startDate: '2026-01-01',
    endDate: '2026-12-31',
    status: 'active',
    departmentIds: [],
    createdAt: '2025-12-01T08:00:00+07:00',
    updatedAt: '2026-09-30T09:00:00+07:00',
  },
  {
    id: 'bn-003',
    code: 'PL-003',
    name: 'Phụ cấp đi lại',
    type: 'allowance',
    description: 'Phụ cấp đi lại cho nhân viên thuộc phòng Kinh doanh & Marketing. Dữ liệu minh hoạ.',
    value: 500000,
    valueUnit: 'vnd_month',
    eligibility: 'Nhân viên phòng Kinh doanh / Marketing (minh hoạ).',
    startDate: '2026-01-01',
    endDate: '2026-12-31',
    status: 'active',
    departmentIds: ['dept-sales', 'dept-mkt'],
    createdAt: '2025-12-01T08:00:00+07:00',
    updatedAt: '2026-09-30T09:00:00+07:00',
  },
  {
    id: 'bn-004',
    code: 'PL-004',
    name: 'Khám sức khỏe định kỳ',
    type: 'healthcare',
    description: 'Khám sức khỏe định kỳ 1 lần/năm cho nhân viên. Dữ liệu demo.',
    value: 1,
    valueUnit: 'times',
    eligibility: 'Toàn bộ nhân viên chính thức (minh hoạ).',
    startDate: '2026-06-01',
    endDate: '2026-11-30',
    status: 'active',
    departmentIds: [],
    createdAt: '2026-05-15T10:00:00+07:00',
    updatedAt: '2026-09-30T09:00:00+07:00',
  },
  {
    id: 'bn-005',
    code: 'PL-005',
    name: 'Hỗ trợ đào tạo ngoại khóa',
    type: 'training',
    description: 'Hỗ trợ chi phí tham gia khóa học bên ngoài. Dữ liệu demo.',
    value: 5000000,
    valueUnit: 'vnd_year',
    eligibility: 'Nhân viên chính thức có thâm niên ≥ 6 tháng (minh hoạ).',
    startDate: '2026-01-01',
    endDate: '2026-12-31',
    status: 'active',
    departmentIds: [],
    createdAt: '2025-12-01T08:00:00+07:00',
    updatedAt: '2026-09-30T09:00:00+07:00',
  },
  {
    id: 'bn-006',
    code: 'PL-006',
    name: 'Quà sinh nhật',
    type: 'welfare',
    description: 'Quà tặng sinh nhật cho nhân viên. Dữ liệu demo.',
    value: 500000,
    valueUnit: 'fixed',
    eligibility: 'Áp dụng cho toàn bộ nhân viên (minh hoạ).',
    startDate: '2026-01-01',
    endDate: '2026-12-31',
    status: 'active',
    departmentIds: [],
    createdAt: '2025-12-01T08:00:00+07:00',
    updatedAt: '2026-09-30T09:00:00+07:00',
  },
]

/**
 * Seed EmployeeBenefit (gán phúc lợi cho nhân viên).
 * - id format: bn-001-emp-001 (mỗi cặp là 1 record)
 * - Đã bao gồm cancelled + expired để demo summary stats.
 */
export const EMPLOYEE_BENEFITS = [
  // bn-001 - Bảo hiểm sức khỏe: gán 7 nhân viên
  ...seedAssign('bn-001', ['emp-001', 'emp-002', 'emp-005', 'emp-008', 'emp-009', 'emp-011', 'emp-014'], '2026-01-01', '2026-12-31', 'active', 'usr-admin-001', 'Bảo hiểm nhóm'),

  // bn-002 - Phụ cấp ăn trưa: 8 nhân viên
  ...seedAssign('bn-002', ['emp-001', 'emp-002', 'emp-003', 'emp-005', 'emp-008', 'emp-009', 'emp-011', 'emp-013'], '2026-01-01', '2026-12-31', 'active', 'usr-admin-001', ''),

  // bn-003 - Phụ cấp đi lại: phòng sales & mkt
  ...seedAssign('bn-003', ['emp-003', 'emp-008', 'emp-009'], '2026-01-01', '2026-12-31', 'active', 'usr-admin-001', ''),

  // bn-004 - Khám sức khỏe: 5 nhân viên (1 expired)
  ...seedAssign('bn-004', ['emp-001', 'emp-005', 'emp-008', 'emp-009'], '2026-06-01', '2026-11-30', 'active', 'usr-admin-001', ''),
  ...seedAssign('bn-004', ['emp-010'], '2026-06-01', '2026-06-30', 'expired', 'usr-admin-001', 'Đợt khám 1'),

  // bn-005 - Hỗ trợ đào tạo: 2 nhân viên
  ...seedAssign('bn-005', ['emp-005', 'emp-008'], '2026-01-01', '2026-12-31', 'active', 'usr-admin-001', ''),

  // bn-006 - Quà sinh nhật: gán cho nhiều người (1 cancelled)
  ...seedAssign('bn-006', ['emp-001', 'emp-002', 'emp-005', 'emp-008'], '2026-01-01', '2026-12-31', 'active', 'usr-admin-001', ''),
  ...seedAssign('bn-006', ['emp-003'], '2026-01-01', '2026-12-31', 'cancelled', 'usr-admin-001', 'NV đã nghỉ việc'),
]

function seedAssign(benefitId, employeeIds, startDate, endDate, status, assignedBy, note) {
  return employeeIds.map((employeeId, idx) => ({
    id: `${benefitId}-${employeeId}-${idx}`,
    benefitId,
    employeeId,
    startDate,
    endDate,
    status,
    note,
    assignedBy,
    assignedAt: `${startDate}T${String(9 + (idx % 8)).padStart(2, '0')}:00:00+07:00`,
  }))
}