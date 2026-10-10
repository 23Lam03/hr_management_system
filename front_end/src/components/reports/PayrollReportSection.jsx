import { useEffect, useMemo, useState } from 'react'
import { Download, Search, Wallet } from 'lucide-react'

import Card from '../common/Card'
import Input from '../common/Input'
import Select from '../common/Select'
import Button from '../../components/common/Button'
import Table from '../../components/common/Table'
import EmptyState from '../../components/common/EmptyState'
import ReportStatusBadge from './ReportStatusBadge'
import ReportSummary from './ReportSummary'
import MiniBarChart from './MiniBarChart'
import { formatCurrencyVnd } from '../../utils/format'
import { exportToCsv, sanitizeForExport } from '../../utils/exportCsv'
import { useI18n } from '../../i18n/useI18n'
import {
  getPayrollReport,
  getDepartments,
  getPaymentStatusList,
} from '../../services/reportService'

const CURRENT_YEAR = 2026

const MONTH_OPTIONS = [
  { value: '', label: 'Tất cả tháng' },
  ...Array.from({ length: 12 }, (_, i) => ({
    value: String(i + 1), label: `Tháng ${i + 1}`,
  })),
]
const YEAR_OPTIONS = [
  { value: '', label: 'Tất cả năm' },
  ...[2024, 2025, 2026, 2027].map((y) => ({ value: String(y), label: String(y) })),
]

