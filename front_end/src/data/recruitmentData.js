/**
 * Mock data cho Recruitment Management (Phần 19 — AD-HRM14).
 *
 * Quy tắc:
 * - Không random. Tất cả số liệu cố định tại đây.
 * - application.jobId tham chiếu về job.id trong JOBS.
 * - KHÔNG chứa dữ liệu nhạy cảm (password/token/secret/apiKey).
 */

export const JOB_STATUSES = [
  { value: 'draft',  label: 'Bản nháp',     tone: 'inactive' },
  { value: 'open',   label: 'Đang mở',      tone: 'success' },
  { value: 'paused', label: 'Tạm dừng',     tone: 'warning' },
  { value: 'closed', label: 'Đã đóng',      tone: 'neutral' },
]

export const JOB_STATUS_LABEL = JOB_STATUSES.reduce((acc, s) => {
  acc[s.value] = s.label
  return acc
}, {})

export const JOB_STATUS_TONE = JOB_STATUSES.reduce((acc, s) => {
  acc[s.value] = s.tone
  return acc
}, {})

export const EMPLOYMENT_TYPES = [
  { value: 'full_time', label: 'Toàn thời gian' },
  { value: 'part_time', label: 'Bán thời gian' },
  { value: 'contract',  label: 'Hợp đồng' },
  { value: 'intern',    label: 'Thực tập sinh' },
]

export const EMPLOYMENT_TYPE_LABEL = EMPLOYMENT_TYPES.reduce((acc, t) => {
  acc[t.value] = t.label
  return acc
}, {})

/** Dùng làm Department option cho Job. Lấy từ employeeMockData.js sẽ gọn hơn. */
export const DEPARTMENT_OPTIONS = [
  { value: 'dept-eng',   label: 'Phòng Kỹ thuật' },
  { value: 'dept-hr',    label: 'Phòng Nhân sự' },
  { value: 'dept-mkt',   label: 'Phòng Marketing' },
  { value: 'dept-fin',   label: 'Phòng Tài chính' },
  { value: 'dept-sales', label: 'Phòng Kinh doanh' },
  { value: 'dept-cs',    label: 'Phòng Chăm sóc Khách hàng' },
  { value: 'dept-ops',   label: 'Phòng Vận hành' },
]

export const DEPARTMENT_LABEL = DEPARTMENT_OPTIONS.reduce((acc, d) => {
  acc[d.value] = d.label
  return acc
}, {})

export const APPLICATION_STATUSES = [
  { value: 'new',       label: 'Mới',            tone: 'info' },
  { value: 'screening', label: 'Sàng lọc',       tone: 'pending' },
  { value: 'interview', label: 'Phỏng vấn',      tone: 'warning' },
  { value: 'offer',     label: 'Gửi offer',      tone: 'brand' },
  { value: 'hired',     label: 'Đã tuyển',       tone: 'success' },
  { value: 'rejected',  label: 'Từ chối',        tone: 'danger' },
]

export const APPLICATION_STATUS_LABEL = APPLICATION_STATUSES.reduce((acc, s) => {
  acc[s.value] = s.label
  return acc
}, {})

export const APPLICATION_STATUS_TONE = APPLICATION_STATUSES.reduce((acc, s) => {
  acc[s.value] = s.tone
  return acc
}, {})

// ---------- Mock jobs ----------
export const JOBS = [
  {
    id: 'job-001',
    title: 'Frontend Developer',
    departmentId: 'dept-eng',
    location: 'TP. Hồ Chí Minh',
    employmentType: 'full_time',
    description: 'Xây dựng và bảo trì các ứng dụng web nội bộ của hệ thống HRM.',
    requirements: ['HTML/CSS', 'JavaScript', 'React', 'REST API'],
    vacancies: 2,
    status: 'open',
    postedAt: '2026-09-01',
    closingDate: '2026-10-30',
    createdBy: 'usr-admin-001',
    createdAt: '2026-09-01T08:00:00+07:00',
    updatedAt: '2026-09-15T09:30:00+07:00',
  },
  {
    id: 'job-002',
    title: 'Backend Engineer',
    departmentId: 'dept-eng',
    location: 'TP. Hồ Chí Minh',
    employmentType: 'full_time',
    description: 'Phát triển API và hệ thống backend cho các tính năng HR.',
    requirements: ['Node.js', 'Express', 'PostgreSQL', 'Docker'],
    vacancies: 1,
    status: 'open',
    postedAt: '2026-09-05',
    closingDate: '2026-10-15',
    createdBy: 'usr-admin-001',
    createdAt: '2026-09-05T08:00:00+07:00',
    updatedAt: '2026-09-20T10:15:00+07:00',
  },
  {
    id: 'job-003',
    title: 'HR Specialist',
    departmentId: 'dept-hr',
    location: 'Hà Nội',
    employmentType: 'full_time',
    description: 'Hỗ trợ tuyển dụng, đào tạo và các hoạt động nhân sự.',
    requirements: ['Kinh nghiệm HR', 'Giao tiếp tốt', 'Tiếng Anh cơ bản'],
    vacancies: 1,
    status: 'paused',
    postedAt: '2026-08-20',
    closingDate: '2026-10-10',
    createdBy: 'usr-admin-001',
    createdAt: '2026-08-20T08:00:00+07:00',
    updatedAt: '2026-09-25T14:00:00+07:00',
  },
  {
    id: 'job-004',
    title: 'Content Marketing Intern',
    departmentId: 'dept-mkt',
    location: 'TP. Hồ Chí Minh',
    employmentType: 'intern',
    description: 'Hỗ trợ team content cho các kênh truyền thông nội bộ.',
    requirements: ['Sáng tạo nội dung', 'Tiếng Việt tốt'],
    vacancies: 3,
    status: 'draft',
    postedAt: null,
    closingDate: '2026-11-01',
    createdBy: 'usr-admin-001',
    createdAt: '2026-09-28T11:00:00+07:00',
    updatedAt: '2026-09-28T11:00:00+07:00',
  },
  {
    id: 'job-005',
    title: 'Sales Executive',
    departmentId: 'dept-sales',
    location: 'Đà Nẵng',
    employmentType: 'full_time',
    description: 'Phát triển khách hàng doanh nghiệp trong khu vực miền Trung.',
    requirements: ['Kinh nghiệm sales', 'Kỹ năng đàm phán'],
    vacancies: 2,
    status: 'closed',
    postedAt: '2026-07-01',
    closingDate: '2026-08-31',
    createdBy: 'usr-admin-001',
    createdAt: '2026-07-01T08:00:00+07:00',
    updatedAt: '2026-08-31T17:30:00+07:00',
  },
]

