import { useState } from 'react'
import { AlertTriangle } from 'lucide-react'

import Modal from '../common/Modal'
import Input from '../common/Input'
import Button from '../common/Button'

import { useI18n } from '../../i18n/useI18n'

/**
 * TerminateContractModal - kết thúc hợp đồng.
 */
export default function TerminateContractModal({
  open,
  onClose,
  contract,
  onSubmit,
  submitting = false,
}) {
  const { t } = useI18n()
  const [endDate, setEndDate] = useState(() => new Date().toISOString().slice(0, 10))
  const [reason, setReason] = useState('')
  const [note, setNote] = useState('')
  const [localErrors, setLocalErrors] = useState({})

  if (!contract) return null

  function handleSubmit(e) {
    e.preventDefault()
    const errs = {}
    if (!reason.trim()) errs.reason = t('contracts.reasonRequired')
    if (Object.keys(errs).length) {
      setLocalErrors(errs)
      return
    }
    onSubmit({ endDate, reason, note })
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      size="md"
      title={t('contracts.terminateContractTitle')}
      description={contract.contractCode}
      footer={
        <>
          <Button variant="secondary" onClick={onClose} disabled={submitting}>{t('common.close')}</Button>
          <Button variant="danger" onClick={handleSubmit} loading={submitting}>
            {t('contracts.confirmTerminate')}
          </Button>
        </>
      }
    >
      <div className="flex items-start gap-3 rounded-md border border-warning-200 bg-warning-50 px-4 py-3 text-sm text-warning-700">
        <AlertTriangle className="mt-0.5 h-4 w-4 flex-shrink-0" aria-hidden="true" />
        <p>{t('contracts.terminateWarning')}</p>
      </div>
      <div className="mt-4 grid grid-cols-1 gap-2 rounded-md border border-neutral-200 bg-white p-3 text-sm text-neutral-700">
        <div className="flex justify-between"><dt className="text-neutral-500">{t('contracts.employee')}:</dt><dd className="font-medium">{contract.employeeName}</dd></div>
        <div className="flex justify-between"><dt className="text-neutral-500">{t('contracts.department')}:</dt><dd>{contract.departmentName}</dd></div>
        <div className="flex justify-between"><dt className="text-neutral-500">{t('contracts.currentStatus')}:</dt><dd>{contract.status}</dd></div>
      </div>
      <form onSubmit={handleSubmit} className="mt-4 flex flex-col gap-3" noValidate>
        <Input
          label={t('contracts.endDate')}
          required
          type="date"
          value={endDate}
          onChange={(e) => setEndDate(e.target.value)}
        />
        <Input
          label={t('contracts.reasonLabel')}
          required
          value={reason}
          onChange={(e) => {
            setReason(e.target.value)
            setLocalErrors((prev) => {
              if (!prev.reason) return prev
              const next = { ...prev }
              delete next.reason
              return next
            })
          }}
          error={localErrors.reason}
          placeholder={t('contracts.reasonPlaceholder')}
        />
        <div className="flex flex-col gap-1.5">
          <label className="text-[13px] font-medium text-neutral-900">{t('contracts.noteField')}</label>
          <textarea
            rows={2}
            value={note}
            onChange={(e) => setNote(e.target.value)}
            placeholder={t('contracts.notePlaceholderTerminate')}
            className="w-full rounded-md border border-neutral-200 bg-white px-3 py-2 text-sm text-neutral-700 placeholder:text-neutral-400 focus:border-brand-600 focus:outline-none focus:ring-2 focus:ring-brand-600/20"
          />
        </div>
      </form>
    </Modal>
  )
}
