import { useState } from 'react'
import { useI18n } from '../../i18n/useI18n'

import Modal from '../common/Modal'
import Select from '../common/Select'
import Button from '../common/Button'

const STATUS_OPTIONS = [
  { value: 'open',                  label: 'Mới' },
  { value: 'in_progress',           label: 'Đang xử lý' },
  { value: 'waiting_for_employee',  label: 'Chờ nhân viên phản hồi' },
  { value: 'resolved',              label: 'Đã giải quyết' },
  { value: 'closed',               label: 'Đã đóng' },
  { value: 'cancelled',           label: 'Đã hủy' },
]

/**
 * SupportStatusUpdateModal - chỉnh sửa nhanh trạng thái 1 yêu cầu.
 */
export default function SupportStatusUpdateModal({
  open,
  onClose,
  onSubmit,
  initialStatus,
  submitting = false,
}) {
  const { t } = useI18n()
  const [status, setStatus] = useState(initialStatus ?? 'open')

  const handleSubmit = async () => {
    await onSubmit?.(status)
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={t('support.component.updateStatusModal')}
      description={t('support.component.changeStatusOfRequest')}
      size="sm"
      footer={
        <>
          <Button variant="secondary" onClick={onClose} disabled={submitting}>
            {t('support.component.cancel')}
          </Button>
          <Button variant="primary" onClick={handleSubmit} loading={submitting}>
            {t('support.component.save')}
          </Button>
        </>
      }
    >
      <Select
        label={t('support.component.status')}
        options={STATUS_OPTIONS}
        value={status}
        onChange={(e) => setStatus(e.target.value)}
      />
    </Modal>
  )
}