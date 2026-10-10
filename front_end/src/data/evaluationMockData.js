/**
 * Mock data cho Quản lý đánh giá hiệu suất (Phần 9).
 *
 * Quy tắc:
 * - Liên kết employeeId với employeeMockData.js (emp-001 ... emp-015).
 *   KHÔNG copy danh sách nhân viên/phòng ban.
 * - KHÔNG random. Toàn bộ số liệu chốt cứng tại đây.
 * - Điểm 1-5, làm tròn tối đa 2 chữ số thập phân (tính ở service).
 */

export const CYCLE_STATUSES = [
  { value: 'draft',      label: 'Bản nháp',     tone: 'inactive' },
  { value: 'upcoming',   label: 'Sắp diễn ra',  tone: 'pending' },
  { value: 'in_progress', label: 'Đang diễn ra', tone: 'warning' },
  { value: 'completed',  label: 'Đã hoàn thành', tone: 'success' },
  { value: 'closed',     label: 'Đã đóng',      tone: 'neutral' },
]

export const CYCLE_STATUS_LABEL = CYCLE_STATUSES.reduce((acc, s) => {
  acc[s.value] = s.label
  return acc
}, {})

export const EVALUATION_STATUSES = [
  { value: 'pending',    label: 'Chờ đánh giá',  tone: 'inactive' },
  { value: 'draft',      label: 'Bản nháp',      tone: 'pending' },
  { value: 'in_progress', label: 'Đang đánh giá', tone: 'warning' },
  { value: 'completed',  label: 'Đã hoàn thành', tone: 'success' },
  { value: 'published',  label: 'Đã công bố',    tone: 'brand' },
  { value: 'rejected',   label: 'Bị từ chối',    tone: 'danger' },
]

export const EVALUATION_STATUS_LABEL = EVALUATION_STATUSES.reduce((acc, s) => {
  acc[s.value] = s.label
  return acc
}, {})

/**
 * 6 tiêu chí đánh giá mặc định. Trọng số mặc định đều bằng nhau (= 1) -
 * khi nghiệp vụ chính thức được phê duyệt sẽ cập nhật trọng số tại đây.
 */
export const EVALUATION_CRITERIA = [
  {
    id: 'quality',
    name: 'Chất lượng công việc',
    description: 'Mức độ chính xác, hoàn thiện và đạt chuẩn của sản phẩm/dịch vụ.',
    weight: 1,
    required: true,
  },
  {
    id: 'productivity',
    name: 'Năng suất và tiến độ',
    description: 'Khả năng hoàn thành khối lượng công việc đúng thời hạn.',
    weight: 1,
    required: true,
  },
  {
    id: 'expertise',
    name: 'Kỹ năng chuyên môn',
    description: 'Kiến thức và áp dụng đúng chuyên môn vào công việc thực tế.',
    weight: 1,
    required: true,
  },
  {
    id: 'teamwork',
    name: 'Khả năng làm việc nhóm',
    description: 'Hỗ trợ đồng nghiệp, chia sẻ thông tin và xây dựng mối quan hệ tốt.',
    weight: 1,
    required: true,
  },
  {
    id: 'responsibility',
    name: 'Tinh thần trách nhiệm',
    description: 'Chủ động, chịu trách nhiệm với kết quả công việc.',
    weight: 1,
    required: true,
  },
  {
    id: 'learning',
    name: 'Khả năng học hỏi và phát triển',
    description: 'Tiếp thu kiến thức mới, sẵn sàng thích ứng với thay đổi.',
    weight: 1,
    required: true,
  },
]

/**
 * Cycles - mỗi cycle đại diện cho một đợt đánh giá.
 *
 * employeeIds: nếu null/mảng rỗng -> áp dụng cho tất cả nhân viên active
 * thuộc các departmentIds. Nếu có employeeIds -> chỉ áp dụng cho các nhân
 * viên được liệt kê (ưu tiên departmentIds làm hint).
 */
