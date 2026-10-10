import { Eye } from 'lucide-react'
import { useI18n } from '../../i18n/useI18n'

import Table from '../common/Table'
import Button from '../common/Button'
import SecurityActivityTypeBadge from './SecurityActivityTypeBadge'
import SecurityActivityStatusBadge from './SecurityActivityStatusBadge'
import { formatDateTime } from '../../utils/format'

/**
 * SecurityActivityTable - bảng security activity chỉ-đọc.
 */
export default function SecurityActivityTable({
  data = [],
  loading = false,
  pagination,
  onView,
}) {
  const { t } = useI18n()
  const columns = [
    {
      key: 'type',
      header: t('security.component.activity'),
      render: (row) => <SecurityActivityTypeBadge type={row.type} />,
    },
    {
      key: 'actor',
      header: t('security.component.actor'),
      render: (row) => (
        <div className="flex flex-col">
          <span className="text-sm font-medium text-neutral-900">{row.actorName}</span>
          <span className="font-mono text-[11px] text-neutral-500">{row.actorId}</span>
        </div>
      ),
    },
    {
      key: 'description',
      header: t('security.component.description'),
      render: (row) => <span className="text-sm text-neutral-700">{row.description}</span>,
    },
    {
      key: 'status',
      header: t('security.component.status'),
      render: (row) => <SecurityActivityStatusBadge status={row.status} />,
    },
    {
      key: 'ip',
      header: t('security.component.ipCol'),
      render: (row) => (
        <span className="font-mono text-[12px] text-neutral-700">{row.ipAddress}</span>
      ),
    },
    {
      key: 'createdAt',
      header: t('security.component.createdAt'),
      render: (row) => (
        <span className="text-[13px] text-neutral-700">{formatDateTime(row.createdAt)}</span>
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
      emptyTitle={t('security.component.noSecurityActivities')}
      emptyDescription={t('security.component.emptyList')}
      actions={(row) => (
        <Button variant="ghost" size="sm" icon={Eye} aria-label={t('security.component.viewDetail')} onClick={() => onView?.(row)} />
      )}
    />
  )
}