import { useEffect, useMemo, useState } from 'react'
import { FileText, RefreshCw, ListChecks, CalendarDays } from 'lucide-react'

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
import ApproveConfirmModal from '../../components/leaves/ApproveConfirmModal'
import RejectConfirmModal from '../../components/leaves/RejectConfirmModal'
import LeaveCalendar from '../../components/leaves/LeaveCalendar'

import {
  queryLeaveRequests,
  getLeaveSummary,
  getLeaveRequestById,
  getLeaveStatuses,
  getLeaveTypes,
  approveLeaveRequest,
  rejectLeaveRequest,
  subscribeLeaves,
} from '../../services/leaveService'
import { getDepartments } from '../../services/employeeService'
import { useAuth } from '../../contexts/useAuth'

const DEFAULT_QUERY = {
  search: '',
  status: '',
  leaveType: '',
  departmentId: '',
  dateField: 'createdAt',
  dateFrom: '',
  dateTo: '',
  sortBy: 'submittedAt',
  sortDir: 'desc',
  page: 1,
  pageSize: 10,
}

export default function AdminLeavesPage() {
  const { t } = useI18n()
  const toast = useToast()
  const { user: currentUser } = useAuth()
  const [query, setQuery] = useState(DEFAULT_QUERY)
  const [loading, setLoading] = useState(true)
  const [tick, setTick] = useState(0)
  const [openDetail, setOpenDetail] = useState(false)
  const [detailId, setDetailId] = useState(null)
  const [openApprove, setOpenApprove] = useState(false)
  const [openReject, setOpenReject] = useState(false)
  const [targetId, setTargetId] = useState(null)
  const [submitting, setSubmitting] = useState(false)
  const [activeTab, setActiveTab] = useState('list') // 'list' | 'calendar'
  const [calendarDeptId, setCalendarDeptId] = useState('')
  const [selectedCalendarDate, setSelectedCalendarDate] = useState(null)

  // Loading effect
  useEffect(() => {
    setLoading(true)
    const tmr = setTimeout(() => setLoading(false), 150)
    return () => clearTimeout(tmr)
  }, [tick, query.search, query.status, query.leaveType, query.departmentId, query.dateFrom, query.dateTo])

  // Subscribe
  useEffect(() => {
    const unsub = subscribeLeaves(() => setTick((n) => n + 1))
    return () => unsub()
  }, [])

  const departments = useMemo(() => getDepartments(), [])
  const statuses = useMemo(() => getLeaveStatuses(), [])
  const types = useMemo(() => getLeaveTypes(), [])

  // eslint-disable-next-line react-hooks/exhaustive-deps
  const data = useMemo(() => {
    // Map UI date field -> backend filter
    const filters = { ...query }
    if (query.dateField === 'createdAt') {
      filters.createdFrom = query.dateFrom
      filters.createdTo = query.dateTo
      filters.startDateFrom = ''
      filters.startDateTo = ''
    } else {
      filters.startDateFrom = query.dateFrom
      filters.startDateTo = query.dateTo
      filters.createdFrom = ''
      filters.createdTo = ''
    }
    return queryLeaveRequests(filters)
  }, [query, tick])

  // eslint-disable-next-line react-hooks/exhaustive-deps
  const summary = useMemo(() => {
    const filters = { ...query }
    if (query.dateField === 'createdAt') {
      filters.createdFrom = query.dateFrom
      filters.createdTo = query.dateTo
      filters.startDateFrom = ''
      filters.startDateTo = ''
    } else {
      filters.startDateFrom = query.dateFrom
      filters.startDateTo = query.dateTo
      filters.createdFrom = ''
      filters.createdTo = ''
    }
    return getLeaveSummary(filters)
  }, [query, tick])

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

  const onRefresh = () => {
    setTick((n) => n + 1)
    toast.info(t('admin.dataRefreshed'))
  }

  const openView = (id) => {
    setDetailId(id)
    setOpenDetail(true)
  }

  const handleApprove = (id) => {
    setTargetId(id)
    setOpenApprove(true)
  }
  const handleReject = (id) => {
    setTargetId(id)
    setOpenReject(true)
  }

  const confirmApprove = async () => {
    if (!targetId || !currentUser) return
    setSubmitting(true)
    const result = await approveLeaveRequest(targetId, {
      id: currentUser.id,
      name: currentUser.name,
    })
    setSubmitting(false)
    if (!result.ok) {
      toast.error(t('admin.cannotApproveLeave'), { description: result.error })
      setOpenApprove(false)
      setTargetId(null)
      return
    }
    toast.success(t('admin.leaveApproved'), {
      description: `${result.record.requestCode} · ${result.record.employeeName}`,
    })
    setOpenApprove(false)
    setOpenReject(false)
    setTargetId(null)
    setOpenDetail(false)
    setDetailId(null)
  }

  const confirmReject = async (reason) => {
    if (!targetId || !currentUser) return
    setSubmitting(true)
    const result = await rejectLeaveRequest(targetId, {
      id: currentUser.id,
      name: currentUser.name,
    }, reason)
    setSubmitting(false)
    if (!result.ok) {
      toast.error(t('admin.cannotRejectLeave'), { description: result.error })
      return
    }
    toast.success(t('admin.leaveRejected'), {
      description: `${result.record.requestCode} · ${result.record.employeeName}`,
    })
    setTargetId(null)
    setOpenReject(false)
    setOpenDetail(false)
    setDetailId(null)
  }

  const detailRecord = detailId ? getLeaveRequestById(detailId) : null
  const targetRecord = targetId ? getLeaveRequestById(targetId) : null

  return (
    <>
      <PageHeader
        title={t('admin.leavesTitle')}
        subtitle={t('admin.leavesSubtitle')}
        icon={FileText}
        breadcrumb={t('admin.leavesBreadcrumb')}
        actions={
          <Button variant="secondary" icon={RefreshCw} onClick={onRefresh}>
            {t('admin.refresh')}
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
          {t('admin.leaveList')}
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
          {t('admin.leaveCalendar')}
        </button>
      </div>

      <div className="mb-6">
        <LeaveStatTiles summary={summary} />
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
              departmentId={query.departmentId}
              onDepartmentChange={(v) => setField('departmentId', v)}
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
              showDepartment
            />
            <div className="mt-3 flex flex-wrap items-center justify-end gap-2">
              <span className="text-[13px] text-neutral-500">{t('admin.filterBy')}</span>
              <Button
                size="sm"
                variant={query.dateField === 'createdAt' ? 'primary' : 'secondary'}
                onClick={() => setQuery((q) => ({ ...q, dateField: 'createdAt', page: 1 }))}
              >
                {t('admin.submittedDate')}
              </Button>
              <Button
                size="sm"
                variant={query.dateField === 'startDate' ? 'primary' : 'secondary'}
                onClick={() => setQuery((q) => ({ ...q, dateField: 'startDate', page: 1 }))}
              >
                {t('admin.startDate')}
              </Button>
            </div>
          </div>

          <div className="mb-4">
            {data.total === 0 && !loading ? (
              <EmptyState
                title={t('admin.noLeavesFound')}
                description={
                  query.search || query.status || query.leaveType || query.departmentId || query.dateFrom || query.dateTo
                    ? t('admin.tryClearFilterOrChangeDate')
                    : t('admin.noLeavesInSystem')
                }
              />
            ) : (
              <LeaveTable
                rows={data.items}
                loading={loading}
                sortBy={query.sortBy}
                sortDir={query.sortDir}
                onSort={onSort}
                onView={openView}
                onApprove={handleApprove}
                onReject={handleReject}
                isAdminView
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
            departmentId={calendarDeptId}
            onDepartmentChange={setCalendarDeptId}
            departments={departments}
            selectedDate={selectedCalendarDate}
            onDayClick={(date) => setSelectedCalendarDate(date)}
          />
        </div>
      )}

      <LeaveDetailModal
        open={openDetail}
        onClose={() => {
          setOpenDetail(false)
          setDetailId(null)
        }}
        record={detailRecord}
        onApprove={handleApprove}
        onReject={handleReject}
        showReviewActions
      />

      <ApproveConfirmModal
        open={openApprove}
        onClose={() => {
          setOpenApprove(false)
          setTargetId(null)
        }}
        record={targetRecord}
        onConfirm={confirmApprove}
        submitting={submitting}
      />

      <RejectConfirmModal
        open={openReject}
        onClose={() => {
          setOpenReject(false)
          setTargetId(null)
        }}
        record={targetRecord}
        onConfirm={confirmReject}
        submitting={submitting}
      />
    </>
  )
}
