import { AlertTriangle } from 'lucide-react'

import Modal from '../common/Modal'
import Button from '../common/Button'
import { useI18n } from '../../i18n/useI18n'

import { formatDate } from '../../utils/format'
import { LEAVE_TYPE_LABEL } from '../../data/leaveMockData'

/**
 * CancelConfirmModal - xác nhận huỷ đơn của nhân viên.
 */
export default function CancelConfirmModal({ open, onClose, record, onConfirm, submitting = false }) {
  const { t } = useI18n()
  if (!record) return null
  return (
    <Modal
      open={open}
      onClose={onClose}
      size="md"
      title={t('leaves.component.cancelConfirmTitle')}
      description={t('leaves.component.cancelConfirmFor', { code: record.requestCode })}
      footer={
        <>
          <Button variant="secondary" onClick={onClose} disabled={submitting}>{t('leaves.component.close')}</Button>
          <Button variant="danger" onClick={onConfirm} loading={submitting}>
            {t('leaves.component.confirmCancel')}
          </Button>
        </>
      }
    >
      <div className="flex items-start gap-3 rounded-md border border-warning-200 bg-warning-50 px-4 py-3 text-sm text-warning-700">
        <AlertTriangle className="mt-0.5 h-4 w-4 flex-shrink-0" aria-hidden="true" />
        <p>{t('leaves.component.cancelConfirmDesc')}</p>
      </div>
      <div className="mt-4 space-y-1 text-sm text-neutral-700">
        <p><b>{t('leaves.component.leaveType')}:</b> {LEAVE_TYPE_LABEL[record.leaveType] ?? record.leaveType}</p>
        <p><b>{t('leaves.component.dateRange', { from: formatDate(record.startDate), to: formatDate(record.endDate), days: record.totalDays })}</b></p>
        <p><b>{t('leaves.component.reason')}:</b> {record.reason}</p>
      </div>
    </Modal>
  )
}