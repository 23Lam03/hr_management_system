import { CheckCircle2, XCircle } from 'lucide-react'

import { useI18n } from '../../i18n/useI18n'
import Badge from '../common/Badge'

const META = {
  success: { Icon: CheckCircle2, tone: 'success' },
  failed:  { Icon: XCircle,      tone: 'danger' },
}

export default function SecurityActivityStatusBadge({ status, withIcon = true, className = '' }) {
  const { t } = useI18n()
  const meta = META[status] ?? META.failed
  const Icon = meta.Icon
  const labelMap = { success: t('security.component.statusSuccess'), failed: t('security.component.statusFailed') }
  return (
    <Badge tone={meta.tone} className={className}>
      {withIcon && <Icon className="h-3.5 w-3.5" aria-hidden="true" />}
      <span>{labelMap[status] ?? t('security.component.statusFailed')}</span>
    </Badge>
  )
}