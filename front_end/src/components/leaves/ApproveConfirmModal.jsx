import { CheckCircle2, AlertTriangle } from 'lucide-react'

import Modal from '../common/Modal'
import Button from '../common/Button'
import { useI18n } from '../../i18n/useI18n'

/**
 * ApproveConfirmModal - hộp thoại xác nhận phê duyệt.
 */
export default function ApproveConfirmModal({ open, onClose, record, onConfirm, submitting = false }) {
  const { t } = useI18n()
  if (!record) return null
  return (
    <Modal
      open={open}
      onClose={onClose}
      size="md"
      title={t('leaves.component.approveConfirmTitle')}
      description={t('leaves.component.approveConfirmFor', { code: record.requestCode, name: record.employeeName })}
      footer={
        <>
          <Button variant="secondary" onClick={onClose} disabled={submitting}>{t('leaves.component.cancel')}</Button>
          <Button onClick={onConfirm} loading={submitting}>{t('leaves.component.confirmApproval')}</Button>
        </>
      }
    >
      <div className="flex items-start gap-3 rounded-md border border-success-200 bg-success-50 px-4 py-3 text-sm text-success-700">
        <CheckCircle2 className="mt-0.5 h-4 w-4 flex-shrink-0" aria-hidden="true" />
        <p>{t('leaves.component.approveConfirmDesc')}</p>
      </div>
    </Modal>
    )
}

void AlertTriangle