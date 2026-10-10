import { forwardRef } from 'react'
import { FileEdit, Clock, Check, X, Ban, FileText } from 'lucide-react'

import { classNames } from '../../utils/format'
import { useI18n } from '../../i18n/useI18n'

const META_KEYS = {
  draft:      'contractStatusDraft',
  pending:    'contractStatusPending',
  active:     'contractStatusActive',
  expired:    'contractStatusExpired',
  terminated: 'contractStatusTerminated',
  cancelled:  'contractStatusCancelled',
}

const TONE_CLASS = {
  warning:  'bg-warning-50 text-warning-700 border-warning-200',
  success:  'bg-success-50 text-success-700 border-success-200',
  danger:   'bg-danger-50 text-danger-700 border-danger-200',
  neutral:  'bg-neutral-100 text-neutral-600 border-neutral-200',
  inactive: 'bg-neutral-100 text-neutral-600 border-neutral-200',
  pending:  'bg-neutral-100 text-neutral-600 border-neutral-200',
}

const ICONS = { FileEdit, Clock, Check, X, Ban, FileText }

const ContractStatusPill = forwardRef(function ContractStatusPill(
  { status = 'draft', className = '' },
  ref,
) {
  const { t } = useI18n()
  const meta = META_KEYS[status] ?? META_KEYS.draft
  const iconKey = { draft: 'FileEdit', pending: 'Clock', active: 'Check', expired: 'FileText', terminated: 'Ban', cancelled: 'X' }[status] ?? 'FileEdit'
  const Icon = ICONS[iconKey]

  const toneMap = { draft: 'inactive', pending: 'pending', active: 'success', expired: 'neutral', terminated: 'danger', cancelled: 'neutral' }
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
      <span>{t(`contracts.${meta}`)}</span>
    </span>
  )
})

export default ContractStatusPill
