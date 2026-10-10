import { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Star, Plus, RefreshCw } from 'lucide-react'

import PageHeader from '../../components/common/PageHeader'
import Button from '../../components/common/Button'
import EmptyState from '../../components/common/EmptyState'
import { useToast } from '../../components/common/useToast'
import { useI18n } from '../../i18n/useI18n'

import EvaluationStatTiles from '../../components/evaluations/EvaluationStatTiles'
import EvaluationFilterBar from '../../components/evaluations/EvaluationFilterBar'
import EvaluationCycleTable from '../../components/evaluations/EvaluationCycleTable'
import EvaluationPagination from '../../components/evaluations/EvaluationPagination'
import CycleFormModal from '../../components/evaluations/CycleFormModal'
import CloseCycleConfirmModal from '../../components/evaluations/CloseCycleConfirmModal'

import {
  queryEvaluationCycles,
  getCyclesSummary,
  createEvaluationCycle,
  updateEvaluationCycle,
  closeEvaluationCycle,
  getEvaluationCycleById,
  subscribeEvaluations,
} from '../../services/evaluationService'
import { getDepartments } from '../../services/employeeService'
import { CYCLE_STATUSES } from '../../data/evaluationMockData'

const DEFAULT_QUERY = {
  search: '',
  status: '',
  departmentId: '',
  dateField: 'startDate',
  dateFrom: '',
  dateTo: '',
  sortBy: 'updatedAt',
  sortDir: 'desc',
  page: 1,
  pageSize: 10,
}

