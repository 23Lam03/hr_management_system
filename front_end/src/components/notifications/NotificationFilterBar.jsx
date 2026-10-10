import { Search, X } from 'lucide-react'

import Input from '../common/Input'
import Select from '../common/Select'
import Button from '../common/Button'
import { classNames } from '../../utils/format'
import { useI18n } from '../../i18n/useI18n'

const TYPE_OPTIONS = [
  { value: '',          label: 'Tất cả loại' },
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
  { value: '',       label: 'Tất cả mức độ' },
  { value: 'low',    label: 'Thấp' },
  { value: 'normal', label: 'Bình thường' },
  { value: 'high',   label: 'Cao' },
]

const STATUS_OPTIONS = [
  { value: '',         label: 'Tất cả trạng thái' },
  { value: 'unread', label: 'Chưa đọc' },
  { value: 'read',  label: 'Đã đọc' },
]

export default function NotificationFilterBar({
  search,
  type,
  priority,
  isRead,
  recipientId,
  recipientOptions = [],
  onChange,
  onReset,
  className = '',
}) {
  const { t } = useI18n()
  const handle = (field) => (value) => onChange?.({ [field]: value })

  const hasFilter =
    Boolean(search) ||
    Boolean(type) ||
    Boolean(priority) ||
    Boolean(isRead) ||
    Boolean(recipientId)

  const recipientSelectOptions = [
    { value: '', label: t('notificationsComponent.allRecipients') },
    ...recipientOptions.map((r) => ({ value: r.id, label: r.label })),
  ]

  const resolvedTypeOptions = TYPE_OPTIONS.map(o => ({
    ...o,
    label: o.value === '' ? t('notificationsComponent.allTypes') : o.label,
  }))
  const resolvedPriorityOptions = PRIORITY_OPTIONS.map(o => ({
    ...o,
    label: o.value === '' ? t('notificationsComponent.allPriorities') : o.label,
  }))
  const resolvedStatusOptions = STATUS_OPTIONS.map(o => ({
    ...o,
    label: o.value === '' ? t('notificationsComponent.allStatuses') : (o.value === 'unread' ? t('notificationsComponent.unreadOnly') : t('notificationsComponent.read')),
  }))

  return (
    <div
      className={classNames(
        'flex flex-col gap-3 rounded-lg border border-neutral-200 bg-white p-4 shadow-card',
        className,
      )}
    >
      <div className="grid grid-cols-1 gap-3 md:grid-cols-12">
        <div className="md:col-span-5">
          <Input
            placeholder={t('notificationsComponent.searchPlaceholder')}
            value={search ?? ''}
            onChange={(e) => handle('search')(e.target.value)}
            leftIcon={Search}
          />
        </div>
        <div className="md:col-span-3">
          <Select
            options={resolvedTypeOptions}
            value={type ?? ''}
            onChange={(e) => handle('type')(e.target.value)}
          />
        </div>
        <div className="md:col-span-2">
          <Select
            options={resolvedPriorityOptions}
            value={priority ?? ''}
            onChange={(e) => handle('priority')(e.target.value)}
          />
        </div>
        <div className="md:col-span-2">
          <Select
            options={resolvedStatusOptions}
            value={isRead ?? ''}
            onChange={(e) => handle('isRead')(e.target.value)}
          />
        </div>
      </div>

      {recipientOptions.length > 0 && (
        <div className="grid grid-cols-1 gap-3 md:grid-cols-12">
          <div className="md:col-span-5">
            <Select
              options={recipientSelectOptions}
              value={recipientId ?? ''}
              onChange={(e) => handle('recipientId')(e.target.value)}
            />
          </div>
          <div className="md:col-span-2">
            <Button
              variant="outline"
              size="md"
              icon={X}
              onClick={onReset}
              disabled={!hasFilter}
              fullWidth
            >
              {t('notificationsComponent.reset')}
            </Button>
          </div>
        </div>
      )}
    </div>
  )
}
