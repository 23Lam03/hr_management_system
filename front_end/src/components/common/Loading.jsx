import { Loader2 } from 'lucide-react'

import { classNames } from '../../utils/format'

const SIZE = {
  sm: 'h-4 w-4 border-2',
  md: 'h-6 w-6 border-2',
  lg: 'h-10 w-10 border-[3px]',
}

/**
 * Loading - spinner with optional label.
 */
export default function Loading({ size = 'md', label, className = '' }) {
  return (
    <div
      role="status"
      aria-live="polite"
      className={classNames('inline-flex items-center gap-2 text-neutral-500', className)}
    >
      <Loader2
        className={classNames(
          'animate-spin rounded-full border-current border-r-transparent',
          SIZE[size] ?? SIZE.md,
        )}
        aria-hidden="true"
      />
      {label && <span className="text-sm">{label}</span>}
    </div>
  )
}

/** Inline button loading indicator (kept here for reuse). */
export function Spinner({ className = '' }) {
  return (
    <span
      className={classNames(
        'inline-block h-3.5 w-3.5 rounded-full border-2 border-current border-r-transparent animate-spin',
        className,
      )}
      aria-hidden="true"
    />
  )
}