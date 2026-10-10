import { Ban, Calendar } from 'lucide-react'

import Avatar from '../common/Avatar'
import EmployeeBenefitPill from './EmployeeBenefitPill'
import { useI18n } from '../../i18n/useI18n'

import { formatDate } from '../../utils/format'

export default function BenefitAssigneeTable({
  rows,
  loading,
  onCancel,
  canCancel,
}) {
  const { t } = useI18n()

  return (
    <div className="w-full overflow-x-auto rounded-lg border border-neutral-200 bg-white shadow-card">
      <table className="w-full border-separate border-spacing-0 text-sm text-neutral-700">
        <thead>
          <tr>
            <th className="border-b border-neutral-200 bg-neutral-50 px-4 py-3 text-xs font-semibold uppercase tracking-wider text-neutral-500 whitespace-nowrap">{t('benefitsComponent.employee')}</th>
            <th className="border-b border-neutral-200 bg-neutral-50 px-4 py-3 text-xs font-semibold uppercase tracking-wider text-neutral-500 whitespace-nowrap">{t('benefitsComponent.dept')}</th>
            <th className="border-b border-neutral-200 bg-neutral-50 px-4 py-3 text-xs font-semibold uppercase tracking-wider text-neutral-500 whitespace-nowrap">{t('benefitsComponent.position')}</th>
            <th className="border-b border-neutral-200 bg-neutral-50 px-4 py-3 text-xs font-semibold uppercase tracking-wider text-neutral-500 whitespace-nowrap">{t('benefitsComponent.startEnjoy')}</th>
            <th className="border-b border-neutral-200 bg-neutral-50 px-4 py-3 text-xs font-semibold uppercase tracking-wider text-neutral-500 whitespace-nowrap">{t('benefitsComponent.endEnjoy')}</th>
            <th className="border-b border-neutral-200 bg-neutral-50 px-4 py-3 text-xs font-semibold uppercase tracking-wider text-neutral-500 whitespace-nowrap text-center">{t('benefitsComponent.status')}</th>
            <th className="border-b border-neutral-200 bg-neutral-50 px-4 py-3 text-xs font-semibold uppercase tracking-wider text-neutral-500 whitespace-nowrap">{t('benefitsComponent.note')}</th>
            <th className="border-b border-neutral-200 bg-neutral-50 px-4 py-3 text-xs font-semibold uppercase tracking-wider text-neutral-500 whitespace-nowrap text-right">{t('benefitsComponent.actions')}</th>
          </tr>
        </thead>
        <tbody>
          {loading && (
            <tr><td colSpan={8} className="px-4 py-10 text-center text-sm text-neutral-500">{t('benefitsComponent.loading')}</td></tr>
          )}
          {!loading && rows.length === 0 && (
            <tr><td colSpan={8} className="px-4 py-10 text-center text-sm text-neutral-500">{t('benefitsComponent.noAssignees')}</td></tr>
          )}
          {!loading && rows.map((row) => (
            <tr key={row.id} className="group">
              <td className="border-b border-neutral-200 px-4 py-3 align-middle group-hover:bg-neutral-50">
                <div className="flex items-center gap-3 min-w-[220px]">
                  <Avatar name={row.employeeName} size="sm" />
                  <div className="flex min-w-0 flex-col">
                    <span className="font-medium text-neutral-900">{row.employeeName}</span>
                    <span className="font-mono text-[12px] text-neutral-500">{row.employeeCode}</span>
                  </div>
                </div>
              </td>
              <td className="border-b border-neutral-200 px-4 py-3 align-middle group-hover:bg-neutral-50">{row.departmentName}</td>
              <td className="border-b border-neutral-200 px-4 py-3 align-middle group-hover:bg-neutral-50">{row.position || '—'}</td>
              <td className="border-b border-neutral-200 px-4 py-3 align-middle group-hover:bg-neutral-50">{formatDate(row.startDate)}</td>
              <td className="border-b border-neutral-200 px-4 py-3 align-middle group-hover:bg-neutral-50">{row.endDate ? formatDate(row.endDate) : '—'}</td>
              <td className="border-b border-neutral-200 px-4 py-3 text-center align-middle group-hover:bg-neutral-50">
                <EmployeeBenefitPill status={row.status} />
              </td>
              <td className="border-b border-neutral-200 px-4 py-3 align-middle group-hover:bg-neutral-50 max-w-[220px]">
                <span className="line-clamp-2 text-[13px] text-neutral-600">{row.note || '—'}</span>
              </td>
              <td className="border-b border-neutral-200 px-4 py-3 text-right align-middle group-hover:bg-neutral-50">
                {canCancel && row.status === 'active' && (
                  <button
                    type="button"
                    onClick={() => onCancel(row.id)}
                    aria-label={t('benefitsComponent.cancelBenefitAria', { n: row.employeeName })}
                    className="inline-flex h-8 items-center gap-1 rounded-md bg-danger-500 px-2 text-xs font-medium text-white hover:bg-danger-600"
                  >
                    <Ban className="h-3.5 w-3.5" aria-hidden="true" />
                    <span>{t('benefitsComponent.cancelBenefit')}</span>
                  </button>
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      <span className="hidden"><Calendar aria-hidden="true" /></span>
    </div>
  )
}
