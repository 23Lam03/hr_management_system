import { useState } from 'react'
import { AlertTriangle, XCircle } from 'lucide-react'

import Modal from '../common/Modal'
import Button from '../common/Button'
import Input from '../common/Input'
import { useI18n } from '../../i18n/useI18n'

/**
 * RejectConfirmModal - hộp thoại từ chối với lý do.
 */
export default function RejectConfirmModal({ open, onClose, record, onConfirm, submitting = false }) {
  const { t } = useI18n()
  const [reason, setReason] = useState('')
  const [localError, setLocalError] = useState('')

  if (!record) return null

  function reset() {
    setReason('')
    setLocalError('')
  }

  function handleClose() {
    reset()
    onClose()
  }

  function handleSubmit() {
    if (!reason.trim() || reason.trim().length < 3) {
      setLocalError(t('leaves.component.rejectReasonError'))
      return
    }
    setLocalError('')
    onConfirm(reason.trim())
  }

  return (
    <Modal
      open={open}
      onClose={handleClose}
      size="md"
      title={t('leaves.component.rejectTitle')}
      description={t('leaves.component.rejectDesc', { n: record.requestCode, m: record.employeeName })}
      footer={
        <>
          <Button variant="secondary" onClick={handleClose} disabled={submitting}>{t('common.cancel')}</Button>
          <Button variant="danger" onClick={handleSubmit} loading={submitting}>
            {t('leaves.component.confirmReject')}
          </Button>
        </>
      }
    >
      <div className="flex items-start gap-3 rounded-md border border-warning-200 bg-warning-50 px-4 py-3 text-sm text-warning-700">
        <AlertTriangle className="mt-0.5 h-4 w-4 flex-shrink-0" aria-hidden="true" />
        <p>{t('leaves.component.rejectWarning')}</p>
      </div>
      <div className="mt-4">
        <Input
          label={t('leaves.component.rejectReasonLabel')}
          required
          placeholder={t('leaves.component.rejectReasonPlaceholder')}
          value={reason}
          onChange={(e) => {
            setReason(e.target.value)
            if (localError) setLocalError('')
          }}
          error={localError}
          leftIcon={XCircle}
        />
      </div>
    </Modal>
  )
}
