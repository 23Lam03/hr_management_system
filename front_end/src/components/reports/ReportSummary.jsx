import { classNames } from '../../utils/format'

/**
 * ReportSummary - bảng tóm tắt số liệu tổng hợp.
 *
 * Props:
 * - items: [{ label, value, tone?, sub? }]
 */
export default function ReportSummary({ items = [], columns = 4, className = '' }) {
  const gridCols = {
    2: 'grid-cols-1 md:grid-cols-2',
    3: 'grid-cols-1 md:grid-cols-3',
    4: 'grid-cols-1 md:grid-cols-2 xl:grid-cols-4',
  }
  return (
    <div className={classNames('grid gap-3', gridCols[columns] ?? gridCols[4], className)}>
      {items.map((it) => (
        <div
          key={it.label}
          className="flex items-center justify-between gap-3 rounded-md border border-neutral-200 bg-white p-4 shadow-card"
        >
          <div className="min-w-0">
            <p className="text-xs text-neutral-500">{it.label}</p>
            <p className="mt-1 text-xl font-semibold text-neutral-900">{it.value}</p>
            {it.sub && <p className="mt-0.5 text-[11px] text-neutral-400">{it.sub}</p>}
          </div>
          {it.Icon && (
            <span
              className={classNames(
                'inline-flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-md',
                it.toneClass ?? 'bg-brand-50 text-brand-600',
              )}
            >
              <it.Icon className="h-4 w-4" aria-hidden="true" />
            </span>
          )}
        </div>
      ))}
    </div>
  )
}