import { CalendarDays, Play, Check, Clock, BarChart3 } from 'lucide-react'

import { classNames, formatNumber } from '../../utils/format'
import { useI18n } from '../../i18n/useI18n'

const TONE = {
  primary: 'bg-brand-50 text-brand-700',
  warning: 'bg-warning-50 text-warning-600',
  success: 'bg-success-50 text-success-600',
  neutral: 'bg-neutral-100 text-neutral-600',
}

const META_KEYS = ['totalCycles', 'inProgress', 'completedStat', 'upcoming', 'publishedCount']

export default function EvaluationStatTiles({ summary }) {
  const { t } = useI18n()
  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-5">
      {META_KEYS.map((k, i) => {
        const keys = ['totalCycles', 'inProgress', 'completedStat', 'upcoming', 'publishedCount']
        const subKeys = ['allCyclesCreated', 'beingDeployed', 'closedOrCompleted', 'draftOrUpcoming', 'totalPublishedRecords']
        const valueMap = { totalCycles: summary?.total, inProgress: summary?.inProgress, completedStat: summary?.completed, upcoming: summary?.upcoming, publishedCount: summary?.published }
        const value = valueMap[k] ?? 0
        const toneKeys = ['primary', 'warning', 'success', 'neutral', 'primary']
        const Icon = [CalendarDays, Play, Check, Clock, BarChart3][i]
        return (
          <div
            key={k}
            className="flex min-h-[112px] flex-col gap-3 rounded-lg border border-neutral-200 bg-white p-5 shadow-card"
          >
            <div className="flex items-start justify-between gap-3">
              <span className="text-[13px] font-medium text-neutral-500">{t(`evaluations.${k}`)}</span>
              <span
                className={classNames(
                  'inline-flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-md',
                  TONE[toneKeys[i]],
                )}
              >
                <Icon className="h-[18px] w-[18px]" aria-hidden="true" />
              </span>
            </div>
            <div className="text-[28px] font-bold leading-tight text-neutral-900">{formatNumber(value)}</div>
            <div className="text-xs text-neutral-500">{t(`evaluations.${subKeys[i]}`)}</div>
          </div>
        )
      })}
    </div>
  )
}
