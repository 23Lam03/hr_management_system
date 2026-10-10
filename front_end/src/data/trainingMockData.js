/**
 * Mock data cho Quản lý đào tạo (Phần 11).
 *
 * Quy tắc:
 * - TrainingCourse liên kết employeeId từ employeeMockData (emp-001 ... emp-015).
 * - Không random. Toàn bộ dữ liệu chốt cứng tại đây.
 * - Trạng thái khóa học: draft | open | in_progress | completed | cancelled.
 * - Trạng thái đăng ký: registered | confirmed | waitlisted | cancelled.
 * - Trạng thái học tập: not_started | in_progress | completed | failed.
 */

export const TRAINING_CATEGORIES = [
  { value: 'hard_skill',   label: 'Kỹ năng chuyên môn' },
  { value: 'soft_skill',   label: 'Kỹ năng mềm' },
  { value: 'onboarding',   label: 'Hội nhập nhân viên mới' },
  { value: 'compliance',   label: 'An toàn & quy trình nội bộ' },
  { value: 'other',        label: 'Khác' },
]

export const TRAINING_CATEGORY_LABEL = TRAINING_CATEGORIES.reduce((acc, c) => {
  acc[c.value] = c.label
  return acc
}, {})

export const TRAINING_FORMATS = [
  { value: 'offline', label: 'Trực tiếp' },
  { value: 'online',  label: 'Trực tuyến' },
  { value: 'hybrid',  label: 'Kết hợp' },
]

export const TRAINING_FORMAT_LABEL = TRAINING_FORMATS.reduce((acc, f) => {
  acc[f.value] = f.label
  return acc
}, {})

export const TRAINING_STATUSES = [
  { value: 'draft',      label: 'Bản nháp',       tone: 'inactive' },
  { value: 'open',       label: 'Mở đăng ký',     tone: 'pending' },
  { value: 'in_progress', label: 'Đang diễn ra',  tone: 'warning' },
  { value: 'completed',  label: 'Đã hoàn thành',  tone: 'success' },
  { value: 'cancelled',  label: 'Đã hủy',         tone: 'neutral' },
]

export const TRAINING_STATUS_LABEL = TRAINING_STATUSES.reduce((acc, s) => {
  acc[s.value] = s.label
  return acc
}, {})

export const PARTICIPANT_STATUSES = [
  { value: 'registered', label: 'Đã đăng ký',     tone: 'pending' },
  { value: 'confirmed',  label: 'Đã xác nhận',    tone: 'brand' },
  { value: 'waitlisted', label: 'Danh sách chờ',  tone: 'warning' },
  { value: 'cancelled',  label: 'Đã hủy đăng ký', tone: 'neutral' },
]

export const PARTICIPANT_STATUS_LABEL = PARTICIPANT_STATUSES.reduce((acc, s) => {
  acc[s.value] = s.label
  return acc
}, {})

export const LEARNING_STATUSES = [
  { value: 'not_started', label: 'Chưa bắt đầu',  tone: 'inactive' },
  { value: 'in_progress', label: 'Đang học',       tone: 'warning' },
  { value: 'completed',   label: 'Hoàn thành',     tone: 'success' },
  { value: 'failed',      label: 'Chưa đạt',       tone: 'danger' },
]

export const LEARNING_STATUS_LABEL = LEARNING_STATUSES.reduce((acc, s) => {
  acc[s.value] = s.label
  return acc
}, {})

/**
 * Seed khóa đào tạo.
 * employeeIds: danh sách nhân viên "eligible" (đủ điều kiện tham gia).
 * Tất cả nhân viên active đều có thể đăng ký - employeeIds là hint.
 */
