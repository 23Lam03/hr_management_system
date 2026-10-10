import { Users, Banknote, Check, Wallet, TrendingDown } from 'lucide-react'

import { classNames, formatCurrencyVnd } from '../../utils/format'
import { useI18n } from '../../i18n/useI18n'

const TONE = {
  primary: 'bg-brand-50 text-brand-700',
  success: 'bg-success-50 text-success-600',
  warning: 'bg-warning-50 text-warning-600',
  danger:  'bg-danger-50 text-danger-600',
  neutral: 'bg-neutral-100 text-neutral-600',
}

const META = [
  { key: 'totalEmployees', labelKey: 'stat_totalEmployees', icon: Users,       tone: 'primary' },
  { key: 'paidCount',      labelKey: 'stat_paidCount',    icon: Check,       tone: 'success' },
  { key: 'unpaidCount',    labelKey: 'stat_unpaidCount',  icon: Wallet,      tone: 'warning' },
  { key: 'totalNet',       labelKey: 'stat_totalNet',     icon: Banknote,    tone: 'primary' },
  { key: 'unpaidNet',      labelKey: 'stat_unpaidNet',    icon: TrendingDown, tone: 'danger' },
]

export default function PayrollStatTiles({ summary }) {
  const { t } = useI18n()

  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-5">
      {META.map((m) => {
        const raw = summary?.[m.key] ?? 0
        const isMoney = m.key === 'totalNet' || m.key === 'unpaidNet'
        return (
          <div
            key={m.key}
            className="flex min-h-[112px] flex-col gap-3 rounded-lg border border-neutral-200 bg-white p-5 shadow-card"
          >
            <div className="flex items-start justify-between gap-3">
              <span className="text-[13px] font-medium text-neutral-500">{t(`payrollComponent.${m.labelKey}`)}</span>
              <span
                className={classNames(
                  'inline-flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-md',
                  TONE[m.tone],
                )}
              >
                <m.icon className="h-[18px] w-[18px]" aria-hidden="true" />
              </span>
            </div>
            <div className="text-[24px] font-bold leading-tight text-neutral-900">
              {isMoney ? formatCurrencyVnd(raw) : raw}
            </div>
            <div className="text-xs text-neutral-500">
              {t(`payrollComponent.${m.labelKey}Note`)}
            </div>
          </div>
        )
      })}
    </div>
  )
}
