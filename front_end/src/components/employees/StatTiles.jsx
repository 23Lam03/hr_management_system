import { Users, UserCheck2, CalendarOff, UserMinus } from 'lucide-react'
import { useI18n } from '../../i18n/useI18n'

import { classNames } from '../../utils/format'

const TONE = {
  primary: 'bg-brand-50 text-brand-700',
  success: 'bg-success-50 text-success-600',
  warning: 'bg-warning-50 text-warning-600',
  neutral: 'bg-neutral-100 text-neutral-600',
  danger:  'bg-danger-50 text-danger-600',
}

/**
 * StatTiles - 4 thẻ thống kê, đồng bộ với dashboard.
 */
export default function StatTiles({ stats }) {
  const { t } = useI18n()
  const order = ['total', 'active', 'onLeave', 'inactive']
  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
      {order.map((k) => {
        const Icon = [Users, UserCheck2, CalendarOff, UserMinus][order.indexOf(k)]
        const tone = [TONE.primary, TONE.success, TONE.warning, TONE.neutral][order.indexOf(k)]
        const value = stats?.[k] ?? 0
        const labelKey = ['employees.component.totalEmployees', 'employees.component.activeEmployees', 'employees.component.onLeaveEmployees', 'employees.component.inactiveEmployees'][order.indexOf(k)]
        const subtitleKey = [
          'employees.component.companyWide',
          'employees.component.rate',
          'employees.component.temporarilyAbsent',
          'employees.component.leftCompany',
        ][order.indexOf(k)]
        return (
          <div
            key={k}
            className="flex min-h-[112px] flex-col gap-3 rounded-lg border border-neutral-200 bg-white p-5 shadow-card"
          >
            <div className="flex items-start justify-between gap-3">
              <span className="text-[13px] font-medium text-neutral-500">{t(labelKey)}</span>
              <span
                className={classNames(
                  'inline-flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-md',
                  tone,
                )}
              >
                <Icon className="h-[18px] w-[18px]" aria-hidden="true" />
              </span>
            </div>
            <div className="text-[28px] font-bold leading-tight text-neutral-900">{value}</div>
            <div className="text-xs text-neutral-500">
              {k === 'total'
                ? t('employees.component.companyWide')
                : k === 'active'
                ? `${t('employees.component.rate')}: ${stats.total ? Math.round((value / stats.total) * 100) : 0}%`
                : k === 'onLeave'
                ? t('employees.component.temporarilyAbsent')
                : t('employees.component.leftCompany')}
            </div>
          </div>
        )
      })}
    </div>
  )
}