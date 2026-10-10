import { useCallback, useEffect, useState } from 'react'
import {
  BarChart3,
  Users,
  CalendarCheck,
  Wallet,
  FileText,
  GraduationCap,
  Gift,
  FileSignature,
  Star,
  RefreshCcw,
} from 'lucide-react'

import PageHeader from '../../components/common/PageHeader'
import Tabs from '../../components/common/Tabs'
import Button from '../../components/common/Button'
import Loading from '../../components/common/Loading'
import { useToast } from '../../components/common/useToast'
import EmptyState from '../../components/common/EmptyState'
import { useI18n } from '../../i18n/useI18n'

import SystemOverviewSection from '../../components/reports/SystemOverviewSection'
import EmployeeReportSection from '../../components/reports/EmployeeReportSection'
import AttendanceReportSection from '../../components/reports/AttendanceReportSection'
import PayrollReportSection from '../../components/reports/PayrollReportSection'
import ReportSummary from '../../components/reports/ReportSummary'
import DepartmentDistributionChart from '../../components/reports/DepartmentDistributionChart'
import ReportStatusBadge from '../../components/reports/ReportStatusBadge'
import { formatNumber, formatCurrencyVnd, formatDate } from '../../utils/format'

import {
  getSystemOverview,
  getLeaveReport,
  getEvaluationReport,
  getEvaluationCycles,
  getTrainingReport,
  getBenefitsReport,
  getContractsReport,
  getDepartments,
  getEmployeeById,
  getEmployeeReport,
  subscribeReport,
} from '../../services/reportService'

export default function AdminReportsPage() {
  const { t } = useI18n()
  const toast = useToast()
  const [tick, setTick] = useState(0)
  const [refreshing, setRefreshing] = useState(false)
  const [overview, setOverview] = useState(null)
  const [error, setError] = useState(null)

  // Subscribe các service để bump tick khi có thay đổi.
  useEffect(() => {
    const unsub = subscribeReport(() => setTick((t_) => t_ + 1))
    return () => unsub()
  }, [])

  const refresh = useCallback(() => {
    setRefreshing(true)
    try {
      setOverview(getSystemOverview())
      setTick((t_) => t_ + 1)
      setError(null)
      toast.success(t('admin.reportDataRefreshed'))
    } catch (_e) {
      void _e
      setError(t('admin.cannotLoadReport'))
    } finally {
      setRefreshing(false)
    }
  }, [toast, t])

  // Lấy overview lần đầu và khi tick đổi
  useEffect(() => {
    try {
      setOverview(getSystemOverview())
      setError(null)
    } catch (_e) {
      void _e
      setError(t('admin.cannotLoadReport'))
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tick])

  const showToast = (type, msg) => {
    if (type === 'error') toast.error(msg)
    else toast.success(msg)
  }

  if (error && !overview) {
    return (
      <div className="flex flex-col gap-4">
        <PageHeader title={t('admin.reportsTitle')} subtitle={t('admin.reportsSubtitle')} icon={BarChart3} />
        <EmptyState
          icon={BarChart3}
          title={t('admin.cannotLoadReportData')}
          description={error}
          actionLabel={t('admin.tryAgain')}
          onAction={refresh}
        />
      </div>
    )
  }

  if (!overview) {
    return (
      <div className="flex h-40 items-center justify-center rounded-lg border border-dashed border-neutral-300 bg-white">
        <Loading size="md" label={t('admin.loadingReportData')} />
      </div>
    )
  }

  const tabs = [
    {
      id: 'overview',
      label: t('admin.overview'),
      icon: BarChart3,
      panel: (
        <div className="flex flex-col gap-4">
          <SystemOverviewSection overview={overview} />
          <DepartmentDistributionChart
            departments={getDepartments()}
            counts={countByDept()}
            total={overview.employees.total}
          />
          <LeaveReportPanel />
          <EvaluationReportPanel />
        </div>
      ),
    },
    {
      id: 'employee',
      label: t('admin.employees'),
      icon: Users,
      badge: overview.employees?.total ?? 0,
      panel: <EmployeeReportSection onToast={showToast} />,
    },
    {
      id: 'attendance',
      label: t('admin.attendance'),
      icon: CalendarCheck,
      badge: overview.attendance?.total ?? 0,
      panel: <AttendanceReportSection onToast={showToast} />,
    },
    {
      id: 'payroll',
      label: t('admin.payroll'),
      icon: Wallet,
      badge: overview.payroll?.total ?? 0,
      panel: <PayrollReportSection onToast={showToast} />,
    },
    {
      id: 'leave',
      label: t('admin.leave'),
      icon: FileText,
      badge: overview.leave?.total ?? 0,
      panel: <LeaveReportPanel />,
    },
    {
      id: 'evaluation',
      label: t('admin.evaluation'),
      icon: Star,
      panel: <EvaluationReportPanel />,
    },
    {
      id: 'training',
      label: t('admin.training'),
      icon: GraduationCap,
      badge: overview.training?.total ?? 0,
      panel: <TrainingReportPanel />,
    },
    {
      id: 'benefit',
      label: t('admin.benefit'),
      icon: Gift,
      badge: overview.benefit?.total ?? 0,
      panel: <BenefitsReportPanel />,
    },
    {
      id: 'contract',
      label: t('admin.contract'),
      icon: FileSignature,
      badge: overview.contract?.total ?? 0,
      panel: <ContractsReportPanel />,
    },
  ]

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title={t('admin.reportsTitle')}
        subtitle={t('admin.reportsSubtitle')}
        icon={BarChart3}
        actions={
          <Button
            variant="secondary"
            size="md"
            icon={RefreshCcw}
            onClick={refresh}
            loading={refreshing}
          >
            {t('admin.refreshReports')}
          </Button>
        }
      />

      <Tabs items={tabs} variant="underline" />
    </div>
  )
}

