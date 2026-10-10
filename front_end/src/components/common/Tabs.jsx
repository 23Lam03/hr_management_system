import { useState, useEffect } from 'react'

import { classNames } from '../../utils/format'

/**
 * Tabs - simple controlled/uncontrolled tab strip + panel renderer.
 *
 * Props:
 * - items: [{ id, label, icon?, badge?, panel: ReactNode }]
 * - value / onChange (controlled) | defaultValue / onValueChange (uncontrolled)
 * - variant: 'underline' (default) | 'pills'
 * - size: 'sm' | 'md'
 */
export default function Tabs({
  items = [],
  value,
  onChange,
  defaultValue,
  className = '',
  variant = 'underline',
  size = 'md',
}) {
  const isControlled = value !== undefined
  const [internal, setInternal] = useState(defaultValue ?? items[0]?.id)

  useEffect(() => {
    if (!isControlled) {
      // keep internal in sync if items change
      if (!items.some((it) => it.id === internal) && items[0]) {
        setInternal(items[0].id)
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [items])

  const current = isControlled
    ? (value ?? items[0]?.id)
    : internal

  const handleSelect = (id) => {
    if (!isControlled) setInternal(id)
    onChange?.(id)
  }

  const activeItem = items.find((it) => it.id === current) ?? items[0]

  const sizeClasses = size === 'sm' ? 'text-xs px-3 py-1.5' : 'text-sm px-4 py-2'

  const isPills = variant === 'pills'

  return (
    <div className={classNames('flex flex-col gap-4', className)}>
      <div
        role="tablist"
        aria-label="tabs"
        className={classNames(
          'flex flex-wrap gap-1',
          isPills
            ? 'rounded-md border border-neutral-200 bg-white p-1 shadow-card'
            : 'border-b border-neutral-200',
        )}
      >
        {items.map((item) => {
          const active = item.id === current
          const Icon = item.icon
          return (
            <button
              key={item.id}
              type="button"
              role="tab"
              aria-selected={active}
              aria-controls={`tab-panel-${item.id}`}
              id={`tab-${item.id}`}
              onClick={() => handleSelect(item.id)}
              className={classNames(
                'inline-flex items-center gap-2 font-medium',
                sizeClasses,
                isPills
                  ? active
                    ? 'rounded-md bg-brand-600 text-white'
                    : 'rounded-md text-neutral-600 hover:bg-neutral-100'
                  : active
                    ? '-mb-px border-b-2 border-brand-600 text-brand-700'
                    : 'border-b-2 border-transparent text-neutral-600 hover:text-neutral-900',
                'focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-600/40',
              )}
            >
              {Icon && <Icon className="h-4 w-4" aria-hidden="true" />}
              <span>{item.label}</span>
              {item.badge !== undefined && item.badge !== null && (
                <span
                  className={classNames(
                    'inline-flex items-center justify-center rounded-full px-2 py-0.5 text-[11px] font-semibold',
                    active
                      ? isPills ? 'bg-white/20 text-white' : 'bg-brand-50 text-brand-700'
                      : 'bg-neutral-100 text-neutral-600',
                  )}
                >
                  {item.badge}
                </span>
              )}
            </button>
          )
        })}
      </div>
      {activeItem && (
        <div
          role="tabpanel"
          id={`tab-panel-${activeItem.id}`}
          aria-labelledby={`tab-${activeItem.id}`}
        >
          {activeItem.panel}
        </div>
      )}
    </div>
  )
}