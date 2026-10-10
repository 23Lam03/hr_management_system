import { useNavigate } from 'react-router-dom'
import { Check, X } from 'lucide-react'
import { useI18n } from '../../i18n/useI18n'

import Badge from '../common/Badge'
import Button from '../common/Button'
import Table from '../common/Table'
import EmptyState from '../common/EmptyState'
import { useToast } from '../common/useToast'

const STATUS_TONE = {
  pending: 'pending',
  approved: 'approved',
  rejected: 'rejected',
}

const STATUS_LABEL = {
  pending: 'Chờ duyệt',
  approved: 'Đã duyệt',
  rejected: 'Từ chối',
}

/**
 * PendingLeaveTable - bảng đơn nghỉ phép đang chờ.
 *
 * Props:
 * - rows: danh sách đơn nghỉ phép (đã lọc status pending)
 * - onApprove / onReject: callback tuỳ chọn (demo - thay đổi UI)
 *
 * Lưu ý: đây là dữ liệu demo, không thật sự thay đổi trạng thái server.
 * Hai nút Approve/Reject chỉ mở toast để xác nhận hành vi hoạt động.
 */
export default function PendingLeaveTable({ rows, loading = false }) {
  const { t } = useI18n()
  const toast = useToast()
  const navigate = useNavigate()

  const handleAction = (row, kind) => {
    if (kind === 'approve') {
      toast.success(`${t('employees.component.approve')} ${t('dashboard.component.pendingLeave')} ${row.employeeName}`, {
        description: `${row.type} · ${row.from} → ${row.to}`,
      })
    } else {
      toast.warning(`${t('employees.component.reject')} ${t('dashboard.component.pendingLeave')} ${row.employeeName}`, {
        description: row.reason,
      })
    }
  }

  if (!loading && (!rows || rows.length === 0)) {
    return (
      <EmptyState
        title={t('dashboard.component.pendingLeave')}
        description={t('dashboard.component.allRequestsHandled')}
        actionLabel={t('dashboard.component.viewAll')}
        onAction={() => navigate('/admin/leave')}
      />
    )
  }

  const columns = [
    {
      key: 'employee',
      header: t('dashboard.component.employee'),
      render: (row) => (
        <div className="min-w-0">
          <div className="truncate font-medium text-neutral-900">{row.employeeName}</div>
          <div className="truncate text-xs text-neutral-500">{row.department}</div>
        </div>
      ),
    },
    {
      key: 'type',
      header: t('dashboard.component.type'),
      render: (row) => (
        <div className="min-w-0">
          <div className="text-sm text-neutral-700">{row.type}</div>
          <div className="text-xs text-neutral-500">{row.days} {t('dashboard.component.days')}</div>
        </div>
      ),
    },
    {
      key: 'range',
      header: t('dashboard.component.dateRange'),
      render: (row) => (
        <span className="text-sm text-neutral-700">
          {row.from} <span className="text-neutral-400">→</span> {row.to}
        </span>
      ),
    },
    {
      key: 'status',
      header: t('dashboard.component.status'),
      align: 'center',
      render: (row) => (
        <Badge tone={STATUS_TONE[row.status] ?? 'pending'}>
          {t(`status.${row.status}Short`) ?? row.status}
        </Badge>
      ),
    },
  ]

  return (
    <Table
      columns={columns}
      data={rows}
      rowKey="id"
      loading={loading}
      actions={(row) => (
        <div className="flex items-center justify-end gap-1">
          <Button
            variant="ghost"
            size="sm"
            icon={Check}
            onClick={() => handleAction(row, 'approve')}
          >
            {t('dashboard.component.approve')}
          </Button>
          <Button
            variant="ghost"
            size="sm"
            icon={X}
            onClick={() => handleAction(row, 'reject')}
          >
            {t('dashboard.component.reject')}
          </Button>
        </div>
      )}
    />
  )
}