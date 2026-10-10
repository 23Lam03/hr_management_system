import { useEffect, useMemo, useState } from 'react'
import {
  CalendarDays,
  Plus,
  Download,
  ShieldCheck,
  CheckCircle2,
  XCircle,
  Clock4,
  Flag,
  Settings2,
  Power,
  Pencil,
  Trash2,
  AlertTriangle,
} from 'lucide-react'

import PageHeader from '../../components/common/PageHeader'
import Button from '../../components/common/Button'
import Card from '../../components/common/Card'
import Tabs from '../../components/common/Tabs'
import Input from '../../components/common/Input'
import Select from '../../components/common/Select'
import Modal from '../../components/common/Modal'
import Badge from '../../components/common/Badge'
import Table from '../../components/common/Table'
import StatCard from '../../components/common/StatCard'
import EmptyState from '../../components/common/EmptyState'
import Switch from '../../components/common/Switch'
import { useToast } from '../../components/common/useToast'
import { useI18n } from '../../i18n/useI18n'

import AttendanceStatTiles from '../../components/attendance/AttendanceStatTiles'
import AttendanceFilterBar from '../../components/attendance/AttendanceFilterBar'
import AttendanceTable from '../../components/attendance/AttendanceTable'
import AttendancePagination from '../../components/attendance/AttendancePagination'
import AttendanceFormModal from '../../components/attendance/AttendanceFormModal'
import AttendanceDetailModal from '../../components/attendance/AttendanceDetailModal'

import {
  queryAttendance,
  getAttendanceSummary,
  getAttendanceById,
  getAttendanceStatuses,
  createAttendanceRecord,
  updateAttendanceRecord,
  subscribeAttendance,
  ATTENDANCE_APPROVAL_LABEL,
  ATTENDANCE_APPROVAL_TONE,
  ATTENDANCE_APPROVAL_STATUSES,
  approveAttendance,
  rejectAttendance,
  getApprovalSummary,
  getAttendanceRules,
  getAttendanceRuleById,
  createAttendanceRule,
  updateAttendanceRule,
  toggleAttendanceRule,
  deleteAttendanceRule,
  RULE_CATEGORIES,
} from '../../services/attendanceService'
import { getDepartments, getEmployees } from '../../services/employeeService'
import { useAuth } from '../../contexts/useAuth'

const DEFAULT_QUERY = {
  search: '',
  dateFrom: '',
  dateTo: '',
  departmentId: '',
  employeeId: '',
  status: '',
  approvalStatus: '',
  sortBy: 'date',
  sortDir: 'desc',
  page: 1,
  pageSize: 10,
}

