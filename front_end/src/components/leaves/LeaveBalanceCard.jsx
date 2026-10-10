import { CalendarDays, Wallet, Clock } from 'lucide-react'

import { formatNumber } from '../../utils/format'
import { useI18n } from '../../i18n/useI18n'

/**
 * LeaveBalanceCard - thẻ hiển thị hạn mức nghỉ phép năm minh hoạ.
 *
 * Lưu ý: balance là dữ liệu demo, KHÔNG phải chính sách phép năm chính
 * thức của công ty. Số liệu "Còn lại" chỉ mang tính tham khảo UI.
 */
export default function LeaveBalanceCard({ balance }) {
  const { t } = useI18n()
  if (!balance) return null
  const { annualTotal, used, remaining, pendingDays, year, unit = 'ngày' } = balance
  const percent = annualTotal > 0 ? Math.min(100, Math.round((used / annualTotal) * 100)) : 0

  return (
    <div className="flex flex-col gap-4 rounded-lg border border-neutral-200 bg-white p-5 shadow-card">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <p className="text-[13px] font-medium text-neutral-500">{t('leaves.component.balanceCardTitle', { year })}</p>
          <p className="mt-1 text-2xl font-bold text-neutral-900">
            {formatNumber(used)} / {formatNumber(annualTotal)} {unit}
          </p>
          <p className="text-xs text-neutral-500">{t('leaves.component.balanceCardNote')}</p>
        </div>
        <span className="inline-flex h-10 w-10 items-center justify-center rounded-md bg-brand-50 text-brand-600">
          <Wallet className="h-5 w-5" aria-hidden="true" />
        </span>
      </div>

      <div>
        <div
          role="progressbar"
          aria-valuenow={percent}
          aria-valuemin={0}
          aria-valuemax={100}
          className="h-2 w-full overflow-hidden rounded-full bg-neutral-100"
        >
          <div
            className={percent >= 100 ? 'h-full bg-danger-500' : percent >= 75 ? 'h-full bg-warning-500' : 'h-full bg-brand-500'}
            style={{ width: `${percent}%` }}
          />
        </div>
        <p className="mt-1 text-[12px] text-neutral-500">{t('leaves.component.usedPercent', { n: percent })}</p>
      </div>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <Stat
          icon={CalendarDays}
          tone="success"
          label={t('leaves.component.remaining')}
          value={`${formatNumber(remaining)} ${unit}`}
          hint={t('leaves.component.remainingHint')}
        />
        <Stat
          icon={Clock}
          tone="warning"
          label={t('leaves.component.pendingApproval')}
          value={`${formatNumber(pendingDays)} ${unit}`}
          hint={t('leaves.component.pendingHint')}
        />
      </div>

      <p className="rounded-md border border-warning-200 bg-warning-50 px-3 py-2 text-[12px] text-warning-700">
        <b>{t('leaves.component.balanceDisclaimer').split(':')[0]}:</b> {t('leaves.component.balanceDisclaimer').split(':')[1]}
      </p>
    </div>
  )
}

function Stat({ icon: Icon, tone, label, value, hint }) {
  const toneClass = {
    success: 'bg-success-50 text-success-700 border-success-200',
    warning: 'bg-warning-50 text-warning-700 border-warning-200',
    neutral: 'bg-neutral-50 text-neutral-700 border-neutral-200',
  }[tone] || 'bg-neutral-50 text-neutral-700 border-neutral-200'
  return (
    <div className={`rounded-md border p-3 ${toneClass}`}>
      <div className="flex items-center gap-2 text-[12px] font-semibold uppercase tracking-wider">
        <Icon className="h-3.5 w-3.5" aria-hidden="true" />
        {label}
      </div>
      <p className="mt-1 text-base font-bold">{value}</p>
      {hint && <p className="text-[11px] opacity-80">{hint}</p>}
    </div>
  )
}