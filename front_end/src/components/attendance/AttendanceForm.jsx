import { useMemo, useRef, useState } from 'react'
import { User, CalendarDays, Clock3, LogOut, FileText, Save } from 'lucide-react'

import Input from '../common/Input'
import Select from '../common/Select'
import Button from '../common/Button'
import { useI18n } from '../../i18n/useI18n'

import { validateAttendance } from '../../services/attendanceService'

const EMPTY = {
  employeeId: '',
  date: '',
  checkIn: '',
  checkOut: '',
  status: 'on_time',
  note: '',
}

const TIME_HELP_KEY = 'attendance.component.timeFormatHint'

/**
 * AttendanceForm - dùng chung cho tạo + sửa.
 */
export default function AttendanceForm({
  initialValue,
  employees = [],
  statuses = [],
  onSubmit,
  onCancel,
  submitting = false,
  serverErrors = {},
  isEdit = false,
}) {
  const { t } = useI18n()
  const [values, setValues] = useState(() => ({ ...EMPTY, ...initialValue }))
  const [localErrors, setLocalErrors] = useState(() => ({}))
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
    const v = validateAttendance(values, { excludeRecordId: initialValue?.id })
    if (Object.keys(v).length) {
      setLocalErrors(v)
      return
    }
    submittedRef.current = true
    onSubmit(values)
  }

  const employeeOptions = useMemo(
    () => employees.map((e) => ({ value: e.id, label: `${e.fullName} · ${e.employeeCode}` })),
    [employees],
  )
  const statusOptions = useMemo(
    () => statuses.map((s) => ({ value: s.value, label: s.label })),
    [statuses],
  )

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-5" noValidate>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <Select
          label={t('employees.component.fullName')}
          required
          value={values.employeeId}
          onChange={(e) => setField('employeeId', e.target.value)}
          placeholder={t('attendance.component.selectEmployee')}
          options={employeeOptions}
          error={errors.employeeId}
          disabled={isEdit}
          leftIcon={User}
        />
        <Input
          label={t('attendance.component.attendanceDate')}
          required
          type="date"
          leftIcon={CalendarDays}
          value={values.date || ''}
          onChange={(e) => setField('date', e.target.value)}
          error={errors.date}
          disabled={isEdit}
        />
        <Input
          label={t('attendance.component.checkInLabel')}
          type="time"
          leftIcon={Clock3}
          value={values.checkIn || ''}
          onChange={(e) => setField('checkIn', e.target.value)}
          error={errors.checkIn}
          helper={!errors.checkIn ? t('attendance.component.leaveBlankIfNoData') : undefined}
        />
        <Input
          label={t('attendance.component.checkOutLabel')}
          type="time"
          leftIcon={LogOut}
          value={values.checkOut || ''}
          onChange={(e) => setField('checkOut', e.target.value)}
          error={errors.checkOut}
          helper={!errors.checkOut ? t(TIME_HELP_KEY) : undefined}
        />
        <Select
          label={t('attendance.component.status')}
          required
          value={values.status}
          onChange={(e) => setField('status', e.target.value)}
          options={statusOptions}
          error={errors.status}
          className="sm:col-span-2"
        />
        <div className="sm:col-span-2">
          <Input
            label={t('attendance.component.note')}
            placeholder={t('attendance.component.notePlaceholder')}
            leftIcon={FileText}
            value={values.note || ''}
            onChange={(e) => setField('note', e.target.value)}
            error={errors.note}
          />
        </div>
      </div>

      {errors._form && (
        <p className="text-sm text-danger-600">{errors._form}</p>
      )}

      <div className="flex flex-wrap items-center justify-end gap-2 border-t border-neutral-200 pt-4">
        <Button variant="secondary" onClick={onCancel} disabled={submitting}>
          {t('attendance.component.cancel')}
        </Button>
        <Button type="submit" icon={Save} loading={submitting}>
          {isEdit ? t('attendance.component.saveChanges') : t('attendance.component.record')}
        </Button>
      </div>
    </form>
  )
}