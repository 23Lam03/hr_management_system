import { AlertTriangle } from 'lucide-react'

import Modal from '../common/Modal'
import Button from '../common/Button'

import { formatDateRange } from '../../utils/format'
import TrainingStatusPill from './TrainingStatusPill'
import { useI18n } from '../../i18n/useI18n'

/**
 * RegisterConfirmModal - xác nhận đăng ký khóa học (employee).
 */
export default function RegisterConfirmModal({
  open,
  onClose,
  course,
  onConfirm,
  submitting = false,
}) {
  const { t } = useI18n()

  if (!course) return null
  return (
    <Modal
      open={open}
      onClose={onClose}
      size="md"
      title={t('trainings.registerCourseTitle')}
      description={course.name}
      footer={
        <>
          <Button variant="secondary" onClick={onClose} disabled={submitting}>{t('trainings.close')}</Button>
          <Button onClick={onConfirm} loading={submitting}>
            {t('trainings.confirmRegistration')}
          </Button>
        </>
      }
    >
      <div className="flex items-start gap-3 rounded-md border border-brand-200 bg-brand-50 px-4 py-3 text-sm text-brand-700">
        <AlertTriangle className="mt-0.5 h-4 w-4 flex-shrink-0" aria-hidden="true" />
        <p>{t('trainings.registerWarning')}</p>
      </div>
      <dl className="mt-4 grid grid-cols-1 gap-2 text-sm text-neutral-700">
        <div className="flex justify-between"><dt className="text-neutral-500">{t('trainings.code')}:</dt><dd className="font-mono text-neutral-900">{course.code}</dd></div>
        <div className="flex justify-between"><dt className="text-neutral-500">{t('trainings.columnInstructor')}:</dt><dd>{course.instructor}</dd></div>
        <div className="flex justify-between"><dt className="text-neutral-500">{t('trainings.columnPeriod')}:</dt><dd>{formatDateRange(course.startDate, course.endDate)}</dd></div>
        <div className="flex justify-between"><dt className="text-neutral-500">{t('trainings.duration')}:</dt><dd>{t('trainings.durationHoursUnit', { n: course.durationHours })}</dd></div>
        <div className="flex justify-between"><dt className="text-neutral-500">{t('trainings.registrationDeadlineLabel')}:</dt><dd>{course.registrationDeadline}</dd></div>
        <div className="flex justify-between"><dt className="text-neutral-500">{t('trainings.status')}:</dt><dd><TrainingStatusPill status={course.status} /></dd></div>
      </dl>
    </Modal>
  )
}
