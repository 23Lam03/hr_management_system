import Modal from '../common/Modal'
import Button from '../common/Button'
import { useI18n } from '../../i18n/useI18n'

/**
 * Generic confirm modal - dùng cho cancel / delete với nội dung tùy biến.
 */
export default function SupportConfirmModal({
  open,
  onClose,
  onConfirm,
  title = 'Xác nhận',
  description,
  message,
  confirmLabel = 'Xác nhận',
  cancelLabel = 'Hủy bỏ',
  variant = 'danger',
  submitting = false,
}) {
  const { t } = useI18n()
  return (
    <Modal
      open={open}
      onClose={onClose}
      title={title}
      description={description}
      size="sm"
      footer={
        <>
          <Button variant="secondary" onClick={onClose} disabled={submitting}>
            {cancelLabel}
          </Button>
          <Button
            variant={variant === 'warning' ? 'primary' : 'danger'}
            onClick={onConfirm}
            loading={submitting}
          >
            {confirmLabel}
          </Button>
        </>
      }
    >
      <p className="text-sm text-neutral-700">{message}</p>
    </Modal>
  )
}