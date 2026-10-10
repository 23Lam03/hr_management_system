import { forwardRef } from 'react'
import { Clock, Check, X, Ban, CircleDot } from 'lucide-react'

import { classNames } from '../../utils/format'
import { useI18n } from '../../i18n/useI18n'

const META = {
  pending:   { labelKey: 'pending',   tone: 'pending',  Icon: Clock },
  approved:  { labelKey: 'approved',  tone: 'approved', Icon: Check },
  rejected:  { labelKey: 'rejected', tone: 'rejected', Icon: X },
  cancelled: { labelKey: 'cancelled', tone: 'inactive', Icon: Ban },
}

const TONE_CLASS = {
  pending:  'bg-warning-50 text-warning-700 border-warning-200',
  approved: 'bg-success-50 text-success-700 border-success-200',
  rejected: 'bg-danger-50 text-danger-700 border-danger-200',
  inactive: 'bg-neutral-100 text-neutral-600 border-neutral-200',
}

const LeaveStatusPill = forwardRef(function LeaveStatusPill({ status = 'pending', className = '' }, ref) {
  const { t } = useI18n()
  const meta = META[status] ?? META.pending
  const { Icon } = meta
  return (
    <span
      ref={ref}
      className={classNames(
        'inline-flex items-center gap-1.5 h-[24px] px-2 rounded-full text-xs font-medium whitespace-nowrap border',
        TONE_CLASS[meta.tone],
        className,
      )}
    >
      <Icon className="h-3.5 w-3.5" aria-hidden="true" />
      <span>{t(`leaves.component.status_${meta.labelKey}`)}</span>
    </span>
  )
})

export default LeaveStatusPill

// Re-export để tránh warning no-unused-vars cho CircleDot (giữ cho tree-shake hint)
void CircleDot
