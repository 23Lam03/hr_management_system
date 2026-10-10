/**
 * Mock data cho Quản lý nghỉ phép (Phần 7).
 *
 * Quy tắc:
 * - Dữ liệu nhân viên + phòng ban được TÁI SỬ DỤNG từ employeeMockData.js.
 *   KHÔNG copy danh sách nhân viên sang file này.
 * - Không random mỗi lần render.
 * - requestCode là string duy nhất, format `LR-YYYYMMDD-XXXX`.
 */

export const LEAVE_TYPES = [
  { value: 'annual',     label: 'Nghỉ phép năm' },
  { value: 'sick',       label: 'Nghỉ ốm' },
  { value: 'personal',   label: 'Nghỉ việc riêng' },
  { value: 'unpaid',     label: 'Nghỉ không hưởng lương' },
  { value: 'other',      label: 'Loại khác' },
]

export const LEAVE_TYPE_LABEL = LEAVE_TYPES.reduce((acc, t) => {
  acc[t.value] = t.label
  return acc
}, {})

// startSession / endSession: 'morning' | 'afternoon' | 'full'
// 'full' = cả ngày. Nếu sau này không hỗ trợ nghỉ nửa ngày, xoá các giá trị
// này khỏi form, KHÔNG bỏ trường để tránh vỡ dữ liệu cũ.
export const LEAVE_SESSIONS = [
  { value: 'full',      label: 'Cả ngày' },
  { value: 'morning',   label: 'Buổi sáng' },
  { value: 'afternoon', label: 'Buổi chiều' },
]

export const LEAVE_STATUSES = [
  { value: 'pending',  label: 'Chờ duyệt', tone: 'pending' },
  { value: 'approved', label: 'Đã duyệt',  tone: 'approved' },
  { value: 'rejected', label: 'Từ chối',   tone: 'rejected' },
  { value: 'cancelled',label: 'Đã hủy',    tone: 'inactive' },
]

export const LEAVE_STATUS_LABEL = LEAVE_STATUSES.reduce((acc, s) => {
  acc[s.value] = s.label
  return acc
}, {})

/**
 * Hạn mức nghỉ phép minh hoạ (Phần 10).
 * Lưu ý: Đây là dữ liệu minh hoạ cho UI. Khi có chính sách phép năm
 * chính thức từ phòng nhân sự, cập nhật lại tại đây.
 *
 * Quy ước:
 *  - annualTotal: tổng ngày phép năm được cấp trong năm (mặc định 12 ngày).
 *  - Chỉ tính số ngày đã approved (totalDays) vào "đã sử dụng".
 *  - "Còn lại" chỉ mang tính tham khảo, không dùng để trừ phép thực tế.
 */
export const LEAVE_BALANCE_DEMO = {
  annualTotal: 12,
  unit: 'ngày',
}

/**
 * Seed đơn nghỉ phép (mở rộng từ 5 đơn có sẵn trong dashboardMockData).
 *
 * Lưu ý:
 * - Gắn với employeeId thực tế từ employeeMockData (emp-001 ... emp-015).
 * - KHÔNG tự ý trừ phép năm - chính sách số dư phép năm chưa được xác
 *   định nên chỉ lưu totalDays, không lưu "số dư còn lại".
 * - Mỗi seed có sẵn `history` ghi nhận lịch sử trạng thái phục vụ
 *   Phần 10. Đơn pending chỉ có 1 entry (gửi), đơn approved/rejected/
 *   cancelled có thêm entry tương ứng.
 */
function buildHistory(items) {
  return items
}

const SUBMITTER_HISTORY = ({ requestCode, employeeId, createdAt }) => [
  {
    fromStatus: null,
    toStatus: 'pending',
    actorId: employeeId,
    actorName: 'Nhân viên',
    timestamp: createdAt,
    note: `Tạo đơn ${requestCode}`,
  },
]

