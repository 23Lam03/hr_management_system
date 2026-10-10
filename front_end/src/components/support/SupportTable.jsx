import { Eye, Pencil, UserCheck2, Trash2, XCircle } from 'lucide-react'
import { useI18n } from '../../i18n/useI18n'

import Table from '../common/Table'
import Button from '../common/Button'
import SupportCategoryBadge from './SupportCategoryBadge'
import SupportPriorityBadge from './SupportPriorityBadge'
import SupportStatusBadge from './SupportStatusBadge'
import { formatDateTime } from '../../utils/format'

/**
 * SupportTable - bảng support request chung cho admin & employee.
 *
 * Props:
 * - data: array
 * - loading: boolean
 * - pagination
 * - requesterLookup(id): label
 * - adminLookup(id): label
 * - showAssignee: bool
 * - actions: hàm (row) => ReactNode
 * - onCancel: (row) => void (employee)
 */
export default function SupportTable({
  data = [],
  loading = false,
  pagination,
  requesterLookup,
  adminLookup,
  showAssignee = false,
  onView,
  onEdit,
  onAssign,
  onUpdateStatus,
  onDelete,
  onCancel,
  variant = 'admin',
}) {
  const { t } = useI18n()
  const columns = [
    {
      key: 'id',
      header: t('support.component.requestId'),
      width: 110,
      render: (row) => (
        <span className="font-mono text-xs text-neutral-700">{row.id}</span>
      ),
    },
    {
      key: 'subject',
      header: t('support.component.subjectCol'),
      render: (row) => (
        <div className="flex flex-col">
          <span className="text-sm font-medium text-neutral-900">{row.subject}</span>
          <span className="line-clamp-1 text-xs text-neutral-500">{row.description}</span>
        </div>
      ),
    },
    ...(variant === 'admin' && requesterLookup
      ? [
          {
            key: 'requester',
            header: t('support.component.requester'),
            render: (row) => (
              <span className="text-sm text-neutral-700">
                {requesterLookup(row.requesterId) ?? row.requesterId}
              </span>
            ),
          },
        ]
      : []),
    {
      key: 'category',
      header: t('support.component.category'),
      render: (row) => <SupportCategoryBadge category={row.category} />,
    },
    {
      key: 'priority',
      header: t('support.component.priorityCol'),
      render: (row) => <SupportPriorityBadge priority={row.priority} />,
    },
    {
      key: 'status',
      header: t('support.component.statusCol'),
      render: (row) => <SupportStatusBadge status={row.status} />,
    },
    ...(showAssignee
      ? [
          {
            key: 'assignedTo',
            header: t('support.component.assignee'),
            render: (row) =>
              row.assignedTo ? (
                <span className="text-sm text-neutral-700">
                  {adminLookup?.(row.assignedTo) ?? row.assignedTo}
                </span>
              ) : (
                <span className="text-xs text-neutral-400">—</span>
              ),
          },
        ]
      : []),
    {
      key: 'createdAt',
      header: variant === 'admin' ? t('support.component.createdAt') : t('support.component.updated'),
      render: (row) => (
        <span className="text-[13px] text-neutral-700">
          {formatDateTime(variant === 'admin' ? row.createdAt : row.updatedAt)}
        </span>
      ),
    },
  ]

  return (
    <Table
      columns={columns}
      data={data}
      loading={loading}
      rowKey="id"
      pagination={pagination}
      emptyTitle={t('support.component.noSupportRequests')}
      emptyDescription={t('support.component.emptyListCreateNew')}
      actions={(row) => (
        <>
          {onView && (
            <Button variant="ghost" size="sm" icon={Eye} aria-label={t('support.component.viewActions')} onClick={() => onView(row)} />
          )}
          {variant === 'admin' ? (
            <>
              {onUpdateStatus && (
                <Button
                  variant="ghost"
                  size="sm"
                  icon={Pencil}
                  aria-label={t('support.component.updateStatus')}
                  onClick={() => onUpdateStatus(row)}
                />
              )}
              {onAssign && (
                <Button
                  variant="ghost"
                  size="sm"
                  icon={UserCheck2}
                  aria-label={t('support.component.assign')}
                  onClick={() => onAssign(row)}
                />
              )}
              {onDelete && (
                <Button
                  variant="ghost"
                  size="sm"
                  icon={Trash2}
                  aria-label={t('support.component.delete')}
                  onClick={() => onDelete(row)}
                />
              )}
            </>
          ) : (
            <>
              {onEdit && (
                <Button
                  variant="ghost"
                  size="sm"
                  icon={Pencil}
                  aria-label={t('support.component.edit')}
                  onClick={() => onEdit(row)}
                />
              )}
              {onCancel && row.status === 'open' && (
                <Button
                  variant="ghost"
                  size="sm"
                  icon={XCircle}
                  aria-label={t('support.component.cancelRequest')}
                  onClick={() => onCancel(row)}
                />
              )}
            </>
          )}
        </>
      )}
    />
  )
}