// ---------- Mock applications ----------
export const APPLICATIONS = [
  {
    id: 'app-001',
    jobId: 'job-001',
    employeeId: null,
    candidateName: 'Nguyễn Văn An',
    email: 'an.nguyen@example.com',
    phone: '0901000001',
    appliedAt: '2026-09-10',
    status: 'interview',
    note: 'Ứng viên đã qua vòng sàng lọc CV, lên lịch phỏng vấn tuần sau.',
    createdAt: '2026-09-10T08:30:00+07:00',
    updatedAt: '2026-09-25T11:00:00+07:00',
  },
  {
    id: 'app-002',
    jobId: 'job-001',
    employeeId: null,
    candidateName: 'Trần Thị Bình',
    email: 'binh.tran@example.com',
    phone: '0901000002',
    appliedAt: '2026-09-12',
    status: 'screening',
    note: '',
    createdAt: '2026-09-12T09:00:00+07:00',
    updatedAt: '2026-09-20T10:00:00+07:00',
  },
  {
    id: 'app-003',
    jobId: 'job-002',
    employeeId: null,
    candidateName: 'Lê Hoàng Cường',
    email: 'cuong.le@example.com',
    phone: '0901000003',
    appliedAt: '2026-09-15',
    status: 'offer',
    note: 'Đã gửi offer letter ngày 30/09.',
    createdAt: '2026-09-15T10:30:00+07:00',
    updatedAt: '2026-09-30T16:00:00+07:00',
  },
  {
    id: 'app-004',
    jobId: 'job-002',
    employeeId: null,
    candidateName: 'Phạm Minh Đức',
    email: 'duc.pham@example.com',
    phone: '0901000004',
    appliedAt: '2026-09-18',
    status: 'new',
    note: '',
    createdAt: '2026-09-18T13:00:00+07:00',
    updatedAt: '2026-09-18T13:00:00+07:00',
  },
  {
    id: 'app-005',
    jobId: 'job-003',
    employeeId: null,
    candidateName: 'Đỗ Khánh Linh',
    email: 'linh.do@example.com',
    phone: '0901000005',
    appliedAt: '2026-09-05',
    status: 'rejected',
    note: 'Chưa đáp ứng yêu cầu tiếng Anh.',
    createdAt: '2026-09-05T14:00:00+07:00',
    updatedAt: '2026-09-22T09:30:00+07:00',
  },
  {
    id: 'app-006',
    jobId: 'job-001',
    employeeId: 'emp-001',
    candidateName: 'Hoàng Gia Mạnh',
    email: 'manh.hoang@example.com',
    phone: '0901000006',
    appliedAt: '2026-09-22',
    status: 'new',
    note: '',
    createdAt: '2026-09-22T08:30:00+07:00',
    updatedAt: '2026-09-22T08:30:00+07:00',
  },
  {
    id: 'app-007',
    jobId: 'job-003',
    employeeId: null,
    candidateName: 'Vũ Mai Quỳnh',
    email: 'quynh.vu@example.com',
    phone: '0901000007',
    appliedAt: '2026-09-08',
    status: 'hired',
    note: 'Đã ký hợp đồng, onboard ngày 01/10.',
    createdAt: '2026-09-08T11:00:00+07:00',
    updatedAt: '2026-09-29T17:00:00+07:00',
  },
  {
    id: 'app-008',
    jobId: 'job-002',
    employeeId: 'emp-001',
    candidateName: 'Ngô Bảo Sơn',
    email: 'son.ngo@example.com',
    phone: '0901000008',
    appliedAt: '2026-09-21',
    status: 'interview',
    note: 'Phỏng vấn vòng 2 vào 05/10.',
    createdAt: '2026-09-21T09:00:00+07:00',
    updatedAt: '2026-10-01T09:00:00+07:00',
  },
]