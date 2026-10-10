import { ChevronRight, Check } from 'lucide-react'

import NotificationTypeBadge from './NotificationTypeBadge'
import NotificationPriorityBadge from './NotificationPriorityBadge'
import { classNames } from '../../utils/format'
import { formatRelativeTime } from '../../utils/notificationUtils'
import { useI18n } from '../../i18n/useI18n'

export default function NotificationItem({
  notification,
  onOpen,
  selected = false,
}) {
  const { t } = useI18n()

  if (!notification) return null
  return (
    <button
      type="button"
      onClick={() => onOpen?.(notification)}
      className={classNames(
        'flex w-full items-start gap-3 rounded-lg border px-4 py-3 text-left transition',
        'bg-white hover:bg-neutral-50',
        selected
          ? 'border-brand-300 ring-1 ring-brand-300'
          : 'border-neutral-200',
      )}
    >
      <span className="mt-1 inline-flex h-2 w-2 flex-shrink-0 rounded-full bg-brand-600"
        aria-hidden="true"
        style={{ visibility: notification.isRead ? 'hidden' : 'visible' }}
      />
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-2">
          <NotificationTypeBadge type={notification.type} />
          <NotificationPriorityBadge priority={notification.priority} />
          {notification.isRead && (
            <span className="inline-flex items-center gap-1 text-xs text-neutral-500">
              <Check className="h-3.5 w-3.5 text-success-600" aria-hidden="true" />
              {t('notificationsComponent.read')}
            </span>
          )}
        </div>
        <p
          className={classNames(
            'mt-1.5 text-sm text-neutral-900',
            notification.isRead ? 'font-normal' : 'font-semibold',
          )}
        >
          {notification.title}
        </p>
        <p className="mt-0.5 line-clamp-2 text-[13px] text-neutral-500">
          {notification.message}
        </p>
        <p className="mt-1 text-xs text-neutral-500">
          {formatRelativeTime(notification.createdAt)}
        </p>
      </div>
      <ChevronRight className="mt-1 h-4 w-4 flex-shrink-0 text-neutral-400" aria-hidden="true" />
    </button>
  )
}
