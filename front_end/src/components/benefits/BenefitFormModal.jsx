import Modal from '../common/Modal'
import BenefitForm from './BenefitForm'
import { useI18n } from '../../i18n/useI18n'

export default function BenefitFormModal({
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
      title={mode === 'edit' ? t('benefitsComponent.editBenefitTitle') : t('benefitsComponent.createBenefitTitle')}
      description={mode === 'edit' ? t('benefitsComponent.editBenefitDesc') : t('benefitsComponent.createBenefitDesc')}
    >
      <BenefitForm
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
