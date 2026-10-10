import { classNames } from '../../utils/format'

/**
 * Tone variants tailored to HRM status semantics:
 * - active/inactive/pending/approved/rejected/warning + neutral/primary/info
 */
const TONE = {
  neutral:   'bg-neutral-100 text-neutral-700',
  primary:   'bg-brand-50 text-brand-700',
  success:   'bg-success-50 text-success-600',
  warning:   'bg-warning-50 text-warning-600',
  danger:    'bg-danger-50 text-danger-600',
  info:      'bg-info-50 text-info-600',

  active:    'bg-success-50 text-success-600',
  inactive:  'bg-neutral-100 text-neutral-600',
  pending:   'bg-warning-50 text-warning-600',
  approved:  'bg-success-50 text-success-600',
  rejected:  'bg-danger-50 text-danger-600',
}

export default function Badge({ children, tone = 'neutral', className = '' }) {
  return (
    <span
      className={classNames(
        'inline-flex items-center h-[22px] px-2 rounded-full text-xs font-medium leading-none whitespace-nowrap',
        TONE[tone] ?? TONE.neutral,
        className,
      )}
    >
      {children}
    </span>
  )
}