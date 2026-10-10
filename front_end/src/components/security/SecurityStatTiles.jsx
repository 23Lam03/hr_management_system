import {
  ShieldCheck,
  LogIn,
  KeyRound,
  Lock,
} from 'lucide-react'
import { useI18n } from '../../i18n/useI18n'

import { classNames } from '../../utils/format'

const TONE = {
  brand:   'bg-brand-50 text-brand-600',
  warning: 'bg-warning-50 text-warning-600',
  success: 'bg-success-50 text-success-600',
  info:    'bg-info-50 text-info-600',
  danger:  'bg-danger-50 text-danger-600',
  neutral: 'bg-neutral-100 text-neutral-700',
}

/**
 * SecurityStatTiles - 4 KPI cards.
 */
export default function SecurityStatTiles({
  totalActivities = 0,
  loginSuccess = 0,
  loginFailed = 0,
  enabledCount = 0,
  className = '',
}) {
  const { t } = useI18n()
  const items = [
    {
      key: 'total',
      label: t('security.component.totalActivities'),
      value: totalActivities,
      Icon: ShieldCheck,
      tone: 'brand',
    },
    {
      key: 'success',
      label: t('security.component.successfulLogins'),
      value: loginSuccess,
      Icon: LogIn,
      tone: 'success',
    },
    {
      key: 'failed',
      label: t('security.component.failedLogins'),
      value: loginFailed,
      Icon: Lock,
      tone: 'danger',
    },
    {
      key: 'enabled',
      label: t('security.component.enabledSettings'),
      value: `${enabledCount}/6`,
      Icon: KeyRound,
      tone: 'warning',
    },
  ]

  return (
    <div className={classNames('grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4', className)}>
      {items.map(({ key, label, value, Icon, tone }) => (
        <div
          key={key}
          className="flex items-center gap-3 rounded-lg border border-neutral-200 bg-white p-4 shadow-card"
        >
          <span
            className={classNames(
              'inline-flex h-10 w-10 items-center justify-center rounded-md',
              TONE[tone] ?? TONE.brand,
            )}
          >
            <Icon className="h-5 w-5" aria-hidden="true" />
          </span>
          <div className="min-w-0">
            <p className="text-xs text-neutral-500">{label}</p>
            <p className="text-2xl font-semibold text-neutral-900 leading-tight">{value}</p>
          </div>
        </div>
      ))}
    </div>
  )
}