export default function AdminAttendancePage() {
  const { t } = useI18n()
  const toast = useToast()
  const { user } = useAuth()

  const [query, setQuery] = useState(() => ({
    ...DEFAULT_QUERY,
    dateFrom: '2026-10-01',
    dateTo: '2026-10-01',
  }))
  const [loading, setLoading] = useState(true)
  const [tick, setTick] = useState(0)
  const [openForm, setOpenForm] = useState(false)
  const [editId, setEditId] = useState(null)
  const [submitting, setSubmitting] = useState(false)
  const [serverErrors, setServerErrors] = useState({})
  const [openDetail, setOpenDetail] = useState(false)
  const [detailId, setDetailId] = useState(null)
  const [actionBusy, setActionBusy] = useState(false)

  // Rules state
  const [rules, setRules] = useState([])
  const [openRuleForm, setOpenRuleForm] = useState(false)
  const [editRuleId, setEditRuleId] = useState(null)
  const [rulePayload, setRulePayload] = useState({ name: '', description: '', category: 'working_hours', enabled: true })
  const [ruleErrors, setRuleErrors] = useState({})
  const [ruleSubmitting, setRuleSubmitting] = useState(false)
  const [confirmDeleteId, setConfirmDeleteId] = useState(null)

  // Reject modal
  const [rejectId, setRejectId] = useState(null)
  const [rejectNote, setRejectNote] = useState('')

  const APPROVAL_OPTIONS = [
    { value: '', label: t('admin.allApprovalStatuses') },
    ...ATTENDANCE_APPROVAL_STATUSES.map((s) => ({ value: s.value, label: s.label })),
  ]

  useEffect(() => {
    setLoading(true)
    const tmr = setTimeout(() => setLoading(false), 150)
    return () => clearTimeout(tmr)
  }, [
    tick,
    query.search,
    query.dateFrom,
    query.dateTo,
    query.departmentId,
    query.employeeId,
    query.status,
    query.approvalStatus,
  ])

  useEffect(() => {
    const unsub = subscribeAttendance(() => setTick((n) => n + 1))
    return () => unsub()
  }, [])

  useEffect(() => {
    setRules(getAttendanceRules())
  }, [tick])

  const departments = useMemo(() => getDepartments(), [])
  const employees = useMemo(() => getEmployees(), [])
  const statuses = useMemo(() => getAttendanceStatuses(), [])

  // eslint-disable-next-line react-hooks/exhaustive-deps
  const data = useMemo(() => queryAttendance(query), [query, tick])
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const summary = useMemo(() => getAttendanceSummary(query), [query, tick])
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const approvalSummary = useMemo(() => getApprovalSummary(query), [query, tick])

  const setField = (key, value) => setQuery((q) => ({ ...q, [key]: value, page: 1 }))

  const onSort = (field) => {
    setQuery((q) => {
      if (q.sortBy === field) {
        return { ...q, sortDir: q.sortDir === 'asc' ? 'desc' : 'asc', page: 1 }
      }
      return { ...q, sortBy: field, sortDir: field === 'date' ? 'desc' : 'asc', page: 1 }
    })
  }

  const onClear = () => {
    setQuery({
      ...DEFAULT_QUERY,
      dateFrom: '2026-10-01',
      dateTo: '2026-10-01',
    })
  }

  const openCreate = () => {
    setEditId(null)
    setServerErrors({})
    setOpenForm(true)
  }
  const openEdit = (id) => {
    setEditId(id)
    setServerErrors({})
    setOpenForm(true)
  }
  const closeForm = () => {
    setOpenForm(false)
    setEditId(null)
    setServerErrors({})
  }
  const openView = (id) => {
    setDetailId(id)
    setOpenDetail(true)
  }

  const onSubmitForm = async (values) => {
    setSubmitting(true)
    const result = editId
      ? await updateAttendanceRecord(editId, values)
      : await createAttendanceRecord(values)
    setSubmitting(false)

    if (!result.ok) {
      setServerErrors(result.errors || {})
      toast.error(t('admin.cannotSaveRecord'), {
        description: result.errors?._form || t('admin.checkInvalidFields'),
      })
      return
    }
    setOpenForm(false)
    setEditId(null)
    setServerErrors({})
    toast.success(editId ? t('admin.recordUpdated') : t('admin.recordCreated'), {
      description: `${result.record.employeeName} · ${result.record.date}`,
    })
    setQuery((q) => ({ ...q, page: 1 }))
  }

  const onApprove = async (id) => {
    if (!id) return
    setActionBusy(true)
    const res = await approveAttendance(id, user?.id || null, '')
    setActionBusy(false)
    if (!res.ok) {
      toast.error(t('admin.cannotApprove'), { description: res.error || t('common.warning') })
      return
    }
    toast.success(t('admin.attendanceApproved'), {
      description: `${res.record.employeeName} · ${res.record.date}`,
    })
  }

  const onReject = async () => {
    if (!rejectId) return
    setActionBusy(true)
    const res = await rejectAttendance(rejectId, user?.id || null, rejectNote)
    setActionBusy(false)
    if (!res.ok) {
      toast.error(t('admin.cannotReject'), { description: res.error || t('common.warning') })
      return
    }
    setRejectId(null)
    setRejectNote('')
    toast.success(t('admin.attendanceRejected'), {
      description: `${res.record.employeeName} · ${res.record.date}`,
    })
  }

  const onExport = () => {
    try {
      const items = data.items
      const header = [
        t('employees.columnEmployeeCode') || 'Mã NV', t('employees.columnName') || 'Họ tên', t('employees.columnDepartment') || 'Phòng ban',
        t('attendance.columnDate') || 'Ngày',
        t('attendance.columnCheckIn') || 'Giờ vào', t('attendance.columnCheckOut') || 'Giờ ra',
        t('attendance.columnWorkHours') || 'Tổng giờ', t('attendance.columnLateMinutes') || 'Phút đi muộn', t('attendance.columnEarlyLeaveMinutes') || 'Phút về sớm',
        t('attendance.columnStatus') || 'Trạng thái', t('admin.filterApprovalStatus') || 'Trạng thái duyệt', t('attendance.columnNote') || 'Ghi chú',
      ]
      const lines = [header.join(',')]
      items.forEach((r) => {
        const cells = [
          r.employeeCode,
          r.employeeName,
          r.departmentName,
          r.date,
          r.checkIn || '',
          r.checkOut || '',
          r.workHours > 0 ? r.workHours : '',
          r.lateMinutes > 0 ? r.lateMinutes : '',
          r.earlyLeaveMinutes > 0 ? r.earlyLeaveMinutes : '',
          r.statusLabel,
          ATTENDANCE_APPROVAL_LABEL[r.approvalStatus] || r.approvalStatus,
          r.note || '',
        ].map((v) => `"${String(v ?? '').replace(/"/g, '""')}"`)
        lines.push(cells.join(','))
      })
      const blob = new Blob(['\ufeff' + lines.join('\n')], { type: 'text/csv;charset=utf-8' })
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `bang-cham-cong-${new Date().toISOString().slice(0, 10)}.csv`
      document.body.appendChild(a)
      a.click()
      document.body.removeChild(a)
      URL.revokeObjectURL(url)
      toast.success(t('admin.exportAttendanceCsvSuccess'), { description: `${items.length} ${t('admin.attendanceRecords')}` })
    } catch (e) {
      toast.error(t('admin.exportAttendanceCsvFail'), { description: t('admin.exportAttendanceCsvFailDesc') })
      void e
    }
  }

  // ----- Rules -----
  const openCreateRule = () => {
    setEditRuleId(null)
    setRulePayload({ name: '', description: '', category: 'working_hours', enabled: true })
    setRuleErrors({})
    setOpenRuleForm(true)
  }
  const openEditRule = (id) => {
    const r = getAttendanceRuleById(id)
    if (!r) return
    setEditRuleId(id)
    setRulePayload({
      name: r.name,
      description: r.description || '',
      category: r.category,
      enabled: r.enabled,
    })
    setRuleErrors({})
    setOpenRuleForm(true)
  }
  const closeRuleForm = () => {
    setOpenRuleForm(false)
    setEditRuleId(null)
    setRuleErrors({})
  }
  const onSaveRule = async () => {
    setRuleSubmitting(true)
    const res = editRuleId
      ? await updateAttendanceRule(editRuleId, rulePayload)
      : await createAttendanceRule({ ...rulePayload, createdBy: user?.id || 'usr-admin-001' })
    setRuleSubmitting(false)
    if (!res.ok) {
      setRuleErrors(res.errors || {})
      toast.error(t('admin.cannotSaveRule'))
      return
    }
    closeRuleForm()
    toast.success(t('admin.ruleSaved'))
  }
  const onToggleRule = async (id, enabled) => {
    const res = await toggleAttendanceRule(id, enabled)
    if (!res.ok) {
      toast.error(t('admin.cannotChangeRuleStatus'))
    } else {
      toast.success(enabled ? t('admin.ruleEnabled') : t('admin.ruleDisabled'))
    }
  }
  const onConfirmDelete = async () => {
    if (!confirmDeleteId) return
    const res = await deleteAttendanceRule(confirmDeleteId)
    if (!res.ok) {
      toast.error(t('admin.cannotDeleteRule'))
    } else {
      toast.success(t('admin.ruleDeleted'))
    }
    setConfirmDeleteId(null)
  }

  const detailRecord = detailId ? getAttendanceById(detailId) : null
  const editRecord = editId ? getAttendanceById(editId) : null

  // Tabs
  const tabs = [
    {
      id: 'records',
      label: t('admin.attendanceRules').split(' ')[0] === 'Attendance' ? 'Attendance Records' : 'Bản ghi',
      icon: CalendarDays,
      badge: data.total,
      panel: (
        <>
          <div className="mb-4">
            <AttendanceStatTiles summary={summary} />
          </div>
          <div className="mb-4">
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
              <ApprovalStatTile icon={Clock4}     label={t('status.pending')}  value={approvalSummary.pending}  tone="info" />
              <ApprovalStatTile icon={CheckCircle2} label={t('status.approved')} value={approvalSummary.approved} tone="success" />
              <ApprovalStatTile icon={XCircle}    label={t('status.rejected')} value={approvalSummary.rejected} tone="danger" />
            </div>
          </div>
          <div className="mb-4">
            <AttendanceFilterBar
              search={query.search}
              onSearchChange={(v) => setField('search', v)}
              dateFrom={query.dateFrom}
              dateTo={query.dateTo}
              onDateFromChange={(v) => setField('dateFrom', v)}
              onDateToChange={(v) => setField('dateTo', v)}
              departmentId={query.departmentId}
              onDepartmentChange={(v) => setField('departmentId', v)}
              employeeId={query.employeeId}
              onEmployeeChange={(v) => setField('employeeId', v)}
              status={query.status}
              onStatusChange={(v) => setField('status', v)}
              departments={departments}
              employees={employees}
              statuses={statuses}
              onClear={onClear}
              total={data.total}
              extra={
                <Select
                  options={APPROVAL_OPTIONS}
                  value={query.approvalStatus}
                  onChange={(e) => setField('approvalStatus', e.target.value)}
                  aria-label={t('admin.filterApprovalStatus')}
                />
              }
            />
          </div>
          <div className="mb-4">
            {data.total === 0 && !loading ? (
              <EmptyState
                title={t('admin.noAttendanceData')}
                description={
                  query.search || query.dateFrom || query.dateTo || query.departmentId || query.employeeId || query.status || query.approvalStatus
                    ? t('admin.tryClearFilter')
                    : t('admin.startRecordAttendance')
                }
                actionLabel={t('admin.recordAttendance')}
                onAction={openCreate}
              />
            ) : (
              <AttendanceTable
                rows={data.items}
                loading={loading}
                sortBy={query.sortBy}
                sortDir={query.sortDir}
                onSort={onSort}
                onView={openView}
                onEdit={openEdit}
              />
            )}
          </div>
          {data.total > 0 && (
            <div className="mb-6">
              <AttendancePagination
                page={data.page}
                totalPages={data.totalPages}
                pageSize={data.pageSize}
                total={data.total}
                onPageChange={(p) => setQuery((q) => ({ ...q, page: p }))}
                onPageSizeChange={(n) => setQuery((q) => ({ ...q, pageSize: n, page: 1 }))}
              />
            </div>
          )}
        </>
      ),
    },
    {
      id: 'pending',
      label: t('admin.pendingApproval'),
      icon: Clock4,
      badge: approvalSummary.pending,
      panel: <PendingApprovalPanel query={query} tick={tick} onView={openView} t={t} />,
    },
    {
      id: 'rules',
      label: t('admin.attendanceRules'),
      icon: Settings2,
      badge: rules.length,
      panel: (
        <RulesPanel
          rules={rules}
          onCreate={openCreateRule}
          onEdit={openEditRule}
          onToggle={onToggleRule}
          onDelete={(id) => setConfirmDeleteId(id)}
          t={t}
        />
      ),
    },
  ]

  return (
    <>
      <PageHeader
        title={t('admin.attendanceTitle')}
        subtitle={t('admin.attendanceSubtitle')}
        icon={CalendarDays}
        breadcrumb={t('admin.attendanceBreadcrumb')}
        actions={
          <>
            <Button variant="secondary" icon={Download} onClick={onExport}>
              {t('admin.exportAttendanceCsv')}
            </Button>
            <Button variant="primary" icon={Plus} onClick={openCreate}>
              {t('admin.recordAttendance')}
            </Button>
          </>
        }
      />

      <Tabs items={tabs} defaultValue="records" variant="underline" />

      <AttendanceFormModal
        open={openForm}
        onClose={closeForm}
        initialValue={editRecord}
        onSubmit={onSubmitForm}
        submitting={submitting}
        serverErrors={serverErrors}
      />

      <AttendanceDetailModal
        open={openDetail}
        onClose={() => {
          setOpenDetail(false)
          setDetailId(null)
        }}
        record={detailRecord}
        onEdit={(id) => {
          setOpenDetail(false)
          setDetailId(null)
          openEdit(id)
        }}
        approvalActions={
          detailRecord?.approvalStatus !== 'approved' ? (
            <div className="flex flex-wrap justify-end gap-2">
              <Button
                variant="outline"
                icon={XCircle}
                onClick={() => {
                  setRejectId(detailRecord.id)
                  setRejectNote('')
                }}
                disabled={actionBusy}
              >
                {t('admin.reject')}
              </Button>
              <Button
                variant="primary"
                icon={CheckCircle2}
                onClick={() => onApprove(detailRecord.id)}
                disabled={actionBusy}
              >
                {t('admin.approve')}
              </Button>
            </div>
          ) : null
        }
      />

      {/* Reject reason modal */}
      <Modal
        open={Boolean(rejectId)}
        onClose={() => { setRejectId(null); setRejectNote('') }}
        title={t('admin.rejectAttendanceTitle')}
        description={t('admin.rejectAttendanceDesc')}
        size="md"
        footer={
          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={() => { setRejectId(null); setRejectNote('') }}>
              {t('admin.cancel')}
            </Button>
            <Button variant="danger" icon={XCircle} onClick={onReject} disabled={actionBusy}>
              {t('admin.confirmReject')}
            </Button>
          </div>
        }
      >
        <Input
          label={t('admin.rejectionReasonLabel')}
          value={rejectNote}
          onChange={(e) => setRejectNote(e.target.value)}
          placeholder={t('admin.rejectionReasonPlaceholder')}
        />
      </Modal>

      {/* Rule Form */}
      <Modal
        open={openRuleForm}
        onClose={closeRuleForm}
        title={editRuleId ? t('admin.editAttendanceRule') : t('admin.createAttendanceRule')}
        size="md"
        footer={
          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={closeRuleForm} disabled={ruleSubmitting}>
              {t('admin.cancel')}
            </Button>
            <Button variant="primary" icon={ShieldCheck} onClick={onSaveRule} disabled={ruleSubmitting}>
              {ruleSubmitting ? t('admin.saving') : t('admin.save')}
            </Button>
          </div>
        }
      >
        <div className="flex flex-col gap-3">
          <Input
            label={t('admin.ruleNameLabel')}
            value={rulePayload.name}
            onChange={(e) => setRulePayload((p) => ({ ...p, name: e.target.value }))}
            error={ruleErrors.name}
            placeholder={t('admin.ruleNamePlaceholder')}
          />
          <Input
            label={t('admin.ruleDescriptionLabel')}
            value={rulePayload.description}
            onChange={(e) => setRulePayload((p) => ({ ...p, description: e.target.value }))}
            placeholder={t('admin.ruleDescriptionPlaceholder')}
          />
          <Select
            label={t('admin.ruleCategoryLabel')}
            value={rulePayload.category}
            onChange={(e) => setRulePayload((p) => ({ ...p, category: e.target.value }))}
            options={RULE_CATEGORIES.map((c) => ({ value: c.value, label: c.label }))}
          />
          <div className="flex items-center justify-between rounded-md border border-neutral-200 px-3 py-2">
            <div>
              <p className="text-sm font-medium text-neutral-900">{t('admin.ruleEnabledLabel')}</p>
              <p className="text-xs text-neutral-500">{t('admin.ruleEnabledDesc')}</p>
            </div>
            <Switch
              checked={rulePayload.enabled}
              onChange={(v) => setRulePayload((p) => ({ ...p, enabled: v }))}
              aria-label={t('admin.ruleEnabledLabel')}
            />
          </div>
        </div>
      </Modal>

      {/* Delete confirmation */}
      <Modal
        open={Boolean(confirmDeleteId)}
        onClose={() => setConfirmDeleteId(null)}
        title={t('admin.deleteAttendanceRule')}
        size="sm"
        footer={
          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={() => setConfirmDeleteId(null)}>{t('admin.cancel')}</Button>
            <Button variant="danger" icon={Trash2} onClick={onConfirmDelete}>{t('admin.delete')}</Button>
          </div>
        }
      >
        <div className="flex items-start gap-2 text-sm text-neutral-700">
          <AlertTriangle className="mt-0.5 h-4 w-4 text-warning-600" aria-hidden="true" />
          <span>{t('admin.deleteRuleConfirm')}</span>
        </div>
      </Modal>
    </>
  )
}