export const TRAINING_COURSES = [
  {
    id: 'tc-001',
    code: 'TRN-2026-001',
    name: 'Kỹ năng giao tiếp và thuyết trình',
    category: 'soft_skill',
    description: 'Khóa học giúp cải thiện kỹ năng giao tiếp, thuyết trình và xử lý tình huống trong môi trường làm việc.',
    objectives: 'Trang bị kỹ thuật thuyết trình hiệu quả, kỹ năng lắng nghe chủ động và phản hồi xây dựng.',
    instructor: 'Nguyễn Hà My',
    format: 'hybrid',
    location: 'Phòng họp lớn Tầng 5',
    meetingUrl: 'https://meet.example.com/trn-001',
    startDate: '2026-10-15',
    endDate: '2026-10-17',
    registrationDeadline: '2026-10-10',
    durationHours: 12,
    capacity: 20,
    employeeIds: [],
    status: 'open',
    createdAt: '2026-09-25T09:00:00+07:00',
    updatedAt: '2026-10-01T09:00:00+07:00',
  },
  {
    id: 'tc-002',
    code: 'TRN-2026-002',
    name: 'React nâng cao & Patterns',
    category: 'hard_skill',
    description: 'Khóa học chuyên sâu về React 19, các patterns hiện đại và tối ưu hiệu năng.',
    objectives: 'Hiểu về Concurrent Rendering, Server Components, tối ưu re-render với memo và Suspense.',
    instructor: 'Ngô Hải Đăng',
    format: 'online',
    location: '',
    meetingUrl: 'https://meet.example.com/trn-002',
    startDate: '2026-11-05',
    endDate: '2026-11-07',
    registrationDeadline: '2026-11-01',
    durationHours: 16,
    capacity: 12,
    employeeIds: ['emp-005', 'emp-006', 'emp-008', 'emp-009'],
    status: 'open',
    createdAt: '2026-09-28T10:00:00+07:00',
    updatedAt: '2026-10-01T10:00:00+07:00',
  },
  {
    id: 'tc-003',
    code: 'TRN-2026-003',
    name: 'Hội nhập nhân viên mới - Khóa Q3/2026',
    category: 'onboarding',
    description: 'Khóa hội nhập cho nhân viên mới trong quý 3.',
    objectives: 'Giới thiệu văn hoá công ty, quy trình làm việc, các công cụ nội bộ.',
    instructor: 'Nguyễn Minh Anh',
    format: 'offline',
    location: 'Phòng đào tạo Tầng 3',
    meetingUrl: '',
    startDate: '2026-09-05',
    endDate: '2026-09-05',
    registrationDeadline: '2026-09-01',
    durationHours: 6,
    capacity: 15,
    employeeIds: [],
    status: 'completed',
    createdAt: '2026-08-25T09:00:00+07:00',
    updatedAt: '2026-09-05T17:00:00+07:00',
  },
  {
    id: 'tc-004',
    code: 'TRN-2026-004',
    name: 'An toàn lao động & PCCC',
    category: 'compliance',
    description: 'Khóa đào tạo bắt buộc về an toàn lao động và phòng cháy chữa cháy.',
    objectives: 'Nắm vững quy trình an toàn, kỹ năng xử lý sự cố và sơ cứu ban đầu.',
    instructor: 'Trần Văn Bình',
    format: 'offline',
    location: 'Hội trường A',
    meetingUrl: '',
    startDate: '2026-10-25',
    endDate: '2026-10-25',
    registrationDeadline: '2026-10-22',
    durationHours: 4,
    capacity: 50,
    employeeIds: [],
    status: 'open',
    createdAt: '2026-10-01T08:30:00+07:00',
    updatedAt: '2026-10-01T08:30:00+07:00',
  },
  {
    id: 'tc-005',
    code: 'TRN-2026-005',
    name: 'Quản lý dự án Agile cơ bản',
    category: 'hard_skill',
    description: 'Phương pháp quản lý dự án theo Agile/Scrum cho người mới.',
    objectives: 'Hiểu và áp dụng được Scrum framework trong dự án thực tế.',
    instructor: 'Phan Thanh Tùng',
    format: 'hybrid',
    location: 'Phòng họp nhỏ Tầng 4',
    meetingUrl: 'https://meet.example.com/trn-005',
    startDate: '2026-10-05',
    endDate: '2026-10-07',
    registrationDeadline: '2026-10-02',
    durationHours: 12,
    capacity: 25,
    employeeIds: [],
    status: 'in_progress',
    createdAt: '2026-09-15T09:00:00+07:00',
    updatedAt: '2026-10-05T08:00:00+07:00',
  },
  {
    id: 'tc-006',
    code: 'TRN-2026-006',
    name: 'Kỹ năng lãnh đạo cho Manager',
    category: 'soft_skill',
    description: 'Khóa học phát triển năng lực lãnh đạo cho cấp quản lý.',
    objectives: 'Xây dựng phong cách lãnh đạo, coaching và truyền cảm hứng cho đội ngũ.',
    instructor: 'Nguyễn Hà My',
    format: 'offline',
    location: 'Khách sạn 5*',
    meetingUrl: '',
    startDate: '2026-12-10',
    endDate: '2026-12-12',
    registrationDeadline: '2026-12-01',
    durationHours: 24,
    capacity: 10,
    employeeIds: [],
    status: 'draft',
    createdAt: '2026-10-01T14:00:00+07:00',
    updatedAt: '2026-10-01T14:00:00+07:00',
  },
]

/**
 * Seed đăng ký / tham gia khóa học.
 * Mỗi entry là 1 (trainingId, employeeId) duy nhất - rule đã được enforce.
 */
