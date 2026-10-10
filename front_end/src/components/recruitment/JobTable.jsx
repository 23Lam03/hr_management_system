import { ArrowDown, ArrowUp, Eye, Pencil, Trash2 } from 'lucide-react'

import Table from '../common/Table'
import RecruitmentStatusBadge from './RecruitmentStatusBadge'
import Button from '../common/Button'
import { classNames } from '../../utils/format'
import { useI18n } from '../../i18n/useI18n'
import {
  DEPARTMENT_LABEL,
  EMPLOYMENT_TYPE_LABEL,
} from '../../data/recruitmentData'

const SORTABLE = [
  { key: 'title',       label: 'Job Title' },
  { key: 'postedAt',    label: 'Posted Date' },
  { key: 'closingDate', label: 'Closing Date' },
  { key: 'vacancies',   label: 'Vacancies' },
]

/**
 * JobTable - bảng job + sort + pagination.
 */
export default function JobTable({
  rows,
  loading,
  pagination,
  sortBy,
  sortDir,
  onSortChange,
  onView,
  onEdit,
  onDelete,
  onChangeStatus,
  statusOptions,
}) {
  const { t } = useI18n()
  const columns = [
    {
      key: 'title',
      header: t('recruitment.component.jobTitle'),
      render: (r) => (
        <div className="flex flex-col">
          <span className="text-sm font-semibold text-neutral-900">{r.title}</span>
          <span className="font-mono text-[11px] text-neutral-500">{r.id}</span>
        </div>
      ),
    },
    {
      key: 'department',
      header: t('recruitment.component.departmentCol'),
      render: (r) => DEPARTMENT_LABEL[r.departmentId] ?? '—',
    },
    { key: 'location', header: t('recruitment.component.locationCol'), render: (r) => r.location || '—' },
    {
      key: 'employmentType',
      header: t('recruitment.component.employmentTypeCol'),
      render: (r) => EMPLOYMENT_TYPE_LABEL[r.employmentType] ?? r.employmentType,
    },
    {
      key: 'vacancies',
      header: t('recruitment.component.vacanciesCol'),
      align: 'right',
      render: (r) => <span className="font-medium">{r.vacancies}</span>,
    },
    {
      key: 'applicationCount',
      header: t('recruitment.component.applicationsCol'),
      align: 'right',
      render: (r) => (
        <span className="rounded-md bg-neutral-100 px-2 py-0.5 text-[12px] font-medium text-neutral-700">
          {r.applicationCount ?? 0}
        </span>
      ),
    },
    {
      key: 'status',
      header: t('recruitment.component.status'),
      render: (r) => (
        <div className="flex items-center gap-2">
          <RecruitmentStatusBadge kind="job" value={r.status} />
          {onChangeStatus && (
            <select
              aria-label={t('recruitment.component.changeJobStatus')}
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
    {
      key: 'postedAt',
      header: t('recruitment.component.postedDateCol'),
      render: (r) => (r.postedAt ? formatShort(r.postedAt) : '—'),
    },
    {
      key: 'closingDate',
      header: t('recruitment.component.closingDateCol'),
      render: (r) => (r.closingDate ? formatShort(r.closingDate) : '—'),
    },
  ]

  // Thêm cột sort header (clickable) bằng cách render header cho 4 cột chính
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
      emptyTitle={t('recruitment.component.noJobPositionsFound')}
      emptyDescription={t('recruitment.component.createFirstJob')}
    />
  )
}

function formatShort(s) {
  // 'YYYY-MM-DD' -> 'DD/MM/YYYY'
  if (!s || typeof s !== 'string') return '—'
  const [y, m, d] = s.split('-')
  if (!y || !m || !d) return s
  return `${d}/${m}/${y}`
}
