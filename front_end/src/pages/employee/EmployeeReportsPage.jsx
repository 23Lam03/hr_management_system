import { useEffect, useMemo, useState } from 'react'
import {
  AlertTriangle,
  BarChart3,
  Briefcase,
  Calendar,
  Clock,
  ClipboardCheck,
  DollarSign,
  FileText,
  GraduationCap,
  Gift,
  LineChart as LineChartIcon,
  RefreshCcw,
} from 'lucide-react'

import PageHeader from '../../components/common/PageHeader'
import Card from '../../components/common/Card'
import Button from '../../components/common/Button'
import Input from '../../components/common/Input'
import Select from '../../components/common/Select'
import Tabs from '../../components/common/Tabs'
import EmptyState from '../../components/common/EmptyState'
import Loading from '../../components/common/Loading'
import StatCard from '../../components/common/StatCard'
import Table from '../../components/common/Table'
import Badge from '../../components/common/Badge'

import { useAuth } from '../../contexts/useAuth'
import { useI18n } from '../../i18n/useI18n'

import {
  getAttendanceStatuses,
  subscribeAttendance,
} from '../../services/attendanceService'

import {
  getPaymentStatuses,
  subscribePayroll,
} from '../../services/payrollService'

import {
  getLeaveStatuses,
  getLeaveTypes,
  subscribeLeaves,
} from '../../services/leaveService'

import {
  getEvaluationStatusLabel,
  getCycleStatusLabel,
  queryEvaluationsByCycle,
  queryEvaluationCycles,
  subscribeEvaluations,
} from '../../services/evaluationService'

import {
  getTrainingCategories,
  getParticipantStatuses,
  getMyTrainings,
  subscribeTrainings,
} from '../../services/trainingService'

import {
  getBenefitStatuses,
  getBenefitTypes,
  getMyBenefits,
  subscribeBenefits,
} from '../../services/benefitService'

import {
  getContractStatuses,
  getContractTypes,
  getContractsByEmployee,
  subscribeContracts,
} from '../../services/contractService'

import {
  getPromotionStatuses,
  getPromotionsByEmployeeId,
  subscribePromotions,
} from '../../services/promotionService'

import {
  subscribeReport,
  getAttendanceReport,
  getPayrollReport,
  getLeaveReport,
  getEvaluationReport,
  getTrainingReport,
  getBenefitsReport,
  getContractsReport,
} from '../../services/reportService'

import { formatCurrencyVnd, formatDate } from '../../utils/format'

const DEFAULT_FILTERS = {
  search: '',
  status: '',
  type: '',
  from: '',
  to: '',
  page: 1,
}

const PAGE_SIZE = 10

