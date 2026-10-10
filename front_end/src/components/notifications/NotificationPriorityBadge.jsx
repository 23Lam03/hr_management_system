import { useI18n } from '../../i18n/useI18n'
import Badge from '../common/Badge'
import { getNotificationPriorityLabel } from '../../services/notificationService'
import { getNotificationPriorityTone } from '../../services/notificationService'

export default function NotificationPriorityBadge({ priority, className = '' }) {
  const { t } = useI18n()
  const tone = getNotificationPriorityTone(priority)
  const labelMap = {
    low:    t('notifications.component.notificationPriorityLow'),
    normal: t('notifications.component.notificationPriorityNormal'),
    high:   t('notifications.component.notificationPriorityHigh'),
  }
  return (
    <Badge tone={tone} className={className}>
      {labelMap[priority] ?? getNotificationPriorityLabel(priority)}
    </Badge>
  )
}