// ---------- Helpers --------------------------------------------------------

function countByDept() {
  // Lấy phân bổ phòng ban từ EmployeeReport (đã có sẵn `byDepartment`).
  const r = getEmployeeReport({ page: 1, pageSize: 100000 })
  return r.summary?.byDepartment ?? {}
}

// ---------- Sub-panels -----------------------------------------------------

function LeaveReportPanel() {
  const [data, setData] = useState(null)
  useEffect(() => {
    try {
      // eslint-disable-next-line react/set-state-in-effect
      setData(getLeaveReport({ page: 1, pageSize: 50 }))
    } catch (_e) { void _e }
  }, [])
  if (!data) return <Loading size="sm" label="Đang tải..." />
  if (data.total === 0) {
    return (
      <div className="rounded-md border border-dashed border-neutral-200 bg-neutral-50 p-4 text-sm text-neutral-500">
        Chưa có dữ liệu nghỉ phép.
      </div>
    )
  }
  return (
    <div className="grid grid-cols-1 gap-3 md:grid-cols-4">
      <ReportSummary
        items={[
          { label: 'Tổng đơn', value: data.summary.total },
          { label: 'Đã duyệt', value: data.summary.byStatus?.approved ?? 0 },
          { label: 'Chờ duyệt', value: data.summary.byStatus?.pending ?? 0 },
          { label: 'Từ chối / Hủy', value: (data.summary.byStatus?.rejected ?? 0) + (data.summary.byStatus?.cancelled ?? 0) },
        ]}
      />
      <div className="md:col-span-4">
        <ul className="flex flex-col gap-2 text-sm">
          {data.items.slice(0, 5).map((it) => (
            <li key={it.id} className="flex flex-wrap items-center justify-between gap-2 rounded-md border border-neutral-200 bg-white px-3 py-2">
              <div className="flex flex-col">
                <span className="font-medium text-neutral-900">{it.employeeName}</span>
                <span className="text-[11px] text-neutral-500">{it.requestCode} · {it.leaveTypeLabel ?? it.leaveType} · {formatDate(it.startDate)}</span>
              </div>
              <ReportStatusBadge kind="leave" value={it.status} />
            </li>
          ))}
        </ul>
      </div>
    </div>
  )
}

function EvaluationReportPanel() {
  const [data, setData] = useState(null)
  const [cycleId, setCycleId] = useState(null)
  useEffect(() => {
    try {
      const cycles = getEvaluationCycles()
      // eslint-disable-next-line react/set-state-in-effect
      setCycleId(cycles[0]?.id ?? null)
      setData(getEvaluationReport({ page: 1, pageSize: 50 }))
    } catch (_e) { void _e }
  }, [])

  if (!data) return <Loading size="sm" label="Đang tải..." />
  if (!cycleId) {
    return (
      <div className="rounded-md border border-dashed border-neutral-200 bg-neutral-50 p-4 text-sm text-neutral-500">
        Chưa có kỳ đánh giá nào trong hệ thống.
      </div>
    )
  }
  const summary = data.summary ?? {}
  return (
    <div className="grid grid-cols-1 gap-3 md:grid-cols-4">
      <ReportSummary
        items={[
          { label: 'Tổng đánh giá', value: summary.total ?? 0 },
          { label: 'Đã hoàn thành', value: summary.completed ?? 0 },
          { label: 'Điểm trung bình', value: summary.avgScore != null ? summary.avgScore.toFixed(2) : '—' },
          { label: 'Trạng thái khác', value: (summary.total ?? 0) - (summary.completed ?? 0) },
        ]}
      />
    </div>
  )
}

