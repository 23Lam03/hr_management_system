import { Link } from 'react-router-dom'
import { ChevronRight } from 'lucide-react'

import { classNames } from '../../utils/format'

/**
 * Breadcrumb - items: [{ label, to? }]
 */
export default function Breadcrumb({ items = [], separator, className = '' }) {
  return (
    <nav aria-label="Breadcrumb" className={classNames('flex items-center', className)}>
      <ol className="flex flex-wrap items-center gap-1 text-[13px] text-neutral-500">
        {items.map((item, index) => {
          const isLast = index === items.length - 1
          return (
            <li key={`${item.label}-${index}`} className="flex items-center gap-1">
              {item.to && !isLast ? (
                <Link
                  to={item.to}
                  className="rounded px-1 hover:text-brand-600"
                >
                  {item.label}
                </Link>
              ) : (
                <span className={classNames('px-1', isLast && 'font-medium text-neutral-900')}>
                  {item.label}
                </span>
              )}
              {!isLast && (
                separator || (
                  <ChevronRight
                    className="h-3.5 w-3.5 text-neutral-400"
                    aria-hidden="true"
                  />
                )
              )}
            </li>
          )
        })}
      </ol>
    </nav>
  )
}