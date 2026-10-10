import { Inbox, ListChecks, Clock4, CheckCircle2 } from 'lucide-react'

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
 * SupportStatTiles - 4 KPI cards (label, value, icon, tone).
 */
export default function SupportStatTiles({
  total = 0,
  inProgress = 0,
  resolved = 0,
  open = 0,
  waiting = 0,
  high = 0,
  variant = 'admin',
  className = '',
}) {
  const { t } = useI18n()
  let items = []
  if (variant === 'employee') {
    items = [
      { key: 'total',      label: t('support.component.statTotal'),      value: total,      Icon: Inbox,         tone: 'brand' },
      { key: 'inProgress', label: t('support.component.statInProgress'), value: inProgress, Icon: Clock4,         tone: 'warning' },
      { key: 'resolved',   label: t('support.component.statResolved'), value: resolved,   Icon: CheckCircle2,  tone: 'success' },
      { key: 'waiting',    label: t('support.component.statWaiting'),    value: waiting,   Icon: ListChecks,    tone: 'info' },
    ]
  } else {
    items = [
      { key: 'total',      label: t('support.component.statTotal'),      value: total,      Icon: Inbox,         tone: 'brand' },
      { key: 'open',       label: t('support.component.statNew'),       value: open,       Icon: ListChecks,    tone: 'info' },
      { key: 'inProgress', label: t('support.component.statInProgress'), value: inProgress, Icon: Clock4,        tone: 'warning' },
      { key: 'resolved',   label: t('support.component.statResolved'), value: resolved,   Icon: CheckCircle2,  tone: 'success' },
    ]
  }
  // optional 5th for high
  if (variant === 'admin' && high > 0) {
    items.push({ key: 'high', label: t('support.component.statHighPriority'), value: high, Icon: ListChecks, tone: 'danger' })
  }

  return (
    <div className={classNames('grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4', className)}>
      {items.map(({ key, label, value, Icon, tone }) => (
        <div
          key={key}
          className="flex items-center gap-3 rounded-lg border border-neutral-200 bg-white p-4 shadow-card"
        >
          <span className={classNames('inline-flex h-10 w-10 items-center justify-center rounded-md', TONE[tone] ?? TONE.brand)}>
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