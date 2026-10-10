import { Users, ClipboardCheck, AlertTriangle, UserMinus, TrendingUp } from 'lucide-react'

import { classNames } from '../../utils/format'
import { useI18n } from '../../i18n/useI18n'

const TONE = {
  primary: 'bg-brand-50 text-brand-700',
  success: 'bg-success-50 text-success-600',
  warning: 'bg-warning-50 text-warning-600',
  danger:  'bg-danger-50 text-danger-600',
  neutral: 'bg-neutral-100 text-neutral-600',
  info:    'bg-info-50 text-info-600',
}

/**
 * AttendanceStatTiles - 5 thẻ thống kê chấm công.
 * Thứ tự hiển thị: inScope, recorded, late, absent, rate.
 */
export default function AttendanceStatTiles({ summary }) {
  const { t } = useI18n()
  const META = {
    inScope:     { labelKey: 'attendance.component.inScope',     icon: Users,          tone: 'primary' },
    recorded:     { labelKey: 'attendance.component.recorded',    icon: ClipboardCheck, tone: 'info' },
    late:         { labelKey: 'attendance.component.late',        icon: AlertTriangle,  tone: 'warning' },
    absent:       { labelKey: 'attendance.component.absent',         icon: UserMinus,      tone: 'danger' },
    rate:         { labelKey: 'attendance.component.rate',          icon: TrendingUp,     tone: 'success' },
  }

  const items = [
    { key: 'inScope',  value: summary.inScope },
    { key: 'recorded', value: summary.recorded },
    { key: 'late',    value: summary.late },
    { key: 'absent',   value: summary.absent },
    {
      key: 'rate',
      value: `${summary.attendanceRate}%`,
      tone: summary.attendanceRate >= 90 ? 'success' : summary.attendanceRate >= 75 ? 'warning' : 'danger',
    },
  ]

  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5">
      {items.map((it) => {
        const meta = META[it.key]
        const Icon = meta.icon
        const tone = it.tone ?? meta.tone
        const note =
          it.key === 'inScope'
            ? t('attendance.component.rangeNote', { from: summary.range.dateFrom || '…', to: summary.range.dateTo || '…' })
            : it.key === 'recorded'
            ? t('attendance.component.expectedNote', { n: summary.expected })
            : it.key === 'late'
            ? t('attendance.component.lateNote', { n: summary.late })
            : it.key === 'absent'
            ? t('attendance.component.leaveNote', { onLeave: summary.onLeave, incomplete: summary.incomplete })
            : t('attendance.component.presentNote', { n: summary.present })
        return (
          <div
            key={it.key}
            className="flex min-h-[112px] flex-col gap-3 rounded-lg border border-neutral-200 bg-white p-5 shadow-card"
          >
            <div className="flex items-start justify-between gap-3">
              <span className="text-[13px] font-medium text-neutral-500">{t(meta.labelKey)}</span>
              <span
                className={classNames(
                  'inline-flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-md',
                  TONE[tone],
                )}
              >
                <Icon className="h-[18px] w-[18px]" aria-hidden="true" />
              </span>
            </div>
            <div className="text-[28px] font-bold leading-tight text-neutral-900">{it.value}</div>
            <div className="text-xs text-neutral-500">{note}</div>
          </div>
        )
      })}
    </div>
  )
}