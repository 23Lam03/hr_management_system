import { useEffect, useMemo, useState } from 'react'
import { FileText, Plus, ListChecks, CalendarDays } from 'lucide-react'

import PageHeader from '../../components/common/PageHeader'
import Button from '../../components/common/Button'
import EmptyState from '../../components/common/EmptyState'
import { useToast } from '../../components/common/useToast'
import { useI18n } from '../../i18n/useI18n'

import LeaveStatTiles from '../../components/leaves/LeaveStatTiles'
import LeaveFilterBar from '../../components/leaves/LeaveFilterBar'
import LeaveTable from '../../components/leaves/LeaveTable'
import LeavePagination from '../../components/leaves/LeavePagination'
import LeaveDetailModal from '../../components/leaves/LeaveDetailModal'
import LeaveFormModal from '../../components/leaves/LeaveFormModal'
import CancelConfirmModal from '../../components/leaves/CancelConfirmModal'
import LeaveCalendar from '../../components/leaves/LeaveCalendar'
import LeaveBalanceCard from '../../components/leaves/LeaveBalanceCard'

import {
  queryLeaveRequests,
  getLeaveSummary,
  getLeaveRequestById,
  getLeaveStatuses,
  getLeaveTypes,
  createLeaveRequest,
  cancelLeaveRequest,
  getLeaveBalance,
  subscribeLeaves,
} from '../../services/leaveService'
import { getEmployeeById, getDepartments } from '../../services/employeeService'
import { useAuth } from '../../contexts/useAuth'

const DEFAULT_QUERY = {
  search: '',
  status: '',
  leaveType: '',
  dateField: 'startDate',
  dateFrom: '',
  dateTo: '',
  sortBy: 'submittedAt',
  sortDir: 'desc',
  page: 1,
  pageSize: 10,
}

