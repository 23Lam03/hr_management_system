import { classNames } from '../../utils/format'

const TONE = {
  primary: 'bg-brand-50 text-brand-700',
  success: 'bg-success-50 text-success-600',
  warning: 'bg-warning-50 text-warning-600',
  danger:  'bg-danger-50 text-danger-600',
  info:    'bg-info-50 text-info-600',
}

export default function StatCard({ label, value, icon: Icon, tone = 'primary', delta }) {
  return (
    <div className="flex min-h-[120px] flex-col gap-3 rounded-lg border border-neutral-200 bg-white p-5 shadow-card">
      <div className="flex items-start justify-between gap-3">
        <span className="text-[13px] font-medium text-neutral-500">{label}</span>
        {Icon && (
          <span
            className={classNames(
              'inline-flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-md',
              TONE[tone] ?? TONE.primary,
            )}
          >
            <Icon className="h-[18px] w-[18px]" />
          </span>
        )}
      </div>
      <div className="text-[28px] font-bold leading-tight text-neutral-900">
        {value}
      </div>
      {delta && <div className="text-xs text-neutral-500">{delta}</div>}
    </div>
  )
}