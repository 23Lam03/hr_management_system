import { Eye, Pencil, CalendarPlus, Ban } from 'lucide-react'

import Avatar from '../common/Avatar'
import ContractStatusPill from './ContractStatusPill'

import { formatDate } from '../../utils/format'
import { CONTRACT_TYPE_LABEL } from '../../data/contractMockData'
import { useI18n } from '../../i18n/useI18n'

export default function ContractTable({
  rows,
  loading,
  onView,
  onEdit,
  onExtend,
  onTerminate,
}) {
  const { t } = useI18n()

  return (
    <div className="w-full overflow-x-auto rounded-lg border border-neutral-200 bg-white shadow-card">
      <table className="w-full border-separate border-spacing-0 text-sm text-neutral-700">
        <thead>
          <tr>
            <th className="border-b border-neutral-200 bg-neutral-50 px-4 py-3 text-xs font-semibold uppercase tracking-wider text-neutral-500 whitespace-nowrap">{t('contracts.contract')}</th>
            <th className="border-b border-neutral-200 bg-neutral-50 px-4 py-3 text-xs font-semibold uppercase tracking-wider text-neutral-500 whitespace-nowrap">{t('contracts.employee')}</th>
            <th className="border-b border-neutral-200 bg-neutral-50 px-4 py-3 text-xs font-semibold uppercase tracking-wider text-neutral-500 whitespace-nowrap">{t('contracts.contractType')}</th>
            <th className="border-b border-neutral-200 bg-neutral-50 px-4 py-3 text-xs font-semibold uppercase tracking-wider text-neutral-500 whitespace-nowrap">{t('contracts.signedDate')}</th>
            <th className="border-b border-neutral-200 bg-neutral-50 px-4 py-3 text-xs font-semibold uppercase tracking-wider text-neutral-500 whitespace-nowrap">{t('contracts.effectiveDate')}</th>
            <th className="border-b border-neutral-200 bg-neutral-50 px-4 py-3 text-xs font-semibold uppercase tracking-wider text-neutral-500 whitespace-nowrap">{t('contracts.expiryDate')}</th>
            <th className="border-b border-neutral-200 bg-neutral-50 px-4 py-3 text-xs font-semibold uppercase tracking-wider text-neutral-500 whitespace-nowrap text-center">{t('contracts.status')}</th>
            <th className="border-b border-neutral-200 bg-neutral-50 px-4 py-3 text-xs font-semibold uppercase tracking-wider text-neutral-500 whitespace-nowrap text-right">{t('contracts.actions')}</th>
          </tr>
        </thead>
        <tbody>
          {loading && (
            <tr><td colSpan={8} className="px-4 py-10 text-center text-sm text-neutral-500">{t('common.loading')}</td></tr>
          )}
          {!loading && rows.length === 0 && (
            <tr><td colSpan={8} className="px-4 py-10 text-center text-sm text-neutral-500">{t('contracts.noContracts')}</td></tr>
          )}
          {!loading && rows.map((row) => (
            <tr key={row.id} className="group">
              <td className="border-b border-neutral-200 px-4 py-3 align-middle group-hover:bg-neutral-50">
                <div className="flex min-w-[180px] flex-col">
                  <span className="font-mono text-[12px] text-neutral-500">{row.contractCode}</span>
                </div>
              </td>
              <td className="border-b border-neutral-200 px-4 py-3 align-middle group-hover:bg-neutral-50">
                <div className="flex items-center gap-3 min-w-[200px]">
                  <Avatar name={row.employeeName} size="sm" />
                  <div className="flex min-w-0 flex-col">
                    <span className="font-medium text-neutral-900">{row.employeeName}</span>
                    <span className="text-[12px] text-neutral-500">{row.employeeCode} · {row.departmentName}</span>
                  </div>
                </div>
              </td>
              <td className="border-b border-neutral-200 px-4 py-3 align-middle group-hover:bg-neutral-50">
                {CONTRACT_TYPE_LABEL[row.contractType] || row.contractType}
              </td>
              <td className="border-b border-neutral-200 px-4 py-3 align-middle group-hover:bg-neutral-50 whitespace-nowrap">
                {formatDate(row.signedDate)}
              </td>
              <td className="border-b border-neutral-200 px-4 py-3 align-middle group-hover:bg-neutral-50 whitespace-nowrap">
                {formatDate(row.effectiveDate)}
              </td>
              <td className="border-b border-neutral-200 px-4 py-3 align-middle group-hover:bg-neutral-50 whitespace-nowrap">
                {row.expiryDate ? formatDate(row.expiryDate) : <span className="text-neutral-400">—</span>}
              </td>
              <td className="border-b border-neutral-200 px-4 py-3 text-center align-middle group-hover:bg-neutral-50">
                <ContractStatusPill status={row.status} />
              </td>
              <td className="border-b border-neutral-200 px-4 py-3 text-right align-middle group-hover:bg-neutral-50">
                <div className="inline-flex items-center gap-1">
                  <button
                    type="button"
                    onClick={() => onView(row.id)}
                    aria-label={`${t('contracts.view')} ${row.contractCode}`}
                    className="inline-flex h-8 w-8 items-center justify-center rounded-md text-neutral-500 hover:bg-neutral-100 hover:text-neutral-900"
                  >
                    <Eye className="h-4 w-4" aria-hidden="true" />
                  </button>
                  {(row.status === 'active' || row.status === 'pending' || row.status === 'expired') && onExtend && (
                    <button
                      type="button"
                      onClick={() => onExtend(row.id)}
                      aria-label={`${t('contracts.extend')} ${row.contractCode}`}
                      className="inline-flex h-8 items-center gap-1 rounded-md bg-brand-50 px-2 text-xs font-medium text-brand-700 hover:bg-brand-100"
                    >
                      <CalendarPlus className="h-3.5 w-3.5" aria-hidden="true" />
                      <span>{t('contracts.extend')}</span>
                    </button>
                  )}
                  {(row.status === 'active' || row.status === 'pending') && onEdit && (
                    <button
                      type="button"
                      onClick={() => onEdit(row.id)}
                      aria-label={`${t('contracts.edit')} ${row.contractCode}`}
                      className="inline-flex h-8 items-center gap-1 rounded-md border border-neutral-200 px-2 text-xs font-medium text-neutral-700 hover:bg-neutral-100"
                    >
                      <Pencil className="h-3.5 w-3.5" aria-hidden="true" />
                      <span>{t('contracts.edit')}</span>
                    </button>
                  )}
                  {(row.status === 'active' || row.status === 'pending' || row.status === 'expired' || row.status === 'draft') && onTerminate && (
                    <button
                      type="button"
                      onClick={() => onTerminate(row.id)}
                      aria-label={`${t('contracts.terminate')} ${row.contractCode}`}
                      className="inline-flex h-8 items-center gap-1 rounded-md bg-danger-500 px-2 text-xs font-medium text-white hover:bg-danger-600"
                    >
                      <Ban className="h-3.5 w-3.5" aria-hidden="true" />
                      <span>{t('contracts.terminate')}</span>
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