export default function AdminEvaluationsPage() {
  const { t } = useI18n()
  const navigate = useNavigate()
  const toast = useToast()
  const [query, setQuery] = useState(DEFAULT_QUERY)
  const [loading, setLoading] = useState(true)
  const [tick, setTick] = useState(0)
  const [openForm, setOpenForm] = useState(false)
  const [formMode, setFormMode] = useState('create')
  const [formInitial, setFormInitial] = useState(null)
  const [submitting, setSubmitting] = useState(false)
  const [serverErrors, setServerErrors] = useState({})
  const [openClose, setOpenClose] = useState(false)
  const [closeCycleId, setCloseCycleId] = useState(null)

  useEffect(() => {
    setLoading(true)
    const tmr = setTimeout(() => setLoading(false), 150)
    return () => clearTimeout(tmr)
  }, [tick, query.search, query.status, query.departmentId, query.dateFrom, query.dateTo])

  useEffect(() => {
    const unsub = subscribeEvaluations(() => setTick((n) => n + 1))
    return () => unsub()
  }, [])

  const departments = useMemo(() => getDepartments(), [])

  // eslint-disable-next-line react-hooks/exhaustive-deps
  const data = useMemo(() => {
    const filters = {
      search: query.search,
      status: query.status,
      departmentId: query.departmentId,
      startDateFrom: query.dateField === 'startDate' ? query.dateFrom : '',
      startDateTo: query.dateField === 'startDate' ? query.dateTo : '',
      endDateFrom: query.dateField === 'endDate' ? query.dateFrom : '',
      endDateTo: query.dateField === 'endDate' ? query.dateTo : '',
      sortBy: query.sortBy,
      sortDir: query.sortDir,
      page: query.page,
      pageSize: query.pageSize,
    }
    return queryEvaluationCycles(filters)
  }, [query, tick])

  // eslint-disable-next-line react-hooks/exhaustive-deps
  const summary = useMemo(() => getCyclesSummary(), [tick])

  const setField = (key, value) => setQuery((q) => ({ ...q, [key]: value, page: 1 }))
  const onClear = () => setQuery({ ...DEFAULT_QUERY })

  const onRefresh = () => {
    setTick((n) => n + 1)
    toast.info(t('admin.evaluationsDataRefreshed'))
  }

  const openCreate = () => {
    setServerErrors({})
    setFormMode('create')
    setFormInitial(null)
    setOpenForm(true)
  }

  const openEdit = (id) => {
    const cycle = getEvaluationCycleById(id)
    if (!cycle) {
      toast.error(t('admin.cannotFindCycle'))
      return
    }
    if (cycle.status === 'closed' || cycle.status === 'completed') {
      toast.warning(t('admin.cycleClosed'), {
        description: t('admin.cannotEditClosedCycle'),
      })
      return
    }
    setServerErrors({})
    setFormMode('edit')
    setFormInitial(cycle)
    setOpenForm(true)
  }

  const openView = (id) => navigate(`/admin/evaluations/${id}`)
  const openReview = (id) => navigate(`/admin/evaluations/${id}`)

  const openCloseConfirm = (id) => {
    setCloseCycleId(id)
    setOpenClose(true)
  }

  const submitForm = async (values) => {
    setSubmitting(true)
    const result = formMode === 'edit'
      ? await updateEvaluationCycle(formInitial.id, values)
      : await createEvaluationCycle(values)
    setSubmitting(false)
    if (!result.ok) {
      setServerErrors(result.errors || {})
      toast.error(formMode === 'edit' ? t('admin.cannotUpdateEvaluation') : t('admin.cannotCreateEvaluation'), {
        description: result.errors?._form || t('admin.evaluationCheckFields'),
      })
      return
    }
    toast.success(formMode === 'edit' ? t('admin.evaluationCycleUpdated') : t('admin.evaluationCycleCreated'), {
      description: result.cycle.name,
    })
    setOpenForm(false)
    setServerErrors({})
    setFormInitial(null)
    setQuery((q) => ({ ...q, page: 1 }))
  }

  const confirmClose = async () => {
    if (!closeCycleId) return
    setSubmitting(true)
    const result = await closeEvaluationCycle(closeCycleId)
    setSubmitting(false)
    if (!result.ok) {
      toast.error(t('admin.cannotCloseCycle'), { description: result.error })
      return
    }
    toast.success(t('admin.cycleClosed'), { description: result.cycle.name })
    setOpenClose(false)
    setCloseCycleId(null)
  }

  const closeCycle = closeCycleId ? getEvaluationCycleById(closeCycleId) : null

  return (
    <>
      <PageHeader
        title={t('admin.evaluationsTitle')}
        subtitle={t('admin.evaluationsSubtitle')}
        icon={Star}
        breadcrumb={t('admin.evaluationsBreadcrumb')}
        actions={
          <>
            <Button variant="secondary" icon={RefreshCw} onClick={onRefresh}>{t('admin.refreshEvaluations')}</Button>
            <Button icon={Plus} onClick={openCreate}>{t('admin.createEvaluationCycle')}</Button>
          </>
        }
      />

      <div className="mb-6">
        <EvaluationStatTiles summary={summary} />
      </div>

      <div className="mb-4">
        <EvaluationFilterBar
          search={query.search}
          onSearchChange={(v) => setField('search', v)}
          status={query.status}
          onStatusChange={(v) => setField('status', v)}
          departmentId={query.departmentId}
          onDepartmentChange={(v) => setField('departmentId', v)}
          dateField={query.dateField}
          dateFrom={query.dateFrom}
          dateTo={query.dateTo}
          onDateFromChange={(v) => setField('dateFrom', v)}
          onDateToChange={(v) => setField('dateTo', v)}
          departments={departments}
          statuses={CYCLE_STATUSES}
          onClear={onClear}
          total={data.total}
          showDepartment
        />
        <div className="mt-3 flex flex-wrap items-center justify-end gap-2">
          <span className="text-[13px] text-neutral-500">{t('admin.dateRangeFilter')}</span>
          <Button
            size="sm"
            variant={query.dateField === 'startDate' ? 'primary' : 'secondary'}
            onClick={() => setQuery((q) => ({ ...q, dateField: 'startDate', page: 1 }))}
          >
            {t('admin.startDate')}
          </Button>
          <Button
            size="sm"
            variant={query.dateField === 'endDate' ? 'primary' : 'secondary'}
            onClick={() => setQuery((q) => ({ ...q, dateField: 'endDate', page: 1 }))}
          >
            {t('admin.endDate')}
          </Button>
        </div>
      </div>

      <div className="mb-4">
        {data.total === 0 && !loading ? (
          <EmptyState
            title={t('admin.noEvaluations')}
            description={query.search || query.status || query.departmentId || query.dateFrom || query.dateTo
              ? t('admin.noEvaluationsFiltered')
              : t('admin.noEvaluationsEmpty')}
            actionLabel={t('admin.createEvaluationCycle')}
            onAction={openCreate}
          />
        ) : (
          <EvaluationCycleTable
            rows={data.items}
            loading={loading}
            onView={openView}
            onEdit={openEdit}
            onReview={openReview}
            onClose={openCloseConfirm}
          />
        )}
      </div>

      {data.total > 0 && (
        <div className="mb-6">
          <EvaluationPagination
            page={data.page}
            totalPages={data.totalPages}
            pageSize={data.pageSize}
            total={data.total}
            onPageChange={(p) => setQuery((q) => ({ ...q, page: p }))}
            onPageSizeChange={(n) => setQuery((q) => ({ ...q, pageSize: n, page: 1 }))}
          />
        </div>
      )}

      <CycleFormModal
        open={openForm}
        onClose={() => {
          setOpenForm(false)
          setServerErrors({})
        }}
        mode={formMode}
        initial={formInitial}
        departments={departments}
        onSubmit={submitForm}
        submitting={submitting}
        serverErrors={serverErrors}
      />

      <CloseCycleConfirmModal
        open={openClose}
        onClose={() => {
          setOpenClose(false)
          setCloseCycleId(null)
        }}
        cycle={closeCycle}
        onConfirm={confirmClose}
        submitting={submitting}
      />
    </>
  )
}
