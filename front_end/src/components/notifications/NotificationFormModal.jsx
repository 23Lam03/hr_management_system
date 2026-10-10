import { useState } from 'react'

import Modal from '../common/Modal'
import Input from '../common/Input'
import Select from '../common/Select'
import Button from '../common/Button'
import { useI18n } from '../../i18n/useI18n'

const TYPE_OPTIONS = [
  { value: 'system',     label: 'Hệ thống' },
  { value: 'leave',      label: 'Nghỉ phép' },
  { value: 'payroll',    label: 'Bảng lương' },
  { value: 'evaluation', label: 'Đánh giá' },
  { value: 'training',   label: 'Đào tạo' },
  { value: 'benefit',    label: 'Phúc lợi' },
  { value: 'contract',   label: 'Hợp đồng' },
  { value: 'attendance', label: 'Chấm công' },
]

const PRIORITY_OPTIONS = [
  { value: 'low',    label: 'Thấp' },
  { value: 'normal', label: 'Bình thường' },
  { value: 'high',   label: 'Cao' },
]

const ALL_EMPLOYEES = '__ALL__'

export default function NotificationFormModal({
  open,
  onClose,
  onSubmit,
  initialValue = null,
  recipientOptions = [],
  submitting = false,
}) {
  const { t } = useI18n()
  const [title, setTitle] = useState(initialValue?.title ?? '')
  const [message, setMessage] = useState(initialValue?.message ?? '')
  const [type, setType] = useState(initialValue?.type ?? 'system')
  const [priority, setPriority] = useState(initialValue?.priority ?? 'normal')
  const [recipientType, setRecipientType] = useState(
    initialValue?.recipientType ?? 'employee',
  )
  const [recipientId, setRecipientId] = useState(initialValue?.recipientId ?? '')
  const [errors, setErrors] = useState({})

  const handleClose = () => {
    setTitle(initialValue?.title ?? '')
    setMessage(initialValue?.message ?? '')
    setType(initialValue?.type ?? 'system')
    setPriority(initialValue?.priority ?? 'normal')
    setRecipientType(initialValue?.recipientType ?? 'employee')
    setRecipientId(initialValue?.recipientId ?? '')
    setErrors({})
    onClose?.()
  }

  const handleSubmit = async (e) => {
    e?.preventDefault?.()
    const nextErrors = {}
    if (!title.trim()) nextErrors.title = t('common.fieldRequired')
    if (!message.trim()) nextErrors.message = t('common.fieldRequired')
    if (!type) nextErrors.type = t('common.fieldRequired')
    if (!priority) nextErrors.priority = t('common.fieldRequired')
    if (recipientType === 'employee' && !recipientId) {
      nextErrors.recipientId = t('common.fieldRequired')
    }
    if (Object.keys(nextErrors).length) {
      setErrors(nextErrors)
      return
    }

    let resolvedRecipientId = recipientId
    let resolvedRecipientType = recipientType
    if (recipientType === 'all') {
      resolvedRecipientId = ALL_EMPLOYEES
    }

    const result = await onSubmit?.({
      title: title.trim(),
      message: message.trim(),
      type,
      priority,
      recipientType: resolvedRecipientType,
      recipientId: resolvedRecipientId,
    })
    if (result && result.ok === false) {
      setErrors(result.errors ?? {})
    } else {
      handleClose()
    }
  }

  const recipientSelectOptions = [
    ...recipientOptions.map((r) => ({ value: r.id, label: r.label })),
  ]

  return (
    <Modal
      open={open}
      onClose={handleClose}
      title={initialValue ? t('notificationsComponent.editNotification') : t('notificationsComponent.createNotification')}
      description={initialValue ? t('notificationsComponent.editNotificationDesc') : t('notificationsComponent.createNotificationDesc')}
      size="lg"
      footer={
        <>
          <Button variant="secondary" onClick={handleClose} disabled={submitting}>
            {t('notificationsComponent.cancel')}
          </Button>
          <Button variant="primary" onClick={handleSubmit} loading={submitting}>
            {initialValue ? t('notificationsComponent.saveChanges') : t('notificationsComponent.createNotification')}
          </Button>
        </>
      }
    >
      <form onSubmit={handleSubmit} className="flex flex-col gap-4">
        <Input
          label={t('notificationsComponent.titleLabel')}
          required
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder={t('notificationsComponent.titlePlaceholder')}
          error={errors.title}
        />
        <div className="flex flex-col gap-1.5">
          <label htmlFor="notification-message" className="text-[13px] font-medium text-neutral-900">
            {t('notificationsComponent.contentLabel')} <span className="text-danger-500">*</span>
          </label>
          <textarea
            id="notification-message"
            rows={4}
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            placeholder={t('notificationsComponent.contentPlaceholder')}
            className="w-full rounded-md border border-neutral-200 bg-white px-3 py-2 text-sm text-neutral-700 placeholder:text-neutral-400 focus:border-brand-600 focus:outline-none focus:ring-2 focus:ring-brand-600/20"
            aria-invalid={Boolean(errors.message)}
          />
          {errors.message && <p className="text-xs text-danger-600">{errors.message}</p>}
        </div>

        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <Select
            label={t('notificationsComponent.typeLabel')}
            required
            options={TYPE_OPTIONS}
            value={type}
            onChange={(e) => setType(e.target.value)}
            error={errors.type}
          />
          <Select
            label={t('notificationsComponent.priorityLabel')}
            required
            options={PRIORITY_OPTIONS}
            value={priority}
            onChange={(e) => setPriority(e.target.value)}
            error={errors.priority}
          />
        </div>

        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <Select
            label={t('notificationsComponent.recipientLabel')}
            required
            options={[
              { value: 'employee', label: t('notificationsComponent.recipientTypeSingle') },
              { value: 'all',      label: t('notificationsComponent.recipientTypeAll') },
              { value: 'admin',    label: t('notificationsComponent.recipientTypeAdmin') },
            ]}
            value={recipientType}
            onChange={(e) => {
              setRecipientType(e.target.value)
              setRecipientId('')
            }}
          />
          {recipientType === 'employee' && (
            <Select
              label={t('notificationsComponent.selectEmployee')}
              required
              options={recipientSelectOptions}
              value={recipientId}
              onChange={(e) => setRecipientId(e.target.value)}
              error={errors.recipientId}
              placeholder={t('notificationsComponent.selectEmployeePlaceholder')}
            />
          )}
        </div>

        {recipientType === 'all' && (
          <p className="rounded-md bg-info-50 px-3 py-2 text-xs text-info-600">
            {t('notificationsComponent.broadcastNote')}
          </p>
        )}
      </form>
    </Modal>
  )
}
