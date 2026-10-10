import {
  ArrowDown01,
  ArrowDown10,
  ArrowDownAZ,
  ArrowDownZA,
  ArrowUpDown,
} from 'lucide-react'
import { useI18n } from '../../i18n/useI18n'

import { classNames } from '../../utils/format'

const ICONS = {
  asc:  { name: ArrowDownAZ,    numeric: ArrowDown01 },
  desc: { name: ArrowDownZA,    numeric: ArrowDown10 },
  none: ArrowUpDown,
}

/**
 * SortableTh - thẻ <th> có thể click để sắp xếp.
 *
 * Props:
 * - field: key sắp xếp
 * - currentField / currentDir: state hiện tại
 * - onSort(field): callback
 * - children: nội dung header
 */
export default function SortableTh({
  field,
  currentField,
  currentDir,
  onSort,
  align = 'left',
  className = '',
  numeric = false,
  children,
}) {
  const { t } = useI18n()
  const isActive = field === currentField
  const Icon = isActive
    ? (currentDir === 'asc' ? ICONS.asc : ICONS.desc)[numeric ? 'numeric' : 'name']
    : ICONS.none

  const handleClick = () => onSort(field)

  return (
    <th
      scope="col"
      style={{ textAlign: align }}
      className={classNames(
        'border-b border-neutral-200 bg-neutral-50 px-4 py-3 text-xs font-semibold uppercase tracking-wider text-neutral-500 whitespace-nowrap',
        className,
      )}
    >
      <button
        type="button"
        onClick={handleClick}
        className={classNames(
          'inline-flex items-center gap-1 rounded transition',
          isActive ? 'text-neutral-900' : 'text-neutral-500 hover:text-neutral-700',
          align === 'right' && 'flex-row-reverse',
        )}
        aria-label={t('employees.component.sortBy', { n: children })}
      >
        <span>{children}</span>
        <Icon className="h-3.5 w-3.5" aria-hidden="true" />
      </button>
    </th>
  )
}