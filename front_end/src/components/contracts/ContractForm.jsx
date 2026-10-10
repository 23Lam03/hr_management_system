import { useMemo, useRef, useState } from 'react'
import { Save, Sparkles, Calendar } from 'lucide-react'

import Input from '../common/Input'
import Select from '../common/Select'
import Button from '../common/Button'

import { validateContract } from '../../utils/contractUtils'
import { useI18n } from '../../i18n/useI18n'

const TYPE_OPTIONS = (t) => [
  { value: 'probation',  label: t('contracts.typeProbation') },
  { value: 'fixed_term', label: t('contracts.typeFixed') },
  { value: 'indefinite', label: t('contracts.typeIndefinite') },
  { value: 'internship', label: t('contracts.typeInternship') },
  { value: 'other',      label: t('contracts.typeOther') },
]

const STATUS_OPTIONS = (t) => [
  { value: 'draft',      label: t('contracts.contractStatusDraft') },
  { value: 'pending',    label: t('contracts.contractStatusPending') },
  { value: 'active',     label: t('contracts.contractStatusActive') },
  { value: 'expired',    label: t('contracts.contractStatusExpired') },
  { value: 'terminated', label: t('contracts.contractStatusTerminated') },
  { value: 'cancelled',  label: t('contracts.contractStatusCancelled') },
]

const EMPTY = {
  contractCode: '',
  employeeId: '',
  contractType: 'fixed_term',
  signedDate: '',
  effectiveDate: '',
  expiryDate: '',
  status: 'draft',
  note: '',
  owner: '',
}

export default function ContractForm({
  initial,
  employees = [],
  onSubmit,
  onCancel,
  submitting = false,
  serverErrors = {},
  mode = 'create',
}) {
  const { t } = useI18n()
  const [values, setValues] = useState(() => ({ ...EMPTY, ...(initial || {}) }))
  const [localErrors, setLocalErrors] = useState({})
  const submittedRef = useRef(false)

  const errors = useMemo(
    () => ({ ...localErrors, ...serverErrors }),
    [localErrors, serverErrors],
  )

  function setField(name, value) {
    setValues((prev) => ({ ...prev, [name]: value }))
    setLocalErrors((prev) => {
      if (!prev[name] && !serverErrors[name]) return prev
      const next = { ...prev }
      delete next[name]
      return next
    })
  }

  function handleSubmit(e) {
    e.preventDefault()
    if (submittedRef.current || submitting) return
    const v = validateContract(values)
    if (Object.keys(v).length) {
      setLocalErrors(v)
      return
    }
    submittedRef.current = true
    onSubmit(values)
  }

  const selectedEmployee = employees.find((e) => e.id === values.employeeId)

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-5" noValidate>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <Input
          label={t('contracts.contractCode')}
          required
          placeholder={t('contracts.contractCodePlaceholder')}
          value={values.contractCode}
          onChange={(e) => setField('contractCode', e.target.value)}
          error={errors.contractCode}
          helper={t('contracts.contractCodeHelper')}
        />
        <Select
          label={t('contracts.employeeLabel')}
          required
          value={values.employeeId}
          onChange={(e) => setField('employeeId', e.target.value)}
          options={[
            { value: '', label: t('contracts.selectEmployee') },
            ...employees.map((e) => ({ value: e.id, label: `${e.fullName} · ${e.employeeCode}` })),
          ]}
          error={errors.employeeId}
        />
        <Select
          label={t('contracts.contractType')}
          required
          value={values.contractType}
          onChange={(e) => setField('contractType', e.target.value)}
          options={TYPE_OPTIONS(t)}
          error={errors.contractType}
        />
        <Select
          label={t('contracts.statusLabel')}
          required
          value={values.status}
          onChange={(e) => setField('status', e.target.value)}
          options={STATUS_OPTIONS(t)}
          error={errors.status}
        />
        <Input
          label={t('contracts.signedDateLabel')}
          required
          type="date"
          value={values.signedDate || ''}
          onChange={(e) => setField('signedDate', e.target.value)}
          error={errors.signedDate}
        />
        <Input
          label={t('contracts.effectiveDateLabel')}
          required
          type="date"
          value={values.effectiveDate || ''}
          onChange={(e) => setField('effectiveDate', e.target.value)}
          error={errors.effectiveDate}
        />
        <Input
          label={t('contracts.expiryDateLabel')}
          type="date"
          value={values.expiryDate || ''}
          onChange={(e) => setField('expiryDate', e.target.value)}
          error={errors.expiryDate}
          helper={values.contractType === 'indefinite' ? t('contracts.expiryDateHelper') : t('contracts.optionalExpiry')}
        />
        <Input
          label={t('contracts.owner')}
          value={values.owner || ''}
          onChange={(e) => setField('owner', e.target.value)}
          placeholder={t('contracts.ownerPlaceholder')}
        />
      </div>

      {selectedEmployee && (
        <div className="rounded-md border border-neutral-200 bg-neutral-50 p-3 text-sm">
          <p className="text-[12px] uppercase tracking-wider text-neutral-500">{t('contracts.employeeInfo')}</p>
          <div className="mt-1 flex flex-wrap items-center gap-2 text-neutral-700">
            <span className="font-mono">{selectedEmployee.employeeCode}</span>
            <span>·</span>
            <span>{selectedEmployee.fullName}</span>
            <span>·</span>
            <span>{selectedEmployee.departmentName}</span>
            <span>·</span>
            <span>{selectedEmployee.position}</span>
          </div>
        </div>
      )}

      <div className="flex flex-col gap-1.5">
        <label className="text-[13px] font-medium text-neutral-900">{t('contracts.note')}</label>
        <textarea
          rows={3}
          value={values.note || ''}
          onChange={(e) => setField('note', e.target.value)}
          placeholder={t('contracts.notePlaceholder')}
          className="w-full rounded-md border border-neutral-200 bg-white px-3 py-2 text-sm text-neutral-700 placeholder:text-neutral-400 focus:border-brand-600 focus:outline-none focus:ring-2 focus:ring-brand-600/20"
        />
      </div>

      {errors._form && (
        <p className="text-sm text-danger-600">{errors._form}</p>
      )}

      <div className="flex flex-wrap items-center justify-end gap-2 border-t border-neutral-200 pt-4">
        <Button variant="secondary" onClick={onCancel} disabled={submitting}>{t('common.cancel')}</Button>
        <Button type="submit" icon={mode === 'edit' ? Save : Sparkles} loading={submitting}>
          {mode === 'edit' ? t('contracts.saveChanges') : t('contracts.createContract')}
        </Button>
      </div>
      <span className="hidden"><Calendar aria-hidden="true" /></span>
    </form>
  )
}
