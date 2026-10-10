import { useEffect, useMemo, useState } from 'react'
import { Download, Search, Users } from 'lucide-react'

import Card from '../common/Card'
import Input from '../common/Input'
import Select from '../common/Select'
import Button from '../../components/common/Button'
import Table from '../../components/common/Table'
import EmptyState from '../../components/common/EmptyState'
import Loading from '../../components/common/Loading'
import ReportStatusBadge from './ReportStatusBadge'
import { formatDate } from '../../utils/format'
import { exportToCsv, sanitizeForExport } from '../../utils/exportCsv'
import { useI18n } from '../../i18n/useI18n'
import {
  getEmployeeReport,
  getDepartments,
  getEmployeeStatuses,
} from '../../services/reportService'

/**
 * EmployeeReportSection - báo cáo nhân viên.
 */
export default function EmployeeReportSection({ onToast }) {
  const { t } = useI18n()
  const [search, setSearch] = useState('')
  const [departmentId, setDepartmentId] = useState('')
  const [status, setStatus] = useState('')
  const [page, setPage] = useState(1)
  const [pageSize] = useState(10)
  const [tick, setTick] = useState(0)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)

  const departments = getDepartments()
  const statuses = getEmployeeStatuses()

  // Tái lấy khi pub-sub thông báo
  useEffect(() => {
    setLoading(true)
    const id = setTimeout(() => {
      try {
        setLoading(false)
        // eslint-disable-next-line react/set-state-in-effect
        setTick((prev) => prev + 1)
        setError(null)
      } catch (_e) {
        void _e
        setError(t('reports.component.cannotLoadReportData'))
        setLoading(false)
      }
    }, 0)
    return () => clearTimeout(id)
  }, [t])

  const data = useMemo(() => {
    return getEmployeeReport({
      search,
      departmentId,
      status,
      sortBy: 'fullName',
      sortDir: 'asc',
      page,
      pageSize,
    })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [search, departmentId, status, page, pageSize, tick])

  const handleFilterChange = (field) => (value) => {
    if (field === 'search') setSearch(value)
    if (field === 'departmentId') setDepartmentId(value)
    if (field === 'status') setStatus(value)
    setPage(1)
  }

  const handleReset = () => {
    setSearch(''); setDepartmentId(''); setStatus(''); setPage(1)
  }

  const handleExport = () => {
    try {
      const all = getEmployeeReport({
        search, departmentId, status, sortBy: 'fullName', sortDir: 'asc',
        page: 1, pageSize: 100000,
      })
      const rows = sanitizeForExport(all.items).map((r) => ({
        [t('reports.component.employeeCode')]: r.employeeCode,
        [t('reports.component.fullName')]: r.fullName,
        [t('reports.component.email')]: r.email,
        [t('reports.component.phone')]: r.phone,
        [t('reports.component.department')]: r.departmentName,
        [t('reports.component.position')]: r.position,
        [t('reports.component.employmentType')]: r.employmentTypeLabel,
        [t('reports.component.status')]: r.statusLabel,
        [t('reports.component.hireDate')]: r.hireDate,
      }))
      const filename = `employee-report-${new Date().toISOString().slice(0, 10)}.csv`
      exportToCsv(filename, rows)
      onToast?.('success', t('reports.component.exportedEmployeeReport'))
    } catch (_e) {
      void _e
      onToast?.('error', t('reports.component.cannotExportReport'))
    }
  }

  const columns = [
    { key: 'employeeCode', header: t('reports.component.employeeCode'), render: (r) => (
      <span className="font-mono text-xs text-neutral-700">{r.employeeCode}</span>
    ) },
    { key: 'fullName', header: t('reports.component.fullName'), render: (r) => (
      <div className="flex flex-col">
        <span className="text-sm font-medium text-neutral-900">{r.fullName}</span>
        <span className="text-[11px] text-neutral-500">{r.email}</span>
      </div>
    ) },
    { key: 'departmentName', header: t('reports.component.department'), render: (r) => r.departmentName ?? '—' },
    { key: 'position', header: t('reports.component.position'), render: (r) => r.position ?? '—' },
    { key: 'status', header: t('reports.component.status'), render: (r) => (
      <ReportStatusBadge kind="employee" value={r.status} />
    ) },
    { key: 'hireDate', header: t('reports.component.hireDate'), render: (r) => (
      <span className="text-[13px] text-neutral-700">{formatDate(r.hireDate)}</span>
    ) },
  ]

  return (
    <Card
      title={t('reports.component.employeeReportTitle')}
      subtitle={t('reports.component.employeeReportSubtitle')}
      actions={
        <Button variant="secondary" size="sm" icon={Download} onClick={handleExport}>
          {t('reports.component.exportReport')}
        </Button>
      }
    >
      <div className="flex flex-col gap-4">
        <div className="grid grid-cols-1 gap-3 md:grid-cols-12">
          <div className="md:col-span-6">
            <Input
              placeholder={t('reports.component.searchEmployee')}
              value={search}
              onChange={(e) => handleFilterChange('search')(e.target.value)}
              leftIcon={Search}
            />
          </div>
          <div className="md:col-span-3">
            <Select
              options={[{ value: '', label: t('reports.component.allDepartments') }, ...departments.map((d) => ({ value: d.id, label: d.name }))]}
              value={departmentId}
              onChange={(e) => handleFilterChange('departmentId')(e.target.value)}
            />
          </div>
          <div className="md:col-span-3">
            <Select
              options={[{ value: '', label: t('reports.component.allStatusesEmp') }, ...statuses.map((s) => ({ value: s.value, label: s.label }))]}
              value={status}
              onChange={(e) => handleFilterChange('status')(e.target.value)}
            />
          </div>
        </div>

        {(search || departmentId || status) && (
          <div className="flex justify-end">
            <Button variant="outline" size="sm" onClick={handleReset}>
              {t('reports.component.resetFilters')}
            </Button>
          </div>
        )}

        <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
          <SummaryTile label={t('reports.component.totalEmployees')} value={data.summary?.total ?? 0} />
          <SummaryTile label={t('reports.component.active')} value={data.summary?.byStatus?.active ?? 0} tone="success" />
          <SummaryTile label={t('reports.component.inactiveOrLeave')} value={
            (data.summary?.byStatus?.inactive ?? 0) + (data.summary?.byStatus?.on_leave ?? 0)
          } tone="warning" />
        </div>

        {error ? (
          <EmptyState
            icon={Users}
            title={t('reports.component.cannotLoadReportData')}
            description={error}
            actionLabel={t('reports.component.retry')}
            onAction={() => setTick((t) => t + 1)}
          />
        ) : data.items.length === 0 ? (
          <EmptyState
            icon={Users}
            title={t('reports.component.noDataMatchesFilter')}
            description={t('reports.component.changeFilterOrReset')}
          />
        ) : (
          <Table
            columns={columns}
            data={data.items}
            loading={loading}
            rowKey="id"
            pagination={{
              page: data.page,
              pageSize: data.pageSize,
              total: data.total,
              onChange: setPage,
            }}
            emptyTitle={t('reports.component.noDataMatchesFilter')}
            emptyDescription={t('reports.component.changeFilterOrReset')}
          />
        )}
      </div>
    </Card>
  )
}

function SummaryTile({ label, value, tone = 'neutral' }) {
  const toneCls = {
    neutral: 'bg-neutral-50 text-neutral-700',
    success: 'bg-success-50 text-success-700',
    warning: 'bg-warning-50 text-warning-700',
  }[tone]
  return (
    <div className={`rounded-md px-4 py-3 text-sm ${toneCls}`}>
      <div className="text-xs">{label}</div>
      <div className="mt-0.5 text-xl font-semibold">{value}</div>
    </div>
  )
}

void Loading
