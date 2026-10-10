import { useMemo, useRef, useState } from 'react'
import { Save, Sparkles, CalendarDays } from 'lucide-react'

import Input from '../common/Input'
import Select from '../common/Select'
import Button from '../common/Button'
import { useI18n } from '../../i18n/useI18n'

import { validateBenefit } from '../../utils/benefitUtils'

const TYPE_OPTIONS = [
  { value: 'insurance', label: 'Bảo hiểm' },
  { value: 'allowance', label: 'Phụ cấp' },
  { value: 'healthcare', label: 'Chăm sóc sức khỏe' },
  { value: 'training',   label: 'Hỗ trợ đào tạo' },
  { value: 'welfare',    label: 'Phúc lợi khác' },
]

const STATUS_OPTIONS = [
  { value: 'draft',   label: 'Bản nháp' },
  { value: 'active',  label: 'Đang hoạt động' },
  { value: 'paused',  label: 'Tạm dừng' },
  { value: 'expired', label: 'Hết hạn' },
]

const UNIT_OPTIONS = [
  { value: 'fixed',     label: 'Giá trị cố định' },
  { value: 'vnd_month', label: 'VNĐ / tháng' },
  { value: 'vnd_year',  label: 'VNĐ / năm' },
  { value: 'percent',   label: '% lương' },
  { value: 'times',     label: 'Lần / năm' },
]

const EMPTY = {
  code: '',
  name: '',
  type: 'allowance',
  description: '',
  value: '',
  valueUnit: 'vnd_month',
  eligibility: '',
  startDate: '',
  endDate: '',
  status: 'active',
  departmentIds: [],
}

export default function BenefitForm({
  initial,
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
    const v = validateBenefit(values)
    if (Object.keys(v).length) {
      setLocalErrors(v)
      return
    }
    submittedRef.current = true
    onSubmit(values)
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-5" noValidate>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <Input
          label={t('benefitsComponent.benefitCode')}
          required
          placeholder={t('benefitsComponent.benefitCodePlaceholder')}
          value={values.code}
          onChange={(e) => setField('code', e.target.value)}
          error={errors.code}
          helper={t('benefitsComponent.benefitCodeHelper')}
        />
        <Input
          label={t('benefitsComponent.benefitName')}
          required
          placeholder={t('benefitsComponent.benefitNamePlaceholder')}
          value={values.name}
          onChange={(e) => setField('name', e.target.value)}
          error={errors.name}
        />
        <Select
          label={t('benefitsComponent.benefitTypeSelect')}
          required
          value={values.type}
          onChange={(e) => setField('type', e.target.value)}
          options={TYPE_OPTIONS}
          error={errors.type}
        />
        <Select
          label={t('benefitsComponent.statusSelect')}
          required
          value={values.status}
          onChange={(e) => setField('status', e.target.value)}
          options={STATUS_OPTIONS}
          error={errors.status}
        />
      </div>

      <div className="flex flex-col gap-1.5">
        <label className="text-[13px] font-medium text-neutral-900">{t('benefitsComponent.description')}</label>
        <textarea
          rows={2}
          value={values.description || ''}
          onChange={(e) => setField('description', e.target.value)}
          placeholder={t('benefitsComponent.descriptionPlaceholder')}
          className="w-full rounded-md border border-neutral-200 bg-white px-3 py-2 text-sm text-neutral-700 placeholder:text-neutral-400 focus:border-brand-600 focus:outline-none focus:ring-2 focus:ring-brand-600/20"
        />
      </div>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <Input
          label={t('benefitsComponent.value')}
          type="number"
          min={0}
          placeholder={t('benefitsComponent.valuePlaceholder')}
          value={values.value ?? ''}
          onChange={(e) => setField('value', e.target.value === '' ? '' : Number(e.target.value))}
          error={errors.value}
        />
        <Select
          label={t('benefitsComponent.valueUnit')}
          value={values.valueUnit || 'fixed'}
          onChange={(e) => setField('valueUnit', e.target.value)}
          options={UNIT_OPTIONS}
          error={errors.valueUnit}
        />
      </div>

      <div className="flex flex-col gap-1.5">
        <label className="text-[13px] font-medium text-neutral-900">{t('benefitsComponent.eligibilityLabel')}</label>
        <textarea
          rows={2}
          value={values.eligibility || ''}
          onChange={(e) => setField('eligibility', e.target.value)}
          placeholder={t('benefitsComponent.eligibilityPlaceholder')}
          className="w-full rounded-md border border-neutral-200 bg-white px-3 py-2 text-sm text-neutral-700 placeholder:text-neutral-400 focus:border-brand-600 focus:outline-none focus:ring-2 focus:ring-brand-600/20"
        />
      </div>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <Input
          label={t('benefitsComponent.startDate')}
          required
          type="date"
          leftIcon={CalendarDays}
          value={values.startDate || ''}
          onChange={(e) => setField('startDate', e.target.value)}
          error={errors.startDate}
        />
        <Input
          label={t('benefitsComponent.endDate')}
          type="date"
          value={values.endDate || ''}
          onChange={(e) => setField('endDate', e.target.value)}
          error={errors.endDate}
          helper={t('benefitsComponent.endDateHelper')}
        />
      </div>

      {errors._form && (
        <p className="text-sm text-danger-600">{errors._form}</p>
      )}

      <div className="flex flex-wrap items-center justify-end gap-2 border-t border-neutral-200 pt-4">
        <Button variant="secondary" onClick={onCancel} disabled={submitting}>{t('benefitsComponent.cancel')}</Button>
        <Button type="submit" icon={mode === 'edit' ? Save : Sparkles} loading={submitting}>
          {mode === 'edit' ? t('benefitsComponent.saveChanges') : t('benefitsComponent.createProgram')}
        </Button>
      </div>
    </form>
  )
}
