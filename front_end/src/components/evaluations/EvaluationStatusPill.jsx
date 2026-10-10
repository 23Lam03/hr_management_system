import { forwardRef } from 'react'
import { Clock, FileEdit, Play, Check, Eye, X } from 'lucide-react'

import { classNames } from '../../utils/format'
import { useI18n } from '../../i18n/useI18n'

const META_KEYS = {
  pending:    'evalStatusPending',
  draft:      'evalStatusDraft',
  in_progress:'evalStatusInProgress',
  completed:  'evalStatusCompleted',
  published:  'evalStatusPublished',
  rejected:   'evalStatusRejected',
}

const TONE_CLASS = {
  pending:  'bg-neutral-100 text-neutral-600 border-neutral-200',
  warning:  'bg-warning-50 text-warning-700 border-warning-200',
  success:  'bg-success-50 text-success-700 border-success-200',
  inactive: 'bg-neutral-100 text-neutral-600 border-neutral-200',
  brand:    'bg-brand-50 text-brand-700 border-brand-200',
  danger:   'bg-danger-50 text-danger-700 border-danger-200',
}

const ICONS = { Clock, FileEdit, Play, Check, Eye, X }

const EvaluationStatusPill = forwardRef(function EvaluationStatusPill(
  { status = 'pending', className = '' },
  ref,
) {
  const { t } = useI18n()
  const meta = META_KEYS[status] ?? META_KEYS.pending
  const iconKey = { pending: 'Clock', draft: 'FileEdit', in_progress: 'Play', completed: 'Check', published: 'Eye', rejected: 'X' }[status] ?? 'Clock'
  const Icon = ICONS[iconKey]

  const toneMap = {
    pending: 'inactive', draft: 'pending', in_progress: 'warning',
    completed: 'success', published: 'brand', rejected: 'danger',
  }
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

export default EvaluationStatusPill
