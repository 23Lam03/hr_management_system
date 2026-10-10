import { useI18n } from '../../i18n/useI18n'
import Badge from '../common/Badge'
import { getSupportStatusLabel, getSupportStatusTone } from '../../services/supportService'

export default function SupportStatusBadge({ status, className = '' }) {
  const { t } = useI18n()
  const tone = getSupportStatusTone(status)
  const labelMap = {
    open:                  t('support.component.statusOpen'),
    in_progress:           t('support.component.statusInProgress'),
    waiting_for_employee:  t('support.component.statusWaitingForEmployee'),
    resolved:             t('support.component.statusResolved'),
    closed:                t('support.component.statusClosed'),
    cancelled:             t('support.component.statusCancelled'),
  }
  return (
    <Badge tone={tone} className={className}>
      {labelMap[status] ?? getSupportStatusLabel(status)}
    </Badge>
  )
}