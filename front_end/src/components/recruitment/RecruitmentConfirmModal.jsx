import Modal from '../common/Modal'
import Button from '../common/Button'
import { useI18n } from '../../i18n/useI18n'

/**
 * RecruitmentConfirmModal - modal xác nhận generic.
 */
export default function RecruitmentConfirmModal({
  open,
  onClose,
  onConfirm,
  title,
  description,
  warning,
  confirmLabel,
  cancelLabel,
  variant = 'danger',
}) {
  const { t } = useI18n()
  const defTitle = t('recruitment.component.confirm')
  const defConfirm = t('recruitment.component.confirmDefault')
  const defCancel = t('recruitment.component.cancelDefault')
  return (
    <Modal
      open={open}
      onClose={onClose}
      title={title ?? defTitle}
      description={description}
      size="md"
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>{cancelLabel ?? defCancel}</Button>
          <Button variant={variant} onClick={onConfirm}>{confirmLabel ?? defConfirm}</Button>
        </>
      }
    >
      {warning && (
        <p className="rounded-md bg-warning-50 px-3 py-2 text-sm text-warning-700">{warning}</p>
      )}
    </Modal>
  )
}
