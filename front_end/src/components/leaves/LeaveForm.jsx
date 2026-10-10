import { useMemo, useRef, useState } from 'react'
import { CalendarDays, FileText, Save } from 'lucide-react'

import Input from '../common/Input'
import Select from '../common/Select'
import Button from '../common/Button'
import { useI18n } from '../../i18n/useI18n'

import { validateLeaveRequest, calcTotalDays } from '../../services/leaveService'

const EMPTY = {
  leaveType: '',
  startDate: '',
  endDate: '',
  startSession: 'full',
  endSession: 'full',
  reason: '',
}

export default function LeaveForm({
  onSubmit,
  onCancel,
  submitting = false,
  serverErrors = {},
}) {
  const { t } = useI18n()
  const [values, setValues] = useState(() => ({ ...EMPTY }))
  const [localErrors, setLocalErrors] = useState(() => ({}))
  const submittedRef = useRef(false)

  const errors = useMemo(
    () => ({ ...localErrors, ...serverErrors }),
    [localErrors, serverErrors],
  )

  const totalDaysPreview = useMemo(
    () =>
      calcTotalDays({
        startDate: values.startDate,
        endDate: values.endDate,
        startSession: values.startSession,
        endSession: values.endSession,
      }),
    [values.startDate, values.endDate, values.startSession, values.endSession],
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
    const v = validateLeaveRequest(values, {})
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
        <Select
          label={t('leaves.component.leaveTypeLabel')}
          required
          value={values.leaveType}
          onChange={(e) => setField('leaveType', e.target.value)}
          options={[
            { value: '', label: t('leaves.component.selectType') },
            { value: 'annual', label: t('leaves.component.annualLeave') },
            { value: 'sick', label: t('leaves.component.sickLeave') },
            { value: 'personal', label: t('leaves.component.personalLeave') },
            { value: 'unpaid', label: t('leaves.component.unpaidLeave') },
            { value: 'other', label: t('leaves.component.otherLeave') },
          ]}
          error={errors.leaveType}
        />
        <div className="hidden sm:block" />
        <Input
          label={t('leaves.component.startDateLabel')}
          required
          type="date"
          leftIcon={CalendarDays}
          value={values.startDate || ''}
          onChange={(e) => setField('startDate', e.target.value)}
          error={errors.startDate}
        />
        <Input
          label={t('leaves.component.endDateLabel')}
          required
          type="date"
          leftIcon={CalendarDays}
          value={values.endDate || ''}
          onChange={(e) => setField('endDate', e.target.value)}
          error={errors.endDate}
        />
        <Select
          label={t('leaves.component.sessionStart')}
          value={values.startSession}
          onChange={(e) => setField('startSession', e.target.value)}
          options={[
            { value: 'full', label: t('leaves.component.fullDay') },
            { value: 'morning', label: t('leaves.component.morning') },
            { value: 'afternoon', label: t('leaves.component.afternoon') },
          ]}
        />
        <Select
          label={t('leaves.component.sessionEnd')}
          value={values.endSession}
          onChange={(e) => setField('endSession', e.target.value)}
          options={[
            { value: 'full', label: t('leaves.component.fullDay') },
            { value: 'morning', label: t('leaves.component.morning') },
            { value: 'afternoon', label: t('leaves.component.afternoon') },
          ]}
        />
        <div className="sm:col-span-2">
          <Input
            label={t('leaves.component.reasonLabel')}
            required
            placeholder={t('leaves.component.reasonPlaceholder')}
            leftIcon={FileText}
            value={values.reason || ''}
            onChange={(e) => setField('reason', e.target.value)}
            error={errors.reason}
            helper={t('leaves.component.reasonHelper')}
          />
        </div>
      </div>

      <div className="flex items-center justify-between rounded-md border border-brand-100 bg-brand-50 px-4 py-2 text-sm text-brand-700">
        <span>{t('leaves.component.totalDaysPreview')}</span>
        <b>{totalDaysPreview || 0}</b>
      </div>

      {errors._form && (
        <p className="text-sm text-danger-600">{errors._form}</p>
      )}

      <div className="flex flex-wrap items-center justify-end gap-2 border-t border-neutral-200 pt-4">
        <Button variant="secondary" onClick={onCancel} disabled={submitting}>
          {t('leaves.component.cancel')}
        </Button>
        <Button type="submit" icon={Save} loading={submitting}>
          {t('leaves.component.submitRequest')}
        </Button>
      </div>
    </form>
  )
}
