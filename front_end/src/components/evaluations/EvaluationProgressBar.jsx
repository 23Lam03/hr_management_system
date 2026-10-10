import { classNames } from '../../utils/format'

export default function EvaluationProgressBar({ percent = 0, className = '' }) {
  const safe = Math.max(0, Math.min(100, Number(percent) || 0))
  return (
    <div className={classNames('flex items-center gap-2', className)}>
      <div
        role="progressbar"
        aria-valuenow={safe}
        aria-valuemin={0}
        aria-valuemax={100}
        className="h-2 w-full overflow-hidden rounded-full bg-neutral-100"
      >
        <div
          className={classNames(
            'h-full rounded-full transition-all',
            safe >= 100 ? 'bg-success-500' : safe >= 60 ? 'bg-brand-500' : 'bg-warning-500',
          )}
          style={{ width: `${safe}%` }}
        />
      </div>
      <span className="min-w-[40px] text-right text-[12px] font-medium text-neutral-700">{safe}%</span>
    </div>
  )
}