import { useState } from 'react'
import { CalendarPlus, Calendar } from 'lucide-react'

import Modal from '../common/Modal'
import Input from '../common/Input'
import Button from '../common/Button'

import { validateExtension } from '../../utils/contractUtils'
import { useI18n } from '../../i18n/useI18n'

/**
 * ExtendContractModal - gia hạn hợp đồng.
 */
export default function ExtendContractModal({
  open,
  onClose,
  contract,
  onSubmit,
  submitting = false,
}) {
  const { t } = useI18n()
  const [newExpiryDate, setNewExpiryDate] = useState('')
  const [note, setNote] = useState('')
  const [localErrors, setLocalErrors] = useState({})

  if (!contract) return null

  function handleSubmit(e) {
    e.preventDefault()
    const v = validateExtension({ newExpiryDate }, contract.expiryDate)
    if (Object.keys(v).length) {
      setLocalErrors(v)
      return
    }
    onSubmit({ newExpiryDate, note })
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      size="md"
      title={t('contracts.extendContractTitle')}
      description={contract.contractCode}
    >
      <div className="rounded-md border border-brand-200 bg-brand-50 px-4 py-3 text-sm text-brand-800">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div>
            <p className="text-[12px] uppercase tracking-wider text-brand-600">{t('contracts.contract')}</p>
            <p className="font-semibold">{contract.employeeName}</p>
            <p className="text-[12px] text-brand-700">
              {contract.employeeCode} · {contract.departmentName}
            </p>
          </div>
          <div>
            <p className="text-[12px] uppercase tracking-wider text-brand-600">{t('contracts.expiryDate')}</p>
            <p className="font-semibold">{contract.expiryDate || '—'}</p>
          </div>
        </div>
      </div>
      <form onSubmit={handleSubmit} className="mt-4 flex flex-col gap-3" noValidate>
        <Input
          label={t('contracts.newExpiryDateLabel')}
          required
          type="date"
          leftIcon={Calendar}
          value={newExpiryDate}
          onChange={(e) => setNewExpiryDate(e.target.value)}
          error={localErrors.newExpiryDate}
          helper={t('contracts.newExpiryDateHelper')}
        />
        <div className="flex flex-col gap-1.5">
          <label className="text-[13px] font-medium text-neutral-900">{t('contracts.noteLabel')}</label>
          <textarea
            rows={2}
            value={note}
            onChange={(e) => setNote(e.target.value)}
            placeholder={t('contracts.notePlaceholder')}
            className="w-full rounded-md border border-neutral-200 bg-white px-3 py-2 text-sm text-neutral-700 placeholder:text-neutral-400 focus:border-brand-600 focus:outline-none focus:ring-2 focus:ring-brand-600/20"
          />
        </div>
        <div className="flex items-center justify-end gap-2 border-t border-neutral-200 pt-4">
          <Button variant="secondary" onClick={onClose} disabled={submitting}>{t('common.close')}</Button>
          <Button type="submit" icon={CalendarPlus} loading={submitting}>{t('contracts.extend')}</Button>
        </div>
      </form>
    </Modal>
  )
}
