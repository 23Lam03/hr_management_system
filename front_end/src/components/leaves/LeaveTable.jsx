import { Eye, Check, X, Ban } from 'lucide-react'

import LeaveStatusPill from './LeaveStatusPill'
import LeaveSortableTh from './LeaveSortableTh'

import { LEAVE_TYPE_LABEL } from '../../data/leaveMockData'
import { formatDate } from '../../utils/format'
import { useI18n } from '../../i18n/useI18n'

/**
 * LeaveTable - danh sách đơn nghỉ phép với sort + thao tác.
 */
export default function LeaveTable({
  rows,
  loading,
  sortBy,
  sortDir,
  onSort,
  onView,
  onApprove,
  onReject,
  onCancel,
  currentUserEmployeeId,
  isAdminView = true,
}) {
  const { t } = useI18n()

  const sortableKeys = {
    submittedAt: t('leaves.component.submittedAt'),
    startDate: t('leaves.component.startDate'),
    status: t('leaves.component.status'),
  }
  const sortableColumns = ['submittedAt', 'startDate', 'status']

  return (
    <div className="w-full overflow-x-auto rounded-lg border border-neutral-200 bg-white shadow-card">
      <table className="w-full border-separate border-spacing-0 text-sm text-neutral-700">
        <thead>
          <tr>
            <th className="border-b border-neutral-200 bg-neutral-50 px-4 py-3 text-xs font-semibold uppercase tracking-wider text-neutral-500 whitespace-nowrap">{t('leaves.component.requestCode')}</th>
            <th className="border-b border-neutral-200 bg-neutral-50 px-4 py-3 text-xs font-semibold uppercase tracking-wider text-neutral-500 whitespace-nowrap">{t('leaves.component.employee')}</th>
            <th className="border-b border-neutral-200 bg-neutral-50 px-4 py-3 text-xs font-semibold uppercase tracking-wider text-neutral-500 whitespace-nowrap">{t('leaves.component.department')}</th>
            <th className="border-b border-neutral-200 bg-neutral-50 px-4 py-3 text-xs font-semibold uppercase tracking-wider text-neutral-500 whitespace-nowrap">{t('leaves.component.leaveType')}</th>
            {sortableColumns.map((key) => (
              <LeaveSortableTh
                key={key}
                field={key}
                currentField={sortBy}
                currentDir={sortDir}
                onSort={onSort}
              >
                {sortableKeys[key]}
              </LeaveSortableTh>
            ))}
            <th className="border-b border-neutral-200 bg-neutral-50 px-4 py-3 text-xs font-semibold uppercase tracking-wider text-neutral-500 whitespace-nowrap text-right">{t('leaves.component.totalDays')}</th>
            <th className="border-b border-neutral-200 bg-neutral-50 px-4 py-3 text-xs font-semibold uppercase tracking-wider text-neutral-500 whitespace-nowrap text-center">{t('leaves.component.status')}</th>
            <th className="border-b border-neutral-200 bg-neutral-50 px-4 py-3 text-xs font-semibold uppercase tracking-wider text-neutral-500 whitespace-nowrap text-right">{t('leaves.component.actions')}</th>
          </tr>
        </thead>
        <tbody>
          {loading && (
            <tr>
              <td colSpan={9} className="px-4 py-10 text-center text-sm text-neutral-500">
                {t('common.loading')}
              </td>
            </tr>
          )}
          {!loading && rows.length === 0 && (
            <tr>
              <td colSpan={9} className="px-4 py-10 text-center text-sm text-neutral-500">
                {t('leaves.component.emptyRows')}
              </td>
            </tr>
          )}
          {!loading && rows.map((row) => (
            <tr key={row.id} className="group">
              <td className="border-b border-neutral-200 px-4 py-3 align-middle group-hover:bg-neutral-50">
                <span className="font-mono text-[13px] text-neutral-700">{row.requestCode}</span>
              </td>
              <td className="border-b border-neutral-200 px-4 py-3 align-middle group-hover:bg-neutral-50">
                <div className="flex min-w-[200px] flex-col">
                  <span className="font-medium text-neutral-900">{row.employeeName}</span>
                  <span className="text-xs text-neutral-500">{row.employeeCode}</span>
                </div>
              </td>
              <td className="border-b border-neutral-200 px-4 py-3 align-middle group-hover:bg-neutral-50">{row.departmentName}</td>
              <td className="border-b border-neutral-200 px-4 py-3 align-middle group-hover:bg-neutral-50">
                {LEAVE_TYPE_LABEL[row.leaveType] ?? row.leaveType}
              </td>
              <td className="border-b border-neutral-200 px-4 py-3 align-middle group-hover:bg-neutral-50">
                {formatDate(row.startDate)}
              </td>
              <td className="border-b border-neutral-200 px-4 py-3 align-middle group-hover:bg-neutral-50">
                {formatDate(row.endDate)}
              </td>
              <td className="border-b border-neutral-200 px-4 py-3 text-right align-middle group-hover:bg-neutral-50">
                {row.totalDays}
              </td>
              <td className="border-b border-neutral-200 px-4 py-3 text-center align-middle group-hover:bg-neutral-50">
                <LeaveStatusPill status={row.status} />
              </td>
              <td className="border-b border-neutral-200 px-4 py-3 text-right align-middle group-hover:bg-neutral-50">
                <div className="inline-flex items-center gap-1">
                  <button
                    type="button"
                    onClick={() => onView(row.id)}
                    aria-label={t('leaves.component.viewRequestAria', { n: row.requestCode })}
                    className="inline-flex h-8 w-8 items-center justify-center rounded-md text-neutral-500 hover:bg-neutral-100 hover:text-neutral-900"
                  >
                    <Eye className="h-4 w-4" aria-hidden="true" />
                  </button>
                  {isAdminView && row.status === 'pending' && (
                    <>
                      <button
                        type="button"
                        onClick={() => onApprove(row.id)}
                        aria-label={t('leaves.component.approveRequestAria', { n: row.requestCode })}
                        className="inline-flex h-8 items-center gap-1 rounded-md bg-success-500 px-2 text-xs font-medium text-white hover:bg-success-600"
                      >
                        <Check className="h-3.5 w-3.5" aria-hidden="true" />
                        <span>{t('leaves.component.approve')}</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => onReject(row.id)}
                        aria-label={t('leaves.component.rejectRequestAria', { n: row.requestCode })}
                        className="inline-flex h-8 items-center gap-1 rounded-md bg-danger-500 px-2 text-xs font-medium text-white hover:bg-danger-600"
                      >
                        <X className="h-3.5 w-3.5" aria-hidden="true" />
                        <span>{t('leaves.component.reject')}</span>
                      </button>
                    </>
                  )}
                  {!isAdminView && row.status === 'pending' && row.employeeId === currentUserEmployeeId && onCancel && (
                    <button
                      type="button"
                      onClick={() => onCancel(row.id)}
                      aria-label={t('leaves.component.cancelRequestAria', { n: row.requestCode })}
                      className="inline-flex h-8 items-center gap-1 rounded-md bg-neutral-200 px-2 text-xs font-medium text-neutral-700 hover:bg-neutral-300"
                    >
                      <Ban className="h-3.5 w-3.5" aria-hidden="true" />
                      <span>{t('leaves.component.cancel')}</span>
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
