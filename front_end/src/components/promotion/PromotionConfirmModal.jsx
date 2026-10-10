import Modal from '../common/Modal'
import Button from '../common/Button'
import { useI18n } from '../../i18n/useI18n'

/**
 * PromotionConfirmModal - confirm đơn giản (delete / approve / reject).
 */
export default function PromotionConfirmModal({
  open,
  onClose,
  onConfirm,
  title,
  description,
  confirmLabel,
  cancelLabel,
  variant = 'danger',
}) {
  const { t } = useI18n()
  const defConfirm = t('common.confirm')
  const defCancel = t('common.cancel')
  return (
    <Modal
      open={open}
      onClose={onClose}
      title={title}
      description={description}
      size="md"
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>{cancelLabel ?? defCancel}</Button>
          <Button variant={variant} onClick={onConfirm}>{confirmLabel ?? defConfirm}</Button>
        </>
      }
    >
      {null}
    </Modal>
  )
}
