import Modal from '../common/Modal'
import TrainingForm from './TrainingForm'

import { useI18n } from '../../i18n/useI18n'

export default function TrainingFormModal({
  open,
  onClose,
  mode = 'create',
  initial,
  onSubmit,
  submitting,
  serverErrors,
}) {
  const { t } = useI18n()

  return (
    <Modal
      open={open}
      onClose={onClose}
      size="xl"
      title={mode === 'edit' ? t('trainings.editTrainingTitle') : t('trainings.createTrainingTitle')}
      description={mode === 'edit'
        ? t('trainings.editTrainingTitle')
        : t('trainings.createTrainingTitle')}
    >
      <TrainingForm
        key={open ? `${mode}-${initial?.id ?? 'new'}` : 'closed'}
        mode={mode}
        initial={initial}
        onSubmit={onSubmit}
        onCancel={onClose}
        submitting={submitting}
        serverErrors={serverErrors}
      />
    </Modal>
  )
}
