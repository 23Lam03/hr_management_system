import { useMemo, useRef, useState } from 'react'
import { Save, CalendarDays, Sparkles } from 'lucide-react'

import Input from '../common/Input'
import Select from '../common/Select'
import Button from '../common/Button'

import { validateTraining } from '../../utils/trainingUtils'
import { useI18n } from '../../i18n/useI18n'

const CATEGORY_OPTIONS = (t) => [
  { value: 'hard_skill', label: t('trainings.categoryHardSkill') },
  { value: 'soft_skill', label: t('trainings.categorySoftSkill') },
  { value: 'onboarding', label: t('trainings.categoryOnboarding') },
  { value: 'compliance', label: t('trainings.categoryCompliance') },
  { value: 'other',      label: t('trainings.categoryOther') },
]

const FORMAT_OPTIONS = (t) => [
  { value: 'offline', label: t('trainings.formatOffline') },
  { value: 'online',  label: t('trainings.formatOnline') },
  { value: 'hybrid',  label: t('trainings.formatHybrid') },
]

const STATUS_OPTIONS = (t) => [
  { value: 'draft',       label: t('trainings.trainingStatusDraft') },
  { value: 'open',        label: t('trainings.trainingStatusOpen') },
  { value: 'in_progress', label: t('trainings.trainingStatusInProgress') },
  { value: 'completed',   label: t('trainings.trainingStatusCompleted') },
  { value: 'cancelled',   label: t('trainings.trainingStatusCancelled') },
]

const EMPTY = {
  code: '',
  name: '',
  category: 'hard_skill',
  format: 'offline',
  instructor: '',
  location: '',
  meetingUrl: '',
  startDate: '',
  endDate: '',
  registrationDeadline: '',
  durationHours: 8,
  capacity: 20,
  description: '',
  objectives: '',
  status: 'draft',
}

export default function TrainingForm({
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
    const v = validateTraining(values)
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
          label={t('trainings.trainingName')}
          required
          placeholder={t('trainings.trainingNamePlaceholder')}
          value={values.name}
          onChange={(e) => setField('name', e.target.value)}
          error={errors.name}
        />
        <Input
          label={t('trainings.trainingCode')}
          required
          placeholder={t('trainings.trainingCodePlaceholder')}
          value={values.code}
          onChange={(e) => setField('code', e.target.value)}
          error={errors.code}
          helper={t('trainings.trainingCodeHelper')}
        />
        <Select
          label={t('trainings.categoryLabel')}
          required
          value={values.category}
          onChange={(e) => setField('category', e.target.value)}
          options={CATEGORY_OPTIONS(t)}
          error={errors.category}
        />
        <Select
          label={t('trainings.formatLabel')}
          required
          value={values.format}
          onChange={(e) => setField('format', e.target.value)}
          options={FORMAT_OPTIONS(t)}
          error={errors.format}
        />
        <Input
          label={t('trainings.instructor')}
          required
          placeholder={t('trainings.instructorPlaceholder')}
          value={values.instructor}
          onChange={(e) => setField('instructor', e.target.value)}
          error={errors.instructor}
        />
        <Input
          label={t('trainings.durationHoursLabel')}
          required
          type="number"
          min={1}
          max={1000}
          leftIcon={CalendarDays}
          value={values.durationHours ?? ''}
          onChange={(e) => setField('durationHours', e.target.value === '' ? '' : Number(e.target.value))}
          error={errors.durationHours}
        />
      </div>

      <div className="flex flex-col gap-1.5">
        <label className="text-[13px] font-medium text-neutral-900">{t('trainings.description')} <span className="text-danger-500">*</span></label>
        <textarea
          rows={3}
          value={values.description || ''}
          onChange={(e) => setField('description', e.target.value)}
          placeholder={t('trainings.descriptionPlaceholder')}
          className="w-full rounded-md border border-neutral-200 bg-white px-3 py-2 text-sm text-neutral-700 placeholder:text-neutral-400 focus:border-brand-600 focus:outline-none focus:ring-2 focus:ring-brand-600/20"
        />
        {errors.description && <p className="text-xs text-danger-600">{errors.description}</p>}
      </div>

      <div className="flex flex-col gap-1.5">
        <label className="text-[13px] font-medium text-neutral-900">{t('trainings.objectives')}</label>
        <textarea
          rows={2}
          value={values.objectives || ''}
          onChange={(e) => setField('objectives', e.target.value)}
          placeholder={t('trainings.objectivesPlaceholder')}
          className="w-full rounded-md border border-neutral-200 bg-white px-3 py-2 text-sm text-neutral-700 placeholder:text-neutral-400 focus:border-brand-600 focus:outline-none focus:ring-2 focus:ring-brand-600/20"
        />
      </div>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <Input
          label={t('trainings.location')}
          placeholder={t('trainings.locationPlaceholder')}
          value={values.location || ''}
          onChange={(e) => setField('location', e.target.value)}
          error={errors.location}
        />
        <Input
          label={t('trainings.onlineUrl')}
          placeholder={t('trainings.onlineUrlPlaceholder')}
          value={values.meetingUrl || ''}
          onChange={(e) => setField('meetingUrl', e.target.value)}
          error={errors.meetingUrl}
        />
      </div>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <Input
          label={t('trainings.startDate')}
          required
          type="date"
          value={values.startDate || ''}
          onChange={(e) => setField('startDate', e.target.value)}
          error={errors.startDate}
        />
        <Input
          label={t('trainings.endDate')}
          required
          type="date"
          value={values.endDate || ''}
          onChange={(e) => setField('endDate', e.target.value)}
          error={errors.endDate}
        />
        <Input
          label={t('trainings.registrationDeadline')}
          required
          type="date"
          value={values.registrationDeadline || ''}
          onChange={(e) => setField('registrationDeadline', e.target.value)}
          error={errors.registrationDeadline}
          helper={t('trainings.registrationDeadlineHelper')}
        />
        <Input
          label={t('trainings.maxCapacity')}
          required
          type="number"
          min={1}
          max={1000}
          value={values.capacity ?? ''}
          onChange={(e) => setField('capacity', e.target.value === '' ? '' : Number(e.target.value))}
          error={errors.capacity}
        />
      </div>

      <Select
        label={t('trainings.status')}
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
        <Button variant="secondary" onClick={onCancel} disabled={submitting}>{t('trainings.cancel')}</Button>
        <Button type="submit" icon={mode === 'edit' ? Save : Sparkles} loading={submitting}>
          {mode === 'edit' ? t('trainings.saveChanges') : t('trainings.createTraining')}
        </Button>
      </div>
    </form>
  )
}
