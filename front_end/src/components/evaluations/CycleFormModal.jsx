import Modal from '../common/Modal'
import CycleForm from './CycleForm'

import { useI18n } from '../../i18n/useI18n'

export default function CycleFormModal({
  open,
  onClose,
  mode = 'create',
  initial,
  departments,
  onSubmit,
  submitting,
  serverErrors,
}) {
  const { t } = useI18n()

  return (
    <Modal
      open={open}
      onClose={onClose}
      size="lg"
      title={mode === 'edit' ? t('evaluations.editCycleTitle') : t('evaluations.createCycleTitle')}
      description={mode === 'edit'
        ? t('evaluations.editCycleTitle')
        : t('evaluations.createCycleTitle')}
    >
      <CycleForm
        key={open ? `${mode}-${initial?.id ?? 'new'}` : 'closed'}
        mode={mode}
        initial={initial}
        departments={departments}
        onSubmit={onSubmit}
        onCancel={onClose}
        submitting={submitting}
        serverErrors={serverErrors}
      />
    </Modal>
  )
}
