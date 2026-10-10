import { useNavigate } from 'react-router-dom'
import { ArrowRight, CalendarClock, CircleCheck } from 'lucide-react'

import Modal from '../common/Modal'
import Button from '../common/Button'
import NotificationTypeBadge from './NotificationTypeBadge'
import NotificationPriorityBadge from './NotificationPriorityBadge'
import { formatFullDateTime, formatRelativeTime, relatedEntityRoute, relatedEntityLabel } from '../../utils/notificationUtils'
import { useI18n } from '../../i18n/useI18n'

export default function NotificationDetailModal({
  open,
  onClose,
  notification,
  recipientName,
  role,
  onMarkRead,
  onMarkUnread,
}) {
  const { t } = useI18n()
  const navigate = useNavigate()

  if (!notification) return null
  const link = relatedEntityRoute(notification.relatedEntityType, role)
  const entityLabel = relatedEntityLabel(notification.relatedEntityType)

  const handleViewEntity = () => {
    if (!link) return
    onClose?.()
    navigate(link)
  }

  const handleMarkRead = async () => {
    await onMarkRead?.(notification)
    onClose?.()
  }

  const handleMarkUnread = async () => {
    await onMarkUnread?.(notification)
    onClose?.()
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={notification.title}
      description={formatRelativeTime(notification.createdAt)}
      size="lg"
      footer={
        <>
          {notification.isRead ? (
            <Button variant="secondary" onClick={handleMarkUnread}>
              {t('notificationsComponent.markUnread')}
            </Button>
          ) : (
            <Button variant="secondary" onClick={handleMarkRead}>
              {t('notificationsComponent.markRead')}
            </Button>
          )}
          {link && (
            <Button variant="primary" onClick={handleViewEntity} icon={ArrowRight} iconPosition="right">
              {t('notificationsComponent.viewEntity', { n: entityLabel })}
            </Button>
          )}
        </>
      }
    >
      <div className="flex flex-col gap-5">
        <div className="flex flex-wrap items-center gap-2">
          <NotificationTypeBadge type={notification.type} />
          <NotificationPriorityBadge priority={notification.priority} />
          <span
            className={`inline-flex h-[22px] items-center rounded-full px-2 text-xs font-medium ${
              notification.isRead
                ? 'bg-neutral-100 text-neutral-600'
                : 'bg-brand-50 text-brand-700'
            }`}
          >
            {notification.isRead ? t('notificationsComponent.read') : t('notificationsComponent.unread')}
          </span>
        </div>

        <div className="rounded-md bg-neutral-50 px-4 py-3 text-sm text-neutral-700">
          {notification.message}
        </div>

        <dl className="grid grid-cols-1 gap-3 text-sm sm:grid-cols-2">
          <div>
            <dt className="text-xs text-neutral-500">{t('notificationsComponent.recipient')}</dt>
            <dd className="text-neutral-900">{recipientName ?? notification.recipientId}</dd>
          </div>
          <div>
            <dt className="text-xs text-neutral-500">{t('notificationsComponent.type')}</dt>
            <dd className="text-neutral-900">
              <NotificationTypeBadge type={notification.type} withIcon={false} />
            </dd>
          </div>
          <div>
            <dt className="text-xs text-neutral-500">{t('notificationsComponent.priority')}</dt>
            <dd className="text-neutral-900">
              <NotificationPriorityBadge priority={notification.priority} />
            </dd>
          </div>
          <div>
            <dt className="text-xs text-neutral-500">{t('notificationsComponent.notificationStatus')}</dt>
            <dd className="inline-flex items-center gap-1 text-neutral-900">
              {notification.isRead ? (
                <>
                  <CircleCheck className="h-4 w-4 text-success-600" aria-hidden="true" />
                  {t('notificationsComponent.readAt', { n: formatFullDateTime(notification.readAt) })}
                </>
              ) : (
                <>
                  <span className="h-1.5 w-1.5 rounded-full bg-brand-600" aria-hidden="true" />
                  {t('notificationsComponent.unread')}
                </>
              )}
            </dd>
          </div>
          <div>
            <dt className="text-xs text-neutral-500">{t('notificationsComponent.createdAt')}</dt>
            <dd className="inline-flex items-center gap-1 text-neutral-900">
              <CalendarClock className="h-4 w-4 text-neutral-400" aria-hidden="true" />
              {formatFullDateTime(notification.createdAt)}
            </dd>
          </div>
          <div>
            <dt className="text-xs text-neutral-500">{t('notificationsComponent.notificationId')}</dt>
            <dd className="font-mono text-xs text-neutral-700">{notification.id}</dd>
          </div>
        </dl>

        {notification.relatedEntityType && (
          <div className="rounded-md border border-neutral-200 bg-white px-4 py-3 text-sm">
            <p className="text-xs text-neutral-500">{t('notificationsComponent.relatedEntity')}</p>
            <p className="mt-1 text-neutral-900">
              {t('notificationsComponent.entityLabel', { n: entityLabel })}{' '}
              <span className="font-mono text-xs">{notification.relatedEntityId}</span>
            </p>
            {link && (
              <button
                type="button"
                onClick={handleViewEntity}
                className="mt-2 inline-flex items-center gap-1 text-sm font-medium text-brand-600 hover:underline"
              >
                {t('notificationsComponent.viewDetail')}
                <ArrowRight className="h-3.5 w-3.5" aria-hidden="true" />
              </button>
            )}
          </div>
        )}
      </div>
    </Modal>
  )
}
