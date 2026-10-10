import { Gift, Check, AlertTriangle, Users } from 'lucide-react'

import { formatNumber } from '../../utils/format'
import { useI18n } from '../../i18n/useI18n'

const TONE = {
  primary: 'bg-brand-50 text-brand-700',
  warning: 'bg-warning-50 text-warning-600',
  success: 'bg-success-50 text-success-600',
  neutral: 'bg-neutral-100 text-neutral-600',
  info: 'bg-info-50 text-info-600',
}

const META = {
  total: { labelKey: 'stat_total',     icon: Gift,         tone: 'primary' },
  active:{ labelKey: 'stat_active',    icon: Check,        tone: 'success' },
  paused:{ labelKey: 'stat_paused',    icon: AlertTriangle, tone: 'warning' },
  assignees:{ labelKey: 'stat_assignees', icon: Users,      tone: 'info' },
}

export default function BenefitStatTiles({ summary }) {
  const { t } = useI18n()

  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
      {['total', 'active', 'paused', 'assignees'].map((k) => {
        const meta = META[k]
        let value = 0
        if (k === 'total') value = summary?.total ?? 0
        else if (k === 'active') value = summary?.active ?? 0
        else if (k === 'paused') value = (summary?.paused ?? 0) + (summary?.expired ?? 0)
        else if (k === 'assignees') value = summary?.totalActiveAssignees ?? 0
        const Icon = meta.icon
        return (
          <div
            key={k}
            className="flex min-h-[112px] flex-col gap-3 rounded-lg border border-neutral-200 bg-white p-5 shadow-card"
          >
            <div className="flex items-start justify-between gap-3">
              <span className="text-[13px] font-medium text-neutral-500">
                {t(`benefitsComponent.${meta.labelKey}`)}
              </span>
              <span
                className={`inline-flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-md ${TONE[meta.tone]}`}
              >
                <Icon className="h-[18px] w-[18px]" aria-hidden="true" />
              </span>
            </div>
            <div className="text-[28px] font-bold leading-tight text-neutral-900">{formatNumber(value)}</div>
            <div className="text-xs text-neutral-500">
              {t(`benefitsComponent.${meta.labelKey}Note`)}
            </div>
          </div>
        )
      })}
    </div>
  )
}
