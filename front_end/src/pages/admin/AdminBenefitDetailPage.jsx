import { useEffect, useMemo, useState } from 'react'
import { useNavigate, useParams, useSearchParams } from 'react-router-dom'
import { ArrowLeft, Gift, Users, UserPlus, BookOpen } from 'lucide-react'

import PageHeader from '../../components/common/PageHeader'
import Button from '../../components/common/Button'
import EmptyState from '../../components/common/EmptyState'
import { useToast } from '../../components/common/useToast'
import { useI18n } from '../../i18n/useI18n'

import BenefitDetailPanel from '../../components/benefits/BenefitDetailPanel'
import BenefitFormModal from '../../components/benefits/BenefitFormModal'
import BenefitAssigneeTable from '../../components/benefits/BenefitAssigneeTable'
import AssignBenefitModal from '../../components/benefits/AssignBenefitModal'
import CancelAssignmentConfirmModal from '../../components/benefits/CancelAssignmentConfirmModal'

import {
  getBenefitById,
  getAssignments,
  assignBenefitToEmployees,
  cancelAssignment,
  updateBenefitStatus,
  updateBenefit,
  subscribeBenefits,
} from '../../services/benefitService'
import { getEmployees } from '../../services/employeeService'
import { formatNumber } from '../../utils/format'