export const EVALUATION_CYCLES = [
  {
    id: 'cycle-001',
    name: 'Đánh giá Q2/2026',
    description: 'Kỳ đánh giá định kỳ quý 2 năm 2026 cho tất cả phòng ban.',
    startDate: '2026-04-01',
    endDate: '2026-06-30',
    departmentIds: [], // áp dụng toàn công ty
    employeeIds: [],
    status: 'completed',
    createdAt: '2026-03-25T08:00:00+07:00',
    updatedAt: '2026-07-10T17:00:00+07:00',
  },
  {
    id: 'cycle-002',
    name: 'Đánh giá Q3/2026',
    description: 'Kỳ đánh giá định kỳ quý 3 năm 2026.',
    startDate: '2026-07-01',
    endDate: '2026-09-30',
    departmentIds: [],
    employeeIds: [],
    status: 'completed',
    createdAt: '2026-06-25T08:00:00+07:00',
    updatedAt: '2026-10-01T12:00:00+07:00',
  },
  {
    id: 'cycle-003',
    name: 'Đánh giá Q4/2026',
    description: 'Kỳ đánh giá định kỳ quý 4 năm 2026, đang triển khai.',
    startDate: '2026-10-01',
    endDate: '2026-12-31',
    departmentIds: [],
    employeeIds: [],
    status: 'in_progress',
    createdAt: '2026-09-20T08:00:00+07:00',
    updatedAt: '2026-10-01T08:00:00+07:00',
  },
  {
    id: 'cycle-004',
    name: 'Đánh giá kỹ thuật Q4/2026',
    description: 'Kỳ đánh giá bổ sung cho phòng Kỹ thuật, tập trung kỹ năng chuyên môn.',
    startDate: '2026-11-01',
    endDate: '2026-12-15',
    departmentIds: ['dept-eng'],
    employeeIds: [],
    status: 'upcoming',
    createdAt: '2026-10-01T09:00:00+07:00',
    updatedAt: '2026-10-01T09:00:00+07:00',
  },
]

/**
 * Evaluations - bản ghi đánh giá từng nhân viên trong từng kỳ.
 *
 * Cấu trúc criteriaScores:
 *   [{ criteriaId, criteriaName, score, comment }]
 *
 * averageScore được tính ở service bằng trung bình cộng các tiêu chí có
 * điểm hợp lệ (1-5).
 */
