import { AlertTriangle } from 'lucide-react'

import Modal from '../common/Modal'
import Button from '../common/Button'

import { formatDateRange } from '../../utils/format'
import { useI18n } from '../../i18n/useI18n'

/**
 * CancelTrainingConfirmModal - xác nhận huỷ khóa đào tạo.
 */
export default function CancelTrainingConfirmModal({
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
      title={t('trainings.cancelTrainingTitle')}
      description={course.name}
      footer={
        <>
          <Button variant="secondary" onClick={onClose} disabled={submitting}>{t('trainings.close')}</Button>
          <Button variant="danger" onClick={onConfirm} loading={submitting}>
            {t('trainings.confirmCancelTraining')}
          </Button>
        </>
      }
    >
      <div className="flex items-start gap-3 rounded-md border border-warning-200 bg-warning-50 px-4 py-3 text-sm text-warning-700">
        <AlertTriangle className="mt-0.5 h-4 w-4 flex-shrink-0" aria-hidden="true" />
        <p>{t('trainings.cancelTrainingWarning')}</p>
      </div>
      <dl className="mt-4 grid grid-cols-1 gap-2 text-sm text-neutral-700">
        <div className="flex justify-between"><dt className="text-neutral-500">{t('trainings.code')}:</dt><dd className="font-mono text-neutral-900">{course.code}</dd></div>
        <div className="flex justify-between"><dt className="text-neutral-500">{t('trainings.trainingName')}:</dt><dd className="font-medium text-neutral-900">{course.name}</dd></div>
        <div className="flex justify-between"><dt className="text-neutral-500">{t('trainings.columnPeriod')}:</dt><dd>{formatDateRange(course.startDate, course.endDate)}</dd></div>
        <div className="flex justify-between"><dt className="text-neutral-500">{t('trainings.currentStatus')}:</dt><dd>{course.status}</dd></div>
      </dl>
    </Modal>
  )
}
