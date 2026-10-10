import { forwardRef } from 'react'
import { FileEdit, Check, Pause, Ban } from 'lucide-react'

import { classNames } from '../../utils/format'
import { useI18n } from '../../i18n/useI18n'

const META = {
  draft:   { labelKey: 'status_draft',   tone: 'inactive', Icon: FileEdit },
  active:  { labelKey: 'status_active',  tone: 'success',  Icon: Check },
  paused:  { labelKey: 'status_paused',  tone: 'warning',  Icon: Pause },
  expired: { labelKey: 'status_expired', tone: 'neutral',  Icon: Ban },
}

const TONE_CLASS = {
  warning:  'bg-warning-50 text-warning-700 border-warning-200',
  success:  'bg-success-50 text-success-700 border-success-200',
  neutral:  'bg-neutral-100 text-neutral-600 border-neutral-200',
  inactive: 'bg-neutral-100 text-neutral-600 border-neutral-200',
}

const BenefitStatusPill = forwardRef(function BenefitStatusPill(
  { status = 'draft', className = '' },
  ref,
) {
  const { t } = useI18n()
  const meta = META[status] ?? META.draft
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
      <span>{t(`benefitsComponent.${meta.labelKey}`)}</span>
    </span>
  )
})

export default BenefitStatusPill
