import { FileText, Clock, Check, X, Ban } from 'lucide-react'

import { classNames } from '../../utils/format'
import { useI18n } from '../../i18n/useI18n'

const TONE = {
  primary: 'bg-brand-50 text-brand-700',
  warning: 'bg-warning-50 text-warning-600',
  success: 'bg-success-50 text-success-600',
  danger:  'bg-danger-50 text-danger-600',
  neutral: 'bg-neutral-100 text-neutral-600',
}

const META = {
  total:     { labelKey: 'total',     icon: FileText, tone: 'primary' },
  pending:   { labelKey: 'pending',   icon: Clock,    tone: 'warning' },
  approved:  { labelKey: 'approved',  icon: Check,    tone: 'success' },
  rejected:  { labelKey: 'rejected',  icon: X,        tone: 'danger' },
  cancelled: { labelKey: 'cancelled', icon: Ban,      tone: 'neutral' },
}

export default function LeaveStatTiles({ summary }) {
  const { t } = useI18n()

  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-5">
      {['total', 'pending', 'approved', 'rejected', 'cancelled'].map((k) => {
        const meta = META[k]
        const value = summary?.[k] ?? 0
        const Icon = meta.icon
        return (
          <div
            key={k}
            className="flex min-h-[112px] flex-col gap-3 rounded-lg border border-neutral-200 bg-white p-5 shadow-card"
          >
            <div className="flex items-start justify-between gap-3">
              <span className="text-[13px] font-medium text-neutral-500">
                {t(`leaves.component.stat_${k}`)}
              </span>
              <span
                className={classNames(
                  'inline-flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-md',
                  TONE[meta.tone],
                )}
              >
                <Icon className="h-[18px] w-[18px]" aria-hidden="true" />
              </span>
            </div>
            <div className="text-[28px] font-bold leading-tight text-neutral-900">{value}</div>
            <div className="text-xs text-neutral-500">
              {t(`leaves.component.stat_${k}Note`)}
            </div>
          </div>
        )
      })}
    </div>
  )
}
