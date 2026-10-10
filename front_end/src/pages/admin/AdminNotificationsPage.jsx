import { useCallback, useEffect, useMemo, useState } from 'react'
import { Bell, Plus, RefreshCcw } from 'lucide-react'

import PageHeader from '../../components/common/PageHeader'
import Button from '../../components/common/Button'
import Loading from '../../components/common/Loading'
import { useToast } from '../../components/common/useToast'
import { useI18n } from '../../i18n/useI18n'

import NotificationStatTiles from '../../components/notifications/NotificationStatTiles'
import NotificationFilterBar from '../../components/notifications/NotificationFilterBar'
import NotificationTable from '../../components/notifications/NotificationTable'
import NotificationFormModal from '../../components/notifications/NotificationFormModal'
import NotificationDetailModal from '../../components/notifications/NotificationDetailModal'
import DeleteNotificationConfirmModal from '../../components/notifications/DeleteNotificationConfirmModal'

import {
  getNotificationsSummary,
  queryNotifications,
  createNotification,
  updateNotification,
  markAsRead as svcMarkAsRead,
  markAsUnread as svcMarkAsUnread,
  deleteNotification as svcDelete,
  subscribeNotifications,
} from '../../services/notificationService'
import { EMPLOYEES } from '../../data/employeeMockData'

const ADMIN_USER_ID = 'usr-admin-001'

const RECIPIENT_OPTIONS = [
  { id: ADMIN_USER_ID, label: 'Quản trị viên (Admin)' },
  ...EMPLOYEES.map((e) => ({ id: e.id, label: `${e.fullName} (${e.employeeCode})` })),
]

const RECIPIENT_LOOKUP = (() => {
  const m = new Map(RECIPIENT_OPTIONS.map((r) => [r.id, r.label]))
  return (id) => m.get(id) ?? id
})()

