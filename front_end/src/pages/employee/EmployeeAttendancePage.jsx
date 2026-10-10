import { useEffect, useMemo, useState } from 'react'
import { CalendarDays, Clock4, CheckCircle2, XCircle } from 'lucide-react'

import PageHeader from '../../components/common/PageHeader'
import Card from '../../components/common/Card'
import Input from '../../components/common/Input'
import Select from '../../components/common/Select'
import Table from '../../components/common/Table'
import Badge from '../../components/common/Badge'
import EmptyState from '../../components/common/EmptyState'
import StatCard from '../../components/common/StatCard'

import { useAuth } from '../../contexts/useAuth'
import { EMPLOYEES } from '../../data/employeeMockData'
import { useI18n } from '../../i18n/useI18n'
import {
  getMyAttendance,
  queryMyAttendance,
  subscribeAttendance,
  ATTENDANCE_APPROVAL_LABEL,
  ATTENDANCE_APPROVAL_TONE,
} from '../../services/attendanceService'
import { formatDate } from '../../utils/format'

const APPROVAL_OPTIONS = (t) => [
  { value: '',          label: t('employeeAttendance.allStatuses') },
  { value: 'pending',   label: t('employeeAttendance.pendingApproval') },
  { value: 'approved',  label: t('employeeAttendance.approved') },
  { value: 'rejected',  label: t('employeeAttendance.rejected') },
]

/**
 * EmployeeAttendancePage - nhân viên xem chấm công của chính mình.
 *
 * Phase 28:
 *  - Chỉ hiển thị data của currentUser (resolved qua userId/employeeId).
 *  - KHÔNG có Approve/Reject.
 *  - Hiển thị Approval Status.
 */
