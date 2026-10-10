import { forwardRef } from 'react'
import { CirclePlay, Play, Check, X } from 'lucide-react'

import { classNames } from '../../utils/format'
import { useI18n } from '../../i18n/useI18n'

const META_KEYS = {
  not_started: 'learningStatusNotStarted',
  in_progress: 'learningStatusInProgress',
  completed:   'learningStatusCompleted',
  failed:      'learningStatusFailed',
}

const TONE_CLASS = {
  warning:  'bg-warning-50 text-warning-700 border-warning-200',
  success:  'bg-success-50 text-success-700 border-success-200',
  danger:   'bg-danger-50 text-danger-700 border-danger-200',
  inactive: 'bg-neutral-100 text-neutral-600 border-neutral-200',
}

const ICONS = { CirclePlay, Play, Check, X }

const LearningStatusPill = forwardRef(function LearningStatusPill(
  { status = 'not_started', className = '' },
  ref,
) {
  const { t } = useI18n()
  const meta = META_KEYS[status] ?? META_KEYS.not_started
  const iconKey = { not_started: 'CirclePlay', in_progress: 'Play', completed: 'Check', failed: 'X' }[status] ?? 'CirclePlay'
  const Icon = ICONS[iconKey]

  const toneMap = { not_started: 'inactive', in_progress: 'warning', completed: 'success', failed: 'danger' }
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

export default LearningStatusPill
