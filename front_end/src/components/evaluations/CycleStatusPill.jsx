import { forwardRef } from 'react'
import { FileEdit, Clock, Play, Check, Archive } from 'lucide-react'

import { classNames } from '../../utils/format'
import { useI18n } from '../../i18n/useI18n'

const META_KEYS = {
  draft:      'cycleStatusDraft',
  upcoming:   'cycleStatusUpcoming',
  in_progress:'cycleStatusInProgress',
  completed:  'cycleStatusCompleted',
  closed:     'cycleStatusClosed',
}

const TONE_CLASS = {
  pending:  'bg-warning-50 text-warning-700 border-warning-200',
  warning:  'bg-warning-50 text-warning-700 border-warning-200',
  success:  'bg-success-50 text-success-700 border-success-200',
  inactive: 'bg-neutral-100 text-neutral-600 border-neutral-200',
  neutral:  'bg-neutral-100 text-neutral-600 border-neutral-200',
}

const ICONS = { FileEdit, Clock, Play, Check, Archive }

const CycleStatusPill = forwardRef(function CycleStatusPill(
  { status = 'draft', className = '' },
  ref,
) {
  const { t } = useI18n()
  const meta = META_KEYS[status] ?? META_KEYS.draft
  const iconKey = { draft: 'FileEdit', upcoming: 'Clock', in_progress: 'Play', completed: 'Check', closed: 'Archive' }[status] ?? 'FileEdit'
  const Icon = ICONS[iconKey]

  const toneMap = { draft: 'inactive', upcoming: 'pending', in_progress: 'warning', completed: 'success', closed: 'neutral' }
  const tone = toneMap[status] ?? 'inactive'

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
      <span>{t(`evaluations.${meta}`)}</span>
    </span>
  )
})

export default CycleStatusPill
