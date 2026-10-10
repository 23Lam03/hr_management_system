import { useCallback, useEffect, useMemo, useState } from 'react'
import { Award, Plus, RefreshCcw } from 'lucide-react'

import PageHeader from '../../components/common/PageHeader'
import Card from '../../components/common/Card'
import Button from '../../components/common/Button'
import Input from '../../components/common/Input'
import Select from '../../components/common/Select'
import { useToast } from '../../components/common/useToast'
import { useI18n } from '../../i18n/useI18n'

import PromotionSummaryTiles from '../../components/promotion/PromotionSummaryTiles'
import PromotionTable from '../../components/promotion/PromotionTable'
import PromotionFormModal from '../../components/promotion/PromotionFormModal'
import PromotionDetailModal from '../../components/promotion/PromotionDetailModal'
import PromotionConfirmModal from '../../components/promotion/PromotionConfirmModal'

import { EMPLOYEES } from '../../data/employeeMockData'
import {
  queryPromotions,
  getPromotionSummary,
  createPromotion,
  updatePromotion,
  updatePromotionStatus,
  deletePromotion,
  subscribePromotions,
  getPromotionStatuses,
} from '../../services/promotionService'

const PAGE_SIZE = 10

export default function PromotionManagementPage() {
  const { t } = useI18n()
  const toast = useToast()
  const [version, setVersion] = useState(0)

  const [filters, setFilters] = useState({
    search: '',
    status: '',
    employeeId: '',
    sortBy: 'createdAt',
    sortDir: 'desc',
    page: 1,
  })

  const [submitting, setSubmitting] = useState(false)
  const [formOpen, setFormOpen] = useState(false)
  const [editing, setEditing] = useState(null)
  const [detail, setDetail] = useState(null)
  const [deleteTarget, setDeleteTarget] = useState(null)
  const [approveTarget, setApproveTarget] = useState(null)
  const [rejectTarget, setRejectTarget] = useState(null)

  useEffect(() => {
    const unsub = subscribePromotions(() => setVersion((v) => v + 1))
    return () => unsub()
  }, [])

  const refresh = useCallback(() => {
    setVersion((v) => v + 1)
    toast.success(t('admin.promotionDataRefreshed'))
  }, [toast, t])

  const updateFilter = (field) => (value) => {
    setFilters((prev) => ({ ...prev, [field]: value, page: 1 }))
  }

  const handleSort = (sortBy, sortDir) => {
    setFilters((prev) => ({ ...prev, sortBy, sortDir, page: 1 }))
  }

  const query = useMemo(() => queryPromotions({
    search: filters.search,
    status: filters.status,
    employeeId: filters.employeeId,
    sortBy: filters.sortBy,
    sortDir: filters.sortDir,
    page: filters.page,
    pageSize: PAGE_SIZE,
  }), [filters, version]) // eslint-disable-line react-hooks/exhaustive-deps

  const summary = useMemo(() => getPromotionSummary(), [version]) // eslint-disable-line react-hooks/exhaustive-deps

  // decorate rows with employee info
  const rows = useMemo(() => {
    return query.items.map((p) => {
      const emp = EMPLOYEES.find((e) => e.id === p.employeeId)
      return {
        ...p,
        employeeName: emp?.fullName ?? null,
        employeeCode: emp?.employeeCode ?? null,
        missing: !emp,
      }
    })
  }, [query])

  const statusOptions = getPromotionStatuses()
  const employeeOptions = EMPLOYEES.map((e) => ({
    value: e.id,
    label: `${e.fullName} (${e.employeeCode})`,
  }))

  const handleOpenCreate = () => {
    setEditing(null)
    setFormOpen(true)
  }

  const handleOpenEdit = (row) => {
    setEditing(row)
    setFormOpen(true)
  }

  const handleSubmit = async (form) => {
    setSubmitting(true)
    try {
      const result = editing
        ? await updatePromotion(editing.id, form)
        : await createPromotion(form)
      if (result.ok) {
        toast.success(editing ? t('admin.promotionUpdated') : t('admin.promotionCreated'))
        setFormOpen(false)
        setEditing(null)
        return { ok: true }
      }
      toast.error(t('admin.cannotSavePromotionFields'))
      return { ok: false, errors: result.errors ?? {} }
    } catch (_e) {
      void _e
      toast.error('Something went wrong.')
      return { ok: false }
    } finally {
      setSubmitting(false)
    }
  }

  const handleChangeStatus = async (row, status) => {
    const result = await updatePromotionStatus(row.id, status)
    if (result.ok) toast.success(t('admin.promotionStatusUpdated'))
    else toast.error('Something went wrong.')
  }

  const handleDeleteConfirm = async () => {
    if (!deleteTarget) return
    const result = await deletePromotion(deleteTarget.id)
    if (result.ok) toast.success(t('admin.promotionDeleted'))
    else toast.error('Something went wrong.')
    setDeleteTarget(null)
  }

  const handleApproveConfirm = async () => {
    if (!approveTarget) return
    const result = await updatePromotionStatus(approveTarget.id, 'approved')
    if (result.ok) toast.success(t('admin.promotionApproved'))
    else toast.error('Something went wrong.')
    setApproveTarget(null)
  }

  const handleRejectConfirm = async () => {
    if (!rejectTarget) return
    const result = await updatePromotionStatus(rejectTarget.id, 'rejected')
    if (result.ok) toast.success(t('admin.promotionRejected'))
    else toast.error('Something went wrong.')
    setRejectTarget(null)
  }

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title={t('admin.promotionsTitle')}
        subtitle={t('admin.promotionsSubtitle')}
        icon={Award}
        actions={
          <div className="flex flex-wrap items-center gap-2">
            <Button
              variant="secondary"
              size="md"
              icon={RefreshCcw}
              onClick={refresh}
            >
              {t('admin.refreshPromotions')}
            </Button>
            <Button
              variant="primary"
              size="md"
              icon={Plus}
              onClick={handleOpenCreate}
            >
              {t('admin.createPromotion')}
            </Button>
          </div>
        }
      />

      <PromotionSummaryTiles summary={summary} />

      <Card>
        <div className="grid grid-cols-1 gap-3 md:grid-cols-12">
          <div className="md:col-span-6">
            <Input
              placeholder={t('admin.searchPromotionPlaceholder')}
              value={filters.search}
              onChange={(e) => updateFilter('search')(e.target.value)}
            />
          </div>
          <div className="md:col-span-3">
            <Select
              options={[{ value: '', label: t('admin.allStatusesPromotion') }, ...statusOptions.map((s) => ({ value: s.value, label: s.label }))]}
              value={filters.status}
              onChange={(e) => updateFilter('status')(e.target.value)}
            />
          </div>
          <div className="md:col-span-3">
            <Select
              options={[{ value: '', label: t('admin.allEmployeesPromotion') }, ...employeeOptions]}
              value={filters.employeeId}
              onChange={(e) => updateFilter('employeeId')(e.target.value)}
            />
          </div>
        </div>
        {(filters.search || filters.status || filters.employeeId) && (
          <div className="mt-3 flex justify-end">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setFilters((p) => ({ ...p, search: '', status: '', employeeId: '', page: 1 }))}
            >
              {t('admin.resetFiltersPromotion')}
            </Button>
          </div>
        )}
      </Card>

      <PromotionTable
        rows={rows}
        loading={false}
        pagination={{
          page: query.page,
          pageSize: query.pageSize,
          total: query.total,
          onChange: (p) => setFilters((prev) => ({ ...prev, page: p })),
        }}
        sortBy={filters.sortBy}
        sortDir={filters.sortDir}
        onSortChange={handleSort}
        statusOptions={statusOptions}
        onChangeStatus={handleChangeStatus}
        onApprove={setApproveTarget}
        onReject={setRejectTarget}
        onView={setDetail}
        onEdit={handleOpenEdit}
        onDelete={setDeleteTarget}
      />

      <PromotionFormModal
        open={formOpen}
        onClose={() => {
          setFormOpen(false)
          setEditing(null)
        }}
        onSubmit={handleSubmit}
        initialValue={editing}
        submitting={submitting}
      />

      <PromotionDetailModal
        open={Boolean(detail)}
        onClose={() => setDetail(null)}
        promotion={detail}
        employee={detail ? EMPLOYEES.find((e) => e.id === detail.employeeId) : null}
      />

      <PromotionConfirmModal
        open={Boolean(deleteTarget)}
        onClose={() => setDeleteTarget(null)}
        onConfirm={handleDeleteConfirm}
        title={t('admin.deletePromotionTitle')}
        description="Are you sure you want to delete this promotion record?"
        confirmLabel={t('admin.delete')}
        variant="danger"
      />

      <PromotionConfirmModal
        open={Boolean(approveTarget)}
        onClose={() => setApproveTarget(null)}
        onConfirm={handleApproveConfirm}
        title={t('admin.approvePromotionTitle')}
        description={t('admin.approvePromotionFor', { name: approveTarget?.employeeName ?? 'nhân viên này' })}
        confirmLabel={t('admin.approve')}
        variant="primary"
      />

      <PromotionConfirmModal
        open={Boolean(rejectTarget)}
        onClose={() => setRejectTarget(null)}
        onConfirm={handleRejectConfirm}
        title={t('admin.rejectPromotionTitle')}
        description={t('admin.rejectPromotionFor', { name: rejectTarget?.employeeName ?? 'nhân viên này' })}
        confirmLabel={t('admin.reject')}
        variant="danger"
      />
    </div>
  )
}