export default function EmployeeLeavesPage() {
  const toast = useToast()
  const { user: currentUser } = useAuth()
  const { t } = useI18n()
  const employeeId = currentUser?.id ?? null
  const employee = useMemo(
    () => (employeeId ? getEmployeeById(employeeId) : null),
    [employeeId],
  )

  const [query, setQuery] = useState(DEFAULT_QUERY)
  const [loading, setLoading] = useState(true)
  const [tick, setTick] = useState(0)
  const [openDetail, setOpenDetail] = useState(false)
  const [detailId, setDetailId] = useState(null)
  const [openForm, setOpenForm] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [serverErrors, setServerErrors] = useState({})
  const [openCancel, setOpenCancel] = useState(false)
  const [cancelId, setCancelId] = useState(null)
  const [activeTab, setActiveTab] = useState('list')
  const [selectedCalendarDate, setSelectedCalendarDate] = useState(null)

  useEffect(() => {
    setLoading(true)
    const t = setTimeout(() => setLoading(false), 150)
    return () => clearTimeout(t)
  }, [tick, query.search, query.status, query.leaveType, query.dateFrom, query.dateTo])

  useEffect(() => {
    const unsub = subscribeLeaves(() => setTick((n) => n + 1))
    return () => unsub()
  }, [])

  const departments = useMemo(() => getDepartments(), [])
  const statuses = useMemo(() => getLeaveStatuses(), [])
  const types = useMemo(() => getLeaveTypes(), [])

  // eslint-disable-next-line react-hooks/exhaustive-deps
  const data = useMemo(() => {
    const filters = {
      ...query,
      employeeId: employeeId || '',
      createdFrom: query.dateField === 'createdAt' ? query.dateFrom : '',
      createdTo: query.dateField === 'createdAt' ? query.dateTo : '',
      startDateFrom: query.dateField === 'startDate' ? query.dateFrom : '',
      startDateTo: query.dateField === 'startDate' ? query.dateTo : '',
    }
    return queryLeaveRequests(filters)
  }, [query, tick, employeeId])

  // eslint-disable-next-line react-hooks/exhaustive-deps
  const summary = useMemo(() => {
    const filters = {
      ...query,
      employeeId: employeeId || '',
      createdFrom: query.dateField === 'createdAt' ? query.dateFrom : '',
      createdTo: query.dateField === 'createdAt' ? query.dateTo : '',
      startDateFrom: query.dateField === 'startDate' ? query.dateFrom : '',
      startDateTo: query.dateField === 'startDate' ? query.dateTo : '',
    }
    return getLeaveSummary(filters)
  }, [query, tick, employeeId])

  // eslint-disable-next-line react-hooks/exhaustive-deps
  const balance = useMemo(
    () => (employeeId ? getLeaveBalance(employeeId) : null),
    [employeeId, tick],
  )

  const setField = (key, value) => setQuery((q) => ({ ...q, [key]: value, page: 1 }))
  const onSort = (field) => {
    setQuery((q) => {
      if (q.sortBy === field) {
        return { ...q, sortDir: q.sortDir === 'asc' ? 'desc' : 'asc', page: 1 }
      }
      return { ...q, sortBy: field, sortDir: field === 'status' ? 'asc' : 'desc', page: 1 }
    })
  }
  const onClear = () => setQuery({ ...DEFAULT_QUERY })

  const openCreate = () => {
    setServerErrors({})
    setOpenForm(true)
  }
  const closeForm = () => {
    setOpenForm(false)
    setServerErrors({})
  }

  const openView = (id) => {
    setDetailId(id)
    setOpenDetail(true)
  }

  const onCancel = (id) => {
    setCancelId(id)
    setOpenCancel(true)
  }

  const confirmCancel = async () => {
    if (!cancelId || !employeeId) return
    setSubmitting(true)
    const result = await cancelLeaveRequest(cancelId, employeeId)
    setSubmitting(false)
    if (!result.ok) {
      toast.error(t('employeeLeaves.cannotCancel'), { description: result.error })
      setOpenCancel(false)
      setCancelId(null)
      return
    }
    toast.success(t('employeeLeaves.cancelledSuccess'), { description: result.record.requestCode })
    setOpenCancel(false)
    setCancelId(null)
  }

  const submitCreate = async (values) => {
    if (!employeeId) {
      toast.error(t('employeeLeaves.cannotIdentifyEmployee'), {
        description: t('employeeLeaves.pleaseLoginAgain'),
      })
      return
    }
    setSubmitting(true)
    const result = await createLeaveRequest(values, employeeId)
    setSubmitting(false)
    if (!result.ok) {
      setServerErrors(result.errors || {})
      toast.error(t('employeeLeaves.cannotSubmitRequest'), {
        description: result.errors?._form || t('employeeLeaves.checkInvalidFields'),
      })
      return
    }
    toast.success(t('employeeLeaves.requestSubmitted'), {
      description: t('employeeLeaves.requestCode', { n: result.record.requestCode }),
    })
    setOpenForm(false)
    setServerErrors({})
    setQuery((q) => ({ ...q, page: 1 }))
  }

  if (!employeeId || !employee) {
    return (
      <>
        <PageHeader
          title={t('employeeLeaves.myLeaves')}
          icon={FileText}
        />
        <EmptyState
          title={t('employeeLeaves.notIdentified')}
          description={t('employeeLeaves.notLinked')}
        />
      </>
    )
  }

  const detailRecord = detailId ? getLeaveRequestById(detailId) : null
  const cancelRecord = cancelId ? getLeaveRequestById(cancelId) : null

  return (
    <>
      <PageHeader
        title={t('employeeLeaves.myLeaves')}
        subtitle={t('employeeLeaves.myLeavesDesc')}
        icon={FileText}
        breadcrumb="Cá nhân / Nghỉ phép"
        actions={
          <Button variant="primary" icon={Plus} onClick={openCreate}>
            {t('employeeLeaves.createLeave')}
          </Button>
        }
      />

      <div className="mb-4 inline-flex rounded-md border border-neutral-200 bg-white p-1 shadow-card">
        <button
          type="button"
          onClick={() => setActiveTab('list')}
          className={`inline-flex items-center gap-1.5 rounded px-3 py-1.5 text-sm font-medium transition ${
            activeTab === 'list'
              ? 'bg-brand-600 text-white shadow-sm'
              : 'text-neutral-600 hover:bg-neutral-50'
          }`}
        >
          <ListChecks className="h-4 w-4" aria-hidden="true" />
          {t('employeeLeaves.myRequests')}
        </button>
        <button
          type="button"
          onClick={() => setActiveTab('calendar')}
          className={`inline-flex items-center gap-1.5 rounded px-3 py-1.5 text-sm font-medium transition ${
            activeTab === 'calendar'
              ? 'bg-brand-600 text-white shadow-sm'
              : 'text-neutral-600 hover:bg-neutral-50'
          }`}
        >
          <CalendarDays className="h-4 w-4" aria-hidden="true" />
          {t('employeeLeaves.personalCalendar')}
        </button>
      </div>

      <div className="mb-6 grid grid-cols-1 gap-6 lg:grid-cols-[1fr_320px]">
        <div>
          <LeaveStatTiles summary={summary} />
        </div>
        <LeaveBalanceCard balance={balance} />
      </div>

      {activeTab === 'list' ? (
        <>
          <div className="mb-4">
            <LeaveFilterBar
              search={query.search}
              onSearchChange={(v) => setField('search', v)}
              status={query.status}
              onStatusChange={(v) => setField('status', v)}
              leaveType={query.leaveType}
              onLeaveTypeChange={(v) => setField('leaveType', v)}
              dateField={query.dateField}
              dateFrom={query.dateFrom}
              dateTo={query.dateTo}
              onDateFromChange={(v) => setField('dateFrom', v)}
              onDateToChange={(v) => setField('dateTo', v)}
              departments={departments}
              statuses={statuses}
              types={types}
              onClear={onClear}
              total={data.total}
              showDepartment={false}
              searchPlaceholder={t('employeeLeaves.searchByCode')}
              onClear={onClear}
              total={data.total}
              showDepartment={false}
            />
            <div className="mt-3 flex flex-wrap items-center justify-end gap-2">
              <span className="text-[13px] text-neutral-500">{t('employeeLeaves.filterBy')}</span>
              <Button
                size="sm"
                variant={query.dateField === 'startDate' ? 'primary' : 'secondary'}
                onClick={() => setQuery((q) => ({ ...q, dateField: 'startDate', page: 1 }))}
              >
                {t('employeeLeaves.startDateFilter')}
              </Button>
              <Button
                size="sm"
                variant={query.dateField === 'createdAt' ? 'primary' : 'secondary'}
                onClick={() => setQuery((q) => ({ ...q, dateField: 'createdAt', page: 1 }))}
              >
                {t('employeeLeaves.submittedDateFilter')}
              </Button>
            </div>
          </div>

          <div className="mb-4">
            {data.total === 0 && !loading ? (
              <EmptyState
                title={t('employeeLeaves.noLeaveRequests')}
                description={
                  query.search || query.status || query.leaveType || query.dateFrom || query.dateTo
                    ? t('employeeLeaves.tryClearFilter')
                    : t('employeeLeaves.createFirstRequest')
                }
                actionLabel={t('employeeLeaves.createLeave')}
                onAction={openCreate}
              />
            ) : (
              <LeaveTable
                rows={data.items}
                loading={loading}
                sortBy={query.sortBy}
                sortDir={query.sortDir}
                onSort={onSort}
                onView={openView}
                onCancel={onCancel}
                currentUserEmployeeId={employeeId}
                isAdminView={false}
              />
            )}
          </div>

          {data.total > 0 && (
            <div className="mb-6">
              <LeavePagination
                page={data.page}
                totalPages={data.totalPages}
                pageSize={data.pageSize}
                total={data.total}
                onPageChange={(p) => setQuery((q) => ({ ...q, page: p }))}
                onPageSizeChange={(n) => setQuery((q) => ({ ...q, pageSize: n, page: 1 }))}
              />
            </div>
          )}
        </>
      ) : (
        <div className="mb-6">
          <LeaveCalendar
            employeeId={employeeId}
            selectedDate={selectedCalendarDate}
            onDayClick={(date) => setSelectedCalendarDate(date)}
          />
        </div>
      )}

      <LeaveFormModal
        open={openForm}
        onClose={closeForm}
        onSubmit={submitCreate}
        submitting={submitting}
        serverErrors={serverErrors}
      />

      <LeaveDetailModal
        open={openDetail}
        onClose={() => {
          setOpenDetail(false)
          setDetailId(null)
        }}
        record={detailRecord}
        showReviewActions={false}
      />

      <CancelConfirmModal
        open={openCancel}
        onClose={() => {
          setOpenCancel(false)
          setCancelId(null)
        }}
        record={cancelRecord}
        onConfirm={confirmCancel}
        submitting={submitting}
      />
    </>
  )
}