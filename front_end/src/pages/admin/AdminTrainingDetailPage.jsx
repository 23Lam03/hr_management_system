import { useEffect, useMemo, useState } from 'react'
import { useNavigate, useParams, useSearchParams } from 'react-router-dom'
import { ArrowLeft, GraduationCap, Users, UserPlus, BookOpen } from 'lucide-react'

import PageHeader from '../../components/common/PageHeader'
import Button from '../../components/common/Button'
import EmptyState from '../../components/common/EmptyState'
import { useToast } from '../../components/common/useToast'
import { useI18n } from '../../i18n/useI18n'

import TrainingDetailPanel from '../../components/trainings/TrainingDetailPanel'
import TrainingFormModal from '../../components/trainings/TrainingFormModal'
import CancelTrainingConfirmModal from '../../components/trainings/CancelTrainingConfirmModal'
import TrainingParticipantsTable from '../../components/trainings/TrainingParticipantsTable'
import ProgressUpdateModal from '../../components/trainings/ProgressUpdateModal'
import AddParticipantModal from '../../components/trainings/AddParticipantModal'

import {
  getTrainingById,
  getTrainingParticipants,
  updateTraining,
  cancelTraining,
  updateParticipantProgress,
  addTrainingParticipant,
  updateParticipantRegistration,
  subscribeTrainings,
} from '../../services/trainingService'
import { getEmployees } from '../../services/employeeService'
import { formatNumber } from '../../utils/format'

