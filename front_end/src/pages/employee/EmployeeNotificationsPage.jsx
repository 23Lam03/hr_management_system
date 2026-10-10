import { useCallback, useMemo, useState } from 'react'
import { Bell, CheckCheck } from 'lucide-react'

import PageHeader from '../../components/common/PageHeader'
import Button from '../../components/common/Button'
import Select from '../../components/common/Select'
import EmptyState from '../../components/common/EmptyState'
import Loading from '../../components/common/Loading'
import { useToast } from '../../components/common/useToast'
import { useI18n } from '../../i18n/useI18n'

import NotificationItem from '../../components/notifications/NotificationItem'
import NotificationDetailModal from '../../components/notifications/NotificationDetailModal'

import {
  markAsRead as svcMarkAsRead,
  markAsUnread as svcMarkAsUnread,
  markAllAsRead as svcMarkAllAsRead,
} from '../../services/notificationService'
import useNotifications from '../../contexts/useNotifications'
import { useAuth } from '../../contexts/useAuth'

const TYPE_OPTIONS = (t) => [
  { value: '',          label: t('employeeNotifications.allTypes') },
  { value: 'system',     label: t('employeeNotifications.system') },
  { value: 'leave',      label: t('employeeNotifications.leave') },
  { value: 'payroll',    label: t('employeeNotifications.payroll') },
  { value: 'evaluation', label: t('employeeNotifications.evaluation') },
  { value: 'training',   label: t('employeeNotifications.training') },
  { value: 'benefit',    label: t('employeeNotifications.benefit') },
  { value: 'contract',   label: t('employeeNotifications.contract') },
  { value: 'attendance', label: t('employeeNotifications.attendance') },
]

export default function EmployeeNotificationsPage() {
  const toast = useToast()
  const { user } = useAuth()
  const { t } = useI18n()
  const { notifications, loading } = useNotifications() ?? { notifications: [], loading: false }
  const [scope, setScope] = useState('all') // 'all' | 'unread'
  const [type, setType] = useState('')
  const [openDetail, setOpenDetail] = useState(null)

  const visibleNotifications = useMemo(() => {
    return notifications
      .filter((n) => (scope === 'unread' ? !n.isRead : true))
      .filter((n) => (type ? n.type === type : true))
  }, [notifications, scope, type])

  const unreadCount = useMemo(
    () => notifications.filter((n) => !n.isRead).length,
    [notifications],
  )

  const handleOpen = useCallback((n) => {
    setOpenDetail(n)
    if (!n.isRead) {
      svcMarkAsRead(n.id)
    }
  }, [])

  const handleCloseDetail = useCallback(() => {
    setOpenDetail(null)
  }, [])

  const handleMarkAll = useCallback(async () => {
    if (!user) return
    const r = await svcMarkAllAsRead(user.id)
    if (r.ok) {
      toast.success(t('employeeNotifications.markAllSuccess'))
    } else {
      toast.error(t('employeeNotifications.cannotUpdate'))
    }
  }, [user, toast, t])

  const headerActions = useMemo(
    () => [
      <Button
        key="mark-all"
        variant="primary"
        size="md"
        icon={CheckCheck}
        onClick={handleMarkAll}
        disabled={unreadCount === 0}
      >
        {t('employeeNotifications.markAllRead')}
      </Button>,
    ],
    [unreadCount, handleMarkAll, t],
  )

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title={t('employeeNotifications.notifications')}
        subtitle={t('employeeNotifications.unreadCount', { n: unreadCount })}
        icon={Bell}
        actions={headerActions}
      />

      <div className="flex flex-col gap-3 rounded-lg border border-neutral-200 bg-white p-4 shadow-card sm:flex-row sm:items-end">
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setScope('all')}
            className={`h-9 rounded-md border px-3 text-sm font-medium transition ${
              scope === 'all'
                ? 'border-brand-300 bg-brand-50 text-brand-700'
                : 'border-neutral-200 bg-white text-neutral-700 hover:bg-neutral-50'
            }`}
          >
            {t('employeeNotifications.all')}
          </button>
          <button
            type="button"
            onClick={() => setScope('unread')}
            className={`h-9 rounded-md border px-3 text-sm font-medium transition ${
              scope === 'unread'
                ? 'border-brand-300 bg-brand-50 text-brand-700'
                : 'border-neutral-200 bg-white text-neutral-700 hover:bg-neutral-50'
            }`}
          >
            {t('employeeNotifications.unread')}
            {unreadCount > 0 && (
              <span className="ml-1.5 inline-flex h-5 min-w-5 items-center justify-center rounded-full bg-brand-600 px-1.5 text-[11px] font-semibold text-white">
                {unreadCount}
              </span>
            )}
          </button>
        </div>
        <div className="sm:ml-auto sm:w-64">
          <Select
            options={TYPE_OPTIONS(t)}
            value={type}
            onChange={(e) => setType(e.target.value)}
          />
        </div>
      </div>

      {loading ? (
        <div className="flex h-40 items-center justify-center rounded-lg border border-dashed border-neutral-300 bg-white">
          <Loading size="md" label={t('employeeNotifications.loading')} />
        </div>
      ) : visibleNotifications.length === 0 ? (
        <EmptyState
          icon={Bell}
          title={
            notifications.length === 0
              ? t('employeeNotifications.noNotifications')
              : t('employeeNotifications.noMatchingNotifications')
          }
          description={
            notifications.length === 0
              ? t('employeeNotifications.noNotificationsDesc')
              : t('employeeNotifications.tryChangeFilter')
          }
        />
      ) : (
        <div className="flex flex-col gap-2">
          {visibleNotifications.map((n) => (
            <NotificationItem
              key={n.id}
              notification={n}
              onOpen={handleOpen}
              selected={openDetail?.id === n.id}
            />
          ))}
        </div>
      )}

      <NotificationDetailModal
        open={Boolean(openDetail)}
        notification={openDetail}
        onClose={handleCloseDetail}
        role="employee"
        onMarkRead={async (n) => {
          await svcMarkAsRead(n.id)
        }}
        onMarkUnread={async (n) => {
          await svcMarkAsUnread(n.id)
        }}
      />
    </div>
  )
}