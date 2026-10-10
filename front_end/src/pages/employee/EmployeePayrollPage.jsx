import { useEffect, useMemo, useState } from 'react'
import { Wallet } from 'lucide-react'

import PageHeader from '../../components/common/PageHeader'
import EmptyState from '../../components/common/EmptyState'
import Button from '../../components/common/Button'
import { useI18n } from '../../i18n/useI18n'

import PayrollStatTiles from '../../components/payroll/PayrollStatTiles'
import PayrollFilterBar from '../../components/payroll/PayrollFilterBar'
import PayrollTable from '../../components/payroll/PayrollTable'
import PayrollPagination from '../../components/payroll/PayrollPagination'
import PayrollDetailModal from '../../components/payroll/PayrollDetailModal'

import {
  queryPayroll,
  getPayrollSummary,
  getPayrollById,
  getPaymentStatuses,
  subscribePayroll,
} from '../../services/payrollService'
import { resolveEmployeeFromUser } from '../../services/authLinker'
import { useAuth } from '../../contexts/useAuth'
import { formatCurrencyVnd } from '../../utils/format'

const DEFAULT_QUERY = {
  search: '',
  month: '',
  year: '',
  paymentStatus: '',
  sortBy: 'updatedAt',
  sortDir: 'desc',
  page: 1,
  pageSize: 10,
}

export default function EmployeePayrollPage() {
  const { user: currentUser } = useAuth()
  const { t } = useI18n()
  const employee = useMemo(
    () => resolveEmployeeFromUser(currentUser),
    [currentUser],
  )
  const employeeId = employee?.id ?? null

  const [query, setQuery] = useState(DEFAULT_QUERY)
  const [loading, setLoading] = useState(true)
  const [tick, setTick] = useState(0)
  const [openDetail, setOpenDetail] = useState(false)
  const [detailId, setDetailId] = useState(null)

  useEffect(() => {
    setLoading(true)
    const t = setTimeout(() => setLoading(false), 150)
    return () => clearTimeout(t)
  }, [tick, query.search, query.month, query.year, query.paymentStatus])

  useEffect(() => {
    const unsub = subscribePayroll(() => setTick((n) => n + 1))
    return () => unsub()
  }, [])

  const statuses = useMemo(() => getPaymentStatuses(), [])
  const monthOptions = useMemo(
    () =>
      Array.from({ length: 12 }, (_, i) => ({
        value: String(i + 1),
        label: `Tháng ${i + 1}`,
      })),
    [],
  )
  const yearOptions = useMemo(() => {
    const years = new Set()
    const currentYear = new Date().getFullYear()
    years.add(currentYear)
    years.add(currentYear - 1)
    years.add(currentYear - 2)
    return Array.from(years).sort((a, b) => b - a).map((y) => ({
      value: String(y),
      label: String(y),
    }))
  }, [])

  // eslint-disable-next-line react-hooks/exhaustive-deps
  const data = useMemo(
    () => queryPayroll({ ...query, employeeId: employeeId || '' }),
    [query, employeeId, tick],
  )

  // eslint-disable-next-line react-hooks/exhaustive-deps
  const summary = useMemo(
    () => getPayrollSummary({
      employeeId: employeeId || '',
      year: query.year,
    }),
    [employeeId, query.year, tick],
  )

  const setField = (key, value) => setQuery((q) => ({ ...q, [key]: value, page: 1 }))
  const onClear = () => setQuery({ ...DEFAULT_QUERY })

  const openView = (id) => {
    setDetailId(id)
    setOpenDetail(true)
  }

  const detailRecord = detailId ? getPayrollById(detailId) : null

  if (!employeeId || !employee) {
    return (
      <>
        <PageHeader
          title={t('employeePayroll.myPayslips')}
          icon={Wallet}
          breadcrumb="Cá nhân / Phiếu lương"
        />
        <EmptyState
          title={t('employeePayroll.notIdentified')}
          description={t('employeePayroll.notLinked')}
        />
      </>
    )
  }

  // Custom stats cho employee: tổng thu nhập + thực nhận + đã/chưa thanh toán
  const employeeSummary = {
    totalEmployees: summary.totalEmployees,
    paidCount: summary.paidCount,
    unpaidCount: summary.unpaidCount,
    totalNet: summary.totalNet,
    unpaidNet: summary.unpaidNet,
  }

  return (
    <>
      <PageHeader
        title={t('employeePayroll.myPayslips')}
        subtitle={t('employeePayroll.myPayslipsDesc', { n: employee.fullName })}
        icon={Wallet}
        breadcrumb="Cá nhân / Phiếu lương"
        actions={
          <Button
            variant="secondary"
            onClick={() => window.print()}
          >
            {t('employeePayroll.printPayslip')}
          </Button>
        }
      />

      <div className="mb-6">
        <PayrollStatTiles summary={employeeSummary} />
      </div>

      <div className="mb-4">
        <PayrollFilterBar
          search={query.search}
          onSearchChange={(v) => setField('search', v)}
          month={query.month}
          onMonthChange={(v) => setField('month', v)}
          year={query.year}
          onYearChange={(v) => setField('year', v)}
          paymentStatus={query.paymentStatus}
          onPaymentStatusChange={(v) => setField('paymentStatus', v)}
          statuses={statuses}
          monthOptions={monthOptions}
          yearOptions={yearOptions}
          onClear={onClear}
          total={data.total}
          showDepartment={false}
          searchPlaceholder={t('employeePayroll.searchByCode')}
        />
      </div>

      <div className="mb-4">
        {data.total === 0 && !loading ? (
          <EmptyState
            title={t('employeePayroll.noPayslips')}
            description={
              query.search || query.month || query.year || query.paymentStatus
                ? t('employeePayroll.tryClearFilter')
                : t('employeePayroll.noPayslipsYet')
            }
          />
        ) : (
          <PayrollTable
            rows={data.items}
            loading={loading}
            onView={openView}
            isAdminView={false}
          />
        )}
      </div>

      {data.total > 0 && (
        <div className="mb-6">
          <PayrollPagination
            page={data.page}
            totalPages={data.totalPages}
            pageSize={data.pageSize}
            total={data.total}
            onPageChange={(p) => setQuery((q) => ({ ...q, page: p }))}
            onPageSizeChange={(n) => setQuery((q) => ({ ...q, pageSize: n, page: 1 }))}
          />
        </div>
      )}

      <PayrollDetailModal
        open={openDetail}
        onClose={() => {
          setOpenDetail(false)
          setDetailId(null)
        }}
        record={detailRecord}
        isAdminView={false}
      />

      {detailRecord && (
        <p className="hidden text-xs text-neutral-400 print:block">
          {t('employeePayroll.printedFrom', { n: formatCurrencyVnd(detailRecord.netSalary) })}
        </p>
      )}
    </>
  )
}