export default function AdminBenefitDetailPage() {
  const { t } = useI18n()
  const { id } = useParams()
  const navigate = useNavigate()
  const toast = useToast()
  const [searchParams] = useSearchParams()
  const initialTab = searchParams.get('tab') === 'assignees' ? 'assignees' : 'overview'
  const [tick, setTick] = useState(0)
  const [loading, setLoading] = useState(true)
  const [activeTab, setActiveTab] = useState(initialTab)
  const [openForm, setOpenForm] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [serverErrors, setServerErrors] = useState({})
  const [openAssign, setOpenAssign] = useState(false)
  const [openCancel, setOpenCancel] = useState(false)
  const [cancelAssigneeId, setCancelAssigneeId] = useState(null)

  useEffect(() => {
    setLoading(true)
    const tmr = setTimeout(() => setLoading(false), 150)
    return () => clearTimeout(tmr)
  }, [tick, activeTab])

  useEffect(() => {
    const unsub = subscribeBenefits(() => setTick((n) => n + 1))
    return () => unsub()
  }, [])

  // eslint-disable-next-line react-hooks/exhaustive-deps
  const benefit = useMemo(() => getBenefitById(id), [id, tick])
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const assignments = useMemo(() => getAssignments(id), [id, tick])
  const allEmployees = useMemo(() => getEmployees().filter((e) => e.status === 'active'), [])

  if (!benefit) {
    return (
      <>
        <PageHeader title={t('admin.benefitNotFound')} icon={Gift} breadcrumb={t('admin.benefitsBreadcrumb')} />
        <EmptyState
          title={t('admin.benefitNotFound')}
          description={t('admin.benefitNotFoundDesc')}
          actionLabel={t('admin.backToBenefitList')}
          onAction={() => navigate('/admin/benefits')}
        />
      </>
    )
  }

  const existingAssigneeIds = assignments
    .filter((a) => a.status !== 'cancelled')
    .map((a) => a.employeeId)

  const candidates = allEmployees

  const submitEdit = async (values) => {
    setSubmitting(true)
    const result = await updateBenefit(benefit.id, values)
    setSubmitting(false)
    if (!result.ok) {
      setServerErrors(result.errors || {})
      toast.error(t('admin.cannotUpdate'), { description: result.errors?._form || t('admin.checkInvalidFields') })
      return
    }
    toast.success(t('admin.programUpdated'), { description: result.benefit.name })
    setOpenForm(false)
    setServerErrors({})
  }

  const submitAssign = async (payload) => {
    setSubmitting(true)
    const result = await assignBenefitToEmployees({
      benefitId: benefit.id,
      assignedBy: 'usr-admin-001',
      ...payload,
    })
    setSubmitting(false)
    if (!result.ok) {
      toast.error(t('admin.cannotAssignBenefit'), { description: result.error })
      return
    }
    toast.success(t('admin.benefitAssigned'), {
      description: t('admin.assignedToEmployees', { n: result.records.length }),
    })
    setOpenAssign(false)
  }

  const openCancelModal = (recordId) => {
    setCancelAssigneeId(recordId)
    setOpenCancel(true)
  }

  const cancelAssignee = assignments.find((a) => a.id === cancelAssigneeId)

  const confirmCancel = async () => {
    if (!cancelAssignee) return
    setSubmitting(true)
    const result = await cancelAssignment(cancelAssignee.id, t('admin.backToList'))
    setSubmitting(false)
    if (!result.ok) {
      toast.error(t('admin.cannotCancelBenefit'), { description: result.error })
      return
    }
    toast.success(t('admin.benefitCancelled'), { description: cancelAssignee.employeeName })
    setOpenCancel(false)
    setCancelAssigneeId(null)
  }

  const handleStatus = async (nextStatus, successMsg) => {
    setSubmitting(true)
    const result = await updateBenefitStatus(benefit.id, nextStatus)
    setSubmitting(false)
    if (!result.ok) {
      toast.error(t('admin.cannotUpdateBenefitStatus'), { description: result.error })
      return
    }
    toast.success(successMsg, { description: result.benefit.name })
  }

  const canEdit = benefit.status !== 'expired'

  return (
    <>
      <PageHeader
        title={benefit.name}
        subtitle={benefit.description || t('admin.programDescription')}
        icon={Gift}
        breadcrumb={t('admin.benefitDetailBreadcrumb', { name: benefit.name })}
        actions={
          <Button variant="secondary" icon={ArrowLeft} onClick={() => navigate('/admin/benefits')}>
            {t('admin.backToList')}
          </Button>
        }
      />

      <div className="mb-4 inline-flex rounded-md border border-neutral-200 bg-white p-1 shadow-card">
        <button
          type="button"
          onClick={() => setActiveTab('overview')}
          className={`inline-flex items-center gap-1.5 rounded px-3 py-1.5 text-sm font-medium transition ${
            activeTab === 'overview'
              ? 'bg-brand-600 text-white shadow-sm'
              : 'text-neutral-600 hover:bg-neutral-50'
          }`}
        >
          <BookOpen className="h-4 w-4" aria-hidden="true" />
          {t('admin.overview')}
        </button>
        <button
          type="button"
          onClick={() => setActiveTab('assignees')}
          className={`inline-flex items-center gap-1.5 rounded px-3 py-1.5 text-sm font-medium transition ${
            activeTab === 'assignees'
              ? 'bg-brand-600 text-white shadow-sm'
              : 'text-neutral-600 hover:bg-neutral-50'
          }`}
        >
          <Users className="h-4 w-4" aria-hidden="true" />
          {t('admin.beneficiaries')}
        </button>
      </div>

      {activeTab === 'overview' ? (
        <div className="flex flex-col gap-4">
          <BenefitDetailPanel benefit={benefit} mode="admin" />
          <div className="flex flex-wrap items-center justify-end gap-2">
            {canEdit && (
              <Button variant="secondary" onClick={() => setOpenForm(true)}>{t('admin.edit')}</Button>
            )}
            {benefit.status === 'active' && (
              <Button variant="secondary" onClick={() => handleStatus('paused', t('admin.programPausedShort'))}>
                {t('admin.programPausedShort')}
              </Button>
            )}
            {benefit.status === 'paused' && (
              <Button onClick={() => handleStatus('active', t('admin.programActivated'))}>
                {t('admin.programActivated')}
              </Button>
            )}
            {benefit.status !== 'expired' && (
              <Button variant="danger" onClick={() => handleStatus('expired', t('admin.programEnded'))}>
                {t('admin.endProgram')}
              </Button>
            )}
          </div>
        </div>
      ) : (
        <>
          <div className="mb-3 grid grid-cols-1 gap-3 sm:grid-cols-3">
            <SummaryBox label={t('admin.totalAssigned')} value={formatNumber(benefit.totalAssignees)} tone="primary" />
            <SummaryBox label={t('admin.activeBeneficiaries')} value={formatNumber(benefit.activeAssigneesCount)} tone="success" />
            <SummaryBox label={t('admin.expiredCancelled')} value={formatNumber((benefit.expiredAssigneesCount || 0) + (benefit.cancelledAssigneesCount || 0))} tone="neutral" />
          </div>
          <div className="mb-4 flex items-center justify-end">
            {benefit.status === 'active' && (
              <Button icon={UserPlus} onClick={() => setOpenAssign(true)}>
                {t('admin.assignEmployees')}
              </Button>
            )}
          </div>
          <BenefitAssigneeTable
            rows={assignments}
            loading={loading}
            canCancel={benefit.status === 'active'}
            onCancel={openCancelModal}
          />
        </>
      )}

      <BenefitFormModal
        open={openForm}
        onClose={() => {
          setOpenForm(false)
          setServerErrors({})
        }}
        mode="edit"
        initial={benefit}
        onSubmit={submitEdit}
        submitting={submitting}
        serverErrors={serverErrors}
      />

      <AssignBenefitModal
        key={openAssign ? `assign-${benefit.id}` : 'closed'}
        open={openAssign}
        onClose={() => setOpenAssign(false)}
        benefit={benefit}
        candidates={candidates}
        existingAssigneeIds={existingAssigneeIds}
        onSubmit={submitAssign}
        submitting={submitting}
      />

      <CancelAssignmentConfirmModal
        open={openCancel}
        onClose={() => {
          setOpenCancel(false)
          setCancelAssigneeId(null)
        }}
        assignment={cancelAssignee}
        onConfirm={confirmCancel}
        submitting={submitting}
      />
    </>
  )
}

function SummaryBox({ label, value, tone = 'primary' }) {
  const toneClass = {
    primary: 'bg-brand-50 border-brand-200 text-brand-700',
    success: 'bg-success-50 border-success-200 text-success-700',
    neutral: 'bg-neutral-100 border-neutral-200 text-neutral-700',
  }[tone]
  return (
    <div className={`rounded-lg border p-4 ${toneClass}`}>
      <p className="text-[12px] font-medium uppercase tracking-wider">{label}</p>
      <p className="mt-1 text-2xl font-bold">{value}</p>
    </div>
  )
}
