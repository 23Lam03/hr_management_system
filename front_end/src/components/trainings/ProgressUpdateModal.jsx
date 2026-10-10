import { useMemo, useState } from 'react'
import { Save, Target, BarChart3 } from 'lucide-react'

import Modal from '../common/Modal'
import Input from '../common/Input'
import Select from '../common/Select'
import Button from '../common/Button'

import { validateParticipantProgress } from '../../utils/trainingUtils'
import { useI18n } from '../../i18n/useI18n'

const LEARNING_OPTIONS = (t) => [
  { value: 'not_started', label: t('trainings.learningStatusNotStarted') },
  { value: 'in_progress', label: t('trainings.learningStatusInProgress') },
  { value: 'completed',   label: t('trainings.learningStatusCompleted') },
  { value: 'failed',      label: t('trainings.learningStatusFailed') },
]

const RESULT_OPTIONS = (t) => [
  { value: '',       label: t('trainings.resultPlaceholder') },
  { value: 'pass',   label: t('trainings.pass') },
  { value: 'fail',   label: t('trainings.fail') },
]

/**
 * ProgressUpdateModal - cập nhật tiến độ + kết quả cho 1 học viên (admin).
 */
export default function ProgressUpdateModal({
  open,
  onClose,
  record,
  onSubmit,
  submitting = false,
  serverErrors = {},
}) {
  const { t } = useI18n()

  const initial = useMemo(() => ({
    learningStatus: record?.learningStatus ?? 'not_started',
    progress: record?.progress ?? 0,
    score: record?.score ?? '',
    result: record?.result ?? '',
    instructorComment: record?.instructorComment ?? '',
    resultPublished: record?.resultPublished ?? false,
  }), [record])

  const [values, setValues] = useState(initial)
  const [localErrors, setLocalErrors] = useState({})

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
    const v = validateParticipantProgress(values)
    if (Object.keys(v).length) {
      setLocalErrors(v)
      return
    }
    onSubmit({
      ...values,
      progress: values.progress === '' ? 0 : Number(values.progress),
      score: values.score === '' ? null : Number(values.score),
      result: values.result || null,
    })
  }

  if (!record) return null

  return (
    <Modal
      open={open}
      onClose={onClose}
      size="md"
      title={t('trainings.updateProgressTitle')}
      description={`${record.employeeName} · ${record.employeeCode}`}
    >
      <form onSubmit={handleSubmit} className="flex flex-col gap-4" noValidate>
        <Select
          label={t('trainings.learningStatus')}
          required
          value={values.learningStatus}
          onChange={(e) => setField('learningStatus', e.target.value)}
          options={LEARNING_OPTIONS(t)}
        />
        <Input
          label={t('trainings.progressPercent')}
          type="number"
          min={0}
          max={100}
          leftIcon={Target}
          value={values.progress ?? 0}
          onChange={(e) => setField('progress', e.target.value === '' ? '' : Number(e.target.value))}
          error={errors.progress}
        />
        <Input
          label={t('trainings.evaluationScore')}
          type="number"
          min={0}
          max={100}
          leftIcon={BarChart3}
          value={values.score ?? ''}
          onChange={(e) => setField('score', e.target.value)}
          error={errors.score}
          helper={t('trainings.scoreHelper')}
        />
        <Select
          label={t('trainings.result')}
          value={values.result || ''}
          onChange={(e) => setField('result', e.target.value)}
          options={RESULT_OPTIONS(t)}
        />
        <div className="flex flex-col gap-1.5">
          <label className="text-[13px] font-medium text-neutral-900">{t('trainings.instructorFeedback')}</label>
          <textarea
            rows={3}
            value={values.instructorComment || ''}
            onChange={(e) => setField('instructorComment', e.target.value)}
            placeholder={t('trainings.feedbackPlaceholder')}
            className="w-full rounded-md border border-neutral-200 bg-white px-3 py-2 text-sm text-neutral-700 placeholder:text-neutral-400 focus:border-brand-600 focus:outline-none focus:ring-2 focus:ring-brand-600/20"
          />
        </div>
        <label className="inline-flex items-center gap-2 text-sm text-neutral-700">
          <input
            type="checkbox"
            checked={!!values.resultPublished}
            onChange={(e) => setField('resultPublished', e.target.checked)}
            className="h-4 w-4 accent-brand-600"
          />
          <span>{t('trainings.publishResults')}</span>
        </label>
        {errors._form && <p className="text-sm text-danger-600">{errors._form}</p>}
        <div className="flex items-center justify-end gap-2 border-t border-neutral-200 pt-4">
          <Button variant="secondary" onClick={onClose} disabled={submitting}>{t('trainings.cancel')}</Button>
          <Button type="submit" icon={Save} loading={submitting}>{t('trainings.saveUpdate')}</Button>
        </div>
      </form>
    </Modal>
  )
}
