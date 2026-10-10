import { forwardRef } from 'react'
import { useI18n } from '../../i18n/useI18n'
import { classNames } from '../../utils/format'

/**
 * StatusPill - nhãn trạng thái nhân viên (active / on_leave / inactive)
 * có cả tone màu + icon + label để người mù màu vẫn phân biệt được.
 */
const STATUS_META = (t) => ({
  active:   { tone: 'active',  label: t('employees.statusActive'),  dot: 'bg-success-500', icon: '●' },
  on_leave: { tone: 'pending', label: t('employees.statusOnLeave'), dot: 'bg-warning-500', icon: '◐' },
  inactive: { tone: 'inactive',label: t('employees.statusInactive'), dot: 'bg-neutral-400', icon: '○' },
})

const StatusPill = forwardRef(function StatusPill({ status = 'active', className = '' }, ref) {
  const { t } = useI18n()
  const meta = STATUS_META(t)[status] ?? STATUS_META(t).inactive
  return (
    <span
      ref={ref}
      className={classNames(
        'inline-flex items-center gap-1.5 h-[22px] px-2 rounded-full text-xs font-medium whitespace-nowrap',
        'border',
        meta.tone === 'active' && 'bg-success-50 text-success-700 border-success-200',
        meta.tone === 'pending' && 'bg-warning-50 text-warning-700 border-warning-200',
        meta.tone === 'inactive' && 'bg-neutral-100 text-neutral-600 border-neutral-200',
        className,
      )}
    >
      <span aria-hidden="true" className={classNames('inline-block h-1.5 w-1.5 rounded-full', meta.dot)} />
      <span aria-hidden="true" className="text-[10px] leading-none">{meta.icon}</span>
      <span>{meta.label}</span>
    </span>
  )
})

export default StatusPill