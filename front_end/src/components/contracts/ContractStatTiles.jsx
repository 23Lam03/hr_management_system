import { FileText, Clock, Check, AlertTriangle, FilePlus } from 'lucide-react'

import { formatNumber } from '../../utils/format'
import { useI18n } from '../../i18n/useI18n'

const TONE = {
  primary: 'bg-brand-50 text-brand-700',
  warning: 'bg-warning-50 text-warning-600',
  success: 'bg-success-50 text-success-600',
  neutral: 'bg-neutral-100 text-neutral-600',
  info: 'bg-info-50 text-info-600',
  danger: 'bg-danger-50 text-danger-600',
}

const META_KEYS = ['totalContracts', 'activeContracts', 'expiringSoon', 'expiredStat', 'pendingStat']
const SUB_KEYS = ['allContractsCreated', 'currentlyActive', 'within30DaysDemo', 'expiredOrTerminated', 'pendingOrDraft']
const ICONS = [FileText, Check, AlertTriangle, Clock, FilePlus]
const TONE_KEYS = ['primary', 'success', 'warning', 'neutral', 'info']
const VALUE_KEYS = ['total', 'active', 'expiringSoon', 'expired', 'pending']

export default function ContractStatTiles({ summary }) {
  const { t } = useI18n()
  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-5">
      {META_KEYS.map((k, i) => {
        let value = 0
        if (VALUE_KEYS[i] === 'total') value = summary?.total ?? 0
        else if (VALUE_KEYS[i] === 'active') value = summary?.active ?? 0
        else if (VALUE_KEYS[i] === 'expiringSoon') value = summary?.expiringSoon ?? 0
        else if (VALUE_KEYS[i] === 'expired') value = (summary?.expired ?? 0) + (summary?.terminated ?? 0)
        else if (VALUE_KEYS[i] === 'pending') value = (summary?.pending ?? 0) + (summary?.draft ?? 0)
        const Icon = ICONS[i]
        return (
          <div
            key={k}
            className="flex min-h-[112px] flex-col gap-3 rounded-lg border border-neutral-200 bg-white p-5 shadow-card"
          >
            <div className="flex items-start justify-between gap-3">
              <span className="text-[13px] font-medium text-neutral-500">{t(`contracts.${k}`)}</span>
              <span
                className={`inline-flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-md ${TONE[TONE_KEYS[i]]}`}
              >
                <Icon className="h-[18px] w-[18px]" aria-hidden="true" />
              </span>
            </div>
            <div className="text-[28px] font-bold leading-tight text-neutral-900">{formatNumber(value)}</div>
            <div className="text-xs text-neutral-500">{t(`contracts.${SUB_KEYS[i]}`)}</div>
          </div>
        )
      })}
    </div>
  )
}
