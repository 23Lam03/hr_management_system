import { ArrowDown, ArrowUp, Eye, Pencil, Trash2 } from 'lucide-react'

import Table from '../common/Table'
import Button from '../common/Button'
import RecruitmentStatusBadge from './RecruitmentStatusBadge'
import { classNames } from '../../utils/format'
import { useI18n } from '../../i18n/useI18n'

const SORTABLE = [
  { key: 'candidateName', label: 'Candidate' },
  { key: 'appliedAt',     label: 'Applied Date' },
]

/**
 * ApplicationTable - danh sách application.
 */
export default function ApplicationTable({
  rows,
  loading,
  pagination,
  sortBy,
  sortDir,
  onSortChange,
  statusOptions,
  onChangeStatus,
  onView,
  onEdit,
  onDelete,
}) {
  const { t } = useI18n()
  const columns = [
    {
      key: 'candidateName',
      header: t('recruitment.component.candidate'),
      render: (r) => (
        <div className="flex flex-col">
          <span className="text-sm font-medium text-neutral-900">{r.candidateName}</span>
          <span className="font-mono text-[11px] text-neutral-500">{r.id}</span>
        </div>
      ),
    },
    {
      key: 'jobTitle',
      header: t('recruitment.component.job'),
      render: (r) => (
        <span className="text-sm text-neutral-800">{r.jobTitle ?? '—'}</span>
      ),
    },
    { key: 'email', header: t('recruitment.component.email'), render: (r) => r.email || '—' },
    { key: 'phone', header: t('recruitment.component.phone'), render: (r) => r.phone || '—' },
    {
      key: 'appliedAt',
      header: t('recruitment.component.appliedDateCol'),
      render: (r) => (r.appliedAt ? formatShort(r.appliedAt) : '—'),
    },
    {
      key: 'status',
      header: t('recruitment.component.status'),
      render: (r) => (
        <div className="flex items-center gap-2">
          <RecruitmentStatusBadge kind="application" value={r.status} />
          {onChangeStatus && (
            <select
              aria-label={t('recruitment.component.changeStatus')}
              value={r.status}
              onChange={(e) => onChangeStatus(r, e.target.value)}
              className="h-7 rounded-md border border-neutral-200 bg-white px-2 text-[12px] text-neutral-700 focus:border-brand-600 focus:outline-none focus:ring-1 focus:ring-brand-600/30"
            >
              {statusOptions.map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </select>
          )}
        </div>
      ),
    },
  ]

  const columnsWithSort = columns.map((col) => {
    const sortDef = SORTABLE.find((s) => s.key === col.key)
    if (!sortDef) return col
    return {
      ...col,
      header: (
        <button
          type="button"
          onClick={() => {
            if (!onSortChange) return
            const nextDir = sortBy === col.key ? (sortDir === 'asc' ? 'desc' : 'asc') : 'asc'
            onSortChange(col.key, nextDir)
          }}
          className={classNames(
            'inline-flex items-center gap-1 text-xs font-semibold uppercase tracking-wider',
            sortBy === col.key ? 'text-neutral-900' : 'text-neutral-500 hover:text-neutral-700',
          )}
        >
          {sortDef.label}
          {sortBy === col.key && (
            sortDir === 'asc'
              ? <ArrowUp className="h-3 w-3" aria-hidden="true" />
              : <ArrowDown className="h-3 w-3" aria-hidden="true" />
          )}
        </button>
      ),
    }
  })

  return (
    <Table
      columns={columnsWithSort}
      data={rows}
      loading={loading}
      rowKey="id"
      pagination={pagination}
      actions={(r) => (
        <div className="flex items-center justify-end gap-1">
          <Button
            variant="ghost"
            size="sm"
            icon={Eye}
            onClick={() => onView?.(r)}
            aria-label={t('recruitment.component.viewDetail')}
          />
          <Button
            variant="ghost"
            size="sm"
            icon={Pencil}
            onClick={() => onEdit?.(r)}
            aria-label={t('common.edit')}
          />
          <Button
            variant="ghost"
            size="sm"
            icon={Trash2}
            onClick={() => onDelete?.(r)}
            aria-label={t('common.delete')}
            className="text-danger-600 hover:bg-danger-50"
          />
        </div>
      )}
      emptyTitle={t('recruitment.component.noApplicationsFound')}
      emptyDescription={t('recruitment.component.applicationsAppearHere')}
    />
  )
}

function formatShort(s) {
  if (!s || typeof s !== 'string') return '—'
  const [y, m, d] = s.split('-')
  if (!y || !m || !d) return s
  return `${d}/${m}/${y}`
}
