import { Eye, ClipboardList } from 'lucide-react'

import EvaluationStatusPill from './EvaluationStatusPill'
import { formatNumber } from '../../utils/format'
import { useI18n } from '../../i18n/useI18n'

export default function EvaluationEmployeeTable({
  rows,
  loading,
  onView,
  onEvaluate,
}) {
  const { t } = useI18n()

  return (
    <div className="w-full overflow-x-auto rounded-lg border border-neutral-200 bg-white shadow-card">
      <table className="w-full border-separate border-spacing-0 text-sm text-neutral-700">
        <thead>
          <tr>
            <th className="border-b border-neutral-200 bg-neutral-50 px-4 py-3 text-xs font-semibold uppercase tracking-wider text-neutral-500 whitespace-nowrap">{t('evaluations.employee')}</th>
            <th className="border-b border-neutral-200 bg-neutral-50 px-4 py-3 text-xs font-semibold uppercase tracking-wider text-neutral-500 whitespace-nowrap">{t('evaluations.department')}</th>
            <th className="border-b border-neutral-200 bg-neutral-50 px-4 py-3 text-xs font-semibold uppercase tracking-wider text-neutral-500 whitespace-nowrap">{t('evaluations.position')}</th>
            <th className="border-b border-neutral-200 bg-neutral-50 px-4 py-3 text-xs font-semibold uppercase tracking-wider text-neutral-500 whitespace-nowrap">{t('evaluations.reviewer')}</th>
            <th className="border-b border-neutral-200 bg-neutral-50 px-4 py-3 text-xs font-semibold uppercase tracking-wider text-neutral-500 whitespace-nowrap text-right">{t('evaluations.overallScore')}</th>
            <th className="border-b border-neutral-200 bg-neutral-50 px-4 py-3 text-xs font-semibold uppercase tracking-wider text-neutral-500 whitespace-nowrap text-center">{t('evaluations.status')}</th>
            <th className="border-b border-neutral-200 bg-neutral-50 px-4 py-3 text-xs font-semibold uppercase tracking-wider text-neutral-500 whitespace-nowrap text-right">{t('evaluations.actions')}</th>
          </tr>
        </thead>
        <tbody>
          {loading && (
            <tr><td colSpan={7} className="px-4 py-10 text-center text-sm text-neutral-500">{t('common.loading')}</td></tr>
          )}
          {!loading && rows.length === 0 && (
            <tr><td colSpan={7} className="px-4 py-10 text-center text-sm text-neutral-500">{t('evaluations.empty')}</td></tr>
          )}
          {!loading && rows.map((row) => (
            <tr key={row.id} className="group">
              <td className="border-b border-neutral-200 px-4 py-3 align-middle group-hover:bg-neutral-50">
                <div className="flex min-w-[200px] flex-col">
                  <span className="font-medium text-neutral-900">{row.employeeName}</span>
                  <span className="font-mono text-[12px] text-neutral-500">{row.employeeCode}</span>
                </div>
              </td>
              <td className="border-b border-neutral-200 px-4 py-3 align-middle group-hover:bg-neutral-50">{row.departmentName}</td>
              <td className="border-b border-neutral-200 px-4 py-3 align-middle group-hover:bg-neutral-50">{row.position || '—'}</td>
              <td className="border-b border-neutral-200 px-4 py-3 align-middle group-hover:bg-neutral-50">{row.reviewerName || '—'}</td>
              <td className="border-b border-neutral-200 px-4 py-3 text-right align-middle group-hover:bg-neutral-50">
                {row.averageScore > 0 ? <b className="text-neutral-900">{formatNumber(row.averageScore)}</b> : <span className="text-neutral-400">—</span>}
              </td>
              <td className="border-b border-neutral-200 px-4 py-3 text-center align-middle group-hover:bg-neutral-50">
                <EvaluationStatusPill status={row.status} />
              </td>
              <td className="border-b border-neutral-200 px-4 py-3 text-right align-middle group-hover:bg-neutral-50">
                <div className="inline-flex items-center gap-1">
                  <button
                    type="button"
                    onClick={() => onView(row.id)}
                    aria-label={t('evaluations.viewDetail')}
                    className="inline-flex h-8 w-8 items-center justify-center rounded-md text-neutral-500 hover:bg-neutral-100 hover:text-neutral-900"
                  >
                    <Eye className="h-4 w-4" aria-hidden="true" />
                  </button>
                  {row.status !== 'published' && (
                    <button
                      type="button"
                      onClick={() => onEvaluate(row.id)}
                      aria-label={`${t('evaluations.evaluate')} ${row.employeeName}`}
                      className="inline-flex h-8 items-center gap-1 rounded-md bg-brand-600 px-2 text-xs font-medium text-white hover:bg-brand-700"
                    >
                      <ClipboardList className="h-3.5 w-3.5" aria-hidden="true" />
                      <span>{t('evaluations.evaluate')}</span>
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
