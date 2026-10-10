import Modal from '../common/Modal'
import EvaluationForm from './EvaluationForm'

import { useI18n } from '../../i18n/useI18n'

export default function EvaluationFormModal({
  open,
  onClose,
  cycle,
  employee,
  evaluation,
  criteria,
  onSaveDraft,
  onComplete,
  submitting,
  serverErrors,
}) {
  const { t } = useI18n()

  return (
    <Modal
      open={open}
      onClose={onClose}
      size="xl"
      title={t('evaluations.employeeEvaluation')}
      description={cycle ? `${cycle.name} · ${employee?.fullName || ''}` : ''}
    >
      <EvaluationForm
        cycle={cycle}
        employee={employee}
        evaluation={evaluation}
        criteria={criteria}
        onSaveDraft={onSaveDraft}
        onComplete={onComplete}
        submitting={submitting}
        serverErrors={serverErrors}
      />
    </Modal>
  )
}
