import Modal from '../common/Modal'
import Button from '../common/Button'
import { useI18n } from '../../i18n/useI18n'

export default function DeleteNotificationConfirmModal({
  open,
  onClose,
  onConfirm,
  notification,
  submitting = false,
}) {
  const { t } = useI18n()

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={t('notificationsComponent.deleteNotification')}
      description={t('notificationsComponent.deleteNotificationDesc')}
      size="sm"
      footer={
        <>
          <Button variant="secondary" onClick={onClose} disabled={submitting}>
            {t('notificationsComponent.cancel')}
          </Button>
          <Button variant="danger" onClick={onConfirm} loading={submitting}>
            {t('notificationsComponent.delete')}
          </Button>
        </>
      }
    >
      <p className="text-sm text-neutral-700">
        {t('notificationsComponent.deleteConfirm')}
        {notification?.title ? (
          <span className="font-semibold"> &ldquo;{notification.title}&rdquo;</span>
        ) : null}
        {t('notificationsComponent.deleteConfirmSuffix')}
      </p>
    </Modal>
  )
}
