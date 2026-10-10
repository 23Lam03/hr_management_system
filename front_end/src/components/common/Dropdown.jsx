import { useState } from 'react'
import { ChevronDown } from 'lucide-react'

import { useClickOutside } from '../../hooks/useClickOutside'
import { useEscapeKey } from '../../hooks/useEscapeKey'
import { classNames } from '../../utils/format'

/**
 * Dropdown - headless-style trigger + panel.
 *
 * Props:
 * - trigger: ReactNode OR (open, toggle) => ReactNode (for custom triggers)
 * - children: panel content
 * - align: 'left' | 'right' (default 'right')
 * - panelClassName: extra classes for the panel
 */
export default function Dropdown({
  trigger,
  children,
  align = 'right',
  panelClassName = '',
  className = '',
}) {
  const [open, setOpen] = useState(false)
  const close = () => setOpen(false)
  const toggle = () => setOpen((p) => !p)

  const containerRef = useClickOutside(() => open && close(), open)
  useEscapeKey(close, open)

  return (
    <div ref={containerRef} className={classNames('relative inline-block', className)}>
      {typeof trigger === 'function'
        ? trigger(open, toggle)
        : (
            <button
              type="button"
              aria-haspopup="menu"
              aria-expanded={open}
              onClick={toggle}
              className="inline-flex items-center"
            >
              {trigger}
            </button>
          )}

      {open && (
        <div
          role="menu"
          className={classNames(
            'absolute z-40 mt-1 min-w-[180px] overflow-hidden rounded-lg border border-neutral-200 bg-white py-1 shadow-modal',
            align === 'right' ? 'right-0' : 'left-0',
            panelClassName,
          )}
        >
          {typeof children === 'function' ? children({ close }) : children}
        </div>
      )}
    </div>
  )
}

/**
 * DropdownItem - clickable row inside Dropdown panel.
 */
export function DropdownItem({ icon: Icon, children, onClick, danger = false, className = '' }) {
  return (
    <button
      type="button"
      role="menuitem"
      onClick={onClick}
      className={classNames(
        'flex w-full items-center gap-2 px-3 py-2 text-sm transition',
        danger
          ? 'text-danger-600 hover:bg-danger-50'
          : 'text-neutral-700 hover:bg-neutral-100',
        className,
      )}
    >
      {Icon && <Icon className="h-4 w-4 flex-shrink-0" aria-hidden="true" />}
      <span className="truncate">{children}</span>
    </button>
  )
}

export function DropdownDivider() {
  return <div role="separator" className="my-1 border-t border-neutral-200" />
}

export function DropdownLabel({ children }) {
  return (
    <p className="px-3 pb-1 pt-2 text-xs font-medium uppercase text-neutral-500">
      {children}
    </p>
  )
}

/* ---------- Convenience: chevron trigger used by TopBar ---------- */
export function DropdownTrigger({ icon: Icon, label }) {
  return (
    <span className="inline-flex items-center gap-1.5 rounded-md px-2 py-1 text-sm text-neutral-700 hover:bg-neutral-100">
      {Icon && <Icon className="h-4 w-4" aria-hidden="true" />}
      {label && <span className="truncate">{label}</span>}
      <ChevronDown className="h-3.5 w-3.5 text-neutral-400" aria-hidden="true" />
    </span>
  )
}