import { ChevronLeft, ChevronRight, Inbox } from 'lucide-react'

import EmptyState from './EmptyState'
import Loading from './Loading'
import { useI18n } from '../../i18n/useI18n'
import { classNames } from '../../utils/format'

/**
 * Table - generic data table.
 *
 * columns: [{ key, header, align, width, render(row) }]
 * data: Array<object>
 * rowKey: string (default 'id')
 * loading: boolean
 * emptyTitle / emptyDescription
 * pagination: { page, pageSize, total, onChange(newPage) }
 * actions: optional ReactNode rendered in a trailing actions column header.
 */
export default function Table({
  columns,
  data = [],
  rowKey = 'id',
  loading = false,
  emptyTitle,
  emptyDescription,
  pagination,
  actions,
  className = '',
}) {
  const { t } = useI18n()
  const pageSize = pagination?.pageSize ?? 10
  const total = pagination?.total ?? data.length
  const page = pagination?.page ?? 1
  const totalPages = Math.max(1, Math.ceil(total / pageSize))
  const start = (page - 1) * pageSize
  const visibleRows = pagination ? data.slice(start, start + pageSize) : data

  const goTo = (next) => {
    if (!pagination?.onChange) return
    const clamped = Math.min(Math.max(1, next), totalPages)
    pagination.onChange(clamped)
  }

  const cols = actions
    ? [
        ...columns,
        {
          key: '__actions',
          header: '',
          align: 'right',
          width: 120,
          render: (row) => (
            <div className="flex items-center justify-end gap-1">
              {typeof actions === 'function' ? actions(row) : actions}
            </div>
          ),
        },
      ]
    : columns

  return (
    <div className={classNames('flex flex-col', className)}>
      <div className="w-full overflow-x-auto rounded-lg border border-neutral-200 bg-white shadow-card">
        <table className="w-full border-separate border-spacing-0 text-sm text-neutral-700">
          <thead>
            <tr>
              {cols.map((col) => (
                <th
                  key={col.key}
                  style={{ width: col.width, textAlign: col.align || 'left' }}
                  className="border-b border-neutral-200 bg-neutral-50 px-4 py-3 text-xs font-semibold uppercase tracking-wider text-neutral-500 whitespace-nowrap"
                >
                  {col.header}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {loading && (
              <tr>
                <td colSpan={cols.length} className="px-4 py-10 text-center">
                  <Loading size="md" label={t('common.component.loading')} />
                </td>
              </tr>
            )}

            {!loading && visibleRows.length === 0 && (
              <tr>
                <td colSpan={cols.length} className="p-0">
                  <EmptyState
                    icon={Inbox}
                    title={emptyTitle ?? t('common.component.noDataYet')}
                    description={emptyDescription ?? t('common.component.emptyList')}
                    className="border-0 shadow-none rounded-none"
                  />
                </td>
              </tr>
            )}

            {!loading &&
              visibleRows.map((row, rowIndex) => (
                <tr key={row[rowKey] ?? rowIndex} className="group">
                  {cols.map((col) => (
                    <td
                      key={col.key}
                      style={{ textAlign: col.align || 'left' }}
                      className="border-b border-neutral-200 px-4 py-3 align-middle last:border-b-0 group-hover:bg-neutral-50"
                    >
                      {col.render ? col.render(row) : row[col.key]}
                    </td>
                  ))}
                </tr>
              ))}
          </tbody>
        </table>
      </div>

      {pagination && total > 0 && (
        <div className="mt-3 flex flex-col items-center justify-between gap-2 text-[13px] text-neutral-500 sm:flex-row">
          <span>
            {t('common.page')} <b className="text-neutral-900">{start + 1}</b>–
            <b className="text-neutral-900">{Math.min(start + pageSize, total)}</b> {t('common.of')}{' '}
            <b className="text-neutral-900">{total}</b> {t('dashboard.component.employees')}
          </span>
          <div className="flex items-center gap-1">
            <button
              type="button"
              onClick={() => goTo(page - 1)}
              disabled={page <= 1}
              className="inline-flex h-8 items-center gap-1 rounded-md border border-neutral-200 bg-white px-2.5 text-sm text-neutral-700 hover:bg-neutral-50 disabled:cursor-not-allowed disabled:opacity-50"
            >
              <ChevronLeft className="h-4 w-4" />
              {t('employees.component.previous')}
            </button>
            <span className="px-2 text-neutral-700">
              {t('employees.component.page')} <b className="text-neutral-900">{page}</b> / {totalPages}
            </span>
            <button
              type="button"
              onClick={() => goTo(page + 1)}
              disabled={page >= totalPages}
              className="inline-flex h-8 items-center gap-1 rounded-md border border-neutral-200 bg-white px-2.5 text-sm text-neutral-700 hover:bg-neutral-50 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {t('employees.component.next')}
              <ChevronRight className="h-4 w-4" />
            </button>
          </div>
        </div>
      )}
    </div>
  )
}