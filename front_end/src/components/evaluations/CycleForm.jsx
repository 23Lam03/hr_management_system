import { useMemo, useRef, useState } from 'react'
import { Save, Sparkles } from 'lucide-react'

import Input from '../common/Input'
import Select from '../common/Select'
import Button from '../common/Button'

import { validateCycle } from '../../utils/evaluationUtils'
import { useI18n } from '../../i18n/useI18n'

const STATUS_OPTIONS = (t) => [
  { value: 'draft', label: t('evaluations.cycleStatusDraft') },
  { value: 'upcoming', label: t('evaluations.cycleStatusUpcoming') },
  { value: 'in_progress', label: t('evaluations.cycleStatusInProgress') },
  { value: 'completed', label: t('evaluations.cycleStatusCompleted') },
  { value: 'closed', label: t('evaluations.cycleStatusClosed') },
]

const EMPTY = {
  name: '',
  description: '',
  startDate: '',
  endDate: '',
  departmentIds: [],
  status: 'draft',
}

export default function CycleForm({
  initial,
  departments = [],
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

  function toggleDepartment(id) {
    setValues((prev) => {
      const arr = prev.departmentIds || []
      const has = arr.includes(id)
      return { ...prev, departmentIds: has ? arr.filter((x) => x !== id) : [...arr, id] }
    })
  }

  function handleSubmit(e) {
    e.preventDefault()
    if (submittedRef.current || submitting) return
    const local = validateCycle(values)
    if (Object.keys(local).length) {
      setLocalErrors(local)
      return
    }
    submittedRef.current = true
    onSubmit(values)
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-5" noValidate>
      <Input
        label={t('evaluations.cycleName')}
        required
        placeholder={t('evaluations.cycleNamePlaceholder')}
        value={values.name}
        onChange={(e) => setField('name', e.target.value)}
        error={errors.name}
      />
      <div className="flex flex-col gap-1.5">
        <label className="text-[13px] font-medium text-neutral-900">{t('evaluations.cycleDescription')}</label>
        <textarea
          rows={3}
          value={values.description || ''}
          onChange={(e) => setField('description', e.target.value)}
          placeholder={t('evaluations.cycleDescriptionPlaceholder')}
          className="w-full rounded-md border border-neutral-200 bg-white px-3 py-2 text-sm text-neutral-700 placeholder:text-neutral-400 focus:border-brand-600 focus:outline-none focus:ring-2 focus:ring-brand-600/20"
        />
      </div>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <Input
          label={t('evaluations.startDate')}
          required
          type="date"
          value={values.startDate || ''}
          onChange={(e) => setField('startDate', e.target.value)}
          error={errors.startDate}
        />
        <Input
          label={t('evaluations.endDate')}
          required
          type="date"
          value={values.endDate || ''}
          onChange={(e) => setField('endDate', e.target.value)}
          error={errors.endDate}
        />
      </div>

      <div className="flex flex-col gap-2">
        <label className="text-[13px] font-medium text-neutral-900">
          {t('evaluations.scopeDepartments')}
        </label>
        <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
          {departments.map((d) => {
            const checked = (values.departmentIds || []).includes(d.id)
            return (
              <label
                key={d.id}
                className={`flex items-center gap-2 rounded-md border px-3 py-2 cursor-pointer transition ${
                  checked ? 'border-brand-300 bg-brand-50' : 'border-neutral-200 hover:bg-neutral-50'
                }`}
              >
                <input
                  type="checkbox"
                  checked={checked}
                  onChange={() => toggleDepartment(d.id)}
                  className="h-4 w-4 accent-brand-600"
                />
                <span className="text-sm text-neutral-700">{d.name}</span>
              </label>
            )
          })}
        </div>
      </div>

      <Select
        label={t('evaluations.status')}
        required
        value={values.status}
        onChange={(e) => setField('status', e.target.value)}
        options={STATUS_OPTIONS(t)}
        error={errors.status}
      />

      {errors._form && (
        <p className="text-sm text-danger-600">{errors._form}</p>
      )}

      <div className="flex flex-wrap items-center justify-end gap-2 border-t border-neutral-200 pt-4">
        <Button variant="secondary" onClick={onCancel} disabled={submitting}>{t('evaluations.cancel')}</Button>
        <Button type="submit" icon={mode === 'edit' ? Save : Sparkles} loading={submitting}>
          {mode === 'edit' ? t('evaluations.saveChanges') : t('evaluations.createCycleTitle')}
        </Button>
      </div>
    </form>
  )
}
