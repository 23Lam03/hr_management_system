import { FileEdit, Clock, Check, X, Ban } from 'lucide-react'

import { LEAVE_STATUS_LABEL } from '../../data/leaveMockData'
import { formatDate } from '../../utils/format'
import { classNames } from '../../utils/format'
import { useI18n } from '../../i18n/useI18n'

const STATUS_META = {
  pending:    { label: LEAVE_STATUS_LABEL.pending,    Icon: Clock,    tone: 'warning' },
  approved:   { label: LEAVE_STATUS_LABEL.approved,   Icon: Check,    tone: 'success' },
  rejected:   { label: LEAVE_STATUS_LABEL.rejected,   Icon: X,        tone: 'danger' },
  cancelled:  { label: LEAVE_STATUS_LABEL.cancelled,  Icon: Ban,      tone: 'neutral' },
}

const TONE_BG = {
  warning: 'bg-warning-50 text-warning-700 border-warning-200',
  success: 'bg-success-50 text-success-700 border-success-200',
  danger: 'bg-danger-50 text-danger-700 border-danger-200',
  neutral: 'bg-neutral-100 text-neutral-600 border-neutral-200',
  pending: 'bg-neutral-100 text-neutral-600 border-neutral-200',
}

const TONE_DOT = {
  warning: 'bg-warning-500',
  success: 'bg-success-500',
  danger: 'bg-danger-500',
  neutral: 'bg-neutral-400',
  pending: 'bg-neutral-400',
}

/**
 * LeaveHistoryTimeline - dọc, hiển thị lịch sử thay đổi trạng thái.
 *
 * Props:
 *  - history: [{ fromStatus, toStatus, actorId, actorName, timestamp, note }]
 */
export default function LeaveHistoryTimeline({ history = [] }) {
  const { t } = useI18n()

  if (!Array.isArray(history) || history.length === 0) {
    return (
      <p className="rounded-md border border-dashed border-neutral-200 bg-neutral-50 px-4 py-3 text-[13px] text-neutral-500">
        {t('leaves.component.noHistory')}
      </p>
    )
  }

  return (
    <ol className="relative space-y-3">
      {history.map((h, idx) => {
        const toMeta = STATUS_META[h.toStatus] || { label: h.toStatus, Icon: FileEdit, tone: 'neutral' }
        const fromMeta = h.fromStatus ? STATUS_META[h.fromStatus] : null
        const isLast = idx === history.length - 1
        return (
          <li key={idx} className="relative pl-6">
            {!isLast && (
              <span className="absolute left-1.5 top-5 h-full w-px bg-neutral-200" aria-hidden="true" />
            )}
            <span
              className={classNames(
                'absolute left-0 top-1 inline-flex h-3 w-3 rounded-full border-2 border-white',
                TONE_DOT[toMeta.tone],
              )}
              aria-hidden="true"
            />
            <div className="flex flex-col gap-1 rounded-md border border-neutral-200 bg-white px-3 py-2">
              <div className="flex flex-wrap items-center gap-2">
                {fromMeta && (
                  <span className="inline-flex items-center gap-1 rounded-full border border-neutral-200 bg-neutral-50 px-2 py-0.5 text-[11px] font-medium text-neutral-600">
                    {fromMeta.label}
                  </span>
                )}
                {fromMeta && <span className="text-[12px] text-neutral-400">→</span>}
                <span className={classNames(
                  'inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[11px] font-medium',
                  TONE_BG[toMeta.tone],
                )}>
                  <toMeta.Icon className="h-3 w-3" aria-hidden="true" />
                  {toMeta.label}
                </span>
              </div>
              <p className="text-[13px] text-neutral-700">{h.note || t('common.none')}</p>
              <p className="text-[12px] text-neutral-500">
                <b className="text-neutral-700">{h.actorName || t('common.none')}</b>
                {' · '}
                {formatDate(h.timestamp)}
              </p>
            </div>
          </li>
        )
      })}
    </ol>
  )
}
