import { ArrowDown, ArrowUp, Check, Eye, Pencil, Trash2, X } from 'lucide-react'

import Table from '../common/Table'
import Button from '../common/Button'
import PromotionStatusBadge from './PromotionStatusBadge'
import { classNames } from '../../utils/format'
import { useI18n } from '../../i18n/useI18n'

const SORTABLE = [
  { key: 'effectiveDate', label: 'Effective Date' },
  { key: 'createdAt',     label: 'Created Date' },
  { key: 'status',        label: 'Status' },
]

function EmployeeCell({ name, employeeId, employeeCode, missing }) {
  const { t } = useI18n()
  if (missing) {
    return <span className="text-sm text-neutral-500">{t('promotions.component.employeeNotFound')}</span>
  }
  return (
    <div className="flex items-center gap-2">
      <span className="inline-flex h-8 w-8 items-center justify-center rounded-full bg-brand-100 text-[11px] font-semibold text-brand-700">
        {initials(name)}
      </span>
      <div className="flex min-w-0 flex-col">
        <span className="truncate text-sm font-medium text-neutral-900">{name}</span>
        <span className="text-[11px] text-neutral-500">
          {employeeCode ? `${employeeCode} · ` : ''}{employeeId}
        </span>
      </div>
    </div>
  )
}

function initials(s) {
  if (!s) return '?'
  return String(s)
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0]?.toUpperCase())
    .join('')
}

/**
 * PromotionTable - bảng promotion + sort + actions.
 */
export default function PromotionTable({
  rows,
  loading,
  pagination,
  sortBy,
  sortDir,
  onSortChange,
  statusOptions,
  onChangeStatus,
  onApprove,
  onReject,
  onView,
  onEdit,
  onDelete,
}) {
  const { t } = useI18n()
  const columns = [
    {
      key: 'employee',
      header: t('promotions.component.employeeCol'),
      render: (r) => (
        <EmployeeCell
          name={r.employeeName}
          employeeCode={r.employeeCode}
          employeeId={r.employeeId}
          missing={r.missing}
        />
      ),
    },
    {
      key: 'positions',
      header: t('promotions.component.positionsCol'),
      render: (r) => (
        <div className="flex flex-col">
          <span className="text-sm text-neutral-700">
            <span className="text-neutral-500">{t('promotions.component.currentPositionShort')}:</span> {r.currentPosition || '—'}
          </span>
          <span className="text-sm font-medium text-neutral-900">
            <span className="text-neutral-500">{t('promotions.component.proposedPositionShort')}:</span> {r.proposedPosition}
          </span>
        </div>
      ),
    },
    {
      key: 'department',
      header: t('promotions.component.departmentCol'),
      render: (r) => (
        <div className="flex flex-col text-sm text-neutral-700">
          <span className="text-neutral-500">{r.currentDepartment || '—'}</span>
          {r.proposedDepartment && r.proposedDepartment !== r.currentDepartment && (
            <span className="font-medium text-neutral-900">{r.proposedDepartment}</span>
          )}
        </div>
      ),
    },
    {
      key: 'effectiveDate',
      header: t('promotions.component.effectiveDateCol'),
      render: (r) => (r.effectiveDate ? formatShort(r.effectiveDate) : '—'),
    },
    {
      key: 'status',
      header: t('promotions.component.statusCol'),
      render: (r) => (
        <div className="flex items-center gap-2">
          <PromotionStatusBadge value={r.status} />
          {onChangeStatus && (
            <select
              aria-label={t('promotions.component.changePromotionStatus')}
              value={r.status}
              onChange={(e) => onChangeStatus(r, e.target.value)}
              className="h-7 rounded-md border border-neutral-200 bg-white px-2 text-[12px] text-neutral-700 focus:border-brand-600 focus:outline-none focus:ring-1 focus:ring-brand-600/30"
            >
              {statusOptions.map((opt) => (
                <option key={opt.value} value={opt.value}>{opt.label}</option>
              ))}
            </select>
          )}
        </div>
      ),
    },
    {
      key: 'createdAt',
      header: t('promotions.component.createdDateCol'),
      render: (r) => (r.createdAt ? formatDate(r.createdAt) : '—'),
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
          {r.status === 'pending' && onApprove && (
            <Button
              variant="ghost"
              size="sm"
              icon={Check}
              onClick={() => onApprove(r)}
              aria-label={t('promotions.component.approve')}
              className="text-success-600 hover:bg-success-50"
            />
          )}
          {r.status === 'pending' && onReject && (
            <Button
              variant="ghost"
              size="sm"
              icon={X}
              onClick={() => onReject(r)}
              aria-label={t('promotions.component.reject')}
              className="text-danger-600 hover:bg-danger-50"
            />
          )}
          <Button
            variant="ghost"
            size="sm"
            icon={Eye}
            onClick={() => onView?.(r)}
            aria-label={t('promotions.component.viewDetailAction')}
          />
          <Button
            variant="ghost"
            size="sm"
            icon={Pencil}
            onClick={() => onEdit?.(r)}
            aria-label={t('promotions.component.edit')}
          />
          <Button
            variant="ghost"
            size="sm"
            icon={Trash2}
            onClick={() => onDelete?.(r)}
            aria-label={t('promotions.component.delete')}
            className="text-danger-600 hover:bg-danger-50"
          />
        </div>
      )}
      emptyTitle={t('promotions.component.noPromotionRecordsFound')}
      emptyDescription={t('promotions.component.createFirstPromotion')}
    />
  )
}

function formatShort(s) {
  if (!s || typeof s !== 'string') return '—'
  const [y, m, d] = s.split('-')
  if (!y || !m || !d) return s
  return `${d}/${m}/${y}`
}

function formatDate(s) {
  if (!s || typeof s !== 'string') return '—'
  const d = new Date(s)
  if (Number.isNaN(d.getTime())) return s
  const dd = String(d.getDate()).padStart(2, '0')
  const mm = String(d.getMonth() + 1).padStart(2, '0')
  const yyyy = d.getFullYear()
  return `${dd}/${mm}/${yyyy}`
}