export const EMPLOYEE_EVALUATIONS = [
  // ===== Cycle Q2/2026 (completed, tất cả published) =====
  ...buildAllScoresForCycle('cycle-001', '2026-07-05T09:00:00+07:00', 'published', {
    'emp-001': { reviewerId: 'usr-admin-001', reviewerName: 'Nguyễn Minh Anh', scores: [4.5, 4.5, 4.0, 4.5, 5.0, 4.5], strengths: 'Quản lý tốt nhân sự, định hướng rõ ràng.', improvements: 'Có thể chủ động hơn trong việc phân bổ nguồn lực.', comment: 'Hoàn thành xuất sắc nhiệm vụ Q2.', goals: 'Phát triển năng lực lãnh đạo cấp cao.', training: 'Khóa Leadership for HR Manager.' },
    'emp-002': { reviewerId: 'emp-001', reviewerName: 'Nguyễn Minh Anh', scores: [4.0, 4.5, 3.5, 4.5, 4.5, 4.0], strengths: 'Hỗ trợ tuyển dụng tốt, nhiệt tình.', improvements: 'Cần cải thiện kỹ năng viết báo cáo.', comment: 'Nhân viên tích cực, đóng góp ổn định.', goals: 'Nâng cao kỹ năng phân tích dữ liệu nhân sự.', training: 'Khóa HR Analytics cơ bản.' },
    'emp-005': { reviewerId: 'emp-006', reviewerName: 'Ngô Hải Đăng', scores: [4.0, 4.0, 4.5, 4.0, 4.5, 4.5], strengths: 'Nắm vững React, code sạch.', improvements: 'Cần cải thiện kỹ năng estimate thời gian.', comment: 'Hoàn thành tốt sprint Q2.', goals: 'Học thêm về testing tự động.', training: 'Khoá Vitest và React Testing Library.' },
    'emp-006': { reviewerId: 'usr-admin-001', reviewerName: 'Nguyễn Minh Anh', scores: [4.5, 4.5, 5.0, 4.5, 5.0, 4.5], strengths: 'Dẫn dắt team tốt, mentor hiệu quả.', improvements: 'Cân bằng khối lượng task quản lý và kỹ thuật.', comment: 'Quản lý kỹ thuật xuất sắc.', goals: 'Xây dựng quy trình DevOps chuẩn.', training: 'Khoá quản lý dự án nâng cao.' },
    'emp-007': { reviewerId: 'usr-admin-001', reviewerName: 'Nguyễn Minh Anh', scores: [4.0, 4.0, 4.0, 4.5, 4.5, 4.0], strengths: 'Khả năng xử lý tình huống khách hàng tốt.', improvements: 'Tăng cường đào tạo đội nhóm.', comment: 'CSKH Lead ổn định.', goals: 'Phát triển năng lực quản lý đội.', training: 'Khoá People Management.' },
    'emp-008': { reviewerId: 'emp-006', reviewerName: 'Ngô Hải Đăng', scores: [3.5, 4.0, 4.0, 4.0, 4.0, 4.5], strengths: 'Backend vững vàng, sẵn sàng hỗ trợ đồng đội.', improvements: 'Giao tiếp với khách hàng cần chủ động hơn.', comment: 'Hoàn thành nhiệm vụ ổn.', goals: 'Học về system design.', training: 'Khoá System Design Interview.' },
    'emp-009': { reviewerId: 'emp-006', reviewerName: 'Ngô Hải Đăng', scores: [4.0, 4.0, 4.5, 4.0, 4.5, 4.5], strengths: 'DevOps chủ động, pipeline ổn định.', improvements: 'Mở rộng kiến thức cloud.', comment: 'Đóng góp quan trọng cho hạ tầng.', goals: 'Đạt chứng chỉ AWS Solutions Architect.', training: 'AWS certification track.' },
    'emp-010': { reviewerId: 'emp-003', reviewerName: 'Lê Hoàng Phương', scores: [4.0, 4.0, 3.5, 4.0, 4.0, 4.0], strengths: 'Thiết kế sáng tạo, phù hợp brand.', improvements: 'Cần cập nhật xu hướng thiết kế mới.', comment: 'Designer tích cực.', goals: 'Học về motion design.', training: 'Khoá After Effects cơ bản.' },
    'emp-011': { reviewerId: 'usr-admin-001', reviewerName: 'Nguyễn Minh Anh', scores: [4.5, 4.5, 4.5, 5.0, 5.0, 4.5], strengths: 'Dẫn dắt team Marketing rất tốt.', improvements: 'Có thể delegate nhiều hơn.', comment: 'Hoàn thành KPI Q2 xuất sắc.', goals: 'Phát triển chiến lược marketing dài hạn.', training: 'Khoá Strategic Marketing.' },
    'emp-015': { reviewerId: 'emp-004', reviewerName: 'Phan Thanh Tùng', scores: [4.0, 4.0, 4.0, 4.0, 4.5, 4.0], strengths: 'Sổ sách chính xác, đúng hạn.', improvements: 'Nâng cao tiếng Anh chuyên ngành.', comment: 'Kế toán viên ổn định.', goals: 'Tham gia khóa chứng chỉ kế toán quốc tế.', training: 'Khoá ACCA Foundation.' },
  }),

  // ===== Cycle Q3/2026 (completed, một số published) =====
  ...buildAllScoresForCycle('cycle-002', '2026-10-02T09:00:00+07:00', 'published', {
    'emp-001': { reviewerId: 'usr-admin-001', reviewerName: 'Nguyễn Minh Anh', scores: [4.5, 4.5, 4.5, 4.5, 5.0, 4.5], strengths: 'Hoàn thành tốt các dự án HR Q3.', improvements: 'Có thể đẩy mạnh số hóa quy trình HR.', comment: 'Ổn định và hiệu quả.', goals: 'Triển khai số hóa hồ sơ nhân viên.', training: 'Khoá HR Digital Transformation.' },
    'emp-002': { reviewerId: 'emp-001', reviewerName: 'Nguyễn Minh Anh', scores: [4.0, 4.0, 3.5, 4.5, 4.5, 4.0], strengths: 'Phối hợp phòng ban tốt.', improvements: 'Cần chủ động hơn trong các đề xuất.', comment: 'Tiến bộ ổn định.', goals: 'Chủ trì một quy trình tuyển dụng hoàn chỉnh.', training: 'Khoá End-to-end Recruiting.' },
    'emp-005': { reviewerId: 'emp-006', reviewerName: 'Ngô Hải Đăng', scores: [4.5, 4.5, 4.5, 4.0, 4.5, 4.5], strengths: 'Hoàn thành vượt target sprint.', improvements: 'Cải thiện kỹ năng estimate.', comment: 'Tiến bộ rõ rệt so với Q2.', goals: 'Trở thành lead cho 1 dự án nhỏ.', training: 'Khoá Tech Lead fundamentals.' },
    'emp-006': { reviewerId: 'usr-admin-001', reviewerName: 'Nguyễn Minh Anh', scores: [4.5, 4.5, 5.0, 5.0, 5.0, 4.5], strengths: 'Quản lý đội ngũ rất hiệu quả.', improvements: 'Cần thời gian cho bản thân nhiều hơn.', comment: 'Hoàn thành xuất sắc KPI Q3.', goals: 'Xây dựng đội ngũ senior.', training: 'Khoá Coaching for Managers.' },
    'emp-007': { reviewerId: 'usr-admin-001', reviewerName: 'Nguyễn Minh Anh', scores: [4.5, 4.5, 4.0, 5.0, 5.0, 4.5], strengths: 'CSAT tăng 15%.', improvements: 'Tối ưu quy trình training cho nhân viên mới.', comment: 'Hoàn thành xuất sắc.', goals: 'Đạt CSAT 95%.', training: 'Khoá Advanced CS.' },
    'emp-008': { reviewerId: 'emp-006', reviewerName: 'Ngô Hải Đăng', scores: [4.0, 4.0, 4.5, 4.0, 4.5, 4.5], strengths: 'Hoàn thành tốt các task backend.', improvements: 'Cải thiện documentation.', comment: 'Tiến bộ đều.', goals: 'Tự tin thuyết trình giải pháp.', training: 'Khoá Public Speaking cho Dev.' },
    'emp-009': { reviewerId: 'emp-006', reviewerName: 'Ngô Hải Đăng', scores: [4.0, 4.5, 4.5, 4.0, 4.5, 4.5], strengths: 'Triển khai Kubernetes thành công.', improvements: 'Mở rộng monitoring stack.', comment: 'Hoàn thành tốt mục tiêu.', goals: 'Hoàn thành AWS SAA.', training: 'AWS Solutions Architect Associate.' },
    'emp-010': { reviewerId: 'emp-003', reviewerName: 'Lê Hoàng Phương', scores: [4.0, 4.0, 4.0, 4.0, 4.0, 4.0], strengths: 'Thiết kế ổn định, đúng deadline.', improvements: 'Cần đa dạng style thiết kế hơn.', comment: 'Hoàn thành KPI.', goals: 'Thử sức với motion design.', training: 'Khoá Lottie & Motion.' },
    'emp-011': { reviewerId: 'usr-admin-001', reviewerName: 'Nguyễn Minh Anh', scores: [4.5, 4.5, 4.5, 5.0, 5.0, 4.5], strengths: 'Chiến dịch Q3 đạt ROI cao.', improvements: 'Tăng cường phân tích dữ liệu marketing.', comment: 'Vượt KPI 20%.', goals: 'Xây dựng chiến lược inbound.', training: 'Khoá Inbound Marketing.' },
    'emp-015': { reviewerId: 'emp-004', reviewerName: 'Phan Thanh Tùng', scores: [4.0, 4.0, 4.0, 4.0, 4.5, 4.0], strengths: 'Hỗ trợ quyết toán thuế đúng hạn.', improvements: 'Nâng cao tiếng Anh.', comment: 'Ổn định.', goals: 'Tham gia khóa IFRS.', training: 'Khoá IFRS Foundation.' },
  }),

  // ===== Cycle Q4/2026 (in_progress) - vài bản nháp, vài completed, vài pending =====
  ...buildInProgressCycle('cycle-003'),

  // ===== Cycle Q4 kỹ thuật (upcoming) - chỉ các evaluation pending =====
  ...buildUpcomingCycle('cycle-004'),
]

