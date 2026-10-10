import { useState } from 'react'
import { UserPlus } from 'lucide-react'

import Select from '../common/Select'
import Button from '../common/Button'
import Modal from '../common/Modal'

import { useI18n } from '../../i18n/useI18n'

/**
 * AddParticipantModal - admin thêm 1 nhân viên vào khóa học.
 */
export default function AddParticipantModal({
  open,
  onClose,
  candidates = [],
  onSubmit,
  submitting = false,
}) {
  const { t } = useI18n()
  const [employeeId, setEmployeeId] = useState('')
  const [registrationStatus, setRegistrationStatus] = useState('confirmed')

  function handleSubmit(e) {
    e.preventDefault()
    if (!employeeId) return
    onSubmit({ employeeId, registrationStatus })
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      size="md"
      title={t('trainings.addParticipantTitle')}
      description={t('trainings.selectEmployee')}
    >
      <form onSubmit={handleSubmit} className="flex flex-col gap-4" noValidate>
        <Select
          label={t('trainings.employee')}
          required
          value={employeeId}
          onChange={(e) => setEmployeeId(e.target.value)}
          options={[
            { value: '', label: t('trainings.selectEmployee') },
            ...candidates.map((c) => ({ value: c.id, label: `${c.fullName} · ${c.employeeCode}` })),
          ]}
        />
        <Select
          label={t('trainings.registrationStatusLabel')}
          required
          value={registrationStatus}
          onChange={(e) => setRegistrationStatus(e.target.value)}
          options={[
            { value: 'confirmed',  label: t('trainings.statusConfirmed') },
            { value: 'registered', label: t('trainings.statusRegistered') },
            { value: 'waitlisted', label: t('trainings.statusWaitlisted') },
          ]}
        />
        <div className="flex items-center justify-end gap-2 border-t border-neutral-200 pt-4">
          <Button variant="secondary" onClick={onClose} disabled={submitting}>{t('trainings.cancel')}</Button>
          <Button type="submit" icon={UserPlus} loading={submitting}>{t('trainings.add')}</Button>
        </div>
      </form>
    </Modal>
  )
}
