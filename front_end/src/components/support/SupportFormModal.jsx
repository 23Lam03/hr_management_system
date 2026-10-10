import { useState } from 'react'
import { useI18n } from '../../i18n/useI18n'

import Modal from '../common/Modal'
import Input from '../common/Input'
import Select from '../common/Select'
import Button from '../common/Button'

const CATEGORY_OPTIONS = [
  { value: 'account',    label: 'Tài khoản' },
  { value: 'attendance', label: 'Chấm công' },
  { value: 'leave',      label: 'Nghỉ phép' },
  { value: 'payroll',    label: 'Bảng lương' },
  { value: 'benefit',    label: 'Phúc lợi' },
  { value: 'contract',   label: 'Hợp đồng' },
  { value: 'training',   label: 'Đào tạo' },
  { value: 'evaluation', label: 'Đánh giá' },
  { value: 'technical',  label: 'Kỹ thuật' },
  { value: 'other',      label: 'Khác' },
]

const PRIORITY_OPTIONS = [
  { value: 'low',    label: 'Thấp' },
  { value: 'normal', label: 'Bình thường' },
  { value: 'high',   label: 'Cao' },
]

/**
 * SupportFormModal - dùng cho Employee tạo / sửa yêu cầu.
 */
export default function SupportFormModal({
  open,
  onClose,
  onSubmit,
  initialValue = null,
  submitting = false,
}) {
  const { t } = useI18n()
  const [subject, setSubject] = useState(initialValue?.subject ?? '')
  const [description, setDescription] = useState(initialValue?.description ?? '')
  const [category, setCategory] = useState(initialValue?.category ?? 'other')
  const [priority, setPriority] = useState(initialValue?.priority ?? 'normal')
  const [errors, setErrors] = useState({})

  const reset = () => {
    setSubject(initialValue?.subject ?? '')
    setDescription(initialValue?.description ?? '')
    setCategory(initialValue?.category ?? 'other')
    setPriority(initialValue?.priority ?? 'normal')
    setErrors({})
  }

  const handleClose = () => {
    reset()
    onClose?.()
  }

  const handleSubmit = async (e) => {
    e?.preventDefault?.()
    const nextErrors = {}
    if (!subject.trim()) nextErrors.subject = t('support.component.enterSubject')
    if (!description.trim()) nextErrors.description = t('support.component.enterDescription')
    if (!category) nextErrors.category = t('support.component.selectRequestType')
    if (!priority) nextErrors.priority = t('support.component.selectPriority')
    if (Object.keys(nextErrors).length) {
      setErrors(nextErrors)
      return
    }
    const result = await onSubmit?.({
      subject: subject.trim(),
      description: description.trim(),
      category,
      priority,
    })
    if (result && result.ok === false) {
      setErrors(result.errors ?? {})
    } else {
      handleClose()
    }
  }

  return (
    <Modal
      open={open}
      onClose={handleClose}
      title={initialValue ? t('support.component.editRequest') : t('support.component.createRequest')}
      description={
        initialValue
          ? t('support.component.updateContentAndInfo')
          : t('support.component.describeYourRequest')
      }
      size="lg"
      footer={
        <>
          <Button variant="secondary" onClick={handleClose} disabled={submitting}>
            {t('support.component.cancel')}
          </Button>
          <Button variant="primary" onClick={handleSubmit} loading={submitting}>
            {initialValue ? t('support.component.saveChanges') : t('support.component.createRequest')}
          </Button>
        </>
      }
    >
      <form onSubmit={handleSubmit} className="flex flex-col gap-4">
        <Input
          label={t('support.component.subject')}
          required
          value={subject}
          onChange={(e) => setSubject(e.target.value)}
          placeholder={t('support.component.subjectPlaceholder')}
          error={errors.subject}
        />
        <div className="flex flex-col gap-1.5">
          <label htmlFor="support-description" className="text-[13px] font-medium text-neutral-900">
            {t('support.component.description')} <span className="text-danger-500">*</span>
          </label>
          <textarea
            id="support-description"
            rows={4}
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder={t('support.component.descriptionPlaceholder')}
            className="w-full rounded-md border border-neutral-200 bg-white px-3 py-2 text-sm text-neutral-700 placeholder:text-neutral-400 focus:border-brand-600 focus:outline-none focus:ring-2 focus:ring-brand-600/20"
            aria-invalid={Boolean(errors.description)}
          />
          {errors.description && <p className="text-xs text-danger-600">{errors.description}</p>}
        </div>

        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <Select
            label={t('support.component.requestType')}
            required
            options={CATEGORY_OPTIONS}
            value={category}
            onChange={(e) => setCategory(e.target.value)}
            error={errors.category}
          />
          <Select
            label={t('support.component.priority')}
            required
            options={PRIORITY_OPTIONS}
            value={priority}
            onChange={(e) => setPriority(e.target.value)}
            error={errors.priority}
          />
        </div>
      </form>
    </Modal>
  )
}