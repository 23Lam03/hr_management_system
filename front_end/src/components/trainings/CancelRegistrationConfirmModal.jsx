import { AlertTriangle } from 'lucide-react'

import Modal from '../common/Modal'
import Button from '../common/Button'

import { useI18n } from '../../i18n/useI18n'

/**
 * CancelRegistrationConfirmModal - xác nhận hủy đăng ký (employee).
 */
export default function CancelRegistrationConfirmModal({
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
      title={t('trainings.cancelRegistrationTitle')}
      description={course.name}
      footer={
        <>
          <Button variant="secondary" onClick={onClose} disabled={submitting}>{t('trainings.close')}</Button>
          <Button variant="danger" onClick={onConfirm} loading={submitting}>
            {t('trainings.confirmCancelRegistration')}
          </Button>
        </>
      }
    >
      <div className="flex items-start gap-3 rounded-md border border-warning-200 bg-warning-50 px-4 py-3 text-sm text-warning-700">
        <AlertTriangle className="mt-0.5 h-4 w-4 flex-shrink-0" aria-hidden="true" />
        <p>{t('trainings.cancelWarning')}</p>
      </div>
    </Modal>
  )
}