export default function EmployeeReportsPage() {
  const { user } = useAuth()
  const { t } = useI18n()
  const [tab, setTab] = useState('overview')

  const currentEmployeeId = useMemo(() => {
    if (!user) return null
    return user.employeeId ?? user.id
  }, [user])

  if (!user) {
    return (
      <div className="flex h-40 items-center justify-center rounded-lg border border-dashed border-neutral-300 bg-white">
        <Loading size="md" label={t('employeeReports.loading')} />
      </div>
    )
  }

  if (!currentEmployeeId) {
    return (
      <div className="flex flex-col gap-4">
        <PageHeader
          title={t('employeeReports.myReports')}
          subtitle={t('employeeReports.myReportsDesc')}
          icon={BarChart3}
        />
        <EmptyState
          icon={AlertTriangle}
          title={t('employeeReports.personalReportUnavailable')}
          description={t('employeeReports.accountNotLinked')}
        />
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title={t('employeeReports.myReports')}
        subtitle={t('employeeReports.myReportsDesc')}
        icon={BarChart3}
        actions={
          <Button
            variant="secondary"
            size="md"
            icon={RefreshCcw}
            onClick={() => window.location.reload()}
          >
            {t('employeeReports.refresh')}
          </Button>
        }
      />

      <Tabs
        value={tab}
        onChange={setTab}
        items={[
          { value: 'overview',    label: t('employeeReports.overview'),      icon: LineChartIcon },
          { value: 'attendance',  label: t('employeeReports.attendance'),  icon: Clock },
          { value: 'payroll',      label: t('employeeReports.payroll'),       icon: DollarSign },
          { value: 'leave',        label: t('employeeReports.leave'),         icon: Calendar },
          { value: 'evaluation',   label: t('employeeReports.performance'),    icon: ClipboardCheck },
          { value: 'training',     label: t('employeeReports.training'),      icon: GraduationCap },
          { value: 'benefits',     label: t('employeeReports.benefits'),     icon: Gift },
          { value: 'contracts',    label: t('employeeReports.contracts'),    icon: FileText },
          { value: 'promotions',   label: t('employeeReports.promotions'),   icon: Briefcase },
        ]}
      />

      {tab === 'overview' && (
        <OverviewSection employeeId={currentEmployeeId} t={t} />
      )}
      {tab === 'attendance' && (
        <AttendanceSection employeeId={currentEmployeeId} t={t} />
      )}
      {tab === 'payroll' && (
        <PayrollSection employeeId={currentEmployeeId} t={t} />
      )}
      {tab === 'leave' && (
        <LeaveSection employeeId={currentEmployeeId} t={t} />
      )}
      {tab === 'evaluation' && (
        <EvaluationSection employeeId={currentEmployeeId} t={t} />
      )}
      {tab === 'training' && (
        <TrainingSection employeeId={currentEmployeeId} t={t} />
      )}
      {tab === 'benefits' && (
        <BenefitsSection employeeId={currentEmployeeId} t={t} />
      )}
      {tab === 'contracts' && (
        <ContractsSection employeeId={currentEmployeeId} t={t} />
      )}
      {tab === 'promotions' && (
        <PromotionsSection employeeId={currentEmployeeId} t={t} />
      )}
    </div>
  )
}

// ---------- Hook: bump khi service thay đổi -------------------------------
function useServicesVersion() {
  const [v, setV] = useState(0)
  useEffect(() => {
    const unsubs = [
      subscribeReport(() => setV((n) => n + 1)),
      subscribeAttendance(() => setV((n) => n + 1)),
      subscribePayroll(() => setV((n) => n + 1)),
      subscribeLeaves(() => setV((n) => n + 1)),
      subscribeEvaluations(() => setV((n) => n + 1)),
      subscribeTrainings(() => setV((n) => n + 1)),
      subscribeBenefits(() => setV((n) => n + 1)),
      subscribeContracts(() => setV((n) => n + 1)),
      subscribePromotions(() => setV((n) => n + 1)),
    ]
    return () => unsubs.forEach((u) => u())
  }, [])
  return v
}

// ---------- Overview -------------------------------------------------------
function OverviewSection({ employeeId, t }) {
  const v = useServicesVersion()

  const overview = useMemo(() => {
    const attendance = getAttendanceReport({ employeeId })
    const payroll = getPayrollReport({ employeeId })
    const leave = getLeaveReport({ employeeId })
    const training = getTrainingReport({ employeeId })
    const benefits = getBenefitsReport({ employeeId })
    const contracts = getContractsReport({ employeeId })

    // evaluation: lấy cycle → evaluations của cycle → filter theo employeeId
    const cycles = queryEvaluationCycles({ page: 1 })
    const evalRecords = []
    cycles.items.forEach((c) => {
      const items = queryEvaluationsByCycle(c.id, { page: 1 }).items
      items.forEach((it) => {
        if (it.employeeId === employeeId) evalRecords.push({ ...it, cycleName: c.name })
      })
    })

    return { attendance, payroll, leave, training, benefits, contracts, evalRecords }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [employeeId, v])

  return (
    <div className="flex flex-col gap-6">
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard
          label={t('employeeReports.attendanceRecords')}
          value={overview.attendance.summary.total}
          icon={Clock}
          tone="primary"
        />
        <StatCard
          label={t('employeeReports.payrollRecords')}
          value={overview.payroll.summary.total}
          icon={DollarSign}
          tone="success"
          delta={overview.payroll.summary.net ? `${t('employeeReports.net')}: ${formatCurrencyVnd(overview.payroll.summary.net)}` : undefined}
        />
        <StatCard
          label={t('employeeReports.leaveRequests')}
          value={overview.leave.summary.total}
          icon={Calendar}
          tone="warning"
        />
        <StatCard
          label={t('employeeReports.trainings')}
          value={overview.training.summary.total}
          icon={GraduationCap}
          tone="info"
        />
      </div>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard
          label={t('employeeReports.benefits')}
          value={overview.benefits.summary.total}
          icon={Gift}
          tone="primary"
        />
        <StatCard
          label={t('employeeReports.contracts')}
          value={overview.contracts.summary.total}
          icon={FileText}
          tone="info"
        />
        <StatCard
          label={t('employeeReports.performanceReviews')}
          value={overview.evalRecords.length}
          icon={ClipboardCheck}
          tone="warning"
        />
        <StatCard
          label={t('employeeReports.latestPayroll')}
          value={overview.payroll.records[0] ? formatCurrencyVnd(overview.payroll.records[0].netSalary) : '—'}
          icon={DollarSign}
          tone="success"
        />
      </div>
      <Card>
        <p className="text-[13px] text-neutral-500">
          {t('employeeReports.reportDataNote')}
        </p>
      </Card>
    </div>
  )
}

// ---------- Attendance -----------------------------------------------------
function AttendanceSection({ employeeId, t }) {
  const v = useServicesVersion()
  const [filters, setFilters] = useState(DEFAULT_FILTERS)

  const report = useMemo(() => {
    return getAttendanceReport({
      employeeId,
      search: filters.search,
      status: filters.status,
      from: filters.from,
      to: filters.to,
      page: filters.page,
      pageSize: PAGE_SIZE,
    })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [employeeId, filters, v])

  const updateFilter = (field) => (value) =>
    setFilters((p) => ({ ...p, [field]: value, page: 1 }))

  const records = report.records || []
  const statusOptions = getAttendanceStatuses()
  const summary = report.summary || {}
  const hasData = records.length > 0 || summary.total > 0

  return (
    <div className="flex flex-col gap-4">
      <Card>
        <div className="grid grid-cols-1 gap-3 md:grid-cols-12">
          <div className="md:col-span-4">
            <Input placeholder={t('employeeReports.searchByDateNote')} value={filters.search} onChange={(e) => updateFilter('search')(e.target.value)} />
          </div>
          <div className="md:col-span-3">
            <Select options={[{ value: '', label: t('employeeReports.allStatuses') }, ...statusOptions]} value={filters.status} onChange={(e) => updateFilter('status')(e.target.value)} />
          </div>
          <div className="md:col-span-2">
            <Input type="date" value={filters.from} onChange={(e) => updateFilter('from')(e.target.value)} />
          </div>
          <div className="md:col-span-2">
            <Input type="date" value={filters.to} onChange={(e) => updateFilter('to')(e.target.value)} />
          </div>
        </div>
      </Card>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard label={t('employeeReports.total')} value={summary.total || 0} icon={Clock} tone="primary" />
        <StatCard label={t('employeeReports.present')} value={(summary.byStatus?.on_time || 0) + (summary.byStatus?.late || 0)} icon={Clock} tone="success" />
        <StatCard label={t('employeeReports.late')} value={summary.byStatus?.late || 0} icon={Clock} tone="warning" />
        <StatCard label={t('employeeReports.absent')} value={summary.byStatus?.absent || 0} icon={Clock} tone="danger" />
      </div>

      {!hasData ? (
        <Card>
          <EmptyState title={t('employeeReports.noAttendanceReport')} description={t('employeeReports.attendanceRecordsAppear')} />
        </Card>
      ) : (
        <Table
          data={records}
          loading={false}
          pagination={{ page: report.page, pageSize: report.pageSize, total: report.total, onChange: (p) => setFilters((prev) => ({ ...prev, page: p })) }}
          rowKey="id"
          emptyTitle={t('employeeReports.noMatchingRecords')}
          columns={[
            { key: 'date', header: t('employeeReports.date'), render: (r) => formatDate(r.date) || '—' },
            { key: 'checkIn', header: t('employeeReports.checkIn'), render: (r) => r.checkIn || '—' },
            { key: 'checkOut', header: t('employeeReports.checkOut'), render: (r) => r.checkOut || '—' },
            { key: 'workHours', header: t('employeeReports.workHours'), render: (r) => (r.workHours != null ? `${Number(r.workHours).toFixed(2)}h` : '—') },
            { key: 'late', header: t('employeeReports.lateMin'), render: (r) => r.lateMinutes || 0 },
            { key: 'status', header: t('employeeReports.status'), render: (r) => <Badge tone={statusToTone(r.status)}>{statusLabel(r.status)}</Badge> },
          ]}
        />
      )}
    </div>
  )
}

function statusLabel(s) {
  const found = getAttendanceStatuses().find((x) => x.value === s)
  return found?.label || s || '—'
}
function statusToTone(s) {
  if (s === 'on_time') return 'success'
  if (s === 'late') return 'warning'
  if (s === 'absent') return 'danger'
  return 'neutral'
}

// ---------- Payroll --------------------------------------------------------
function PayrollSection({ employeeId, t }) {
  const v = useServicesVersion()
  const [filters, setFilters] = useState(DEFAULT_FILTERS)

  const report = useMemo(() => {
    return getPayrollReport({
      employeeId,
      search: filters.search,
      status: filters.status,
      from: filters.from,
      to: filters.to,
      page: filters.page,
      pageSize: PAGE_SIZE,
    })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [employeeId, filters, v])

  const updateFilter = (field) => (value) =>
    setFilters((p) => ({ ...p, [field]: value, page: 1 }))

  const records = report.records || []
  const summary = report.summary || {}
  const hasData = records.length > 0 || summary.total > 0
  const statusOptions = getPaymentStatuses()

  return (
    <div className="flex flex-col gap-4">
      <Card>
        <div className="grid grid-cols-1 gap-3 md:grid-cols-12">
          <div className="md:col-span-5">
            <Input placeholder={t('employeeReports.searchByPeriod')} value={filters.search} onChange={(e) => updateFilter('search')(e.target.value)} />
          </div>
          <div className="md:col-span-3">
            <Select options={[{ value: '', label: t('employeeReports.allStatuses') }, ...statusOptions]} value={filters.status} onChange={(e) => updateFilter('status')(e.target.value)} />
          </div>
        </div>
      </Card>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard label={t('employeeReports.records')} value={summary.total || 0} icon={FileText} tone="primary" />
        <StatCard label={t('employeeReports.gross')} value={summary.gross ? formatCurrencyVnd(summary.gross) : '—'} icon={DollarSign} tone="info" />
        <StatCard label={t('employeeReports.deductions')} value={summary.deduction ? formatCurrencyVnd(summary.deduction) : '—'} icon={DollarSign} tone="warning" />
        <StatCard label={t('employeeReports.net')} value={summary.net ? formatCurrencyVnd(summary.net) : '—'} icon={DollarSign} tone="success" />
      </div>

      {!hasData ? (
        <Card>
          <EmptyState title={t('employeeReports.noPayrollReport')} description={t('employeeReports.payrollRecordsAppear')} />
        </Card>
      ) : (
        <Table
          data={records}
          loading={false}
          pagination={{ page: report.page, pageSize: report.pageSize, total: report.total, onChange: (p) => setFilters((prev) => ({ ...prev, page: p })) }}
          rowKey="id"
          emptyTitle={t('employeeReports.noMatchingRecords')}
          columns={[
            { key: 'period', header: t('employeeReports.period'), render: (r) => `${r.month ?? '?'}/${r.year ?? '—'}` },
            { key: 'gross', header: t('employeeReports.gross'), render: (r) => formatCurrencyVnd(r.grossSalary) },
            { key: 'deduction', header: t('employeeReports.deductions'), render: (r) => formatCurrencyVnd(r.totalDeduction) },
            { key: 'net', header: t('employeeReports.netSalary'), render: (r) => formatCurrencyVnd(r.netSalary) },
            { key: 'status', header: t('employeeReports.status'), render: (r) => <Badge tone={paymentTone(r.paymentStatus)}>{paymentLabel(r.paymentStatus)}</Badge> },
          ]}
        />
      )}
    </div>
  )
}

function paymentLabel(s) {
  const found = getPaymentStatuses().find((x) => x.value === s)
  return found?.label || s || '—'
}
function paymentTone(s) {
  if (s === 'paid') return 'success'
  if (s === 'pending') return 'warning'
  return 'neutral'
}

// ---------- Leave ----------------------------------------------------------
function LeaveSection({ employeeId, t }) {
  const v = useServicesVersion()
  const [filters, setFilters] = useState(DEFAULT_FILTERS)

  const report = useMemo(() => {
    return getLeaveReport({
      employeeId,
      search: filters.search,
      status: filters.status,
      type: filters.type,
      page: filters.page,
      pageSize: PAGE_SIZE,
    })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [employeeId, filters, v])

  const updateFilter = (field) => (value) =>
    setFilters((p) => ({ ...p, [field]: value, page: 1 }))

  const items = report.items || []
  const summary = report.summary || {}
  const hasData = items.length > 0 || summary.total > 0
  const statusOptions = getLeaveStatuses()
  const typeOptions = getLeaveTypes()

  return (
    <div className="flex flex-col gap-4">
      <Card>
        <div className="grid grid-cols-1 gap-3 md:grid-cols-12">
          <div className="md:col-span-5">
            <Input placeholder={t('employeeReports.searchByReason')} value={filters.search} onChange={(e) => updateFilter('search')(e.target.value)} />
          </div>
          <div className="md:col-span-3">
            <Select options={[{ value: '', label: t('employeeReports.allStatuses') }, ...statusOptions]} value={filters.status} onChange={(e) => updateFilter('status')(e.target.value)} />
          </div>
          <div className="md:col-span-4">
            <Select options={[{ value: '', label: t('employeeReports.allTypes') }, ...typeOptions]} value={filters.type} onChange={(e) => updateFilter('type')(e.target.value)} />
          </div>
        </div>
      </Card>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard label={t('employeeReports.total')} value={summary.total || 0} icon={Calendar} tone="primary" />
        <StatCard label={t('employeeReports.approved')} value={summary.byStatus?.approved || 0} icon={Calendar} tone="success" />
        <StatCard label={t('employeeReports.pending')} value={summary.byStatus?.pending || 0} icon={Calendar} tone="warning" />
        <StatCard label={t('employeeReports.rejected')} value={summary.byStatus?.rejected || 0} icon={Calendar} tone="danger" />
      </div>

      {!hasData ? (
        <Card>
          <EmptyState title={t('employeeReports.noLeaveReport')} description={t('employeeReports.leaveRecordsAppear')} />
        </Card>
      ) : (
        <Table
          data={items}
          loading={false}
          pagination={{ page: report.page, pageSize: report.pageSize, total: report.total, onChange: (p) => setFilters((prev) => ({ ...prev, page: p })) }}
          rowKey="id"
          emptyTitle={t('employeeReports.noMatchingRecords')}
          columns={[
            { key: 'type', header: t('employeeReports.type'), render: (r) => leaveTypeLabel(r.leaveType) },
            { key: 'from', header: t('employeeReports.from'), render: (r) => formatDate(r.startDate) || '—' },
            { key: 'to', header: t('employeeReports.to'), render: (r) => formatDate(r.endDate) || '—' },
            { key: 'days', header: t('employeeReports.days'), render: (r) => r.totalDays ?? '—' },
            { key: 'status', header: t('employeeReports.status'), render: (r) => <Badge tone={leaveTone(r.status)}>{leaveLabel(r.status)}</Badge> },
          ]}
        />
      )}
    </div>
  )
}

function leaveLabel(s) {
  const found = getLeaveStatuses().find((x) => x.value === s)
  return found?.label || s || '—'
}
function leaveTone(s) {
  if (s === 'approved') return 'success'
  if (s === 'pending') return 'warning'
  if (s === 'rejected') return 'danger'
  return 'neutral'
}
function leaveTypeLabel(s) {
  const found = getLeaveTypes().find((x) => x.value === s)
  return found?.label || s || '—'
}

// ---------- Evaluation -----------------------------------------------------
function EvaluationSection({ employeeId, t }) {
  const v = useServicesVersion()

  const rows = useMemo(() => {
    const report = getEvaluationReport({ page: 1 })
    // reportService có thể trả về items không lọc sẵn; đảm bảo filter.
    const list = (report.items || []).filter((r) => r.employeeId === employeeId)
    return list
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [employeeId, v])

  const hasData = rows.length > 0

  return (
    <div className="flex flex-col gap-4">
      {!hasData ? (
        <Card>
          <EmptyState title={t('employeeReports.noEvaluationReport')} description={t('employeeReports.evaluationRecordsAppear')} />
        </Card>
      ) : (
        <Table
          data={rows}
          rowKey="id"
          emptyTitle={t('employeeReports.noMatchingRecords')}
          columns={[
            { key: 'cycle', header: t('employeeReports.cycle'), render: (r) => r.cycleName || r.cycleId || '—' },
            { key: 'status', header: t('employeeReports.status'), render: (r) => <Badge tone={evalTone(r.status)}>{getEvaluationStatusLabel(r.status) || r.status}</Badge> },
            { key: 'score', header: t('employeeReports.score'), render: (r) => r.score != null ? r.score : '—' },
            { key: 'rating', header: t('employeeReports.rating'), render: (r) => r.rating || '—' },
            { key: 'evaluator', header: t('employeeReports.evaluator'), render: (r) => r.reviewerName || r.evaluatorName || '—' },
            { key: 'updated', header: t('employeeReports.updated'), render: (r) => formatDate(r.updatedAt) || '—' },
          ]}
        />
      )}
    </div>
  )
}

function evalTone(s) {
  if (s === 'published' || s === 'completed') return 'success'
  if (s === 'pending' || s === 'in_progress') return 'warning'
  if (s === 'rejected' || s === 'cancelled') return 'danger'
  return 'neutral'
}

// ---------- Training -------------------------------------------------------
function TrainingSection({ employeeId, t }) {
  const v = useServicesVersion()
  const [filters, setFilters] = useState(DEFAULT_FILTERS)

  const items = useMemo(() => {
    // Lấy training mà employee hiện tại tham gia.
    getTrainingReport({ page: 1 })
    const all = getMyTrainings(employeeId)
    // Lọc thêm các field filter frontend
    let list = all
    if (filters.search) {
      const q = filters.search.toLowerCase()
      list = list.filter((r) => (r.trainingName || '').toLowerCase().includes(q))
    }
    if (filters.status) {
      list = list.filter((r) => r.registrationStatus === filters.status || r.status === filters.status)
    }
    if (filters.type) {
      list = list.filter((r) => r.category === filters.type)
    }
    return list
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [employeeId, filters, v])

  const statusOptions = getParticipantStatuses()
  const categoryOptions = getTrainingCategories()
  const hasData = items.length > 0

  const updateFilter = (field) => (value) =>
    setFilters((p) => ({ ...p, [field]: value, page: 1 }))

  return (
    <div className="flex flex-col gap-4">
      <Card>
        <div className="grid grid-cols-1 gap-3 md:grid-cols-12">
          <div className="md:col-span-5">
            <Input placeholder={t('employeeReports.searchByTrainingName')} value={filters.search} onChange={(e) => updateFilter('search')(e.target.value)} />
          </div>
          <div className="md:col-span-3">
            <Select options={[{ value: '', label: t('employeeReports.allStatuses') }, ...statusOptions]} value={filters.status} onChange={(e) => updateFilter('status')(e.target.value)} />
          </div>
          <div className="md:col-span-4">
            <Select options={[{ value: '', label: t('employeeReports.allCategories') }, ...categoryOptions]} value={filters.type} onChange={(e) => updateFilter('type')(e.target.value)} />
          </div>
        </div>
      </Card>

      {!hasData ? (
        <Card>
          <EmptyState title={t('employeeReports.noTrainingReport')} description={t('employeeReports.trainingRecordsAppear')} />
        </Card>
      ) : (
        <Table
          data={items}
          rowKey="id"
          emptyTitle={t('employeeReports.noMatchingRecords')}
          columns={[
            { key: 'name', header: t('employeeReports.training'), render: (r) => r.trainingName || '—' },
            { key: 'category', header: t('employeeReports.category'), render: (r) => categoryLabel(r.category) },
            { key: 'start', header: t('employeeReports.startDate'), render: (r) => formatDate(r.startDate) || '—' },
            { key: 'end', header: t('employeeReports.endDate'), render: (r) => formatDate(r.endDate) || '—' },
            { key: 'status', header: t('employeeReports.status'), render: (r) => <Badge tone={participantTone(r.registrationStatus)}>{participantLabel(r.registrationStatus)}</Badge> },
          ]}
        />
      )}
    </div>
  )
}

function participantLabel(s) {
  const found = getParticipantStatuses().find((x) => x.value === s)
  return found?.label || s || '—'
}
function participantTone(s) {
  if (s === 'completed' || s === 'passed') return 'success'
  if (s === 'in_progress' || s === 'enrolled') return 'warning'
  if (s === 'cancelled' || s === 'failed') return 'danger'
  return 'neutral'
}
function categoryLabel(s) {
  const found = getTrainingCategories().find((x) => x.value === s)
  return found?.label || s || '—'
}

// ---------- Benefits -------------------------------------------------------
function BenefitsSection({ employeeId, t }) {
  const v = useServicesVersion()
  const [filters, setFilters] = useState(DEFAULT_FILTERS)

  const items = useMemo(() => {
    let list = getMyBenefits(employeeId)
    if (filters.search) {
      const q = filters.search.toLowerCase()
      list = list.filter((r) => (r.name || r.benefitName || '').toLowerCase().includes(q))
    }
    if (filters.status) list = list.filter((r) => r.status === filters.status)
    if (filters.type) list = list.filter((r) => r.type === filters.type)
    return list
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [employeeId, filters, v])

  const statusOptions = getBenefitStatuses()
  const typeOptions = getBenefitTypes()
  const hasData = items.length > 0

  const updateFilter = (field) => (value) =>
    setFilters((p) => ({ ...p, [field]: value, page: 1 }))

  return (
    <div className="flex flex-col gap-4">
      <Card>
        <div className="grid grid-cols-1 gap-3 md:grid-cols-12">
          <div className="md:col-span-5">
            <Input placeholder={t('employeeReports.searchByBenefit')} value={filters.search} onChange={(e) => updateFilter('search')(e.target.value)} />
          </div>
          <div className="md:col-span-3">
            <Select options={[{ value: '', label: t('employeeReports.allStatuses') }, ...statusOptions]} value={filters.status} onChange={(e) => updateFilter('status')(e.target.value)} />
          </div>
          <div className="md:col-span-4">
            <Select options={[{ value: '', label: t('employeeReports.allTypes') }, ...typeOptions]} value={filters.type} onChange={(e) => updateFilter('type')(e.target.value)} />
          </div>
        </div>
      </Card>

      {!hasData ? (
        <Card>
          <EmptyState title={t('employeeReports.noBenefitsReport')} description={t('employeeReports.benefitsRecordsAppear')} />
        </Card>
      ) : (
        <Table
          data={items}
          rowKey="id"
          emptyTitle={t('employeeReports.noMatchingRecords')}
          columns={[
            { key: 'name', header: t('employeeReports.benefit'), render: (r) => r.name || r.benefitName || '—' },
            { key: 'type', header: t('employeeReports.type'), render: (r) => benefitTypeLabel(r.type) },
            { key: 'status', header: t('employeeReports.status'), render: (r) => <Badge tone={benefitTone(r.status)}>{benefitLabel(r.status)}</Badge> },
            { key: 'effective', header: t('employeeReports.effectiveDate'), render: (r) => formatDate(r.effectiveDate || r.startDate) },
          ]}
        />
      )}
    </div>
  )
}

function benefitLabel(s) {
  const found = getBenefitStatuses().find((x) => x.value === s)
  return found?.label || s || '—'
}
function benefitTone(s) {
  if (s === 'active' || s === 'enrolled') return 'success'
  if (s === 'pending') return 'warning'
  if (s === 'expired' || s === 'cancelled') return 'danger'
  return 'neutral'
}
function benefitTypeLabel(s) {
  const found = getBenefitTypes().find((x) => x.value === s)
  return found?.label || s || '—'
}

// ---------- Contracts ------------------------------------------------------
function ContractsSection({ employeeId, t }) {
  const v = useServicesVersion()

  const items = useMemo(() => {
    const list = getContractsByEmployee(employeeId)
    return list
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [employeeId, v])

  const hasData = items.length > 0

  return (
    <div className="flex flex-col gap-4">
      {!hasData ? (
        <Card>
          <EmptyState title={t('employeeReports.noContractsReport')} description={t('employeeReports.contractsRecordsAppear')} />
        </Card>
      ) : (
        <Table
          data={items}
          rowKey="id"
          emptyTitle={t('employeeReports.noMatchingRecords')}
          columns={[
            { key: 'number', header: t('employeeReports.contractNumber'), render: (r) => r.contractNumber || r.id || '—' },
            { key: 'type', header: t('employeeReports.type'), render: (r) => contractTypeLabel(r.type || r.contractType) },
            { key: 'from', header: t('employeeReports.startDate'), render: (r) => formatDate(r.startDate) },
            { key: 'to', header: t('employeeReports.endDate'), render: (r) => formatDate(r.endDate) },
            { key: 'status', header: t('employeeReports.status'), render: (r) => <Badge tone={contractTone(r.status)}>{contractLabel(r.status)}</Badge> },
          ]}
        />
      )}
    </div>
  )
}

function contractLabel(s) {
  const found = getContractStatuses().find((x) => x.value === s)
  return found?.label || s || '—'
}
function contractTone(s) {
  if (s === 'active' || s === 'signed') return 'success'
  if (s === 'pending' || s === 'draft') return 'warning'
  if (s === 'expired' || s === 'terminated') return 'danger'
  return 'neutral'
}
function contractTypeLabel(s) {
  const found = getContractTypes().find((x) => x.value === s)
  return found?.label || s || '—'
}

// ---------- Promotions -----------------------------------------------------
function PromotionsSection({ employeeId, t }) {
  const v = useServicesVersion()

  const items = useMemo(() => {
    return getPromotionsByEmployeeId(employeeId)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [employeeId, v])

  const hasData = items.length > 0

  return (
    <div className="flex flex-col gap-4">
      {!hasData ? (
        <Card>
          <EmptyState title={t('employeeReports.noPromotionReport')} description={t('employeeReports.promotionRecordsAppear')} />
        </Card>
      ) : (
        <Table
          data={items}
          rowKey="id"
          emptyTitle={t('employeeReports.noMatchingRecords')}
          columns={[
            { key: 'current', header: t('employeeReports.currentPosition'), render: (r) => r.currentPosition || '—' },
            { key: 'proposed', header: t('employeeReports.proposedPosition'), render: (r) => r.proposedPosition || '—' },
            { key: 'dept', header: t('employeeReports.department'), render: (r) => r.proposedDepartment || r.currentDepartment || '—' },
            { key: 'effective', header: t('employeeReports.effectiveDate'), render: (r) => formatDate(r.effectiveDate) },
            { key: 'status', header: t('employeeReports.status'), render: (r) => <Badge tone={promotionTone(r.status)}>{promotionLabel(r.status)}</Badge> },
          ]}
        />
      )}
    </div>
  )
}

function promotionLabel(s) {
  const found = getPromotionStatuses().find((x) => x.value === s)
  return found?.label || s || '—'
}
function promotionTone(s) {
  if (s === 'approved') return 'success'
  if (s === 'pending') return 'warning'
  if (s === 'rejected') return 'danger'
  return 'neutral'
}

// silence unused import for the cycle status helper if unused
void getCycleStatusLabel