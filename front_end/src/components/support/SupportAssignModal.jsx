import { useState } from 'react'
import { useI18n } from '../../i18n/useI18n'

import Modal from '../common/Modal'
import Select from '../common/Select'
import Button from '../common/Button'

/**
 * SupportAssignModal - phân công người xử lý.
 */
export default function SupportAssignModal({
  open,
  onClose,
  onSubmit,
  adminOptions = [],
  initialAssignee = null,
  submitting = false,
}) {
  const { t } = useI18n()
  const [assignee, setAssignee] = useState(initialAssignee ?? '')

  const handleSubmit = async () => {
    await onSubmit?.(assignee || null)
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={t('support.component.assignRequest')}
      description={t('support.component.selectAdmin')}
      size="sm"
      footer={
        <>
          <Button variant="secondary" onClick={onClose} disabled={submitting}>
            {t('support.component.cancel')}
          </Button>
          <Button variant="primary" onClick={handleSubmit} loading={submitting}>
            {t('support.component.saveAssignment')}
          </Button>
        </>
      }
    >
      <Select
        label={t('support.component.assignHandler')}
        options={[
          { value: '', label: t('support.component.notAssigned') },
          ...adminOptions.map((a) => ({ value: a.id, label: a.label })),
        ]}
        value={assignee}
        onChange={(e) => setAssignee(e.target.value)}
      />
    </Modal>
  )
}