import Modal from '../common/Modal'
import ContractForm from './ContractForm'

import { useI18n } from '../../i18n/useI18n'

export default function ContractFormModal({
  open,
  onClose,
  mode = 'create',
  initial,
  employees,
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
      title={mode === 'edit' ? t('contracts.editContractTitle') : t('contracts.createContractTitle')}
      description={mode === 'edit' ? t('contracts.editContractTitle') : t('contracts.createContractTitle')}
    >
      <ContractForm
        key={open ? `${mode}-${initial?.id ?? 'new'}` : 'closed'}
        mode={mode}
        initial={initial}
        employees={employees}
        onSubmit={onSubmit}
        onCancel={onClose}
        submitting={submitting}
        serverErrors={serverErrors}
      />
    </Modal>
  )
}