function buildAllScoresForCycle(cycleId, publishedAt, publishedStatus, map) {
  return Object.entries(map).map(([employeeId, data]) => ({
    id: `${cycleId}-${employeeId}`,
    cycleId,
    employeeId,
    reviewerId: data.reviewerId,
    reviewerName: data.reviewerName,
    criteriaScores: EVALUATION_CRITERIA.map((c, i) => ({
      criteriaId: c.id,
      criteriaName: c.name,
      score: data.scores[i] ?? 0,
      comment: '',
    })),
    averageScore: round2(mean(data.scores)),
    strengths: data.strengths,
    improvements: data.improvements,
    generalComment: data.comment,
    developmentGoals: data.goals,
    trainingRecommendations: data.training,
    status: publishedStatus,
    publishedAt,
    createdAt: '2026-06-25T08:00:00+07:00',
    updatedAt: publishedAt,
  }))
}

function buildInProgressCycle(cycleId) {
  // Q4: một số completed (admin đã làm), một số in_progress (đang đánh giá), một số pending
  return [
    // emp-001 - completed
    {
      id: `${cycleId}-emp-001`,
      cycleId,
      employeeId: 'emp-001',
      reviewerId: 'usr-admin-001',
      reviewerName: 'Nguyễn Minh Anh',
      criteriaScores: EVALUATION_CRITERIA.map((c, i) => ({
        criteriaId: c.id,
        criteriaName: c.name,
        score: [4.5, 4.5, 4.5, 5.0, 5.0, 4.5][i] ?? 0,
        comment: '',
      })),
      averageScore: round2(mean([4.5, 4.5, 4.5, 5.0, 5.0, 4.5])),
      strengths: 'Định hướng chiến lược HR rõ ràng.',
      improvements: 'Đẩy mạnh chuyển đổi số.',
      generalComment: 'Đang trong giai đoạn ổn định.',
      developmentGoals: 'Triển khai số hóa hồ sơ toàn công ty.',
      trainingRecommendations: 'Khoá HR Digital Transformation.',
      status: 'completed',
      publishedAt: null,
      createdAt: '2026-10-01T08:30:00+07:00',
      updatedAt: '2026-10-01T15:00:00+07:00',
    },
    // emp-002 - in_progress (bản nháp đã lưu)
    {
      id: `${cycleId}-emp-002`,
      cycleId,
      employeeId: 'emp-002',
      reviewerId: 'emp-001',
      reviewerName: 'Nguyễn Minh Anh',
      criteriaScores: EVALUATION_CRITERIA.map((c, i) => ({
        criteriaId: c.id,
        criteriaName: c.name,
        score: [4.0, 4.0, 0, 4.5, 4.5, 4.0][i] ?? 0,
        comment: '',
      })),
      averageScore: round2(mean([4.0, 4.0, 0, 4.5, 4.5, 4.0])),
      strengths: '',
      improvements: '',
      generalComment: '',
      developmentGoals: '',
      trainingRecommendations: '',
      status: 'in_progress',
      publishedAt: null,
      createdAt: '2026-10-01T09:00:00+07:00',
      updatedAt: '2026-10-01T16:00:00+07:00',
    },
    // emp-005 - pending (chưa đánh giá)
    {
      id: `${cycleId}-emp-005`,
      cycleId,
      employeeId: 'emp-005',
      reviewerId: 'emp-006',
      reviewerName: 'Ngô Hải Đăng',
      criteriaScores: EVALUATION_CRITERIA.map((c) => ({
        criteriaId: c.id,
        criteriaName: c.name,
        score: 0,
        comment: '',
      })),
      averageScore: 0,
      strengths: '',
      improvements: '',
      generalComment: '',
      developmentGoals: '',
      trainingRecommendations: '',
      status: 'pending',
      publishedAt: null,
      createdAt: '2026-10-01T08:00:00+07:00',
      updatedAt: '2026-10-01T08:00:00+07:00',
    },
    // emp-006 - pending
    {
      id: `${cycleId}-emp-006`,
      cycleId,
      employeeId: 'emp-006',
      reviewerId: 'usr-admin-001',
      reviewerName: 'Nguyễn Minh Anh',
      criteriaScores: EVALUATION_CRITERIA.map((c) => ({
        criteriaId: c.id,
        criteriaName: c.name,
        score: 0,
        comment: '',
      })),
      averageScore: 0,
      strengths: '',
      improvements: '',
      generalComment: '',
      developmentGoals: '',
      trainingRecommendations: '',
      status: 'pending',
      publishedAt: null,
      createdAt: '2026-10-01T08:00:00+07:00',
      updatedAt: '2026-10-01T08:00:00+07:00',
    },
    // emp-007 - pending
    {
      id: `${cycleId}-emp-007`,
      cycleId,
      employeeId: 'emp-007',
      reviewerId: 'usr-admin-001',
      reviewerName: 'Nguyễn Minh Anh',
      criteriaScores: EVALUATION_CRITERIA.map((c) => ({
        criteriaId: c.id,
        criteriaName: c.name,
        score: 0,
        comment: '',
      })),
      averageScore: 0,
      strengths: '',
      improvements: '',
      generalComment: '',
      developmentGoals: '',
      trainingRecommendations: '',
      status: 'pending',
      publishedAt: null,
      createdAt: '2026-10-01T08:00:00+07:00',
      updatedAt: '2026-10-01T08:00:00+07:00',
    },
  ]
}

