import { useEffect, useMemo, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { ArrowLeft, GraduationCap, AlertCircle } from 'lucide-react'

import PageHeader from '../../components/common/PageHeader'
import Button from '../../components/common/Button'
import EmptyState from '../../components/common/EmptyState'
import { useToast } from '../../components/common/useToast'
import { useI18n } from '../../i18n/useI18n'

import TrainingDetailPanel from '../../components/trainings/TrainingDetailPanel'
import RegisterConfirmModal from '../../components/trainings/RegisterConfirmModal'
import CancelRegistrationConfirmModal from '../../components/trainings/CancelRegistrationConfirmModal'

import {
  getTrainingById,
  getMyTrainingById,
  registerTraining,
  cancelTrainingRegistration,
  subscribeTrainings,
} from '../../services/trainingService'
import { resolveEmployeeFromUser } from '../../services/authLinker'
import { useAuth } from '../../contexts/useAuth'
import { formatDate } from '../../utils/format'

export default function EmployeeTrainingDetailPage() {
  const { id } = useParams()
  const navigate = useNavigate()
  const toast = useToast()
  const { user: currentUser } = useAuth()
  const { t } = useI18n()
  const employee = useMemo(() => resolveEmployeeFromUser(currentUser), [currentUser])
  const employeeId = employee?.id ?? null
  const [tick, setTick] = useState(0)
  const [submitting, setSubmitting] = useState(false)
  const [openRegister, setOpenRegister] = useState(false)
  const [openCancel, setOpenCancel] = useState(false)

  useEffect(() => {
    const unsub = subscribeTrainings(() => setTick((n) => n + 1))
    return () => unsub()
  }, [])

  // eslint-disable-next-line react-hooks/exhaustive-deps
  const course = useMemo(() => getTrainingById(id), [id, tick])
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const myRegistration = useMemo(
    () => (employeeId && id ? getMyTrainingById(employeeId, id) : null),
    [employeeId, id, tick],
  )

  if (!employeeId || !employee) {
    return (
      <>
        <PageHeader title={t('employeeTrainings.myTrainings')} icon={GraduationCap} breadcrumb="Cá nhân / Đào tạo" />
        <EmptyState
          title={t('employeeTrainings.notIdentified')}
          description={t('employeeTrainings.accountNotLinked')}
        />
      </>
    )
  }

  if (!course) {
    return (
      <>
        <PageHeader title={t('employeeTrainings.myTrainings')} icon={GraduationCap} breadcrumb="Cá nhân / Đào tạo" />
        <EmptyState
          title={t('employeeTrainingDetail.courseNotFound')}
          description={t('employeeTrainingDetail.courseNotFoundDesc')}
          actionLabel={t('employeeTrainingDetail.backToList')}
          onAction={() => navigate('/employee/trainings')}
        />
      </>
    )
  }

  // Bảo vệ: Nếu khóa học tồn tại nhưng employee đã đăng ký và bị huỷ,
  // hoặc khóa closed mà employee không thuộc diện, không hiển thị nhạy cảm.
  // Hiện tại service getMyTrainingById trả null nếu chưa đăng ký → myRegistration=null.

  const confirmRegister = async () => {
    setSubmitting(true)
    const result = await registerTraining(course.id, employeeId)
    setSubmitting(false)
    if (!result.ok) {
      toast.error('Không thể đăng ký', { description: result.error })
      return
    }
    toast.success('Đã đăng ký khóa học', { description: course.name })
    setOpenRegister(false)
  }

  const confirmCancelRegistration = async () => {
    setSubmitting(true)
    const result = await cancelTrainingRegistration(course.id, employeeId)
    setSubmitting(false)
    if (!result.ok) {
      toast.error('Không thể huỷ đăng ký', { description: result.error })
      return
    }
    toast.success('Đã huỷ đăng ký', { description: course.name })
    setOpenCancel(false)
  }

  return (
    <>
      <PageHeader
        title={course.name}
        subtitle={course.description || t('employeeTrainingDetail.trainingDetail')}
        icon={GraduationCap}
        breadcrumb={`Cá nhân / Đào tạo / ${course.name}`}
        actions={
          <Button variant="secondary" icon={ArrowLeft} onClick={() => navigate('/employee/trainings')}>
            {t('employeeTrainingDetail.back')}
          </Button>
        }
      />

      {course.status === 'cancelled' && (
        <div className="mb-4 flex items-start gap-3 rounded-md border border-danger-200 bg-danger-50 px-4 py-3 text-sm text-danger-700">
          <AlertCircle className="mt-0.5 h-4 w-4 flex-shrink-0" aria-hidden="true" />
          <p>{t('employeeTrainingDetail.courseCancelled')}</p>
        </div>
      )}

      <TrainingDetailPanel
        course={course}
        registration={myRegistration}
        mode="employee"
        onRegister={() => setOpenRegister(true)}
        onCancelRegistration={() => setOpenCancel(true)}
      />

      <RegisterConfirmModal
        open={openRegister}
        onClose={() => setOpenRegister(false)}
        course={course}
        onConfirm={confirmRegister}
        submitting={submitting}
      />

      <CancelRegistrationConfirmModal
        open={openCancel}
        onClose={() => setOpenCancel(false)}
        course={course}
        onConfirm={confirmCancelRegistration}
        submitting={submitting}
      />

      <p className="hidden text-xs text-neutral-400">{formatDate(new Date().toISOString())}</p>
    </>
  )
}