// ---------- Inline tiles --------------------------------------------------
function ApprovalStatTile({ icon: Icon, label, value, tone = 'primary' }) {
  return (
    <StatCard label={label} value={value} icon={Icon} tone={tone} />
  )
}

// ---------- Pending Approval Panel ---------------------------------------
function PendingApprovalPanel({ query, tick, onView, t }) {
  const [page, setPage] = useState(1)
  const pageSize = 10
  const data = useMemo(
    () => queryAttendance({ ...query, approvalStatus: 'pending', page, pageSize }),
    [query, page, tick], // eslint-disable-line react-hooks/exhaustive-deps
  )

  if (data.total === 0) {
    return (
      <Card>
        <EmptyState
          title={t('admin.noPendingAttendance')}
          description={t('admin.pendingRecordsAppearHere')}
          icon={Clock4}
        />
      </Card>
    )
  }

  return (
    <Card>
      <Table
        data={data.items}
        rowKey="id"
        columns={[
          { key: 'date',   header: t('attendance.columnDate'),  render: (r) => r.date },
          { key: 'emp',    header: t('attendance.columnEmployee'), render: (r) => (
            <div className="flex flex-col">
              <span className="text-sm font-medium">{r.employeeName}</span>
              <span className="text-xs text-neutral-500">{r.employeeCode} · {r.departmentName}</span>
            </div>
          ) },
          { key: 'st',     header: t('attendance.columnStatus'), render: (r) => (
            <Badge tone={statusTone(r.status)}>{r.statusLabel}</Badge>
          ) },
          { key: 'approval', header: t('leaves.approve'), render: (r) => (
            <Badge tone={ATTENDANCE_APPROVAL_TONE[r.approvalStatus] || 'neutral'}>
              {ATTENDANCE_APPROVAL_LABEL[r.approvalStatus] || r.approvalStatus}
            </Badge>
          ) },
          { key: 'view',   header: '', render: (r) => (
            <Button variant="ghost" size="sm" icon={ShieldCheck} onClick={() => onView?.(r.id)}>
              {t('admin.view')}
            </Button>
          ) },
        ]}
      />
      <div className="mt-3 flex items-center justify-between text-xs text-neutral-500">
        <span>{data.total} {t('admin.pendingRecordsCount')}</span>
        <PaginationMini
          page={data.page}
          totalPages={data.totalPages}
          onPageChange={setPage}
          t={t}
        />
      </div>
    </Card>
  )
}

