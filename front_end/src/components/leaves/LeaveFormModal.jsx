import Modal from '../common/Modal'
import LeaveForm from './LeaveForm'
import { useI18n } from '../../i18n/useI18n'

export default function LeaveFormModal({
  open,
  onClose,
  onSubmit,
  submitting = false,
  serverErrors = {},
}) {
  const { t } = useI18n()

  return (
    <Modal
      open={open}
      onClose={onClose}
      size="lg"
      title={t('leaves.component.createRequestTitle')}
      description={t('leaves.component.createRequestDesc')}
    >
      <LeaveForm
        key={open ? 'open' : 'closed'}
        onSubmit={onSubmit}
        onCancel={onClose}
        submitting={submitting}
        serverErrors={serverErrors}
      />
    </Modal>
  )
}
