import { useEffect, useMemo, useState } from 'react'
import { CalendarCheck, Download, Search } from 'lucide-react'

import Card from '../common/Card'
import Input from '../common/Input'
import Select from '../common/Select'
import Button from '../../components/common/Button'
import Table from '../../components/common/Table'
import EmptyState from '../../components/common/EmptyState'
import ReportStatusBadge from './ReportStatusBadge'
import ReportSummary from './ReportSummary'
import MiniBarChart from './MiniBarChart'
import { useI18n } from '../../i18n/useI18n'
import { getAttendanceReport, getDepartments, getAttendanceStatusList } from '../../services/reportService'
import { exportToCsv, sanitizeForExport } from '../../utils/exportCsv'

/**
 * AttendanceReportSection - báo cáo chấm công.
 */
export default function AttendanceReportSection({ onToast }) {
  const { t } = useI18n()
  const [search, setSearch] = useState('')
  const [departmentId, setDepartmentId] = useState('')
  const [status, setStatus] = useState('')
  const [dateFrom, setDateFrom] = useState('')
  const [dateTo, setDateTo] = useState('')
  const [page, setPage] = useState(1)
  const [pageSize] = useState(10)
  const [tick, setTick] = useState(0)

  const departments = getDepartments()
  const statuses = getAttendanceStatusList()

  useEffect(() => {
    // eslint-disable-next-line react/set-state-in-effect
    setTick((t) => t + 1)
  }, [])

  const data = useMemo(() => {
    const r = getAttendanceReport({
      search,
      departmentId,
      status,
      sortBy: 'date',
      sortDir: 'desc',
      page,
      pageSize,
    })
    let items = r.items
    if (dateFrom || dateTo) {
      // eslint-disable-next-line react-hooks/exhaustive-deps
      items = r.items.filter((it) => {
        if (dateFrom && it.date < dateFrom) return false
        if (dateTo && it.date > dateTo) return false
        return true
      })
      return {
        ...r,
        items,
        total: items.length,
        totalPages: Math.max(1, Math.ceil(items.length / pageSize)),
        page: 1,
      }
    }
    return r
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [search, departmentId, status, dateFrom, dateTo, page, pageSize, tick])

  const handleFilterChange = (field) => (value) => {
    if (field === 'search') setSearch(value)
    if (field === 'departmentId') setDepartmentId(value)
    if (field === 'status') setStatus(value)
    if (field === 'dateFrom') setDateFrom(value)
    if (field === 'dateTo') setDateTo(value)
    setPage(1)
  }

  const handleReset = () => {
    setSearch(''); setDepartmentId(''); setStatus(''); setDateFrom(''); setDateTo(''); setPage(1)
  }

  const handleExport = () => {
    try {
      const r = getAttendanceReport({
        search, departmentId, status, sortBy: 'date', sortDir: 'desc',
        page: 1, pageSize: 100000,
      })
      const items = r.items.filter((it) => {
        if (dateFrom && it.date < dateFrom) return false
        if (dateTo && it.date > dateTo) return false
        return true
      })
      const rows = sanitizeForExport(items).map((it) => ({
        [t('reports.component.date')]: it.date,
        [t('reports.component.employee')]: it.employeeName,
        [t('reports.component.department')]: it.departmentName ?? '',
        [t('reports.component.checkIn')]: it.checkIn ?? '',
        [t('reports.component.checkOut')]: it.checkOut ?? '',
        [t('reports.component.workHours')]: it.workHours ?? 0,
        [t('reports.component.lateMinutes')]: it.lateMinutes ?? 0,
        [t('reports.component.earlyLeaveMinutes')]: it.earlyLeaveMinutes ?? 0,
        [t('reports.component.status')]: it.statusLabel ?? it.status,
      }))
      const filename = `attendance-report-${new Date().toISOString().slice(0, 10)}.csv`
      exportToCsv(filename, rows)
      onToast?.('success', t('reports.component.exportedAttendanceReport'))
    } catch (_e) {
      void _e
      onToast?.('error', t('reports.component.cannotExportReport'))
    }
  }

  const columns = [
    { key: 'date', header: t('reports.component.date'), render: (r) => (
      <span className="text-[13px] text-neutral-700">{r.date}</span>
    ) },
    { key: 'employeeName', header: t('reports.component.employee'), render: (r) => (
      <div className="flex flex-col">
        <span className="text-sm font-medium text-neutral-900">{r.employeeName}</span>
        <span className="font-mono text-[11px] text-neutral-500">{r.employeeCode}</span>
      </div>
    ) },
    { key: 'departmentName', header: t('reports.component.department'), render: (r) => r.departmentName ?? '—' },
    { key: 'checkIn', header: t('reports.component.checkIn'), render: (r) => r.checkIn ?? '—' },
    { key: 'checkOut', header: t('reports.component.checkOut'), render: (r) => r.checkOut ?? '—' },
    { key: 'workHours', header: t('reports.component.workHours'), render: (r) => (
      <span className="text-[13px] text-neutral-700">{r.workHours?.toFixed?.(2) ?? '0.00'}</span>
    ) },
    { key: 'status', header: t('reports.component.status'), render: (r) => (
      <ReportStatusBadge kind="attendance" value={r.status} />
    ) },
  ]

  const summary = data.summary ?? {}
  const chartData = (summary.series ?? []).map((s) => ({ label: s.date, value: s.total, secondary: s.absent }))

  return (
    <Card
      title={t('reports.component.attendanceReportTitle')}
      subtitle={t('reports.component.attendanceReportSubtitle')}
      actions={
        <Button variant="secondary" size="sm" icon={Download} onClick={handleExport}>
          {t('reports.component.exportReport')}
        </Button>
      }
    >
      <div className="flex flex-col gap-4">
        <div className="grid grid-cols-1 gap-3 md:grid-cols-12">
          <div className="md:col-span-5">
            <Input
              placeholder={t('reports.component.searchEmployee')}
              value={search}
              onChange={(e) => handleFilterChange('search')(e.target.value)}
              leftIcon={Search}
            />
          </div>
          <div className="md:col-span-2">
            <Input
              type="date"
              value={dateFrom}
              onChange={(e) => handleFilterChange('dateFrom')(e.target.value)}
            />
          </div>
          <div className="md:col-span-2">
            <Input
              type="date"
              value={dateTo}
              onChange={(e) => handleFilterChange('dateTo')(e.target.value)}
            />
          </div>
          <div className="md:col-span-2">
            <Select
              options={[{ value: '', label: t('reports.component.allDepartments') }, ...departments.map((d) => ({ value: d.id, label: d.name }))]}
              value={departmentId}
              onChange={(e) => handleFilterChange('departmentId')(e.target.value)}
            />
          </div>
          <div className="md:col-span-1">
            <Select
              options={[{ value: '', label: t('reports.component.allStatuses') }, ...statuses.map((s) => ({ value: s.value, label: s.label }))]}
              value={status}
              onChange={(e) => handleFilterChange('status')(e.target.value)}
            />
          </div>
        </div>

        {(search || departmentId || status || dateFrom || dateTo) && (
          <div className="flex justify-end">
            <Button variant="outline" size="sm" onClick={handleReset}>
              {t('reports.component.resetFilters')}
            </Button>
          </div>
        )}

        <ReportSummary
          items={[
            { label: t('reports.component.totalRecords'), value: summary.total ?? 0 },
            { label: t('reports.component.onTime'), value: summary.byStatus?.on_time ?? 0 },
            { label: t('reports.component.late'), value: summary.byStatus?.late ?? 0 },
            { label: t('reports.component.absent'), value: summary.byStatus?.absent ?? 0 },
          ]}
        />

        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          <div className="rounded-md border border-neutral-200 p-4">
            <h4 className="mb-3 text-sm font-semibold text-neutral-900">{t('reports.component.recordsByDay')}</h4>
            <MiniBarChart data={chartData} emptyText={t('reports.component.noAttendanceData')} />
          </div>
          <div className="rounded-md border border-neutral-200 p-4">
            <h4 className="mb-3 text-sm font-semibold text-neutral-900">{t('reports.component.distributionByStatus')}</h4>
            <MiniBarChart
              data={statuses.map((s) => ({
                label: s.label,
                value: summary.byStatus?.[s.value] ?? 0,
              }))}
              emptyText={t('reports.component.noData')}
            />
          </div>
        </div>

        {data.items.length === 0 ? (
          <EmptyState
            icon={CalendarCheck}
            title={t('reports.component.noDataMatchesFilter')}
            description={t('reports.component.changeFilterOrReset')}
          />
        ) : (
          <Table
            columns={columns}
            data={data.items}
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