function PaginationMini({ page, totalPages, onPageChange, t }) {
  return (
    <div className="flex items-center gap-1">
      <Button variant="ghost" size="sm" disabled={page <= 1} onClick={() => onPageChange(page - 1)}>
        {t('admin.previous')}
      </Button>
      <span>{page}/{totalPages}</span>
      <Button variant="ghost" size="sm" disabled={page >= totalPages} onClick={() => onPageChange(page + 1)}>
        {t('admin.next')}
      </Button>
    </div>
  )
}

function statusTone(s) {
  if (s === 'late') return 'warning'
  if (s === 'early_leave') return 'warning'
  if (s === 'on_leave') return 'pending'
  if (s === 'absent') return 'danger'
  if (s === 'incomplete') return 'neutral'
  return 'success'
}

// ---------- Rules Panel --------------------------------------------------
function RulesPanel({ rules, onCreate, onEdit, onToggle, onDelete, t }) {
  if (rules.length === 0) {
    return (
      <Card>
        <EmptyState
          title={t('admin.noAttendanceRules')}
          description={t('admin.createRuleBelow')}
          actionLabel={t('admin.createRuleTitle')}
          onAction={onCreate}
        />
      </Card>
    )
  }

  return (
    <Card>
      <div className="mb-3 flex justify-end">
        <Button variant="primary" icon={Plus} onClick={onCreate}>{t('admin.createRuleTitle')}</Button>
      </div>
      <Table
        data={rules}
        rowKey="id"
        columns={[
          { key: 'name', header: t('admin.ruleNameLabel'), render: (r) => (
            <div className="flex items-center gap-2">
              <Flag className="h-4 w-4 text-brand-600" aria-hidden="true" />
              <span className="text-sm font-medium">{r.name}</span>
            </div>
          ) },
          { key: 'description', header: t('admin.ruleDescriptionLabel'), render: (r) => (
            <span className="text-sm text-neutral-700">{r.description || '—'}</span>
          ) },
          { key: 'category', header: t('admin.ruleCategoryLabel'), render: (r) => (
            <Badge tone="info">
              {RULE_CATEGORIES.find((c) => c.value === r.category)?.label || r.category}
            </Badge>
          ) },
          { key: 'enabled', header: t('admin.ruleEnabledLabel'), render: (r) => (
            <Switch
              checked={r.enabled}
              onChange={(v) => onToggle(r.id, v)}
              aria-label={`Toggle ${r.name}`}
            />
          ) },
          { key: 'actions', header: '', render: (r) => (
            <div className="flex justify-end gap-2">
              <Button variant="ghost" size="sm" icon={Pencil} onClick={() => onEdit(r.id)}>{t('admin.edit')}</Button>
              <Button variant="ghost" size="sm" icon={Trash2} onClick={() => onDelete(r.id)}>{t('admin.delete')}</Button>
            </div>
          ) },
        ]}
      />
    </Card>
  )
}

// Touch imports to keep tree-shaking honest
void Power
