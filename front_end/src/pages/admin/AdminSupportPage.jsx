import { useMemo, useState } from 'react'
import { LifeBuoy } from 'lucide-react'

import PageHeader from '../../components/common/PageHeader'
import Loading from '../../components/common/Loading'
import { useToast } from '../../components/common/useToast'
import { useAuth } from '../../contexts/useAuth'
import { useI18n } from '../../i18n/useI18n'

import SupportStatTiles from '../../components/support/SupportStatTiles'
import SupportFilterBar from '../../components/support/SupportFilterBar'
import SupportTable from '../../components/support/SupportTable'
import SupportDetailModal from '../../components/support/SupportDetailModal'
import SupportConfirmModal from '../../components/support/SupportConfirmModal'
import SupportStatusUpdateModal from '../../components/support/SupportStatusUpdateModal'
import SupportAssignModal from '../../components/support/SupportAssignModal'

import {
  querySupportRequests,
  getSupportRequestById,
  getSupportSummary,
  updateSupportStatus as svcUpdateStatus,
  assignSupportRequest as svcAssign,
  deleteSupportRequest as svcDelete,
  addSupportMessage as svcAddMessage,
} from '../../services/supportService'
import { EMPLOYEES } from '../../data/employeeMockData'

const ADMIN_USER_ID = 'usr-admin-001'

const ADMIN_OPTIONS = [{ id: ADMIN_USER_ID, label: 'Nguyễn Minh Anh (Admin)' }]

const REQUESTER_LOOKUP = (() => {
  const m = new Map([
    [ADMIN_USER_ID, 'Nguyễn Minh Anh (Admin)'],
    ...EMPLOYEES.map((e) => [e.id, `${e.fullName} (${e.employeeCode})`]),
    ['usr-emp-001', 'Trần Quốc Bảo'],
  ])
  return (id) => m.get(id) ?? id
})()

const DEFAULT_FILTERS = { search: '', status: '', category: '', priority: '' }

