import { AlertTriangle, Eye } from 'lucide-react'

import Modal from '../common/Modal'
import Button from '../common/Button'

import { useI18n } from '../../i18n/useI18n'

/**
 * CompleteEvaluationConfirmModal - xác nhận "Hoàn thành đánh giá".
 */
export default function CompleteEvaluationConfirmModal({
  open,
  onClose,
  record,
  onConfirm,
  submitting = false,
}) {
  const { t } = useI18n()

  if (!record) return null
  return (
    <Modal
      open={open}
      onClose={onClose}
      size="md"
      title={t('evaluations.completeEvaluationTitle')}
      description={`${t('evaluations.employeeEvaluation')} ${record.employeeName || ''}`}
      footer={
        <>
          <Button variant="secondary" onClick={onClose} disabled={submitting}>{t('evaluations.cancel')}</Button>
          <Button onClick={onConfirm} loading={submitting} icon={Eye}>{t('evaluations.confirmComplete')}</Button>
        </>
      }
    >
      <div className="flex items-start gap-3 rounded-md border border-success-200 bg-success-50 px-4 py-3 text-sm text-success-700">
        <AlertTriangle className="mt-0.5 h-4 w-4 flex-shrink-0" aria-hidden="true" />
        <p>{t('evaluations.completeWarning')}</p>
      </div>
      <ul className="mt-4 list-inside list-disc text-sm text-neutral-700">
        <li>{t('evaluations.criteriaScored')}</li>
        <li>{t('evaluations.mainFieldsFilled')}</li>
        <li>{t('evaluations.statusWillBeCompleted')}</li>
      </ul>
    </Modal>
  )
}
