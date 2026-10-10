/**
 * Mock data cho Quản lý hợp đồng lao động (Phần 13).
 *
 * Quy tắc:
 * - Mỗi nhân viên có thể có nhiều hợp đồng theo thời gian (lịch sử).
 * - employeeId tham chiếu về employeeMockData (emp-001 ... emp-015).
 * - KHÔNG random. Toàn bộ dữ liệu cố định tại đây.
 * - Trạng thái hợp đồng: draft | pending | active | expired | terminated | cancelled.
 * - Loại hợp đồng: probation | fixed_term | indefinite | internship | other.
 * - Hợp đồng chỉ là dữ liệu minh hoạ; KHÔNG phải văn bản pháp lý chính thức.
 */

export const CONTRACT_TYPES = [
  { value: 'probation',  label: 'Hợp đồng thử việc' },
  { value: 'fixed_term', label: 'Hợp đồng xác định thời hạn' },
  { value: 'indefinite', label: 'Hợp đồng không xác định thời hạn' },
  { value: 'internship', label: 'Hợp đồng thực tập' },
  { value: 'other',      label: 'Khác' },
]

export const CONTRACT_TYPE_LABEL = CONTRACT_TYPES.reduce((acc, t) => {
  acc[t.value] = t.label
  return acc
}, {})

export const CONTRACT_STATUSES = [
  { value: 'draft',      label: 'Bản nháp',         tone: 'inactive' },
  { value: 'pending',    label: 'Chờ xử lý',        tone: 'pending' },
  { value: 'active',     label: 'Đang hiệu lực',    tone: 'success' },
  { value: 'expired',    label: 'Hết hạn',          tone: 'neutral' },
  { value: 'terminated', label: 'Đã kết thúc',      tone: 'danger' },
  { value: 'cancelled',  label: 'Đã hủy',           tone: 'neutral' },
]

export const CONTRACT_STATUS_LABEL = CONTRACT_STATUSES.reduce((acc, s) => {
  acc[s.value] = s.label
  return acc
}, {})

/**
 * Seed hợp đồng.
 *
 * Cấu trúc mỗi hợp đồng gồm 1 bản ghi chính + history.
 * History được định nghĩa thẳng tại đây; create/update/extend/terminate
 * sẽ append thêm history từ service.
 */
