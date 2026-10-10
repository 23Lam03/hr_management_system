import { Eye, Pencil, Archive, ClipboardList } from 'lucide-react'

import CycleStatusPill from './CycleStatusPill'
import EvaluationProgressBar from './EvaluationProgressBar'

import { formatDateRange } from '../../utils/format'
import { useI18n } from '../../i18n/useI18n'

export default function EvaluationCycleTable({
  rows,
  loading,
  onView,
  onEdit,
  onReview,
  onClose,
}) {
  const { t } = useI18n()

  return (
    <div className="w-full overflow-x-auto rounded-lg border border-neutral-200 bg-white shadow-card">
      <table className="w-full border-separate border-spacing-0 text-sm text-neutral-700">
        <thead>
          <tr>
            <th className="border-b border-neutral-200 bg-neutral-50 px-4 py-3 text-xs font-semibold uppercase tracking-wider text-neutral-500 whitespace-nowrap">{t('evaluations.cycleNameCol')}</th>
            <th className="border-b border-neutral-200 bg-neutral-50 px-4 py-3 text-xs font-semibold uppercase tracking-wider text-neutral-500 whitespace-nowrap">{t('evaluations.period')}</th>
            <th className="border-b border-neutral-200 bg-neutral-50 px-4 py-3 text-xs font-semibold uppercase tracking-wider text-neutral-500 whitespace-nowrap">{t('evaluations.scopeCol')}</th>
            <th className="border-b border-neutral-200 bg-neutral-50 px-4 py-3 text-xs font-semibold uppercase tracking-wider text-neutral-500 whitespace-nowrap text-right">{t('evaluations.employees')}</th>
            <th className="border-b border-neutral-200 bg-neutral-50 px-4 py-3 text-xs font-semibold uppercase tracking-wider text-neutral-500 whitespace-nowrap text-right">{t('evaluations.completed')}</th>
            <th className="border-b border-neutral-200 bg-neutral-50 px-4 py-3 text-xs font-semibold uppercase tracking-wider text-neutral-500 whitespace-nowrap min-w-[180px]">{t('evaluations.progress')}</th>
            <th className="border-b border-neutral-200 bg-neutral-50 px-4 py-3 text-xs font-semibold uppercase tracking-wider text-neutral-500 whitespace-nowrap text-center">{t('evaluations.status')}</th>
            <th className="border-b border-neutral-200 bg-neutral-50 px-4 py-3 text-xs font-semibold uppercase tracking-wider text-neutral-500 whitespace-nowrap text-right">{t('evaluations.actions')}</th>
          </tr>
        </thead>
        <tbody>
          {loading && (
            <tr>
              <td colSpan={8} className="px-4 py-10 text-center text-sm text-neutral-500">{t('common.loading')}</td>
            </tr>
          )}
          {!loading && rows.length === 0 && (
            <tr>
              <td colSpan={8} className="px-4 py-10 text-center text-sm text-neutral-500">{t('evaluations.empty')}</td>
            </tr>
          )}
          {!loading && rows.map((row) => (
            <tr key={row.id} className="group">
              <td className="border-b border-neutral-200 px-4 py-3 align-middle group-hover:bg-neutral-50">
                <div className="flex min-w-[240px] flex-col">
                  <span className="font-medium text-neutral-900">{row.name}</span>
                  <span className="text-xs text-neutral-500">{row.id}</span>
                </div>
              </td>
              <td className="border-b border-neutral-200 px-4 py-3 align-middle group-hover:bg-neutral-50 whitespace-nowrap">
                {formatDateRange(row.startDate, row.endDate)}
              </td>
              <td className="border-b border-neutral-200 px-4 py-3 align-middle group-hover:bg-neutral-50">
                <ScopeLabel cycle={row} t={t} />
              </td>
              <td className="border-b border-neutral-200 px-4 py-3 text-right align-middle group-hover:bg-neutral-50">
                {row.totalEmployees}
              </td>
              <td className="border-b border-neutral-200 px-4 py-3 text-right align-middle group-hover:bg-neutral-50">
                {row.completedCount}/{row.totalEmployees}
              </td>
              <td className="border-b border-neutral-200 px-4 py-3 align-middle group-hover:bg-neutral-50">
                <EvaluationProgressBar percent={row.progressPercent} />
              </td>
              <td className="border-b border-neutral-200 px-4 py-3 text-center align-middle group-hover:bg-neutral-50">
                <CycleStatusPill status={row.status} />
              </td>
              <td className="border-b border-neutral-200 px-4 py-3 text-right align-middle group-hover:bg-neutral-50">
                <div className="inline-flex items-center gap-1">
                  <button
                    type="button"
                    onClick={() => onView(row.id)}
                    aria-label={`${t('evaluations.viewDetail')} ${row.name}`}
                    className="inline-flex h-8 w-8 items-center justify-center rounded-md text-neutral-500 hover:bg-neutral-100 hover:text-neutral-900"
                  >
                    <Eye className="h-4 w-4" aria-hidden="true" />
                  </button>
                  <button
                    type="button"
                    onClick={() => onReview(row.id)}
                    aria-label={`${t('evaluations.openCycle')} ${row.name}`}
                    className="inline-flex h-8 items-center gap-1 rounded-md bg-brand-50 px-2 text-xs font-medium text-brand-700 hover:bg-brand-100"
                  >
                    <ClipboardList className="h-3.5 w-3.5" aria-hidden="true" />
                    <span>{t('evaluations.openCycle')}</span>
                  </button>
                  {row.status !== 'closed' && onEdit && (
                    <button
                      type="button"
                      onClick={() => onEdit(row.id)}
                      aria-label={`${t('evaluations.editCycle')} ${row.name}`}
                      className="inline-flex h-8 items-center gap-1 rounded-md border border-neutral-200 px-2 text-xs font-medium text-neutral-700 hover:bg-neutral-100"
                    >
                      <Pencil className="h-3.5 w-3.5" aria-hidden="true" />
                      <span>{t('evaluations.editCycle')}</span>
                    </button>
                  )}
                  {row.status !== 'closed' && onClose && (
                    <button
                      type="button"
                      onClick={() => onClose(row.id)}
                      aria-label={`${t('evaluations.closeCycle')} ${row.name}`}
                      className="inline-flex h-8 items-center gap-1 rounded-md bg-danger-500 px-2 text-xs font-medium text-white hover:bg-danger-600"
                    >
                      <Archive className="h-3.5 w-3.5" aria-hidden="true" />
                      <span>{t('evaluations.closeCycle')}</span>
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

function ScopeLabel({ cycle, t }) {
  if (cycle.employeeIds?.length) {
    return <span>{t('evaluations.specifiedEmployees', { n: cycle.employeeIds.length })}</span>
  }
  if (cycle.departmentIds?.length) {
    return <span>{t('evaluations.departmentsSelected', { n: cycle.departmentIds.length })}</span>
  }
  return <span>{t('evaluations.wholeCompany')}</span>
}
