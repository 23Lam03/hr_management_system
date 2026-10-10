import { useI18n } from '../../i18n/useI18n'
import Badge from '../common/Badge'
import { getSupportPriorityLabel, getSupportPriorityTone } from '../../services/supportService'

export default function SupportPriorityBadge({ priority, className = '' }) {
  const { t } = useI18n()
  const tone = getSupportPriorityTone(priority)
  const labelMap = {
    low:    t('support.component.priorityLow'),
    normal: t('support.component.priorityNormal'),
    high:   t('support.component.priorityHigh'),
  }
  return (
    <Badge tone={tone} className={className}>
      {labelMap[priority] ?? getSupportPriorityLabel(priority)}
    </Badge>
  )
}