export default function AdminNotificationsPage() {
  const { t } = useI18n()
  const toast = useToast()
  const [filters, setFilters] = useState({
    search: '',
    type: '',
    priority: '',
    isRead: '',
    recipientId: '',
  })
  const [page, setPage] = useState(1)
  const [pageSize] = useState(10)
  const [loading, setLoading] = useState(true)
  const [version, setVersion] = useState(0)

  // Modal state
  const [openForm, setOpenForm] = useState(false)
  const [editing, setEditing] = useState(null)
  const [openDetail, setOpenDetail] = useState(null)
  const [deleting, setDeleting] = useState(null)

  // Pub-sub listener — re-fetch when service changes
  useEffect(() => {
    const unsub = subscribeNotifications(() => setVersion((v) => v + 1))
    return () => unsub()
  }, [])

  const derived = useMemo(() => {
    const result = queryNotifications({
      search: filters.search,
      type: filters.type,
      priority: filters.priority,
      isRead: filters.isRead,
      recipientId: filters.recipientId,
      sortBy: 'createdAt',
      sortDir: 'desc',
      page,
      pageSize,
    })
    const summaryData = getNotificationsSummary()
    return { result, summaryData }
    // `version` triggers recompute when pub-sub fires
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filters, page, pageSize, version])

  const { result: data, summaryData: summary } = derived

  // Track loading: flip after first derive.
  useEffect(() => {
    // eslint-disable-next-line react/set-state-in-effect
    setLoading(false)
  }, [derived])

  const reload = useCallback(() => {
    setVersion((v) => v + 1)
  }, [])

  const handleFilterChange = (patch) => {
    setFilters((prev) => ({ ...prev, ...patch }))
    setPage(1)
  }

  const handleReset = () => {
    setFilters({ search: '', type: '', priority: '', isRead: '', recipientId: '' })
    setPage(1)
  }

  const handleOpenCreate = () => {
    setEditing(null)
    setOpenForm(true)
  }

  const handleEdit = (row) => {
    setEditing(row)
    setOpenForm(true)
  }

  const handleView = (row) => setOpenDetail(row)

  const handleMarkRead = async (row) => {
    const r = await svcMarkAsRead(row.id)
    if (r.ok) toast.success(t('admin.notificationMarkedRead'))
    else toast.error(t('admin.cannotUpdateNotification'))
  }

  const handleMarkUnread = async (row) => {
    const r = await svcMarkAsUnread(row.id)
    if (r.ok) toast.success(t('admin.notificationMarkedUnread'))
    else toast.error(t('admin.cannotUpdateNotification'))
  }

  const handleSubmitForm = async (payload) => {
    if (payload.recipientId === '__ALL__') {
      // Broadcast: tạo notification cho từng employee + bản cho admin.
      const employeeTargets = EMPLOYEES.map((e) => e.id)
      let okCount = 0
      for (const id of employeeTargets) {
        const r = await createNotification({ ...payload, recipientType: 'employee', recipientId: id })
        if (r.ok) okCount += 1
      }
      // Thêm 1 bản dành cho admin
      await createNotification({ ...payload, recipientType: 'admin', recipientId: ADMIN_USER_ID })
      if (okCount > 0) {
        toast.success(t('admin.notificationsCreated', { n: okCount + 1 }))
        setOpenForm(false)
        reload()
        return { ok: true }
      }
      toast.error(t('admin.cannotCreateNotification'))
      return { ok: false }
    }
    if (editing) {
      const r = await updateNotification(editing.id, payload)
      if (r.ok) {
        toast.success(t('admin.notificationUpdated'))
        setOpenForm(false)
        reload()
      } else {
        toast.error(t('admin.cannotUpdateNotification'))
      }
      return r
    }
    const r = await createNotification(payload)
    if (r.ok) {
      toast.success(t('admin.notificationCreated'))
      setOpenForm(false)
      reload()
    } else {
      toast.error(t('admin.cannotCreateNotification'))
    }
    return r
  }

  const handleConfirmDelete = async () => {
    if (!deleting) return
    const r = await svcDelete(deleting.id)
    if (r.ok) {
      toast.success(t('admin.notificationDeleted'))
      setDeleting(null)
      reload()
    } else {
      toast.error(t('admin.cannotDeleteNotification'))
    }
  }

  const headerActions = useMemo(
    () => [
      <Button key="reload" variant="ghost" size="md" icon={RefreshCcw} onClick={reload}>
        {t('admin.reload')}
      </Button>,
      <Button key="create" variant="primary" size="md" icon={Plus} onClick={handleOpenCreate}>
        {t('admin.createNotification')}
      </Button>,
    ],
    [reload, t],
  )

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title={t('admin.notificationsTitle')}
        subtitle={t('admin.notificationsSubtitle')}
        icon={Bell}
        actions={headerActions}
      />

      <NotificationStatTiles
        total={summary.total}
        unread={summary.unread}
        high={summary.high}
        today={summary.today}
      />

      <NotificationFilterBar
        search={filters.search}
        type={filters.type}
        priority={filters.priority}
        isRead={filters.isRead}
        recipientId={filters.recipientId}
        recipientOptions={RECIPIENT_OPTIONS}
        onChange={handleFilterChange}
        onReset={handleReset}
      />

      {loading ? (
        <div className="flex h-40 items-center justify-center rounded-lg border border-dashed border-neutral-300 bg-white">
          <Loading size="md" label={t('admin.loadingNotifications')} />
        </div>
      ) : (
        <NotificationTable
          data={data.items}
          loading={false}
          pagination={{
            page: data.page,
            pageSize,
            total: data.total,
            onChange: (p) => setPage(p),
          }}
          recipientLookup={RECIPIENT_LOOKUP}
          onView={handleView}
          onMarkRead={handleMarkRead}
          onMarkUnread={handleMarkUnread}
          onEdit={handleEdit}
          onDelete={(row) => setDeleting(row)}
        />
      )}

      <NotificationFormModal
        open={openForm}
        onClose={() => {
          setOpenForm(false)
          setEditing(null)
        }}
        onSubmit={handleSubmitForm}
        initialValue={editing}
        recipientOptions={RECIPIENT_OPTIONS}
      />

      <NotificationDetailModal
        open={Boolean(openDetail)}
        notification={openDetail}
        onClose={() => setOpenDetail(null)}
        recipientName={openDetail ? RECIPIENT_LOOKUP(openDetail.recipientId) : ''}
        role="admin"
        onMarkRead={async (n) => {
          await handleMarkRead(n)
          setOpenDetail(null)
        }}
        onMarkUnread={async (n) => {
          await handleMarkUnread(n)
          setOpenDetail(null)
        }}
      />

      <DeleteNotificationConfirmModal
        open={Boolean(deleting)}
        notification={deleting}
        onClose={() => setDeleting(null)}
        onConfirm={handleConfirmDelete}
      />
    </div>
  )
}
