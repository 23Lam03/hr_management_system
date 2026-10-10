import {
  Tag,
  Clock4,
  CalendarCheck2,
  Wallet,
  Gift,
  FileSignature,
  GraduationCap,
  LineChart,
  Wrench,
  HelpCircle,
} from 'lucide-react'

import { useI18n } from '../../i18n/useI18n'
import Badge from '../common/Badge'

const CATEGORY_META = {
  account:    { icon: Tag,           tone: 'neutral' },
  attendance: { icon: Clock4,        tone: 'info' },
  leave:      { icon: CalendarCheck2, tone: 'info' },
  payroll:    { icon: Wallet,        tone: 'primary' },
  benefit:    { icon: Gift,          tone: 'info' },
  contract:   { icon: FileSignature,  tone: 'neutral' },
  training:   { icon: GraduationCap,  tone: 'success' },
  evaluation: { icon: LineChart,      tone: 'warning' },
  technical:  { icon: Wrench,         tone: 'danger' },
  other:      { icon: HelpCircle,     tone: 'neutral' },
}

const LABEL_KEYS = {
  account:    'support.component.categoryAccount',
  attendance: 'support.component.categoryAttendance',
  leave:      'support.component.categoryLeave',
  payroll:    'support.component.categoryPayroll',
  benefit:    'support.component.categoryBenefit',
  contract:   'support.component.categoryContract',
  training:   'support.component.categoryTraining',
  evaluation: 'support.component.categoryEvaluation',
  technical:  'support.component.categoryTechnical',
  other:      'support.component.categoryOther',
}

export default function SupportCategoryBadge({ category, withIcon = true, className = '' }) {
  const { t } = useI18n()
  const meta = CATEGORY_META[category] ?? CATEGORY_META.other
  const Icon = meta.icon
  return (
    <Badge tone={meta.tone} className={className}>
      {withIcon && <Icon className="h-3.5 w-3.5" aria-hidden="true" />}
      <span>{t(LABEL_KEYS[category] ?? 'support.component.categoryOther')}</span>
    </Badge>
  )
}