export const TRAINING_PARTICIPANTS = [
  // tc-001 - 5 người đăng ký (status: open, có thể có waitlist)
  ...buildParticipants('tc-001', [
    { employeeId: 'emp-002', registrationStatus: 'confirmed',  learningStatus: 'not_started', progress: 0,   resultPublished: false },
    { employeeId: 'emp-003', registrationStatus: 'confirmed',  learningStatus: 'not_started', progress: 0,   resultPublished: false },
    { employeeId: 'emp-005', registrationStatus: 'confirmed',  learningStatus: 'not_started', progress: 0,   resultPublished: false },
    { employeeId: 'emp-007', registrationStatus: 'confirmed',  learningStatus: 'not_started', progress: 0,   resultPublished: false },
    { employeeId: 'emp-010', registrationStatus: 'confirmed',  learningStatus: 'not_started', progress: 0,   resultPublished: false },
    { employeeId: 'emp-011', registrationStatus: 'registered', learningStatus: 'not_started', progress: 0,   resultPublished: false },
  ], '2026-09-29'),

  // tc-002 - 4 người (đã đủ capacity)
  ...buildParticipants('tc-002', [
    { employeeId: 'emp-005', registrationStatus: 'confirmed',  learningStatus: 'not_started', progress: 0,   resultPublished: false },
    { employeeId: 'emp-006', registrationStatus: 'confirmed',  learningStatus: 'not_started', progress: 0,   resultPublished: false },
    { employeeId: 'emp-008', registrationStatus: 'confirmed',  learningStatus: 'not_started', progress: 0,   resultPublished: false },
    { employeeId: 'emp-009', registrationStatus: 'confirmed',  learningStatus: 'not_started', progress: 0,   resultPublished: false },
  ], '2026-09-29'),

  // tc-003 - 5 người hoàn thành (status: completed)
  ...buildParticipants('tc-003', [
    { employeeId: 'emp-002', registrationStatus: 'confirmed', learningStatus: 'completed', progress: 100, score: 88, result: 'pass', resultPublished: true,
      instructorComment: 'Tham gia tích cực, hoàn thành tốt.', completedAt: '2026-09-05T17:00:00+07:00' },
    { employeeId: 'emp-010', registrationStatus: 'confirmed', learningStatus: 'completed', progress: 100, score: 92, result: 'pass', resultPublished: true,
      instructorComment: 'Xuất sắc.', completedAt: '2026-09-05T17:00:00+07:00' },
    { employeeId: 'emp-013', registrationStatus: 'confirmed', learningStatus: 'completed', progress: 100, score: 75, result: 'pass', resultPublished: true,
      instructorComment: 'Hoàn thành yêu cầu.', completedAt: '2026-09-05T17:00:00+07:00' },
    { employeeId: 'emp-014', registrationStatus: 'confirmed', learningStatus: 'completed', progress: 100, score: 70, result: 'pass', resultPublished: true,
      completedAt: '2026-09-05T17:00:00+07:00' },
    { employeeId: 'emp-015', registrationStatus: 'confirmed', learningStatus: 'failed',    progress: 100, score: 55, result: 'fail', resultPublished: true,
      instructorComment: 'Cần ôn lại kiến thức an toàn lao động.', completedAt: '2026-09-05T17:00:00+07:00' },
  ], '2026-08-26'),

  // tc-004 - 3 người đã đăng ký
  ...buildParticipants('tc-004', [
    { employeeId: 'emp-002', registrationStatus: 'confirmed',  learningStatus: 'not_started', progress: 0, resultPublished: false },
    { employeeId: 'emp-007', registrationStatus: 'registered', learningStatus: 'not_started', progress: 0, resultPublished: false },
    { employeeId: 'emp-009', registrationStatus: 'registered', learningStatus: 'not_started', progress: 0, resultPublished: false },
  ], '2026-10-01'),

  // tc-005 - 4 người đang học (status: in_progress)
  ...buildParticipants('tc-005', [
    { employeeId: 'emp-006', registrationStatus: 'confirmed', learningStatus: 'in_progress', progress: 60, resultPublished: false },
    { employeeId: 'emp-008', registrationStatus: 'confirmed', learningStatus: 'in_progress', progress: 75, resultPublished: false },
    { employeeId: 'emp-009', registrationStatus: 'confirmed', learningStatus: 'in_progress', progress: 40, resultPublished: false },
    { employeeId: 'emp-015', registrationStatus: 'confirmed', learningStatus: 'in_progress', progress: 50, resultPublished: false },
  ], '2026-09-20'),
]

function buildParticipants(trainingId, list, registeredAt) {
  return list.map((p, idx) => ({
    id: `${trainingId}-${p.employeeId}`,
    trainingId,
    employeeId: p.employeeId,
    registeredAt: p.registeredAt || `${registeredAt}T${String(9 + idx).padStart(2, '0')}:00:00+07:00`,
    registrationStatus: p.registrationStatus,
    learningStatus: p.learningStatus,
    progress: p.progress ?? 0,
    score: p.score ?? null,
    result: p.result ?? null,
    instructorComment: p.instructorComment ?? '',
    completedAt: p.completedAt ?? null,
    resultPublished: p.resultPublished ?? false,
  }))
}