export const CONTRACTS = [
  // emp-001 - Manager, indefinite + 1 contract lịch sử đã terminated
  {
    id: 'ct-001',
    contractCode: 'HD-2021-001',
    employeeId: 'emp-001',
    contractType: 'indefinite',
    signedDate: '2021-08-10',
    effectiveDate: '2021-08-15',
    expiryDate: null,
    status: 'active',
    note: 'Hợp đồng không xác định thời hạn (dữ liệu minh hoạ).',
    owner: 'Phòng Nhân sự',
    history: [
      { id: 'h-001-1', contractId: 'ct-001', action: 'create', previousStatus: null, newStatus: 'active',
        previousExpiryDate: null, newExpiryDate: null, reason: 'Tạo hợp đồng mới',
        actorId: 'usr-admin-001', actorName: 'Admin', timestamp: '2021-08-10T08:00:00+07:00' },
    ],
    createdAt: '2021-08-10T08:00:00+07:00',
    updatedAt: '2024-01-05T09:00:00+07:00',
  },
  {
    id: 'ct-002',
    contractCode: 'HD-2018-001',
    employeeId: 'emp-001',
    contractType: 'fixed_term',
    signedDate: '2018-05-01',
    effectiveDate: '2018-05-15',
    expiryDate: '2021-05-14',
    status: 'terminated',
    note: 'Hợp đồng trước đó, đã kết thúc do ký mới.',
    owner: 'Phòng Nhân sự',
    history: [
      { id: 'h-002-1', contractId: 'ct-002', action: 'create', previousStatus: null, newStatus: 'active',
        previousExpiryDate: null, newExpiryDate: '2021-05-14', reason: 'Tạo hợp đồng mới',
        actorId: 'usr-admin-001', actorName: 'Admin', timestamp: '2018-05-01T08:00:00+07:00' },
      { id: 'h-002-2', contractId: 'ct-002', action: 'terminate', previousStatus: 'active', newStatus: 'terminated',
        previousExpiryDate: '2021-05-14', newExpiryDate: null, reason: 'Ký hợp đồng mới thay thế',
        actorId: 'usr-admin-001', actorName: 'Admin', timestamp: '2021-08-10T08:00:00+07:00' },
    ],
    createdAt: '2018-05-01T08:00:00+07:00',
    updatedAt: '2021-08-10T09:00:00+07:00',
  },

  // emp-002 - probation (active) + previous fixed_term (expired)
  {
    id: 'ct-003',
    contractCode: 'HD-2026-002',
    employeeId: 'emp-002',
    contractType: 'probation',
    signedDate: '2026-05-01',
    effectiveDate: '2026-05-04',
    expiryDate: '2026-08-03',
    status: 'active',
    note: 'Hợp đồng thử việc 3 tháng (minh hoạ).',
    owner: 'Phòng Nhân sự',
    history: [
      { id: 'h-003-1', contractId: 'ct-003', action: 'create', previousStatus: null, newStatus: 'active',
        previousExpiryDate: null, newExpiryDate: '2026-08-03', reason: 'Tạo hợp đồng thử việc',
        actorId: 'usr-admin-001', actorName: 'Admin', timestamp: '2026-05-01T08:00:00+07:00' },
    ],
    createdAt: '2026-05-01T08:00:00+07:00',
    updatedAt: '2026-05-01T08:00:00+07:00',
  },
  {
    id: 'ct-004',
    contractCode: 'HD-2024-002',
    employeeId: 'emp-002',
    contractType: 'fixed_term',
    signedDate: '2024-04-25',
    effectiveDate: '2024-05-04',
    expiryDate: '2026-05-03',
    status: 'expired',
    note: 'Hợp đồng 2 năm đã hết hạn.',
    owner: 'Phòng Nhân sự',
    history: [
      { id: 'h-004-1', contractId: 'ct-004', action: 'create', previousStatus: null, newStatus: 'active',
        previousExpiryDate: null, newExpiryDate: '2026-05-03', reason: 'Tạo hợp đồng mới',
        actorId: 'usr-admin-001', actorName: 'Admin', timestamp: '2024-04-25T08:00:00+07:00' },
    ],
    createdAt: '2024-04-25T08:00:00+07:00',
    updatedAt: '2026-05-04T09:00:00+07:00',
  },

  // emp-005 - fixed_term sắp hết hạn
  {
    id: 'ct-005',
    contractCode: 'HD-2025-005',
    employeeId: 'emp-005',
    contractType: 'fixed_term',
    signedDate: '2025-10-10',
    effectiveDate: '2025-10-15',
    expiryDate: '2026-11-04',
    status: 'active',
    note: 'Hợp đồng 1 năm, sắp đến ngày gia hạn (minh hoạ).',
    owner: 'Phòng Nhân sự',
    history: [
      { id: 'h-005-1', contractId: 'ct-005', action: 'create', previousStatus: null, newStatus: 'active',
        previousExpiryDate: null, newExpiryDate: '2026-11-04', reason: 'Tạo hợp đồng mới',
        actorId: 'usr-admin-001', actorName: 'Admin', timestamp: '2025-10-10T08:00:00+07:00' },
    ],
    createdAt: '2025-10-10T08:00:00+07:00',
    updatedAt: '2025-10-10T08:00:00+07:00',
  },

  // emp-006 - fixed_term active
  {
    id: 'ct-006',
    contractCode: 'HD-2026-006',
    employeeId: 'emp-006',
    contractType: 'fixed_term',
    signedDate: '2026-02-15',
    effectiveDate: '2026-03-01',
    expiryDate: '2028-02-28',
    status: 'active',
    note: 'Hợp đồng 2 năm.',
    owner: 'Phòng Nhân sự',
    history: [
      { id: 'h-006-1', contractId: 'ct-006', action: 'create', previousStatus: null, newStatus: 'active',
        previousExpiryDate: null, newExpiryDate: '2028-02-28', reason: 'Tạo hợp đồng mới',
        actorId: 'usr-admin-001', actorName: 'Admin', timestamp: '2026-02-15T08:00:00+07:00' },
    ],
    createdAt: '2026-02-15T08:00:00+07:00',
    updatedAt: '2026-02-15T08:00:00+07:00',
  },

  // emp-007 - internship active
  {
    id: 'ct-007',
    contractCode: 'HD-2026-007',
    employeeId: 'emp-007',
    contractType: 'internship',
    signedDate: '2026-08-01',
    effectiveDate: '2026-08-05',
    expiryDate: '2026-12-04',
    status: 'active',
    note: 'Hợp đồng thực tập 4 tháng (minh hoạ).',
    owner: 'Phòng Nhân sự',
    history: [
      { id: 'h-007-1', contractId: 'ct-007', action: 'create', previousStatus: null, newStatus: 'active',
        previousExpiryDate: null, newExpiryDate: '2026-12-04', reason: 'Tạo hợp đồng thực tập',
        actorId: 'usr-admin-001', actorName: 'Admin', timestamp: '2026-08-01T08:00:00+07:00' },
    ],
    createdAt: '2026-08-01T08:00:00+07:00',
    updatedAt: '2026-08-01T08:00:00+07:00',
  },

  // emp-008 - fixed_term terminated
  {
    id: 'ct-008',
    contractCode: 'HD-2023-008',
    employeeId: 'emp-008',
    contractType: 'fixed_term',
    signedDate: '2023-06-10',
    effectiveDate: '2023-06-15',
    expiryDate: '2026-06-14',
    status: 'terminated',
    note: 'Đã kết thúc trước hạn do thỏa thuận hai bên.',
    owner: 'Phòng Nhân sự',
    history: [
      { id: 'h-008-1', contractId: 'ct-008', action: 'create', previousStatus: null, newStatus: 'active',
        previousExpiryDate: null, newExpiryDate: '2026-06-14', reason: 'Tạo hợp đồng mới',
        actorId: 'usr-admin-001', actorName: 'Admin', timestamp: '2023-06-10T08:00:00+07:00' },
      { id: 'h-008-2', contractId: 'ct-008', action: 'terminate', previousStatus: 'active', newStatus: 'terminated',
        previousExpiryDate: '2026-06-14', newExpiryDate: null, reason: 'Thỏa thuận kết thúc sớm',
        actorId: 'usr-admin-001', actorName: 'Admin', timestamp: '2025-12-01T09:00:00+07:00' },
    ],
    createdAt: '2023-06-10T08:00:00+07:00',
    updatedAt: '2025-12-01T09:00:00+07:00',
  },

  // emp-009 - draft
  {
    id: 'ct-009',
    contractCode: 'HD-2026-009',
    employeeId: 'emp-009',
    contractType: 'fixed_term',
    signedDate: '2026-09-10',
    effectiveDate: '2026-10-01',
    expiryDate: '2028-09-30',
    status: 'draft',
    note: 'Đang chờ phê duyệt (bản nháp).',
    owner: 'Phòng Nhân sự',
    history: [
      { id: 'h-009-1', contractId: 'ct-009', action: 'create', previousStatus: null, newStatus: 'draft',
        previousExpiryDate: null, newExpiryDate: '2028-09-30', reason: 'Tạo bản nháp',
        actorId: 'usr-admin-001', actorName: 'Admin', timestamp: '2026-09-10T08:00:00+07:00' },
    ],
    createdAt: '2026-09-10T08:00:00+07:00',
    updatedAt: '2026-09-10T08:00:00+07:00',
  },

  // emp-010 - pending
  {
    id: 'ct-010',
    contractCode: 'HD-2026-010',
    employeeId: 'emp-010',
    contractType: 'fixed_term',
    signedDate: '2026-09-20',
    effectiveDate: '2026-10-05',
    expiryDate: '2027-10-04',
    status: 'pending',
    note: 'Đã ký, đang chờ hiệu lực.',
    owner: 'Phòng Nhân sự',
    history: [
      { id: 'h-010-1', contractId: 'ct-010', action: 'create', previousStatus: null, newStatus: 'pending',
        previousExpiryDate: null, newExpiryDate: '2027-10-04', reason: 'Tạo hợp đồng',
        actorId: 'usr-admin-001', actorName: 'Admin', timestamp: '2026-09-20T08:00:00+07:00' },
    ],
    createdAt: '2026-09-20T08:00:00+07:00',
    updatedAt: '2026-09-20T08:00:00+07:00',
  },
]