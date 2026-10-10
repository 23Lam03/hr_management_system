import { forwardRef } from 'react'
import { CheckCircle2, Clock, ListPlus, Ban } from 'lucide-react'

import { classNames } from '../../utils/format'
import { useI18n } from '../../i18n/useI18n'

const META_KEYS = {
  registered: 'participantStatusRegistered',
  confirmed:  'participantStatusConfirmed',
  waitlisted: 'participantStatusWaitlisted',
  cancelled:  'participantStatusCancelled',
}

const TONE_CLASS = {
  warning:  'bg-warning-50 text-warning-700 border-warning-200',
  brand:    'bg-brand-50 text-brand-700 border-brand-200',
  neutral:  'bg-neutral-100 text-neutral-600 border-neutral-200',
  pending:  'bg-neutral-100 text-neutral-600 border-neutral-200',
}

const ICONS = { CheckCircle2, Clock, ListPlus, Ban }

const ParticipantStatusPill = forwardRef(function ParticipantStatusPill(
  { status = 'registered', className = '' },
  ref,
) {
  const { t } = useI18n()
  const meta = META_KEYS[status] ?? META_KEYS.registered
  const iconKey = { registered: 'Clock', confirmed: 'CheckCircle2', waitlisted: 'ListPlus', cancelled: 'Ban' }[status] ?? 'Clock'
  const Icon = ICONS[iconKey]

  const toneMap = { registered: 'pending', confirmed: 'brand', waitlisted: 'warning', cancelled: 'neutral' }
  const tone = toneMap[status] ?? 'pending'

  return (
    <span
      ref={ref}
      className={classNames(
        'inline-flex items-center gap-1.5 h-[24px] px-2 rounded-full text-xs font-medium whitespace-nowrap border',
        TONE_CLASS[tone],
        className,
      )}
    >
      <Icon className="h-3.5 w-3.5" aria-hidden="true" />
      <span>{t(`trainings.${meta}`)}</span>
    </span>
  )
})

export default ParticipantStatusPill