export default function AdminTrainingDetailPage() {
  const { t } = useI18n()
  const { id } = useParams()
  const navigate = useNavigate()
  const toast = useToast()
  const [searchParams] = useSearchParams()
  const initialTab = searchParams.get('tab') === 'participants' ? 'participants' : 'overview'
  const [tick, setTick] = useState(0)
  const [loading, setLoading] = useState(true)
  const [activeTab, setActiveTab] = useState(initialTab)
  const [openForm, setOpenForm] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [serverErrors, setServerErrors] = useState({})
  const [openCancel, setOpenCancel] = useState(false)
  const [openAdd, setOpenAdd] = useState(false)
  const [openProgress, setOpenProgress] = useState(false)
  const [progressRecordId, setProgressRecordId] = useState(null)

  useEffect(() => {
    setLoading(true)
    const tmr = setTimeout(() => setLoading(false), 150)
    return () => clearTimeout(tmr)
  }, [tick, activeTab])

  useEffect(() => {
    const unsub = subscribeTrainings(() => setTick((n) => n + 1))
    return () => unsub()
  }, [])

  // eslint-disable-next-line react-hooks/exhaustive-deps
  const course = useMemo(() => getTrainingById(id), [id, tick])
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const participants = useMemo(() => getTrainingParticipants(id), [id, tick])
  const allEmployees = useMemo(() => getEmployees().filter((e) => e.status === 'active'), [])

  if (!course) {
    return (
      <>
        <PageHeader title={t('admin.trainingNotFound')} icon={GraduationCap} breadcrumb={t('admin.trainingsBreadcrumb')} />
        <EmptyState
          title={t('admin.trainingNotFound')}
          description={t('admin.trainingNotFoundDesc')}
          actionLabel={t('admin.backToTrainingList')}
          onAction={() => navigate('/admin/trainings')}
        />
      </>
    )
  }

  // Học viên chưa đăng ký (để gợi ý thêm)
  const registeredIds = new Set(
    participants.filter((p) => p.registrationStatus !== 'cancelled').map((p) => p.employeeId),
  )
  const candidates = allEmployees.filter((e) => !registeredIds.has(e.id))

  const submitEdit = async (values) => {
    setSubmitting(true)
    const result = await updateTraining(course.id, values)
    setSubmitting(false)
    if (!result.ok) {
      setServerErrors(result.errors || {})
      toast.error(t('admin.cannotUpdateTraining'), { description: result.errors?._form || t('admin.checkInvalidFields') })
      return
    }
    toast.success(t('admin.trainingUpdated'), { description: result.course.name })
    setOpenForm(false)
    setServerErrors({})
  }

  const confirmCancel = async () => {
    setSubmitting(true)
    const result = await cancelTraining(course.id)
    setSubmitting(false)
    if (!result.ok) {
      toast.error(t('admin.cannotCancelCourse'), { description: result.error })
      return
    }
    toast.success(t('admin.courseCancelled'), { description: result.course.name })
    setOpenCancel(false)
  }

  const submitAddParticipant = async ({ employeeId, registrationStatus }) => {
    setSubmitting(true)
    const result = await addTrainingParticipant(course.id, employeeId, { registrationStatus })
    setSubmitting(false)
    if (!result.ok) {
      toast.error(t('admin.cannotAddParticipant'), { description: result.error })
      return
    }
    toast.success(t('admin.participantAdded'), { description: result.record.employeeName })
    setOpenAdd(false)
  }

  const openProgressModal = (recordId) => {
    setProgressRecordId(recordId)
    setServerErrors({})
    setOpenProgress(true)
  }

  const progressRecord = participants.find((p) => p.id === progressRecordId)

  const submitProgress = async (values) => {
    if (!progressRecord) return
    setSubmitting(true)
    const result = await updateParticipantProgress(course.id, progressRecord.employeeId, values)
    setSubmitting(false)
    if (!result.ok) {
      setServerErrors(result.errors || {})
      toast.error(t('admin.cannotUpdateProgress'), { description: result.errors?._form || t('admin.checkInvalidFields') })
      return
    }
    toast.success(t('admin.progressUpdated'), { description: result.record.employeeName })
    setOpenProgress(false)
    setProgressRecordId(null)
    setServerErrors({})
  }

  const removeParticipant = async (recordId) => {
    const rec = participants.find((p) => p.id === recordId)
    if (!rec) return
    if (!window.confirm(t('admin.removeParticipantConfirm', { name: rec.employeeName }))) return
    setSubmitting(true)
    const result = await updateParticipantRegistration(course.id, rec.employeeId, 'cancelled')
    setSubmitting(false)
    if (!result.ok) {
      toast.error(t('admin.cannotRemoveParticipant'), { description: result.error })
      return
    }
    toast.success(t('admin.participantRemoved'), { description: rec.employeeName })
  }

  const canEdit = course.status !== 'cancelled' && course.status !== 'completed'

  return (
    <>
      <PageHeader
        title={course.name}
        subtitle={course.description || t('admin.trainingDetailDesc')}
        icon={GraduationCap}
        breadcrumb={t('admin.trainingDetailBreadcrumb', { name: course.name })}
        actions={
          <Button variant="secondary" icon={ArrowLeft} onClick={() => navigate('/admin/trainings')}>
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
          onClick={() => setActiveTab('participants')}
          className={`inline-flex items-center gap-1.5 rounded px-3 py-1.5 text-sm font-medium transition ${
            activeTab === 'participants'
              ? 'bg-brand-600 text-white shadow-sm'
              : 'text-neutral-600 hover:bg-neutral-50'
          }`}
        >
          <Users className="h-4 w-4" aria-hidden="true" />
          {t('admin.participants')}
        </button>
      </div>

      {activeTab === 'overview' ? (
        <TrainingDetailPanel
          course={course}
          mode="admin"
          onEdit={canEdit ? () => setOpenForm(true) : undefined}
          onCancelCourse={canEdit ? () => setOpenCancel(true) : undefined}
          onAddEmployee={canEdit ? () => setOpenAdd(true) : undefined}
        />
      ) : (
        <>
          <div className="mb-3 grid grid-cols-1 gap-3 sm:grid-cols-3">
            <SummaryBox label={t('admin.totalRegistered')} value={formatNumber(course.totalRegistered)} tone="primary" />
            <SummaryBox label={t('admin.confirmed')} value={formatNumber(course.confirmedCount)} tone="success" />
            <SummaryBox label={t('admin.completed')} value={formatNumber(course.completedCount)} tone="brand" />
          </div>

          <div className="mb-4 flex items-center justify-end">
            {canEdit && (
              <Button icon={UserPlus} onClick={() => setOpenAdd(true)}>
                {t('admin.addEmployee')}
              </Button>
            )}
          </div>

          <TrainingParticipantsTable
            rows={participants}
            loading={loading}
            onEditProgress={openProgressModal}
            onRemove={removeParticipant}
            canEdit={canEdit}
          />
        </>
      )}

      <TrainingFormModal
        open={openForm}
        onClose={() => {
          setOpenForm(false)
          setServerErrors({})
        }}
        mode="edit"
        initial={course}
        onSubmit={submitEdit}
        submitting={submitting}
        serverErrors={serverErrors}
      />

      <CancelTrainingConfirmModal
        open={openCancel}
        onClose={() => setOpenCancel(false)}
        course={course}
        onConfirm={confirmCancel}
        submitting={submitting}
      />

      <AddParticipantModal
        open={openAdd}
        onClose={() => setOpenAdd(false)}
        candidates={candidates}
        onSubmit={submitAddParticipant}
        submitting={submitting}
      />

      <ProgressUpdateModal
        open={openProgress}
        onClose={() => {
          setOpenProgress(false)
          setProgressRecordId(null)
          setServerErrors({})
        }}
        record={progressRecord}
        onSubmit={submitProgress}
        submitting={submitting}
        serverErrors={serverErrors}
      />
    </>
  )
}

function SummaryBox({ label, value, tone = 'primary' }) {
  const toneClass = {
    primary: 'bg-brand-50 border-brand-200 text-brand-700',
    success: 'bg-success-50 border-success-200 text-success-700',
    brand: 'bg-brand-50 border-brand-200 text-brand-700',
  }[tone]
  return (
    <div className={`rounded-lg border p-4 ${toneClass}`}>
      <p className="text-[12px] font-medium uppercase tracking-wider">{label}</p>
      <p className="mt-1 text-2xl font-bold">{value}</p>
    </div>
  )
}