function buildUpcomingCycle(cycleId) {
  const empIds = ['emp-005', 'emp-006', 'emp-008', 'emp-009', 'emp-012']
  return empIds.map((employeeId) => {
    const reviewerMap = {
      'emp-005': { id: 'emp-006', name: 'Ngô Hải Đăng' },
      'emp-006': { id: 'usr-admin-001', name: 'Nguyễn Minh Anh' },
      'emp-008': { id: 'emp-006', name: 'Ngô Hải Đăng' },
      'emp-009': { id: 'emp-006', name: 'Ngô Hải Đăng' },
      'emp-012': { id: 'emp-006', name: 'Ngô Hải Đăng' },
    }
    const r = reviewerMap[employeeId]
    return {
      id: `${cycleId}-${employeeId}`,
      cycleId,
      employeeId,
      reviewerId: r.id,
      reviewerName: r.name,
      criteriaScores: EVALUATION_CRITERIA.map((c) => ({
        criteriaId: c.id,
        criteriaName: c.name,
        score: 0,
        comment: '',
      })),
      averageScore: 0,
      strengths: '',
      improvements: '',
      generalComment: '',
      developmentGoals: '',
      trainingRecommendations: '',
      status: 'pending',
      publishedAt: null,
      createdAt: '2026-10-01T09:00:00+07:00',
      updatedAt: '2026-10-01T09:00:00+07:00',
    }
  })
}

function mean(arr) {
  const valid = arr.filter((v) => typeof v === 'number' && v > 0)
  if (!valid.length) return 0
  return valid.reduce((s, v) => s + v, 0) / valid.length
}

function round2(n) {
  return Math.round(n * 100) / 100
}