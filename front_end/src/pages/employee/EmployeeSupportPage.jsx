import { useMemo, useState } from 'react'
import { LifeBuoy, Plus } from 'lucide-react'

import PageHeader from '../../components/common/PageHeader'
import Button from '../../components/common/Button'
import Loading from '../../components/common/Loading'
import EmptyState from '../../components/common/EmptyState'
import { useToast } from '../../components/common/useToast'
import { useAuth } from '../../contexts/useAuth'
import { useI18n } from '../../i18n/useI18n'

import SupportStatTiles from '../../components/support/SupportStatTiles'
import SupportFilterBar from '../../components/support/SupportFilterBar'
import SupportTable from '../../components/support/SupportTable'
import SupportFormModal from '../../components/support/SupportFormModal'
import SupportDetailModal from '../../components/support/SupportDetailModal'
import SupportConfirmModal from '../../components/support/SupportConfirmModal'

import useSupport from '../../contexts/useSupport'
import {
  querySupportRequests,
  getSupportRequestById,
} from '../../services/supportService'

const DEFAULT_FILTERS = { search: '', status: '', category: '', priority: '' }

export default function EmployeeSupportPage() {
  const toast = useToast()
  const { user } = useAuth()
  const { t } = useI18n()
  const {
    summary,
    createRequest,
    updateRequest,
    addMessage,
    loadRequests,
  } = useSupport() ?? {}

  const [filters, setFilters] = useState(DEFAULT_FILTERS)
  const [page, setPage] = useState(1)
  const [pageSize] = useState(10)
  const [openForm, setOpenForm] = useState(false)
  const [editing, setEditing] = useState(null)
  const [openDetail, setOpenDetail] = useState(null)
  const [cancelTarget, setCancelTarget] = useState(null)
  const [submitting, setSubmitting] = useState(false)

  const derived = useMemo(() => {
    if (!user) return { items: [], total: 0, page: 1, totalPages: 1 }
    return querySupportRequests({
      ...filters,
      requesterId: user.id,
      sortBy: 'updatedAt',
      sortDir: 'desc',
      page,
      pageSize,
    })
    // `summary.total` triggers recompute after mutations (ticket count changes).
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user, filters, page, pageSize, summary?.total])

  const handleFilterChange = (patch) => {
    setFilters((prev) => ({ ...prev, ...patch }))
    setPage(1)
  }

  const handleReset = () => {
    setFilters(DEFAULT_FILTERS)
    setPage(1)
  }

  const handleView = (row) => {
    const detail = getSupportRequestById(row.id)
    setOpenDetail(detail ?? row)
  }

  const handleEdit = (row) => {
    setEditing(row)
    setOpenForm(true)
  }

  const handleCancel = (row) => setCancelTarget(row)

  const handleSubmitForm = async (payload) => {
    setSubmitting(true)
    let result
    if (editing) {
      result = await updateRequest?.(editing.id, payload)
      if (result?.ok) toast.success(t('employeeSupport.requestUpdated'))
      else toast.error(t('employeeSupport.cannotUpdateRequest'))
    } else {
      result = await createRequest?.(payload)
      if (result?.ok) toast.success(t('employeeSupport.requestCreated'))
      else toast.error(t('employeeSupport.cannotCreateRequest'))
    }
    setSubmitting(false)
    setEditing(null)
    loadRequests?.()
    return result
  }

  const handleConfirmCancel = async () => {
    if (!cancelTarget) return
    setSubmitting(true)
    const result = await updateRequest?.(cancelTarget.id, { status: 'cancelled' })
    setSubmitting(false)
    if (result?.ok) {
      toast.success(t('employeeSupport.requestCancelled'))
      setCancelTarget(null)
      loadRequests?.()
    } else {
      toast.error(t('employeeSupport.cannotCancelRequest'))
    }
  }

  const handleReply = async (text) => {
    const r = await addMessage?.(openDetail.id, {
      senderId: user.id,
      senderRole: 'employee',
      message: text,
    })
    if (r?.ok) {
      toast.success(t('employeeSupport.replySent'))
      // Refresh detail snapshot
      setOpenDetail((prev) => (prev ? getSupportRequestById(prev.id) : prev))
      loadRequests?.()
    }
    return r
  }

  const headerActions = useMemo(
    () => [
      <Button key="create" variant="primary" size="md" icon={Plus} onClick={() => setOpenForm(true)}>
        {t('employeeSupport.createRequest')}
      </Button>,
    ],
    [t],
  )

  if (!user) {
    return (
      <div className="flex h-40 items-center justify-center rounded-lg border border-dashed border-neutral-300 bg-white">
        <Loading size="md" label={t('employeeSupport.loading')} />
      </div>
    )
  }

  const canReply = openDetail && (openDetail.status === 'open' || openDetail.status === 'waiting_for_employee')

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title={t('employeeSupport.support')}
        subtitle={t('employeeSupport.supportDesc')}
        icon={LifeBuoy}
        actions={headerActions}
      />

      <SupportStatTiles
        variant="employee"
        total={summary?.total ?? 0}
        inProgress={summary?.inProgress ?? 0}
        resolved={summary?.resolved ?? 0}
        waiting={summary?.waiting ?? 0}
      />

      <SupportFilterBar
        search={filters.search}
        status={filters.status}
        category={filters.category}
        onChange={handleFilterChange}
        onReset={handleReset}
      />

      <SupportTable
        data={derived.items}
        pagination={{
          page: derived.page,
          pageSize,
          total: derived.total,
          onChange: (p) => setPage(p),
        }}
        variant="employee"
        onView={handleView}
        onEdit={handleEdit}
        onCancel={handleCancel}
        emptyTitle={summary?.total === 0 ? t('employeeSupport.noRequests') : 'Không có yêu cầu phù hợp.'}
        emptyDescription={
          summary?.total === 0
            ? t('employeeSupport.noRequestsDesc')
            : 'Hãy thử đổi bộ lọc hoặc từ khoá tìm kiếm.'
        }
      />

      {summary?.total === 0 && (
        <EmptyState
          icon={LifeBuoy}
          title={t('employeeSupport.noRequests')}
          description={t('employeeSupport.noRequestsDesc')}
          actionLabel={t('employeeSupport.createRequest')}
          onAction={() => setOpenForm(true)}
        />
      )}

      <SupportFormModal
        open={openForm}
        onClose={() => {
          setOpenForm(false)
          setEditing(null)
        }}
        onSubmit={handleSubmitForm}
        initialValue={editing}
        submitting={submitting}
      />

      <SupportDetailModal
        open={Boolean(openDetail)}
        request={openDetail}
        currentRole="employee"
        currentUserId={user.id}
        canReply={canReply}
        onReply={handleReply}
        requesterName={() => user.name}
        adminName={() => 'Quản trị viên'}
        onClose={() => setOpenDetail(null)}
      />

      <SupportConfirmModal
        open={Boolean(cancelTarget)}
        onClose={() => setCancelTarget(null)}
        onConfirm={handleConfirmCancel}
        title={t('employeeSupport.cancelRequestTitle')}
        message={
          cancelTarget?.subject
            ? t('employeeSupport.cancelConfirm', { n: cancelTarget.subject })
            : t('employeeSupport.cancelConfirmGeneric')
        }
        confirmLabel={t('employeeSupport.confirmCancel')}
        cancelLabel={t('employeeSupport.cancelAction')}
        variant="warning"
        submitting={submitting}
      />
    </div>
  )
}