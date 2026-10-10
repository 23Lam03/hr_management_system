import { Bell, BellOff, AlertTriangle, CalendarDays } from 'lucide-react'

import { classNames } from '../../utils/format'
import { useI18n } from '../../i18n/useI18n'

const ICON_WRAP = {
  brand:   'bg-brand-50 text-brand-600',
  warning: 'bg-warning-50 text-warning-600',
  danger:  'bg-danger-50 text-danger-600',
  info:    'bg-info-50 text-info-600',
  success: 'bg-success-50 text-success-600',
  neutral: 'bg-neutral-100 text-neutral-700',
}

export default function NotificationStatTiles({
  total = 0,
  unread = 0,
  high = 0,
  today = 0,
  className = '',
}) {
  const { t } = useI18n()

  const items = [
    {
      key: 'total',
      labelKey: 'totalNotifications',
      value: total,
      Icon: Bell,
      tone: 'brand',
    },
    {
      key: 'unread',
      labelKey: 'unread',
      value: unread,
      Icon: BellOff,
      tone: 'info',
    },
    {
      key: 'high',
      labelKey: 'highPriority',
      value: high,
      Icon: AlertTriangle,
      tone: 'danger',
    },
    {
      key: 'today',
      labelKey: 'todayNotifications',
      value: today,
      Icon: CalendarDays,
      tone: 'success',
    },
  ]

  return (
    <div
      className={classNames(
        'grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4',
        className,
      )}
    >
      {items.map(({ key, labelKey, value, Icon, tone }) => (
        <div
          key={key}
          className="flex items-center gap-3 rounded-lg border border-neutral-200 bg-white p-4 shadow-card"
        >
          <span
            className={classNames(
              'inline-flex h-10 w-10 items-center justify-center rounded-md',
              ICON_WRAP[tone] ?? ICON_WRAP.brand,
            )}
          >
            <Icon className="h-5 w-5" aria-hidden="true" />
          </span>
          <div className="min-w-0">
            <p className="text-xs text-neutral-500">{t(`notificationsComponent.${labelKey}`)}</p>
            <p className="text-2xl font-semibold text-neutral-900 leading-tight">{value}</p>
          </div>
        </div>
      ))}
    </div>
  )
}
