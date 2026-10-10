import {
  Bell,
  CalendarCheck2,
  CircleDollarSign,
  LineChart,
  GraduationCap,
  HeartHandshake,
  FileSignature,
  Clock4,
} from 'lucide-react'

import { useI18n } from '../../i18n/useI18n'
import Badge from '../common/Badge'
import { classNames } from '../../utils/format'

const TYPE_META = {
  system:     { icon: Bell,             tone: 'neutral' },
  leave:      { icon: CalendarCheck2,   tone: 'info' },
  payroll:    { icon: CircleDollarSign, tone: 'primary' },
  evaluation: { icon: LineChart,        tone: 'warning' },
  training:   { icon: GraduationCap,    tone: 'success' },
  benefit:    { icon: HeartHandshake,   tone: 'info' },
  contract:   { icon: FileSignature,    tone: 'neutral' },
  attendance: { icon: Clock4,           tone: 'primary' },
}

const LABEL_KEYS = {
  system:     'notifications.component.notificationTypeSystem',
  leave:      'notifications.component.notificationTypeLeave',
  payroll:    'notifications.component.notificationTypePayroll',
  evaluation: 'notifications.component.notificationTypeEvaluation',
  training:   'notifications.component.notificationTypeTraining',
  benefit:    'notifications.component.notificationTypeBenefit',
  contract:   'notifications.component.notificationTypeContract',
  attendance: 'notifications.component.notificationTypeAttendance',
}

export default function NotificationTypeBadge({ type, withIcon = true, className = '' }) {
  const { t } = useI18n()
  const meta = TYPE_META[type] ?? TYPE_META.system
  const Icon = meta.icon
  return (
    <Badge tone={meta.tone} className={classNames('gap-1', className)}>
      {withIcon && <Icon className="h-3.5 w-3.5" aria-hidden="true" />}
      <span>{t(LABEL_KEYS[type] ?? 'notifications.component.notificationTypeSystem')}</span>
    </Badge>
  )
}