export default function EmployeeAttendancePage() {
  const { user } = useAuth()
  const { t } = useI18n()

  const currentEmployeeId = useMemo(() => {
    if (!user?.id) return null
    const matched = EMPLOYEES.find((e) => e.userId === user.id || e.id === user.id)
    return matched?.id ?? null
  }, [user])

  const [version, setVersion] = useState(0)
  useEffect(() => {
    const unsub = subscribeAttendance(() => setVersion((v) => v + 1))
    return () => unsub()
  }, [])

  const [query, setQuery] = useState({
    search: '',
    dateFrom: '',
    dateTo: '',
    status: '',
    approvalStatus: '',
    sortBy: 'date',
    sortDir: 'desc',
    page: 1,
    pageSize: 10,
  })

  const data = useMemo(() => {
    if (!currentEmployeeId) return { items: [], total: 0, page: 1, totalPages: 1, pageSize: 10 }
    return queryMyAttendance(currentEmployeeId, query)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentEmployeeId, query, version])

  const all = useMemo(() => {
    if (!currentEmployeeId) return []
    return getMyAttendance(currentEmployeeId)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentEmployeeId, version])

  const summary = useMemo(() => {
    return {
      total:    all.length,
      pending:  all.filter((r) => r.approvalStatus === 'pending').length,
      approved: all.filter((r) => r.approvalStatus === 'approved').length,
      rejected: all.filter((r) => r.approvalStatus === 'rejected').length,
    }
  }, [all])

  if (!user) {
    return <EmptyState title={t('employeeAttendance.pleaseLogin')} />
  }

  if (!currentEmployeeId) {
    return (
      <Card>
        <EmptyState
          title={t('employeeAttendance.accountNotLinked')}
          description={t('employeeAttendance.cannotViewWithoutProfile')}
        />
      </Card>
    )
  }

  return (
    <>
      <PageHeader
        title={t('employeeAttendance.myAttendance')}
        subtitle={t('employeeAttendance.myAttendanceDesc')}
        icon={CalendarDays}
      />

      <div className="mb-6 grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard label={t('employeeAttendance.totalRecords')} value={summary.total}    icon={CalendarDays}  tone="primary" />
        <StatCard label={t('employeeAttendance.pendingApproval')} value={summary.pending}  icon={Clock4}        tone="info" />
        <StatCard label={t('employeeAttendance.approved')}      value={summary.approved} icon={CheckCircle2}  tone="success" />
        <StatCard label={t('employeeAttendance.rejected')}     value={summary.rejected} icon={XCircle}       tone="danger" />
      </div>

      <Card className="mb-4">
        <div className="grid grid-cols-1 gap-3 md:grid-cols-12">
          <div className="md:col-span-5">
            <Input
              placeholder={t('employeeAttendance.searchPlaceholder')}
              value={query.search}
              onChange={(e) => setQuery((q) => ({ ...q, search: e.target.value, page: 1 }))}
            />
          </div>
          <div className="md:col-span-3">
            <Input
              type="date"
              value={query.dateFrom}
              onChange={(e) => setQuery((q) => ({ ...q, dateFrom: e.target.value, page: 1 }))}
              aria-label={t('employeeAttendance.dateFrom')}
            />
          </div>
          <div className="md:col-span-2">
            <Input
              type="date"
              value={query.dateTo}
              onChange={(e) => setQuery((q) => ({ ...q, dateTo: e.target.value, page: 1 }))}
              aria-label={t('employeeAttendance.dateTo')}
            />
          </div>
          <div className="md:col-span-2">
            <Select
              options={APPROVAL_OPTIONS(t)}
              value={query.approvalStatus}
              onChange={(e) => setQuery((q) => ({ ...q, approvalStatus: e.target.value, page: 1 }))}
              aria-label={t('employeeAttendance.approvalStatus')}
            />
          </div>
        </div>
      </Card>

      <Card>
        {data.total === 0 ? (
          <EmptyState
            title={t('employeeAttendance.noAttendanceData')}
            description={t('employeeAttendance.noAttendanceDataDesc')}
          />
        ) : (
          <>
            <Table
              data={data.items}
              rowKey="id"
              columns={[
                { key: 'date',    header: t('employeeAttendance.date'),  render: (r) => formatDate(r.date) },
                { key: 'in',      header: t('employeeAttendance.checkInTime'), render: (r) => r.checkIn || '—' },
                { key: 'out',     header: t('employeeAttendance.checkOutTime'), render: (r) => r.checkOut || '—' },
                { key: 'hours',   header: t('employeeAttendance.totalHours'), render: (r) => r.workHours > 0 ? `${r.workHours.toFixed(2)}h` : '—' },
                { key: 'late',    header: t('employeeAttendance.lateMinutes'), render: (r) => r.lateMinutes > 0 ? `${r.lateMinutes} phút` : '—' },
                { key: 'status',  header: t('employeeAttendance.status'), render: (r) => (
                  <Badge tone={statusTone(r.status)}>{statusLabel(r, t)}</Badge>
                ) },
                { key: 'approval', header: t('employeeAttendance.approval'), render: (r) => (
                  <Badge tone={ATTENDANCE_APPROVAL_TONE[r.approvalStatus] || 'neutral'}>
                    {ATTENDANCE_APPROVAL_LABEL[r.approvalStatus] || r.approvalStatus}
                  </Badge>
                ) },
              ]}
            />
            <div className="mt-3 flex items-center justify-between text-xs text-neutral-500">
              <span>{data.total} {t('employeeAttendance.records')}</span>
              <PaginationMini
                page={data.page}
                totalPages={data.totalPages}
                onPageChange={(p) => setQuery((q) => ({ ...q, page: p }))}
                t={t}
              />
            </div>
          </>
        )}
      </Card>
    </>
  )
}

function PaginationMini({ page, totalPages, onPageChange, t }) {
  return (
    <div className="flex items-center gap-1">
      <button
        type="button"
        disabled={page <= 1}
        onClick={() => onPageChange(page - 1)}
        className="rounded-md border border-neutral-200 bg-white px-2 py-1 text-xs text-neutral-700 hover:bg-neutral-50 disabled:opacity-50"
      >{t('employeeAttendance.previous')}</button>
      <span className="px-2">{page}/{totalPages}</span>
      <button
        type="button"
        disabled={page >= totalPages}
        onClick={() => onPageChange(page + 1)}
        className="rounded-md border border-neutral-200 bg-white px-2 py-1 text-xs text-neutral-700 hover:bg-neutral-50 disabled:opacity-50"
      >{t('employeeAttendance.next')}</button>
    </div>
  )
}

function statusTone(s) {
  if (s === 'late') return 'warning'
  if (s === 'early_leave') return 'warning'
  if (s === 'on_leave') return 'pending'
  if (s === 'absent') return 'danger'
  if (s === 'incomplete') return 'neutral'
  return 'success'
}
function statusLabel(r, t) {
  const map = {
    on_time: t('employeeAttendance.onTime'),
    late: t('employeeAttendance.lateMinutes'),
    early_leave: t('employeeAttendance.earlyLeave'),
    on_leave: t('leaves.pageTitle'),
    absent: t('employeeAttendance.absent'),
    incomplete: t('employeeAttendance.incomplete'),
  }
  return map[r.status] || r.status
}