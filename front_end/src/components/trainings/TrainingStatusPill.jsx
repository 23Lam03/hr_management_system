import { forwardRef } from 'react'
import { FileEdit, Clock, Play, Check, Ban } from 'lucide-react'

import { classNames } from '../../utils/format'
import { useI18n } from '../../i18n/useI18n'

const META_KEYS = {
  draft:      'trainingStatusDraft',
  open:       'trainingStatusOpen',
  in_progress:'trainingStatusInProgress',
  completed:  'trainingStatusCompleted',
  cancelled:  'trainingStatusCancelled',
}

const TONE_CLASS = {
  pending:  'bg-warning-50 text-warning-700 border-warning-200',
  warning:  'bg-warning-50 text-warning-700 border-warning-200',
  success:  'bg-success-50 text-success-700 border-success-200',
  inactive: 'bg-neutral-100 text-neutral-600 border-neutral-200',
  neutral:  'bg-neutral-100 text-neutral-600 border-neutral-200',
}

const ICONS = { FileEdit, Clock, Play, Check, Ban }

const TrainingStatusPill = forwardRef(function TrainingStatusPill(
  { status = 'draft', className = '' },
  ref,
) {
  const { t } = useI18n()
  const meta = META_KEYS[status] ?? META_KEYS.draft
  const iconKey = { draft: 'FileEdit', open: 'Clock', in_progress: 'Play', completed: 'Check', cancelled: 'Ban' }[status] ?? 'FileEdit'
  const Icon = ICONS[iconKey]

  const toneMap = { draft: 'inactive', open: 'pending', in_progress: 'warning', completed: 'success', cancelled: 'neutral' }
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
      <span>{t(`trainings.${meta}`)}</span>
    </span>
  )
})

export default TrainingStatusPill
