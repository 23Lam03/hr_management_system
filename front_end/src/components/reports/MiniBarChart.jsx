import { useI18n } from '../../i18n/useI18n'
import { classNames } from '../../utils/format'

/**
 * MiniBarChart - danh sách bar đơn giản dựng bằng CSS/Tailwind.
 *
 * Props:
 * - data: [{ label, value, secondary? }]
 * - maxValue?: auto compute từ data
 * - emptyText: string (should be pre-translated by parent via t(...))
 */
export default function MiniBarChart({ data = [], maxValue, className = '', emptyText }) {
  const { t } = useI18n()
  const empty = emptyText ?? t('reports.component.noDataToDisplay')
  if (!data.length) {
    return (
      <div className={classNames('rounded-md border border-dashed border-neutral-200 bg-neutral-50 px-4 py-6 text-center text-sm text-neutral-500', className)}>
        {empty}
      </div>
    )
  }
  const computedMax = maxValue ?? Math.max(1, ...data.map((d) => d.value || 0))
  return (
    <div className={classNames('flex flex-col gap-2', className)}>
      {data.map((d, idx) => {
        const pct = computedMax > 0 ? Math.round((d.value / computedMax) * 100) : 0
        return (
          <div key={`${d.label}-${idx}`} className="flex items-center gap-3">
            <div className="w-28 flex-shrink-0 text-xs text-neutral-600 truncate">{d.label}</div>
            <div className="relative flex-1 h-3 overflow-hidden rounded-full bg-neutral-100">
              <div
                className="h-full bg-brand-500"
                style={{ width: `${pct}%` }}
                aria-hidden="true"
              />
              {d.secondary && (
                <div
                  className="absolute top-0 h-full bg-warning-400/70"
                  style={{ width: `${Math.max(0, Math.min(100, Math.round((d.secondary / computedMax) * 100)))}%` }}
                  aria-hidden="true"
                />
              )}
            </div>
            <div className="w-12 flex-shrink-0 text-right text-xs font-medium text-neutral-700">{d.value}</div>
          </div>
        )
      })}
    </div>
  )
}
