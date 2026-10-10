import { forwardRef } from 'react'
import { CheckCircle2, AlertTriangle, LogOut, Plane, XCircle, HelpCircle } from 'lucide-react'

import { classNames } from '../../utils/format'
import { useI18n } from '../../i18n/useI18n'

const META = {
  on_time:     { labelKey: 'attendance.component.attendanceStatusOnTime',     tone: 'success',  Icon: CheckCircle2 },
  late:        { labelKey: 'attendance.component.attendanceStatusLate',        tone: 'warning',  Icon: AlertTriangle },
  early_leave: { labelKey: 'attendance.component.attendanceStatusEarlyLeave', tone: 'warning',  Icon: LogOut },
  on_leave:    { labelKey: 'attendance.component.attendanceStatusOnLeave',    tone: 'pending',  Icon: Plane },
  absent:      { labelKey: 'attendance.component.attendanceStatusAbsent',       tone: 'inactive', Icon: XCircle },
  incomplete:  { labelKey: 'attendance.component.attendanceStatusIncomplete',   tone: 'neutral',  Icon: HelpCircle },
}

const TONE_CLASS = {
  success:  'bg-success-50 text-success-700 border-success-200',
  warning:  'bg-warning-50 text-warning-700 border-warning-200',
  pending:  'bg-warning-50 text-warning-700 border-warning-200',
  inactive: 'bg-neutral-100 text-neutral-600 border-neutral-200',
  neutral:  'bg-neutral-100 text-neutral-600 border-neutral-200',
}

const AttendanceStatusPill = forwardRef(function AttendanceStatusPill({ status = 'on_time', className = '' }, ref) {
  const { t } = useI18n()
  const meta = META[status] ?? META.incomplete
  const { Icon } = meta
  return (
    <span
      ref={ref}
      className={classNames(
        'inline-flex items-center gap-1.5 h-[24px] px-2 rounded-full text-xs font-medium whitespace-nowrap border',
        TONE_CLASS[meta.tone] ?? TONE_CLASS.neutral,
        className,
      )}
    >
      <Icon className="h-3.5 w-3.5" aria-hidden="true" />
      <span>{t(meta.labelKey)}</span>
    </span>
  )
})

export default AttendanceStatusPill