function TrainingReportPanel() {
  const [data, setData] = useState(null)
  useEffect(() => {
    try {
      // eslint-disable-next-line react/set-state-in-effect
      setData(getTrainingReport({ page: 1, pageSize: 50 }))
    } catch (_e) { void _e }
  }, [])
  if (!data) return <Loading size="sm" label="Đang tải..." />
  const summary = data.summary ?? {}
  return (
    <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
      <ReportSummary
        items={[
          { label: 'Tổng khóa đào tạo', value: summary.total ?? 0 },
          { label: 'Đã đăng ký (sl)', value: summary.participants ?? 0 },
          { label: 'Đang mở đăng ký', value: summary.byStatus?.open ?? 0 },
        ]}
      />
      <div className="md:col-span-3">
        <ul className="flex flex-col gap-2 text-sm">
          {data.items.slice(0, 5).map((it) => (
            <li key={it.id} className="flex flex-wrap items-center justify-between gap-2 rounded-md border border-neutral-200 bg-white px-3 py-2">
              <div className="flex flex-col">
                <span className="font-medium text-neutral-900">{it.name}</span>
                <span className="text-[11px] text-neutral-500">{it.code} · {formatDate(it.startDate)} - {formatDate(it.endDate)}</span>
              </div>
              <ReportStatusBadge kind="training" value={it.status} />
            </li>
          ))}
        </ul>
      </div>
    </div>
  )
}

function BenefitsReportPanel() {
  const [data, setData] = useState(null)
  useEffect(() => {
    try {
      // eslint-disable-next-line react/set-state-in-effect
      setData(getBenefitsReport({ page: 1, pageSize: 50 }))
    } catch (_e) { void _e }
  }, [])
  if (!data) return <Loading size="sm" label="Đang tải..." />
  const summary = data.summary ?? {}
  return (
    <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
      <ReportSummary
        items={[
          { label: 'Tổng phúc lợi', value: summary.total ?? 0 },
          { label: 'Đang hoạt động', value: summary.byStatus?.active ?? 0 },
          { label: 'Tạm dừng / hết hạn', value: (summary.byStatus?.paused ?? 0) + (summary.byStatus?.expired ?? 0) },
        ]}
      />
    </div>
  )
}

function ContractsReportPanel() {
  const [data, setData] = useState(null)
  useEffect(() => {
    try {
      // eslint-disable-next-line react/set-state-in-effect
      setData(getContractsReport({ page: 1, pageSize: 50 }))
    } catch (_e) { void _e }
  }, [])
  if (!data) return <Loading size="sm" label="Đang tải..." />
  const summary = data.summary ?? {}
  return (
    <div className="grid grid-cols-1 gap-3 md:grid-cols-4">
      <ReportSummary
        items={[
          { label: 'Tổng hợp đồng', value: summary.total ?? 0 },
          { label: 'Đang hiệu lực', value: summary.byStatus?.active ?? 0 },
          { label: 'Hết hạn', value: summary.byStatus?.expired ?? 0 },
          { label: 'Đã kết thúc', value: summary.byStatus?.terminated ?? 0 },
        ]}
      />
      <div className="md:col-span-4">
        <ul className="flex flex-col gap-2 text-sm">
          {data.items.slice(0, 5).map((it) => {
            const emp = getEmployeeById(it.employeeId)
            return (
              <li key={it.id} className="flex flex-wrap items-center justify-between gap-2 rounded-md border border-neutral-200 bg-white px-3 py-2">
                <div className="flex flex-col">
                  <span className="font-medium text-neutral-900">{it.contractCode} · {emp?.fullName ?? '—'}</span>
                  <span className="text-[11px] text-neutral-500">{it.contractTypeLabel ?? it.contractType} · {formatDate(it.startDate)} - {formatDate(it.endDate)}</span>
                </div>
                <ReportStatusBadge kind="contract" value={it.status} />
              </li>
            )
          })}
        </ul>
      </div>
    </div>
  )
}

void formatNumber
void formatCurrencyVnd
