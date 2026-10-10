import { Eye, Check, MailOpen, Pencil, Trash2 } from 'lucide-react'

import Table from '../common/Table'
import Button from '../common/Button'
import NotificationTypeBadge from './NotificationTypeBadge'
import NotificationPriorityBadge from './NotificationPriorityBadge'
import { classNames } from '../../utils/format'
import { formatFullDateTime, formatRelativeTime } from '../../utils/notificationUtils'
import { useI18n } from '../../i18n/useI18n'

export default function NotificationTable({
  data = [],
  loading = false,
  pagination,
  recipientLookup,
  onView,
  onMarkRead,
  onMarkUnread,
  onEdit,
  onDelete,
}) {
  const { t } = useI18n()

  const columns = [
    {
      key: 'title',
      header: t('notificationsComponent.title'),
      render: (row) => (
        <div className="flex flex-col">
          <span
            className={classNames(
              'text-sm text-neutral-900',
              row.isRead ? 'font-normal' : 'font-semibold',
            )}
          >
            {row.title}
          </span>
          <span className="line-clamp-1 text-xs text-neutral-500">{row.message}</span>
        </div>
      ),
    },
    {
      key: 'type',
      header: t('notificationsComponent.type'),
      render: (row) => <NotificationTypeBadge type={row.type} />,
    },
    {
      key: 'recipient',
      header: t('notificationsComponent.recipient'),
      render: (row) => (
        <span className="text-sm text-neutral-700">
          {recipientLookup?.(row.recipientId) ?? row.recipientId}
        </span>
      ),
    },
    {
      key: 'priority',
      header: t('notificationsComponent.priority'),
      render: (row) => <NotificationPriorityBadge priority={row.priority} />,
    },
    {
      key: 'isRead',
      header: t('notificationsComponent.status'),
      render: (row) =>
        row.isRead ? (
          <span className="inline-flex h-[22px] items-center gap-1 rounded-full bg-neutral-100 px-2 text-xs font-medium text-neutral-600">
            <Check className="h-3.5 w-3.5 text-success-600" aria-hidden="true" />
            {t('notificationsComponent.read')}
          </span>
        ) : (
          <span className="inline-flex h-[22px] items-center gap-1 rounded-full bg-brand-50 px-2 text-xs font-medium text-brand-700">
            <span className="h-1.5 w-1.5 rounded-full bg-brand-600" aria-hidden="true" />
            {t('notificationsComponent.unread')}
          </span>
        ),
    },
    {
      key: 'createdAt',
      header: t('notificationsComponent.time'),
      render: (row) => (
        <div className="flex flex-col">
          <span className="text-[13px] text-neutral-900">{formatRelativeTime(row.createdAt)}</span>
          <span className="text-xs text-neutral-500">{formatFullDateTime(row.createdAt)}</span>
        </div>
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
      emptyTitle={t('notificationsComponent.emptyTitle')}
      emptyDescription={t('notificationsComponent.emptyDesc')}
      actions={(row) => (
        <>
          <Button
            variant="ghost"
            size="sm"
            icon={Eye}
            aria-label={t('notificationsComponent.viewDetail')}
            onClick={() => onView?.(row)}
          />
          {row.isRead ? (
            <Button
              variant="ghost"
              size="sm"
              icon={MailOpen}
              aria-label={t('notificationsComponent.markUnread')}
              onClick={() => onMarkUnread?.(row)}
            />
          ) : (
            <Button
              variant="ghost"
              size="sm"
              icon={Check}
              aria-label={t('notificationsComponent.markRead')}
              onClick={() => onMarkRead?.(row)}
            />
          )}
          <Button
            variant="ghost"
            size="sm"
            icon={Pencil}
            aria-label={t('notificationsComponent.edit')}
            onClick={() => onEdit?.(row)}
          />
          <Button
            variant="ghost"
            size="sm"
            icon={Trash2}
            aria-label={t('notificationsComponent.delete')}
            onClick={() => onDelete?.(row)}
          />
        </>
      )}
    />
  )
}