export default function AdminSupportPage() {
  const { t } = useI18n()
  const toast = useToast()
  const { user } = useAuth()
  const [filters, setFilters] = useState(DEFAULT_FILTERS)
  const [page, setPage] = useState(1)
  const [pageSize] = useState(10)
  const [version, setVersion] = useState(0)

  const [openDetail, setOpenDetail] = useState(null)
  const [deleting, setDeleting] = useState(null)
  const [statusTarget, setStatusTarget] = useState(null)
  const [assignTarget, setAssignTarget] = useState(null)
  const [submitting, setSubmitting] = useState(false)

  // `version` triggers recompute after mutations (delete, status, assign).
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const summary = useMemo(() => getSupportSummary(), [version])

  const derived = useMemo(() => {
    return querySupportRequests({
      ...filters,
      sortBy: 'createdAt',
      sortDir: 'desc',
      page,
      pageSize,
    })
    // `version` triggers recompute after mutations (delete, status, assign).
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filters, page, pageSize, version])

  const handleFilterChange = (patch) => {
    setFilters((prev) => ({ ...prev, ...patch }))
    setPage(1)
  }

  const handleReset = () => {
    setFilters(DEFAULT_FILTERS)
    setPage(1)
  }

  const handleView = (row) => {
    setOpenDetail(getSupportRequestById(row.id) ?? row)
  }

  const handleDelete = (row) => setDeleting(row)

  const handleUpdateStatus = (row) => setStatusTarget(row)

  const handleAssign = (row) => setAssignTarget(row)

  const handleConfirmDelete = async () => {
    if (!deleting) return
    setSubmitting(true)
    const r = await svcDelete(deleting.id)
    setSubmitting(false)
    if (r.ok) {
      toast.success(t('admin.requestDeleted'))
      setDeleting(null)
      setVersion((v) => v + 1)
    } else {
      toast.error(t('admin.cannotDeleteRequest'))
    }
  }

  const handleSaveStatus = async (status) => {
    if (!statusTarget) return
    setSubmitting(true)
    const r = await svcUpdateStatus(statusTarget.id, status)
    setSubmitting(false)
    if (r.ok) {
      toast.success(t('admin.statusUpdated'))
      setStatusTarget(null)
      setVersion((v) => v + 1)
      if (openDetail?.id === statusTarget.id) {
        setOpenDetail(getSupportRequestById(statusTarget.id))
      }
    } else {
      toast.error(t('admin.cannotUpdateStatus'))
    }
  }

  const handleSaveAssign = async (adminId) => {
    if (!assignTarget) return
    setSubmitting(true)
    const r = await svcAssign(assignTarget.id, adminId)
    setSubmitting(false)
    if (r.ok) {
      toast.success(t('admin.requestAssigned'))
      setAssignTarget(null)
      setVersion((v) => v + 1)
      if (openDetail?.id === assignTarget.id) {
        setOpenDetail(getSupportRequestById(assignTarget.id))
      }
    } else {
      toast.error(t('admin.cannotAssignRequest'))
    }
  }

  const handleReply = async (text) => {
    if (!openDetail) return { ok: false }
    const r = await svcAddMessage(openDetail.id, {
      senderId: user?.id ?? ADMIN_USER_ID,
      senderRole: 'admin',
      message: text,
    })
    if (r.ok) {
      toast.success(t('admin.replySent'))
      setOpenDetail(getSupportRequestById(openDetail.id))
      setVersion((v) => v + 1)
    } else {
      toast.error(t('admin.cannotSendReply'))
    }
    return r
  }

  const canReply = openDetail && openDetail.status !== 'closed' && openDetail.status !== 'cancelled'

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title={t('admin.supportTitle')}
        subtitle={t('admin.supportSubtitle')}
        icon={LifeBuoy}
      />

      <SupportStatTiles
        variant="admin"
        total={summary.total}
        open={summary.open}
        inProgress={summary.inProgress}
        resolved={summary.resolved}
        high={summary.high}
      />

      <SupportFilterBar
        search={filters.search}
        status={filters.status}
        category={filters.category}
        priority={filters.priority}
        showPriority
        onChange={handleFilterChange}
        onReset={handleReset}
      />

      {derived.items.length === 0 ? (
        <div className="flex h-40 items-center justify-center rounded-lg border border-dashed border-neutral-300 bg-white">
          <Loading size="md" label={t('admin.loadingRequests')} />
        </div>
      ) : (
        <SupportTable
          data={derived.items}
          pagination={{
            page: derived.page,
            pageSize,
            total: derived.total,
            onChange: (p) => setPage(p),
          }}
          variant="admin"
          requesterLookup={REQUESTER_LOOKUP}
          adminLookup={(id) => REQUESTER_LOOKUP(id)}
          showAssignee
          onView={handleView}
          onUpdateStatus={handleUpdateStatus}
          onAssign={handleAssign}
          onDelete={handleDelete}
          emptyTitle={t('admin.noSupportRequests')}
          emptyDescription={t('admin.noSupportRequestsDesc')}
        />
      )}

      <SupportDetailModal
        open={Boolean(openDetail)}
        request={openDetail}
        currentRole="admin"
        currentUserId={user?.id ?? ADMIN_USER_ID}
        canReply={canReply}
        onReply={handleReply}
        requesterName={REQUESTER_LOOKUP}
        adminName={REQUESTER_LOOKUP}
        onClose={() => setOpenDetail(null)}
      />

      <SupportStatusUpdateModal
        open={Boolean(statusTarget)}
        onClose={() => setStatusTarget(null)}
        onSubmit={handleSaveStatus}
        initialStatus={statusTarget?.status}
        submitting={submitting}
      />

      <SupportAssignModal
        open={Boolean(assignTarget)}
        onClose={() => setAssignTarget(null)}
        onSubmit={handleSaveAssign}
        adminOptions={ADMIN_OPTIONS}
        initialAssignee={assignTarget?.assignedTo ?? ADMIN_USER_ID}
        submitting={submitting}
      />

      <SupportConfirmModal
        open={Boolean(deleting)}
        onClose={() => setDeleting(null)}
        onConfirm={handleConfirmDelete}
        title={t('admin.deleteSupportRequest')}
        message={
          deleting?.subject
            ? t('admin.deleteSupportConfirm', { subject: deleting.subject })
            : t('admin.deleteSupportConfirmGeneric')
        }
        confirmLabel={t('admin.delete')}
        cancelLabel={t('admin.cancel')}
        submitting={submitting}
      />
    </div>
  )
}
