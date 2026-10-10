import { useI18n } from '../../i18n/useI18n'
import Avatar from '../common/Avatar'
import Badge from '../common/Badge'
import Table from '../common/Table'

/**
 * RecentEmployeesTable - bảng nhân viên mới, dùng chung Table.
 */
export default function RecentEmployeesTable({ rows, loading = false }) {
  const { t } = useI18n()
  const columns = [
    {
      key: 'name',
      header: t('common.component.employee'),
      render: (row) => (
        <div className="flex min-w-0 items-center gap-3">
          <Avatar name={row.name} size="sm" />
          <div className="min-w-0">
            <div className="truncate font-medium text-neutral-900">{row.name}</div>
            <div className="truncate text-xs text-neutral-500">{row.email}</div>
          </div>
        </div>
      ),
    },
    {
      key: 'jobTitle',
      header: t('common.component.position'),
      render: (row) => (
        <div className="min-w-0">
          <div className="truncate text-sm text-neutral-700">{row.jobTitle}</div>
          <div className="truncate text-xs text-neutral-500">{row.department}</div>
        </div>
      ),
    },
    {
      key: 'status',
      header: t('common.component.status'),
      align: 'center',
      render: (row) => (
        <Badge tone={row.status === 'Đang làm' ? 'active' : 'inactive'}>
          {row.status}
        </Badge>
      ),
    },
    { key: 'joinedAt', header: t('common.component.joinedAt'), align: 'right' },
  ]

  return (
    <Table
      columns={columns}
      data={rows}
      rowKey="id"
      loading={loading}
      emptyTitle={t('common.component.noNewEmployees')}
      emptyDescription={t('common.component.noNewEmployeesDesc')}
    />
  )
}