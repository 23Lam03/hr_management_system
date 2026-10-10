import { useEffect, useMemo, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { ArrowLeft, Star, CalendarDays, Users, CheckCircle2, XCircle, Clock4 } from 'lucide-react'

import PageHeader from '../../components/common/PageHeader'
import Button from '../../components/common/Button'
import Modal from '../../components/common/Modal'
import Input from '../../components/common/Input'
import StatCard from '../../components/common/StatCard'
import EmptyState from '../../components/common/EmptyState'
import { useToast } from '../../components/common/useToast'
import { useI18n } from '../../i18n/useI18n'

import EvaluationFilterBar from '../../components/evaluations/EvaluationFilterBar'
import EvaluationEmployeeTable from '../../components/evaluations/EvaluationEmployeeTable'
import EvaluationPagination from '../../components/evaluations/EvaluationPagination'
import EvaluationFormModal from '../../components/evaluations/EvaluationFormModal'
import EvaluationDetailModal from '../../components/evaluations/EvaluationDetailModal'
import CompleteEvaluationConfirmModal from '../../components/evaluations/CompleteEvaluationConfirmModal'
import CycleStatusPill from '../../components/evaluations/CycleStatusPill'
import EvaluationProgressBar from '../../components/evaluations/EvaluationProgressBar'

import {
  getEvaluationCycleById,
  queryEvaluationsByCycle,
  getEvaluationById,
  saveEvaluationDraft,
  completeEvaluation,
  publishEvaluation,
  rejectEvaluation,
  getEvaluationCriteria,
  getCycleProgress,
  getEvaluationsByCycle,
  getEvaluationApprovalSummary,
  subscribeEvaluations,
} from '../../services/evaluationService'
import { getEmployeeById, getDepartments } from '../../services/employeeService'
import { EVALUATION_STATUSES } from '../../data/evaluationMockData'
import { useAuth } from '../../contexts/useAuth'
import { formatDateRange, formatNumber } from '../../utils/format'

const DEFAULT_QUERY = {
  search: '',
  status: '',
  departmentId: '',
  sortBy: 'employeeName',
  sortDir: 'asc',
  page: 1,
  pageSize: 10,
}

export default function AdminEvaluationCyclePage() {
  const { t } = useI18n()
  const { id } = useParams()
  const navigate = useNavigate()
  const toast = useToast()
  const { user: currentUser } = useAuth()
  const [tick, setTick] = useState(0)
  const [loading, setLoading] = useState(true)
  const [query, setQuery] = useState(DEFAULT_QUERY)

  const [openForm, setOpenForm] = useState(false)
  const [formEvaluationId, setFormEvaluationId] = useState(null)
  const [submitting, setSubmitting] = useState(false)
  const [serverErrors, setServerErrors] = useState({})

  const [openDetail, setOpenDetail] = useState(false)
  const [detailId, setDetailId] = useState(null)

  const [openConfirmComplete, setOpenConfirmComplete] = useState(false)
  const [confirmEvaluationId, setConfirmEvaluationId] = useState(null)
  const [pendingCompletePayload, setPendingCompletePayload] = useState(null)
  const [actionBusy, setActionBusy] = useState(false)
  const [rejectId, setRejectId] = useState(null)
  const [rejectNote, setRejectNote] = useState('')

  useEffect(() => {
    setLoading(true)
    const tmr = setTimeout(() => setLoading(false), 150)
    return () => clearTimeout(tmr)
  }, [tick, query.search, query.status, query.departmentId])

  useEffect(() => {
    const unsub = subscribeEvaluations(() => setTick((n) => n + 1))
    return () => unsub()
  }, [])

  const cycle = useMemo(() => getEvaluationCycleById(id), [id, tick])
  const criteria = useMemo(() => getEvaluationCriteria(), [])
  const departments = useMemo(() => getDepartments(), [])

  // eslint-disable-next-line react-hooks/exhaustive-deps
  const data = useMemo(() => queryEvaluationsByCycle(id, query), [id, query, tick])
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const progress = useMemo(
    () => getCycleProgress(cycle, getEvaluationsByCycle(id)),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [cycle, tick, id],
  )
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const approvalSummary = useMemo(
    () => (cycle ? getEvaluationApprovalSummary(id) : { pending: 0, approved: 0, rejected: 0, total: 0 }),
    [cycle, tick, id],
  )

  const setField = (key, value) => setQuery((q) => ({ ...q, [key]: value, page: 1 }))
  const onClear = () => setQuery({ ...DEFAULT_QUERY })

  const openEvaluate = (evaluationId) => {
    setServerErrors({})
    setFormEvaluationId(evaluationId)
    setOpenForm(true)
  }
  const openViewDetail = (evaluationId) => {
    setDetailId(evaluationId)
    setOpenDetail(true)
  }

  const formEvaluation = formEvaluationId ? getEvaluationById(formEvaluationId) : null
  const formEmployee = formEvaluation ? getEmployeeById(formEvaluation.employeeId) : null

  const detailEvaluation = detailId ? getEvaluationById(detailId) : null
  const detailEmployee = detailEvaluation ? getEmployeeById(detailEvaluation.employeeId) : null

  const confirmEvaluation = confirmEvaluationId ? getEvaluationById(confirmEvaluationId) : null

  async function handleSaveDraft(values) {
    if (!formEvaluation) return
    setSubmitting(true)
    const result = await saveEvaluationDraft(formEvaluation.id, values)
    setSubmitting(false)
    if (!result.ok) {
      setServerErrors(result.errors || {})
      toast.error(t('admin.cannotSaveDraft'), {
        description: result.errors?._form || t('admin.draftSaveCheckFields'),
      })
      return
    }
    toast.success(t('admin.draftSaved'), { description: result.record.employeeName })
    setOpenForm(false)
    setFormEvaluationId(null)
    setServerErrors({})
  }

  async function confirmComplete(payload) {
    if (!confirmEvaluationId) return
    setSubmitting(true)
    const result = await completeEvaluation(confirmEvaluationId, payload || {})
    setSubmitting(false)
    if (!result.ok) {
      setServerErrors(result.errors || {})
      toast.error(t('admin.cannotCompleteEvaluation'), {
        description: result.errors?._form || t('admin.evaluationCompleteCheckFields'),
      })
      return
    }
    toast.success(t('admin.evaluationCompleted'), { description: result.record.employeeName })
    setOpenConfirmComplete(false)
    setConfirmEvaluationId(null)
    setPendingCompletePayload(null)
    setOpenForm(false)
    setFormEvaluationId(null)
    setServerErrors({})
  }

  async function handlePublish(evaluationId) {
    setSubmitting(true)
    const result = await publishEvaluation(evaluationId, currentUser?.id || null, '')
    setSubmitting(false)
    if (!result.ok) {
      toast.error(t('admin.cannotPublish'), { description: result.error })
      return
    }
    toast.success(t('admin.evaluationPublished'), { description: result.record.employeeName })
    setOpenDetail(false)
    setDetailId(null)
  }

  const handleApprove = async (evaluationId) => {
    if (!evaluationId) return
    setActionBusy(true)
    const res = await publishEvaluation(evaluationId, currentUser?.id || null, '')
    setActionBusy(false)
    if (!res.ok) {
      toast.error(t('admin.cannotApproveEvaluation'), { description: res.error || t('common.warning') })
      return
    }
    toast.success(t('admin.evaluationApproved'), {
      description: res.record.employeeName,
    })
    setOpenDetail(false)
    setDetailId(null)
  }

  const handleReject = async () => {
    if (!rejectId) return
    setActionBusy(true)
    const res = await rejectEvaluation(rejectId, currentUser?.id || null, rejectNote)
    setActionBusy(false)
    if (!res.ok) {
      toast.error(t('admin.cannotRejectEvaluation'), { description: res.error || t('common.warning') })
      return
    }
    setRejectId(null)
    setRejectNote('')
    toast.success(t('admin.evaluationRejected'), { description: res.record.employeeName })
    setOpenDetail(false)
    setDetailId(null)
  }

  if (!cycle) {
    return (
      <>
        <PageHeader title={t('admin.evaluationNotFound')} icon={Star} breadcrumb={t('admin.evaluationsBreadcrumb')} />
        <EmptyState
          title={t('admin.evaluationNotFound')}
          description={t('admin.evaluationNotFoundDesc')}
          actionLabel={t('admin.backToEvaluationList')}
          onAction={() => navigate('/admin/evaluations')}
        />
      </>
    )
  }

  return (
    <>
      <PageHeader
        title={cycle.name}
        subtitle={cycle.description || t('admin.evaluationCycleDetailDesc')}
        icon={Star}
        breadcrumb={t('admin.evaluationDetailBreadcrumb', { name: cycle.name })}
        actions={
          <Button variant="secondary" icon={ArrowLeft} onClick={() => navigate('/admin/evaluations')}>
            {t('admin.backToList')}
          </Button>
        }
      />

      <div className="mb-6 grid grid-cols-1 gap-4 lg:grid-cols-3">
        <div className="rounded-lg border border-neutral-200 bg-white p-5 shadow-card">
          <p className="text-[13px] font-medium text-neutral-500">{t('admin.evaluationTime')}</p>
          <p className="mt-1 text-base font-semibold text-neutral-900">{formatDateRange(cycle.startDate, cycle.endDate)}</p>
          <div className="mt-3 flex items-center gap-2">
            <CalendarDays className="h-4 w-4 text-neutral-400" aria-hidden="true" />
            <CycleStatusPill status={cycle.status} />
          </div>
        </div>
        <div className="rounded-lg border border-neutral-200 bg-white p-5 shadow-card">
          <p className="text-[13px] font-medium text-neutral-500">{t('admin.evaluationProgress')}</p>
          <p className="mt-1 text-base font-semibold text-neutral-900">
            {t('admin.employeesCompleted', { completed: progress.completed, total: progress.total })}
          </p>
          <div className="mt-3">
            <EvaluationProgressBar percent={progress.percent} />
          </div>
        </div>
        <div className="rounded-lg border border-neutral-200 bg-white p-5 shadow-card">
          <p className="text-[13px] font-medium text-neutral-500">{t('admin.evaluationScope')}</p>
          <p className="mt-1 text-base font-semibold text-neutral-900">
            {(cycle.employeeIds?.length)
              ? t('admin.designatedEmployees', { n: cycle.employeeIds.length })
              : (cycle.departmentIds?.length)
              ? t('admin.designatedDepartments', { n: cycle.departmentIds.length })
              : t('admin.wholeCompany')}
          </p>
          <div className="mt-3 flex items-center gap-2 text-[12px] text-neutral-500">
            <Users className="h-4 w-4 text-neutral-400" aria-hidden="true" />
            <span>{t('admin.totalParticipants', { n: formatNumber(progress.total) })}</span>
          </div>
        </div>
      </div>

      <div className="mb-6 grid grid-cols-1 gap-3 sm:grid-cols-3">
        <StatCard icon={Clock4}       label={t('status.pending')} value={approvalSummary.pending}  tone="info" />
        <StatCard icon={CheckCircle2} label={t('status.approved')} value={approvalSummary.approved} tone="success" />
        <StatCard icon={XCircle}      label={t('status.rejected')} value={approvalSummary.rejected} tone="danger" />
      </div>

      <div className="mb-4">
        <EvaluationFilterBar
          search={query.search}
          onSearchChange={(v) => setField('search', v)}
          status={query.status}
          onStatusChange={(v) => setField('status', v)}
          departmentId={query.departmentId}
          onDepartmentChange={(v) => setField('departmentId', v)}
          departments={departments}
          statuses={EVALUATION_STATUSES}
          onClear={onClear}
          total={data.total}
          showDepartment
          dateField="startDate"
          dateFrom=""
          dateTo=""
          onDateFromChange={() => {}}
          onDateToChange={() => {}}
          searchPlaceholder={t('admin.searchByNameOrCode')}
        />
      </div>

      <div className="mb-4">
        {data.total === 0 && !loading ? (
          <EmptyState title={t('admin.noMatchingEmployees')} description={t('admin.tryClearFilters')} />
        ) : (
          <EvaluationEmployeeTable
            rows={data.items}
            loading={loading}
            onView={openViewDetail}
            onEvaluate={openEvaluate}
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

      <EvaluationFormModal
        open={openForm}
        onClose={() => {
          setOpenForm(false)
          setFormEvaluationId(null)
          setServerErrors({})
        }}
        cycle={cycle}
        employee={formEmployee}
        evaluation={formEvaluation}
        criteria={criteria}
        onSaveDraft={handleSaveDraft}
        onComplete={(payload) => {
          setConfirmEvaluationId(formEvaluation.id)
          setPendingCompletePayload(payload)
          setOpenConfirmComplete(true)
        }}
        submitting={submitting}
        serverErrors={serverErrors}
      />

      <EvaluationDetailModal
        open={openDetail}
        onClose={() => {
          setOpenDetail(false)
          setDetailId(null)
        }}
        record={detailEvaluation}
        cycle={cycle}
        employee={detailEmployee}
        isAdminView
        showPublish
        onPublish={handlePublish}
        onEdit={(evaluationId) => {
          setOpenDetail(false)
          setDetailId(null)
          openEvaluate(evaluationId)
        }}
        approvalActions={
          detailEvaluation?.status === 'completed' ? (
            <div className="flex flex-wrap justify-end gap-2">
              <Button
                variant="outline"
                icon={XCircle}
                onClick={() => { setRejectId(detailEvaluation.id); setRejectNote('') }}
                disabled={actionBusy}
              >{t('admin.reject')}</Button>
              <Button
                variant="primary"
                icon={CheckCircle2}
                onClick={() => handleApprove(detailEvaluation.id)}
                disabled={actionBusy}
              >{t('admin.approve')}</Button>
            </div>
          ) : null
        }
      />

      <Modal
        open={Boolean(rejectId)}
        onClose={() => { setRejectId(null); setRejectNote('') }}
        title={t('admin.rejectEvaluationTitle')}
        description={t('admin.rejectEvaluationDesc')}
        size="md"
        footer={
          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={() => { setRejectId(null); setRejectNote('') }}>{t('admin.cancel')}</Button>
            <Button variant="danger" icon={XCircle} onClick={handleReject} disabled={actionBusy}>
              {t('admin.confirmRejectEvaluation')}
            </Button>
          </div>
        }
      >
        <Input
          label={t('admin.rejectEvaluationReasonLabel')}
          value={rejectNote}
          onChange={(e) => setRejectNote(e.target.value)}
          placeholder={t('admin.rejectEvaluationReasonPlaceholder')}
        />
      </Modal>

      <CompleteEvaluationConfirmModal
        open={openConfirmComplete}
        onClose={() => {
          setOpenConfirmComplete(false)
          setConfirmEvaluationId(null)
          setPendingCompletePayload(null)
        }}
        record={confirmEvaluation}
        onConfirm={() => confirmComplete(pendingCompletePayload)}
        submitting={submitting}
      />

      {currentUser && (
        <p className="hidden text-xs text-neutral-400">
          {t('admin.loginUserNote', { name: currentUser.name })}
        </p>
      )}

      <span className="hidden text-[11px] text-neutral-400">
        <CheckCircle2 className="hidden" aria-hidden="true" />
      </span>
    </>
  )
}
