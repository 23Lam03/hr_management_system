import { AlertTriangle } from 'lucide-react'

import Modal from '../common/Modal'
import Button from '../common/Button'

import { formatDateRange } from '../../utils/format'
import { useI18n } from '../../i18n/useI18n'

/**
 * CloseCycleConfirmModal - xác nhận đóng kỳ đánh giá.
 */
export default function CloseCycleConfirmModal({
  open,
  onClose,
  cycle,
  onConfirm,
  submitting = false,
}) {
  const { t } = useI18n()

  if (!cycle) return null
  return (
    <Modal
      open={open}
      onClose={onClose}
      size="md"
      title={t('evaluations.closeCycleTitle')}
      description={cycle.name}
      footer={
        <>
          <Button variant="secondary" onClick={onClose} disabled={submitting}>{t('evaluations.cancel')}</Button>
          <Button variant="danger" onClick={onConfirm} loading={submitting}>
            {t('evaluations.confirmClose')}
          </Button>
        </>
      }
    >
      <div className="flex items-start gap-3 rounded-md border border-warning-200 bg-warning-50 px-4 py-3 text-sm text-warning-700">
        <AlertTriangle className="mt-0.5 h-4 w-4 flex-shrink-0" aria-hidden="true" />
        <p>{t('evaluations.closeWarning')}</p>
      </div>
      <dl className="mt-4 grid grid-cols-1 gap-2 text-sm text-neutral-700">
        <div className="flex justify-between"><dt className="text-neutral-500">{t('evaluations.cycleName')}:</dt><dd className="font-medium text-neutral-900">{cycle.name}</dd></div>
        <div className="flex justify-between"><dt className="text-neutral-500">{t('evaluations.period')}:</dt><dd>{formatDateRange(cycle.startDate, cycle.endDate)}</dd></div>
        <div className="flex justify-between"><dt className="text-neutral-500">{t('evaluations.currentStatus')}:</dt><dd>{cycle.status}</dd></div>
      </dl>
    </Modal>
  )
}