export const LEAVE_REQUESTS = [
  // Đã duyệt
  {
    id: 'lr-001',
    requestCode: 'LR-20260918-0001',
    employeeId: 'emp-002',
    leaveType: 'annual',
    startDate: '2026-09-20',
    endDate: '2026-09-22',
    startSession: 'full',
    endSession: 'full',
    totalDays: 3,
    reason: 'Nghỉ ngơi cùng gia đình.',
    status: 'approved',
    approverId: 'emp-001',
    approverName: 'Nguyễn Minh Anh',
    reviewedAt: '2026-09-19T09:30:00+07:00',
    rejectionReason: '',
    createdAt: '2026-09-18T08:30:00+07:00',
    updatedAt: '2026-09-19T09:30:00+07:00',
    history: buildHistory([
      ...SUBMITTER_HISTORY({ requestCode: 'LR-20260918-0001', employeeId: 'emp-002', createdAt: '2026-09-18T08:30:00+07:00' }),
      { fromStatus: 'pending', toStatus: 'approved', actorId: 'emp-001', actorName: 'Nguyễn Minh Anh', timestamp: '2026-09-19T09:30:00+07:00', note: 'Đồng ý nghỉ phép năm.' },
    ]),
  },
  {
    id: 'lr-002',
    requestCode: 'LR-20260915-0002',
    employeeId: 'emp-002',
    leaveType: 'sick',
    startDate: '2026-09-15',
    endDate: '2026-09-16',
    startSession: 'full',
    endSession: 'full',
    totalDays: 2,
    reason: 'Cảm cúm, có giấy khám bác sĩ.',
    status: 'approved',
    approverId: 'emp-001',
    approverName: 'Nguyễn Minh Anh',
    reviewedAt: '2026-09-15T10:00:00+07:00',
    rejectionReason: '',
    createdAt: '2026-09-15T07:30:00+07:00',
    updatedAt: '2026-09-15T10:00:00+07:00',
    history: buildHistory([
      ...SUBMITTER_HISTORY({ requestCode: 'LR-20260915-0002', employeeId: 'emp-002', createdAt: '2026-09-15T07:30:00+07:00' }),
      { fromStatus: 'pending', toStatus: 'approved', actorId: 'emp-001', actorName: 'Nguyễn Minh Anh', timestamp: '2026-09-15T10:00:00+07:00', note: 'Chúc bạn mau khoẻ.' },
    ]),
  },
  {
    id: 'lr-003',
    requestCode: 'LR-20260918-0003',
    employeeId: 'emp-007',
    leaveType: 'annual',
    startDate: '2026-09-20',
    endDate: '2026-09-22',
    startSession: 'full',
    endSession: 'full',
    totalDays: 3,
    reason: 'Nghỉ ngơi sau dự án.',
    status: 'approved',
    approverId: 'emp-001',
    approverName: 'Nguyễn Minh Anh',
    reviewedAt: '2026-09-19T11:00:00+07:00',
    rejectionReason: '',
    createdAt: '2026-09-18T14:00:00+07:00',
    updatedAt: '2026-09-19T11:00:00+07:00',
    history: buildHistory([
      ...SUBMITTER_HISTORY({ requestCode: 'LR-20260918-0003', employeeId: 'emp-007', createdAt: '2026-09-18T14:00:00+07:00' }),
      { fromStatus: 'pending', toStatus: 'approved', actorId: 'emp-001', actorName: 'Nguyễn Minh Anh', timestamp: '2026-09-19T11:00:00+07:00', note: 'Duyệt.' },
    ]),
  },
  {
    id: 'lr-004',
    requestCode: 'LR-20260805-0004',
    employeeId: 'emp-005',
    leaveType: 'annual',
    startDate: '2026-08-12',
    endDate: '2026-08-14',
    startSession: 'full',
    endSession: 'full',
    totalDays: 3,
    reason: 'Về quê thăm gia đình.',
    status: 'approved',
    approverId: 'emp-006',
    approverName: 'Ngô Hải Đăng',
    reviewedAt: '2026-08-08T08:45:00+07:00',
    rejectionReason: '',
    createdAt: '2026-08-05T09:00:00+07:00',
    updatedAt: '2026-08-08T08:45:00+07:00',
    history: buildHistory([
      ...SUBMITTER_HISTORY({ requestCode: 'LR-20260805-0004', employeeId: 'emp-005', createdAt: '2026-08-05T09:00:00+07:00' }),
      { fromStatus: 'pending', toStatus: 'approved', actorId: 'emp-006', actorName: 'Ngô Hải Đăng', timestamp: '2026-08-08T08:45:00+07:00', note: 'Đồng ý.' },
    ]),
  },

  // Từ chối
  {
    id: 'lr-005',
    requestCode: 'LR-20260910-0005',
    employeeId: 'emp-010',
    leaveType: 'personal',
    startDate: '2026-09-12',
    endDate: '2026-09-13',
    startSession: 'full',
    endSession: 'full',
    totalDays: 2,
    reason: 'Có việc riêng.',
    status: 'rejected',
    approverId: 'emp-003',
    approverName: 'Lê Hoàng Phương',
    reviewedAt: '2026-09-11T14:20:00+07:00',
    rejectionReason: 'Đang trong giai đoạn chạy campaign, vui lòng chọn ngày khác.',
    createdAt: '2026-09-10T09:15:00+07:00',
    updatedAt: '2026-09-11T14:20:00+07:00',
    history: buildHistory([
      ...SUBMITTER_HISTORY({ requestCode: 'LR-20260910-0005', employeeId: 'emp-010', createdAt: '2026-09-10T09:15:00+07:00' }),
      { fromStatus: 'pending', toStatus: 'rejected', actorId: 'emp-003', actorName: 'Lê Hoàng Phương', timestamp: '2026-09-11T14:20:00+07:00', note: 'Đang trong giai đoạn chạy campaign, vui lòng chọn ngày khác.' },
    ]),
  },
  {
    id: 'lr-006',
    requestCode: 'LR-20260820-0006',
    employeeId: 'emp-008',
    leaveType: 'unpaid',
    startDate: '2026-09-01',
    endDate: '2026-09-05',
    startSession: 'full',
    endSession: 'full',
    totalDays: 5,
    reason: 'Về nước giải quyết việc gia đình dài ngày.',
    status: 'rejected',
    approverId: 'emp-006',
    approverName: 'Ngô Hải Đăng',
    reviewedAt: '2026-08-22T16:00:00+07:00',
    rejectionReason: 'Cần sắp xếp handover trước khi nghỉ dài ngày.',
    createdAt: '2026-08-20T08:00:00+07:00',
    updatedAt: '2026-08-22T16:00:00+07:00',
    history: buildHistory([
      ...SUBMITTER_HISTORY({ requestCode: 'LR-20260820-0006', employeeId: 'emp-008', createdAt: '2026-08-20T08:00:00+07:00' }),
      { fromStatus: 'pending', toStatus: 'rejected', actorId: 'emp-006', actorName: 'Ngô Hải Đăng', timestamp: '2026-08-22T16:00:00+07:00', note: 'Cần sắp xếp handover trước khi nghỉ dài ngày.' },
    ]),
  },

  // Chờ duyệt
  {
    id: 'lr-007',
    requestCode: 'LR-20260928-0007',
    employeeId: 'emp-002',
    leaveType: 'annual',
    startDate: '2026-10-10',
    endDate: '2026-10-12',
    startSession: 'full',
    endSession: 'full',
    totalDays: 3,
    reason: 'Về quê có việc gia đình.',
    status: 'pending',
    approverId: null,
    approverName: '',
    reviewedAt: null,
    rejectionReason: '',
    createdAt: '2026-09-28T09:30:00+07:00',
    updatedAt: '2026-09-28T09:30:00+07:00',
    history: buildHistory(SUBMITTER_HISTORY({ requestCode: 'LR-20260928-0007', employeeId: 'emp-002', createdAt: '2026-09-28T09:30:00+07:00' })),
  },
  {
    id: 'lr-008',
    requestCode: 'LR-20260930-0008',
    employeeId: 'emp-005',
    leaveType: 'annual',
    startDate: '2026-10-02',
    endDate: '2026-10-04',
    startSession: 'full',
    endSession: 'full',
    totalDays: 3,
    reason: 'Du lịch cùng gia đình.',
    status: 'pending',
    approverId: null,
    approverName: '',
    reviewedAt: null,
    rejectionReason: '',
    createdAt: '2026-09-30T10:00:00+07:00',
    updatedAt: '2026-09-30T10:00:00+07:00',
    history: buildHistory(SUBMITTER_HISTORY({ requestCode: 'LR-20260930-0008', employeeId: 'emp-005', createdAt: '2026-09-30T10:00:00+07:00' })),
  },
  {
    id: 'lr-009',
    requestCode: 'LR-20260929-0009',
    employeeId: 'emp-013',
    leaveType: 'unpaid',
    startDate: '2026-10-15',
    endDate: '2026-10-15',
    startSession: 'full',
    endSession: 'full',
    totalDays: 1,
    reason: 'Việc riêng.',
    status: 'pending',
    approverId: null,
    approverName: '',
    reviewedAt: null,
    rejectionReason: '',
    createdAt: '2026-09-29T18:00:00+07:00',
    updatedAt: '2026-09-29T18:00:00+07:00',
    history: buildHistory(SUBMITTER_HISTORY({ requestCode: 'LR-20260929-0009', employeeId: 'emp-013', createdAt: '2026-09-29T18:00:00+07:00' })),
  },
  {
    id: 'lr-010',
    requestCode: 'LR-20260929-0010',
    employeeId: 'emp-007',
    leaveType: 'sick',
    startDate: '2026-09-30',
    endDate: '2026-09-30',
    startSession: 'afternoon',
    endSession: 'afternoon',
    totalDays: 0.5,
    reason: 'Khám sức khoẻ định kỳ.',
    status: 'pending',
    approverId: null,
    approverName: '',
    reviewedAt: null,
    rejectionReason: '',
    createdAt: '2026-09-29T08:00:00+07:00',
    updatedAt: '2026-09-29T08:00:00+07:00',
    history: buildHistory(SUBMITTER_HISTORY({ requestCode: 'LR-20260929-0010', employeeId: 'emp-007', createdAt: '2026-09-29T08:00:00+07:00' })),
  },
  {
    id: 'lr-011',
    requestCode: 'LR-20261001-0011',
    employeeId: 'emp-009',
    leaveType: 'annual',
    startDate: '2026-10-08',
    endDate: '2026-10-09',
    startSession: 'full',
    endSession: 'full',
    totalDays: 2,
    reason: 'Về quê cưới em.',
    status: 'pending',
    approverId: null,
    approverName: '',
    reviewedAt: null,
    rejectionReason: '',
    createdAt: '2026-10-01T08:00:00+07:00',
    updatedAt: '2026-10-01T08:00:00+07:00',
    history: buildHistory(SUBMITTER_HISTORY({ requestCode: 'LR-20261001-0011', employeeId: 'emp-009', createdAt: '2026-10-01T08:00:00+07:00' })),
  },
  {
    id: 'lr-012',
    requestCode: 'LR-20261001-0012',
    employeeId: 'emp-008',
    leaveType: 'annual',
    startDate: '2026-10-22',
    endDate: '2026-10-23',
    startSession: 'full',
    endSession: 'full',
    totalDays: 2,
    reason: 'Bố mẹ từ quê lên thăm.',
    status: 'pending',
    approverId: null,
    approverName: '',
    reviewedAt: null,
    rejectionReason: '',
    createdAt: '2026-10-01T11:00:00+07:00',
    updatedAt: '2026-10-01T11:00:00+07:00',
    history: buildHistory(SUBMITTER_HISTORY({ requestCode: 'LR-20261001-0012', employeeId: 'emp-008', createdAt: '2026-10-01T11:00:00+07:00' })),
  },

  // Đã hủy
  {
    id: 'lr-013',
    requestCode: 'LR-20260905-0013',
    employeeId: 'emp-011',
    leaveType: 'annual',
    startDate: '2026-09-25',
    endDate: '2026-09-26',
    startSession: 'full',
    endSession: 'full',
    totalDays: 2,
    reason: 'Có việc đột xuất, đã huỷ.',
    status: 'cancelled',
    approverId: null,
    approverName: '',
    reviewedAt: null,
    rejectionReason: '',
    createdAt: '2026-09-05T09:00:00+07:00',
    updatedAt: '2026-09-20T17:00:00+07:00',
    history: buildHistory([
      ...SUBMITTER_HISTORY({ requestCode: 'LR-20260905-0013', employeeId: 'emp-011', createdAt: '2026-09-05T09:00:00+07:00' }),
      { fromStatus: 'pending', toStatus: 'cancelled', actorId: 'emp-011', actorName: 'Đặng Minh Khoa', timestamp: '2026-09-20T17:00:00+07:00', note: 'Huỷ đơn trước thời hạn.' },
    ]),
  },
  {
    id: 'lr-014',
    requestCode: 'LR-20260918-0014',
    employeeId: 'emp-015',
    leaveType: 'personal',
    startDate: '2026-09-22',
    endDate: '2026-09-22',
    startSession: 'morning',
    endSession: 'morning',
    totalDays: 0.5,
    reason: 'Đón người thân.',
    status: 'cancelled',
    approverId: null,
    approverName: '',
    reviewedAt: null,
    rejectionReason: '',
    createdAt: '2026-09-18T08:00:00+07:00',
    updatedAt: '2026-09-21T18:00:00+07:00',
    history: buildHistory([
      ...SUBMITTER_HISTORY({ requestCode: 'LR-20260918-0014', employeeId: 'emp-015', createdAt: '2026-09-18T08:00:00+07:00' }),
      { fromStatus: 'pending', toStatus: 'cancelled', actorId: 'emp-015', actorName: 'Phan Thanh Tùng', timestamp: '2026-09-21T18:00:00+07:00', note: 'Không còn cần nghỉ.' },
    ]),
  },
]