export default function PayrollReportSection({ onToast }) {
  const { t } = useI18n()
  const [search, setSearch] = useState('')
  const [month, setMonth] = useState('')
  const [year, setYear] = useState(String(CURRENT_YEAR))
  const [departmentId, setDepartmentId] = useState('')
  const [paymentStatus, setPaymentStatus] = useState('')
  const [page, setPage] = useState(1)
  const [pageSize] = useState(10)
  const [tick, setTick] = useState(0)

  const departments = getDepartments()
  const statuses = getPaymentStatusList()

  useEffect(() => {
    // eslint-disable-next-line react/set-state-in-effect
    setTick((prev) => prev + 1)
  }, [])

  const data = useMemo(() => {
    return getPayrollReport({
      search, month, year, departmentId, paymentStatus,
      sortBy: 'month', sortDir: 'desc', page, pageSize,
    })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [search, month, year, departmentId, paymentStatus, page, pageSize, tick])

  const handleFilterChange = (field) => (value) => {
    if (field === 'search') setSearch(value)
    if (field === 'month') setMonth(value)
    if (field === 'year') setYear(value)
    if (field === 'departmentId') setDepartmentId(value)
    if (field === 'paymentStatus') setPaymentStatus(value)
    setPage(1)
  }

  const handleReset = () => {
    setSearch(''); setMonth(''); setYear(String(CURRENT_YEAR)); setDepartmentId(''); setPaymentStatus(''); setPage(1)
  }

  const handleExport = () => {
    try {
      const r = getPayrollReport({
        search, month, year, departmentId, paymentStatus,
        sortBy: 'month', sortDir: 'desc', page: 1, pageSize: 100000,
      })
      const rows = sanitizeForExport(r.items).map((it) => ({
        [t('reports.component.payrollCode')]: it.payrollCode,
        [t('reports.component.employee')]: it.employeeName,
        [t('reports.component.department')]: it.departmentName ?? '',
        [t('reports.component.period')]: `${String(it.month).padStart(2, '0')}/${it.year}`,
        [t('reports.component.baseSalary')]: it.baseSalary,
        [t('reports.component.allowance')]: it.allowance,
        [t('reports.component.bonus')]: it.bonus,
        [t('reports.component.overtimePay')]: it.overtimePay,
        [t('reports.component.gross')]: it.grossSalary,
        [t('reports.component.insuranceDeduction')]: it.insuranceDeduction,
        [t('reports.component.taxDeduction')]: it.taxDeduction,
        [t('reports.component.otherDeduction')]: it.otherDeduction,
        [t('reports.component.totalDeduction')]: it.totalDeduction,
        [t('reports.component.netSalary')]: it.netSalary,
        [t('reports.component.paymentStatus')]: it.paymentStatusLabel ?? it.paymentStatus,
      }))
      const filename = `payroll-report-${new Date().toISOString().slice(0, 10)}.csv`
      exportToCsv(filename, rows)
      onToast?.('success', t('reports.component.exportedPayrollReport'))
    } catch (_e) {
      void _e
      onToast?.('error', t('reports.component.cannotExportReport'))
    }
  }

  const columns = [
    { key: 'payrollCode', header: t('reports.component.payrollCode'), render: (r) => (
      <span className="font-mono text-xs text-neutral-700">{r.payrollCode}</span>
    ) },
    { key: 'employeeName', header: t('reports.component.employee'), render: (r) => (
      <div className="flex flex-col">
        <span className="text-sm font-medium text-neutral-900">{r.employeeName}</span>
        <span className="text-[11px] text-neutral-500">{r.departmentName}</span>
      </div>
    ) },
    { key: 'period', header: t('reports.component.period'), render: (r) => (
      <span className="text-[13px] text-neutral-700">{String(r.month).padStart(2, '0')}/{r.year}</span>
    ) },
    { key: 'grossSalary', header: t('reports.component.gross'), render: (r) => (
      <span className="text-[13px] text-neutral-900">{formatCurrencyVnd(r.grossSalary)}</span>
    ) },
    { key: 'totalDeduction', header: t('reports.component.totalDeduction'), render: (r) => (
      <span className="text-[13px] text-neutral-700">{formatCurrencyVnd(r.totalDeduction)}</span>
    ) },
    { key: 'netSalary', header: t('reports.component.netSalary'), render: (r) => (
      <span className="text-[13px] font-semibold text-neutral-900">{formatCurrencyVnd(r.netSalary)}</span>
    ) },
    { key: 'paymentStatus', header: t('reports.component.paymentStatus'), render: (r) => (
      <ReportStatusBadge kind="payroll" value={r.paymentStatus} />
    ) },
  ]

  const summary = data.summary ?? {}
  const chartData = (summary.series ?? []).map((s) => ({
    label: s.period,
    value: Math.round((s.net || 0) / 1_000_000), // scale về triệu VND
    secondary: Math.round((s.gross || 0) / 1_000_000),
  }))

  return (
    <Card
      title={t('reports.component.payrollReportTitle')}
      subtitle={t('reports.component.payrollReportSubtitle')}
      actions={
        <Button variant="secondary" size="sm" icon={Download} onClick={handleExport}>
          {t('reports.component.exportReport')}
        </Button>
      }
    >
      <div className="flex flex-col gap-4">
        <div className="grid grid-cols-1 gap-3 md:grid-cols-12">
          <div className="md:col-span-4">
            <Input
              placeholder={t('reports.component.searchEmployeeOrCode')}
              value={search}
              onChange={(e) => handleFilterChange('search')(e.target.value)}
              leftIcon={Search}
            />
          </div>
          <div className="md:col-span-2">
            <Select
              options={MONTH_OPTIONS}
              value={month}
              onChange={(e) => handleFilterChange('month')(e.target.value)}
            />
          </div>
          <div className="md:col-span-2">
            <Select
              options={YEAR_OPTIONS}
              value={year}
              onChange={(e) => handleFilterChange('year')(e.target.value)}
            />
          </div>
          <div className="md:col-span-2">
            <Select
              options={[{ value: '', label: t('reports.component.allDepartments') }, ...departments.map((d) => ({ value: d.id, label: d.name }))]}
              value={departmentId}
              onChange={(e) => handleFilterChange('departmentId')(e.target.value)}
            />
          </div>
          <div className="md:col-span-2">
            <Select
              options={[{ value: '', label: t('reports.component.allStatusesEmp') }, ...statuses.map((s) => ({ value: s.value, label: s.label }))]}
              value={paymentStatus}
              onChange={(e) => handleFilterChange('paymentStatus')(e.target.value)}
            />
          </div>
        </div>

        {(search || month || departmentId || paymentStatus) && (
          <div className="flex justify-end">
            <Button variant="outline" size="sm" onClick={handleReset}>
              {t('reports.component.resetFilters')}
            </Button>
          </div>
        )}

        <ReportSummary
          items={[
            { label: t('reports.component.totalPayrolls'), value: summary.total ?? 0 },
            { label: t('reports.component.totalGross'), value: formatCurrencyVnd(summary.gross) },
            { label: t('reports.component.totalDeductionReport'), value: formatCurrencyVnd(summary.deduction) },
            { label: t('reports.component.totalNet'), value: formatCurrencyVnd(summary.net) },
          ]}
        />

        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          <div className="rounded-md border border-neutral-200 p-4">
            <h4 className="mb-3 text-sm font-semibold text-neutral-900">{t('reports.component.netGrossByPeriod')}</h4>
            <MiniBarChart data={chartData} emptyText={t('reports.component.noPayrollDataInPeriod')} />
          </div>
          <div className="rounded-md border border-neutral-200 p-4">
            <h4 className="mb-3 text-sm font-semibold text-neutral-900">{t('reports.component.distributionByPaymentStatus')}</h4>
            <MiniBarChart
              data={statuses.map((s) => ({ label: s.label, value: summary.byStatus?.[s.value] ?? 0 }))}
              emptyText={t('reports.component.noData')}
            />
          </div>
        </div>

        {data.items.length === 0 ? (
          <EmptyState
            icon={Wallet}
            title={t('reports.component.noPayrollData')}
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
            emptyTitle={t('reports.component.noPayrollData')}
            emptyDescription={t('reports.component.changeFilterOrReset')}
          />
        )}
      </div>
    </Card>
  )
}
