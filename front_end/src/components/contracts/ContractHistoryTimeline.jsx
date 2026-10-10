import { FilePlus, CalendarPlus, X, RefreshCw, FileEdit, History } from 'lucide-react'

import ContractStatusPill from './ContractStatusPill'

import { CONTRACT_TYPE_LABEL } from '../../data/contractMockData'
import { formatDateTime } from '../../utils/format'
import { useI18n } from '../../i18n/useI18n'

const ACTION_META = (t) => ({
  create: { label: t('contracts.createContractAction'), tone: 'brand' },
  extend: { label: t('contracts.extendContractAction'), tone: 'success' },
  terminate: { label: t('contracts.terminateContractAction'), tone: 'danger' },
  status_change: { label: t('contracts.statusChangeAction'), tone: 'warning' },
  update: { label: t('contracts.updateInfoAction'), tone: 'neutral' },
})

const TONE_CLASS = {
  brand: 'bg-brand-100 text-brand-700',
  success: 'bg-success-100 text-success-700',
  danger: 'bg-danger-100 text-danger-700',
  warning: 'bg-warning-100 text-warning-700',
  neutral: 'bg-neutral-200 text-neutral-700',
}

const ICONS = { FilePlus, CalendarPlus, X, RefreshCw, FileEdit }

/**
 * ContractHistoryTimeline - lịch sử thay đổi của 1 hợp đồng.
 */
export default function ContractHistoryTimeline({ history = [] }) {
  const { t } = useI18n()

  if (history.length === 0) {
    return (
      <p className="text-sm text-neutral-500">{t('contracts.noHistory')}</p>
    )
  }
  const metaMap = ACTION_META(t)
  // Mới nhất trước
  const items = [...history].sort((a, b) => (b.timestamp || '').localeCompare(a.timestamp || ''))
  return (
    <ol className="relative flex flex-col gap-3">
      {items.map((h) => {
        const meta = metaMap[h.action] ?? metaMap.update
        const Icon = ICONS[h.action] ?? FileEdit
        return (
          <li key={h.id} className="flex items-start gap-3 rounded-md border border-neutral-200 bg-white p-3">
            <span
              className={`inline-flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-full ${TONE_CLASS[meta.tone]}`}
            >
              <Icon className="h-4 w-4" aria-hidden="true" />
            </span>
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-2">
                <span className="font-medium text-neutral-900">{meta.label}</span>
                {h.previousStatus && h.newStatus && h.previousStatus !== h.newStatus && (
                  <span className="text-[12px] text-neutral-500">
                    {h.previousStatus} → {h.newStatus}
                  </span>
                )}
              </div>
              {h.previousExpiryDate !== undefined && h.newExpiryDate !== undefined && (
                <p className="text-[12px] text-neutral-500">
                  {t('contracts.previousExpiryDate')}:{' '}
                  <span className="font-medium text-neutral-700">
                    {h.previousExpiryDate || '—'}
                  </span>
                  {' → '}
                  <span className="font-medium text-neutral-900">
                    {h.newExpiryDate || '—'}
                  </span>
                </p>
              )}
              {h.reason && (
                <p className="mt-1 text-[13px] text-neutral-700">{t('contracts.reason')}: {h.reason}</p>
              )}
              <p className="mt-1 text-[11px] text-neutral-500">
                {t('contracts.by', { name: h.actorName || 'Admin' })} · {formatDateTime(h.timestamp)}
              </p>
            </div>
          </li>
        )
      })}
      <span className="hidden"><History aria-hidden="true" /></span>
    </ol>
  )
}

/**
 * ContractHistoryTable - lịch sử hợp đồng của 1 nhân viên (nhiều hợp đồng).
 */
export function ContractHistoryTable({ rows = [] }) {
  const { t } = useI18n()

  if (rows.length === 0) {
    return (
      <p className="text-sm text-neutral-500">{t('contracts.noContracts')}</p>
    )
  }
  return (
    <div className="w-full overflow-x-auto rounded-lg border border-neutral-200 bg-white shadow-card">
      <table className="w-full border-separate border-spacing-0 text-sm text-neutral-700">
        <thead>
          <tr>
            <th className="border-b border-neutral-200 bg-neutral-50 px-4 py-3 text-xs font-semibold uppercase tracking-wider text-neutral-500 whitespace-nowrap">{t('contracts.contractCode')}</th>
            <th className="border-b border-neutral-200 bg-neutral-50 px-4 py-3 text-xs font-semibold uppercase tracking-wider text-neutral-500 whitespace-nowrap">{t('contracts.contractType')}</th>
            <th className="border-b border-neutral-200 bg-neutral-50 px-4 py-3 text-xs font-semibold uppercase tracking-wider text-neutral-500 whitespace-nowrap">{t('contracts.signedDate')}</th>
            <th className="border-b border-neutral-200 bg-neutral-50 px-4 py-3 text-xs font-semibold uppercase tracking-wider text-neutral-500 whitespace-nowrap">{t('contracts.effectiveDate')}</th>
            <th className="border-b border-neutral-200 bg-neutral-50 px-4 py-3 text-xs font-semibold uppercase tracking-wider text-neutral-500 whitespace-nowrap">{t('contracts.expiryDate')}</th>
            <th className="border-b border-neutral-200 bg-neutral-50 px-4 py-3 text-xs font-semibold uppercase tracking-wider text-neutral-500 whitespace-nowrap text-center">{t('contracts.status')}</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={row.id}>
              <td className="border-b border-neutral-200 px-4 py-3 font-mono text-[12px] text-neutral-700">{row.contractCode}</td>
              <td className="border-b border-neutral-200 px-4 py-3">{CONTRACT_TYPE_LABEL[row.contractType] || row.contractType}</td>
              <td className="border-b border-neutral-200 px-4 py-3 whitespace-nowrap">{row.signedDate}</td>
              <td className="border-b border-neutral-200 px-4 py-3 whitespace-nowrap">{row.effectiveDate}</td>
              <td className="border-b border-neutral-200 px-4 py-3 whitespace-nowrap">{row.expiryDate || '—'}</td>
              <td className="border-b border-neutral-200 px-4 py-3 text-center">
                <ContractStatusPill status={row.status} />
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

// silence unused import
void CONTRACT_TYPE_LABEL
