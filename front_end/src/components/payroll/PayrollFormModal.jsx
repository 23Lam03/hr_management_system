import Modal from '../common/Modal'
import PayrollForm from './PayrollForm'
import { useI18n } from '../../i18n/useI18n'

export default function PayrollFormModal({
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
      title={mode === 'edit' ? t('payrollComponent.editPayrollTitle') : t('payrollComponent.createPayrollTitle')}
      description={
        mode === 'edit'
          ? t('payrollComponent.editPayrollDesc')
          : t('payrollComponent.createPayrollDesc')
      }
    >
      <PayrollForm
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
