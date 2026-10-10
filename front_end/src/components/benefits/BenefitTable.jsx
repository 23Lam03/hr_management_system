import { Eye, Pencil, Users, Pause, Ban } from 'lucide-react'

import BenefitStatusPill from './BenefitStatusPill'
import { formatDateRange, formatNumber } from '../../utils/format'
import { BENEFIT_TYPE_LABEL, VALUE_UNIT_LABEL } from '../../data/benefitMockData'
import { useI18n } from '../../i18n/useI18n'

const FORMAT_VALUE = (v) => {
  if (v === null || v === undefined || v === '') return '—'
  const n = Number(v)
  if (Number.isNaN(n)) return '—'
  if (Number.isInteger(n)) return n.toLocaleString('vi-VN')
  return n.toLocaleString('vi-VN', { maximumFractionDigits: 2 })
}

export default function BenefitTable({
  rows,
  loading,
  onView,
  onEdit,
  onAssign,
  onPause,
  onResume,
  onExpire,
}) {
  const { t } = useI18n()

  return (
    <div className="w-full overflow-x-auto rounded-lg border border-neutral-200 bg-white shadow-card">
      <table className="w-full border-separate border-spacing-0 text-sm text-neutral-700">
        <thead>
          <tr>
            <th className="border-b border-neutral-200 bg-neutral-50 px-4 py-3 text-xs font-semibold uppercase tracking-wider text-neutral-500 whitespace-nowrap">{t('benefitsComponent.program')}</th>
            <th className="border-b border-neutral-200 bg-neutral-50 px-4 py-3 text-xs font-semibold uppercase tracking-wider text-neutral-500 whitespace-nowrap">{t('benefitsComponent.type')}</th>
            <th className="border-b border-neutral-200 bg-neutral-50 px-4 py-3 text-xs font-semibold uppercase tracking-wider text-neutral-500 whitespace-nowrap">{t('benefitsComponent.desc')}</th>
            <th className="border-b border-neutral-200 bg-neutral-50 px-4 py-3 text-xs font-semibold uppercase tracking-wider text-neutral-500 whitespace-nowrap">{t('benefitsComponent.valueCol')}</th>
            <th className="border-b border-neutral-200 bg-neutral-50 px-4 py-3 text-xs font-semibold uppercase tracking-wider text-neutral-500 whitespace-nowrap text-right">{t('benefitsComponent.assigneesCount')}</th>
            <th className="border-b border-neutral-200 bg-neutral-50 px-4 py-3 text-xs font-semibold uppercase tracking-wider text-neutral-500 whitespace-nowrap">{t('benefitsComponent.period')}</th>
            <th className="border-b border-neutral-200 bg-neutral-50 px-4 py-3 text-xs font-semibold uppercase tracking-wider text-neutral-500 whitespace-nowrap text-center">{t('benefitsComponent.statusCol')}</th>
            <th className="border-b border-neutral-200 bg-neutral-50 px-4 py-3 text-xs font-semibold uppercase tracking-wider text-neutral-500 whitespace-nowrap text-right">{t('benefitsComponent.actionsCol')}</th>
          </tr>
        </thead>
        <tbody>
          {loading && (
            <tr><td colSpan={8} className="px-4 py-10 text-center text-sm text-neutral-500">{t('benefitsComponent.loading')}</td></tr>
          )}
          {!loading && rows.length === 0 && (
            <tr><td colSpan={8} className="px-4 py-10 text-center text-sm text-neutral-500">{t('benefitsComponent.emptyRows')}</td></tr>
          )}
          {!loading && rows.map((row) => (
            <tr key={row.id} className="group">
              <td className="border-b border-neutral-200 px-4 py-3 align-middle group-hover:bg-neutral-50">
                <div className="flex min-w-[220px] flex-col">
                  <span className="font-medium text-neutral-900">{row.name}</span>
                  <span className="font-mono text-[12px] text-neutral-500">{row.code}</span>
                </div>
              </td>
              <td className="border-b border-neutral-200 px-4 py-3 align-middle group-hover:bg-neutral-50">
                {BENEFIT_TYPE_LABEL[row.type] || row.type}
              </td>
              <td className="border-b border-neutral-200 px-4 py-3 align-middle group-hover:bg-neutral-50 max-w-[260px]">
                <span className="line-clamp-2 text-[13px] text-neutral-600">{row.description || '—'}</span>
              </td>
              <td className="border-b border-neutral-200 px-4 py-3 align-middle group-hover:bg-neutral-50 whitespace-nowrap">
                <div className="flex flex-col text-[13px]">
                  <span className="font-medium text-neutral-900">{FORMAT_VALUE(row.value)}</span>
                  {row.valueUnit && (
                    <span className="text-[12px] text-neutral-500">{VALUE_UNIT_LABEL[row.valueUnit] || row.valueUnit}</span>
                  )}
                </div>
              </td>
              <td className="border-b border-neutral-200 px-4 py-3 text-right align-middle group-hover:bg-neutral-50">
                <span className="font-medium">{formatNumber(row.activeAssigneesCount)}</span>
                <span className="text-neutral-400"> / {formatNumber(row.totalAssignees)}</span>
              </td>
              <td className="border-b border-neutral-200 px-4 py-3 align-middle group-hover:bg-neutral-50 whitespace-nowrap">
                {formatDateRange(row.startDate, row.endDate)}
              </td>
              <td className="border-b border-neutral-200 px-4 py-3 text-center align-middle group-hover:bg-neutral-50">
                <BenefitStatusPill status={row.status} />
              </td>
              <td className="border-b border-neutral-200 px-4 py-3 text-right align-middle group-hover:bg-neutral-50">
                <div className="inline-flex items-center gap-1">
                  <button
                    type="button"
                    onClick={() => onView(row.id)}
                    aria-label={t('benefitsComponent.viewAria', { n: row.name })}
                    className="inline-flex h-8 w-8 items-center justify-center rounded-md text-neutral-500 hover:bg-neutral-100 hover:text-neutral-900"
                  >
                    <Eye className="h-4 w-4" aria-hidden="true" />
                  </button>
                  {row.status !== 'cancelled' && onAssign && (
                    <button
                      type="button"
                      onClick={() => onAssign(row.id)}
                      aria-label={t('benefitsComponent.assignAria', { n: row.name })}
                      className="inline-flex h-8 items-center gap-1 rounded-md bg-brand-50 px-2 text-xs font-medium text-brand-700 hover:bg-brand-100"
                    >
                      <Users className="h-3.5 w-3.5" aria-hidden="true" />
                      <span>{t('benefitsComponent.assign')}</span>
                    </button>
                  )}
                  {row.status !== 'cancelled' && row.status !== 'expired' && onEdit && (
                    <button
                      type="button"
                      onClick={() => onEdit(row.id)}
                      aria-label={t('benefitsComponent.editAria', { n: row.name })}
                      className="inline-flex h-8 items-center gap-1 rounded-md border border-neutral-200 px-2 text-xs font-medium text-neutral-700 hover:bg-neutral-100"
                    >
                      <Pencil className="h-3.5 w-3.5" aria-hidden="true" />
                      <span>{t('benefitsComponent.edit')}</span>
                    </button>
                  )}
                  {row.status === 'active' && onPause && (
                    <button
                      type="button"
                      onClick={() => onPause(row.id)}
                      aria-label={t('benefitsComponent.pauseAria', { n: row.name })}
                      className="inline-flex h-8 items-center gap-1 rounded-md bg-warning-50 px-2 text-xs font-medium text-warning-700 hover:bg-warning-100"
                    >
                      <Pause className="h-3.5 w-3.5" aria-hidden="true" />
                      <span>{t('benefitsComponent.pause')}</span>
                    </button>
                  )}
                  {row.status === 'paused' && onResume && (
                    <button
                      type="button"
                      onClick={() => onResume(row.id)}
                      aria-label={t('benefitsComponent.resumeAria', { n: row.name })}
                      className="inline-flex h-8 items-center gap-1 rounded-md bg-success-50 px-2 text-xs font-medium text-success-700 hover:bg-success-100"
                    >
                      <Pause className="h-3.5 w-3.5" aria-hidden="true" />
                      <span>{t('benefitsComponent.resume')}</span>
                    </button>
                  )}
                  {row.status !== 'expired' && onExpire && (
                    <button
                      type="button"
                      onClick={() => onExpire(row.id)}
                      aria-label={t('benefitsComponent.expireAria', { n: row.name })}
                      className="inline-flex h-8 items-center gap-1 rounded-md bg-danger-50 px-2 text-xs font-medium text-danger-700 hover:bg-danger-100"
                    >
                      <Ban className="h-3.5 w-3.5" aria-hidden="true" />
                      <span>{t('benefitsComponent.expire')}</span>
                    </button>
                  )}
                </div>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
