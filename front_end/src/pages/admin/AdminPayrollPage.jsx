import { useEffect, useMemo, useState } from 'react'
import {
  Wallet,
  Plus,
  FileDown,
  RefreshCw,
  CheckCircle2,
  XCircle,
  Clock4,
  Settings2,
  Pencil,
  Trash2,
  AlertTriangle,
} from 'lucide-react'

import PageHeader from '../../components/common/PageHeader'
import Button from '../../components/common/Button'
import Tabs from '../../components/common/Tabs'
import Card from '../../components/common/Card'
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

import PayrollStatTiles from '../../components/payroll/PayrollStatTiles'
import PayrollFilterBar from '../../components/payroll/PayrollFilterBar'
import PayrollTable from '../../components/payroll/PayrollTable'
import PayrollPagination from '../../components/payroll/PayrollPagination'
import PayrollDetailModal from '../../components/payroll/PayrollDetailModal'
import PayrollFormModal from '../../components/payroll/PayrollFormModal'
import MarkPaidConfirmModal from '../../components/payroll/MarkPaidConfirmModal'

import {
  queryPayroll,
  getPayrollSummary,
  getPayrollById,
  getPaymentStatuses,
  createPayroll,
  updatePayroll,
  markPayrollAsPaid,
  subscribePayroll,
  approvePayroll,
  rejectPayroll,
  getApprovalSummary,
  PAYROLL_APPROVAL_STATUSES,
  PAYROLL_APPROVAL_LABEL,
  PAYROLL_APPROVAL_TONE,
  getPayrollRules,
  createPayrollRule,
  updatePayrollRule,
  togglePayrollRule,
  deletePayrollRule,
  PAYROLL_RULE_TYPES,
} from '../../services/payrollService'
import { getDepartments, getEmployees } from '../../services/employeeService'
import { useAuth } from '../../contexts/useAuth'

const DEFAULT_QUERY = {
  search: '',
  month: '',
  year: '',
  departmentId: '',
  paymentStatus: '',
  approvalStatus: '',
  sortBy: 'updatedAt',
  sortDir: 'desc',
  page: 1,
  pageSize: 10,
}

export default function AdminPayrollPage() {
  const { t } = useI18n()
  const toast = useToast()
  const { user } = useAuth()

  const [query, setQuery] = useState(DEFAULT_QUERY)
  const [loading, setLoading] = useState(true)
  const [tick, setTick] = useState(0)
  const [openDetail, setOpenDetail] = useState(false)
  const [detailId, setDetailId] = useState(null)
  const [openForm, setOpenForm] = useState(false)
  const [formMode, setFormMode] = useState('create')
  const [formInitial, setFormInitial] = useState(null)
  const [submitting, setSubmitting] = useState(false)
  const [serverErrors, setServerErrors] = useState({})
  const [openMarkPaid, setOpenMarkPaid] = useState(false)
  const [markPaidId, setMarkPaidId] = useState(null)
  const [paymentDate, setPaymentDate] = useState(new Date().toISOString().slice(0, 10))
  const [actionBusy, setActionBusy] = useState(false)

  // Reject modal
  const [rejectId, setRejectId] = useState(null)
  const [rejectNote, setRejectNote] = useState('')

  // Rules state
  const [rules, setRules] = useState([])
  const [openRuleForm, setOpenRuleForm] = useState(false)
  const [editRuleId, setEditRuleId] = useState(null)
  const [rulePayload, setRulePayload] = useState({ name: '', description: '', type: 'gross', enabled: true })
  const [ruleErrors, setRuleErrors] = useState({})
  const [ruleSubmitting, setRuleSubmitting] = useState(false)
  const [confirmDeleteId, setConfirmDeleteId] = useState(null)

  const APPROVAL_OPTIONS = [
    { value: '', label: t('admin.allApprovalStatusesPayroll') },
    ...PAYROLL_APPROVAL_STATUSES.map((s) => ({ value: s.value, label: s.label })),
  ]

  useEffect(() => {
    setLoading(true)
    const tmr = setTimeout(() => setLoading(false), 150)
    return () => clearTimeout(tmr)
  }, [
    tick,
    query.search,
    query.month,
    query.year,
    query.departmentId,
    query.paymentStatus,
    query.approvalStatus,
  ])

  useEffect(() => {
    const unsub = subscribePayroll(() => setTick((n) => n + 1))
    return () => unsub()
  }, [])

  useEffect(() => {
    setRules(getPayrollRules())
  }, [tick])

  const departments = useMemo(() => getDepartments(), [])
  const statuses = useMemo(() => getPaymentStatuses(), [])
  const allEmployees = useMemo(
    () =>
      getEmployees().map((e) => ({
        id: e.id,
        label: `${e.fullName} · ${e.employeeCode}`,
      })),
    [],
  )

  const monthOptions = useMemo(
    () => Array.from({ length: 12 }, (_, i) => ({ value: String(i + 1), label: `Tháng ${i + 1}` })),
    [],
  )
  const yearOptions = useMemo(() => {
    const years = new Set()
    const currentYear = new Date().getFullYear()
    years.add(currentYear); years.add(currentYear - 1); years.add(currentYear - 2)
    return Array.from(years).sort((a, b) => b - a).map((y) => ({ value: String(y), label: String(y) }))
  }, [])

  // eslint-disable-next-line react-hooks/exhaustive-deps
  const data = useMemo(() => queryPayroll(query), [query, tick])
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const summary = useMemo(
    () => getPayrollSummary({ month: query.month, year: query.year, departmentId: query.departmentId }),
    [query.month, query.year, query.departmentId, tick],
  )
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const approvalSummary = useMemo(
    () => getApprovalSummary({ month: query.month, year: query.year, departmentId: query.departmentId }),
    [query.month, query.year, query.departmentId, tick],
  )

  const setField = (key, value) => setQuery((q) => ({ ...q, [key]: value, page: 1 }))
  const onClear = () => setQuery({ ...DEFAULT_QUERY })

  const onRefresh = () => {
    setTick((n) => n + 1)
    toast.info(t('admin.payrollDataRefreshed'))
  }

  const onExportCsv = () => {
    if (data.total === 0) {
      toast.warning(t('admin.noPayrollData'))
      return
    }
    const headers = [
      t('payroll.columnCode') || 'Mã phiếu', t('employees.columnEmployeeCode') || 'Mã NV', t('employees.columnName') || 'Nhân viên',
      t('employees.columnDepartment') || 'Phòng ban', t('payroll.columnPeriod') || 'Kỳ lương',
      t('payroll.columnBaseSalary') || 'Lương cơ bản', t('payroll.columnGross') || 'Tổng thu nhập', t('payroll.columnDeduction') || 'Tổng khấu trừ', t('payroll.columnNet') || 'Thực nhận',
      t('payroll.columnPaymentStatus') || 'Trạng thái', t('payroll.columnApprovalStatus') || 'Trạng thái duyệt', t('payroll.columnPaymentDate') || 'Ngày thanh toán',
    ]
    const escape = (v) => {
      const s = String(v ?? '')
      if (/[",\n]/.test(s)) return `"${s.replace(/"/g, '""')}"`
      return s
    }
    const rows = data.items.map((r) => [
      r.payrollCode, r.employeeCode, r.employeeName, r.departmentName,
      `T${String(r.month).padStart(2, '0')}/${r.year}`,
      r.baseSalary, r.grossSalary, r.totalDeduction, r.netSalary,
      r.paymentStatus === 'paid' ? 'Đã thanh toán' : r.paymentStatus === 'unpaid' ? 'Chưa thanh toán' : 'Nháp',
      PAYROLL_APPROVAL_LABEL[r.approvalStatus] || r.approvalStatus,
      r.paymentDate || '',
    ])
    const csv = [headers, ...rows].map((row) => row.map(escape).join(',')).join('\n')
    const blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `bang-luong-${new Date().toISOString().slice(0, 10)}.csv`
    document.body.appendChild(a); a.click(); document.body.removeChild(a); URL.revokeObjectURL(url)
    toast.success(t('admin.exportPayrollCsvSuccess'), { description: `${data.total} ${t('admin.payrollLines')}` })
  }

  const openCreate = () => {
    setServerErrors({})
    setFormMode('create')
    setFormInitial(null)
    setOpenForm(true)
  }
  const openEdit = (id) => {
    const r = getPayrollById(id)
    if (!r) { toast.error(t('admin.cannotFindProgram')); return }
    setServerErrors({})
    setFormMode('edit')
    setFormInitial(r)
    setOpenForm(true)
    setOpenDetail(false)
  }
  const openView = (id) => { setDetailId(id); setOpenDetail(true) }
  const openMarkPaidModal = (id) => {
    setMarkPaidId(id)
    setPaymentDate(new Date().toISOString().slice(0, 10))
    setOpenMarkPaid(true)
  }

  const submitForm = async (values) => {
    setSubmitting(true)
    const result = formMode === 'edit'
      ? await updatePayroll(formInitial.id, values)
      : await createPayroll(values)
    setSubmitting(false)
    if (!result.ok) {
      setServerErrors(result.errors || {})
      toast.error(formMode === 'edit' ? t('admin.cannotSavePayroll') : t('admin.cannotCreatePayroll'), {
        description: result.errors?._form || t('admin.payrollCheckFields'),
      })
      return
    }
    toast.success(formMode === 'edit' ? t('admin.payrollUpdated') : t('admin.payrollCreated'), {
      description: `${result.record.payrollCode} · ${result.record.employeeName}`,
    })
    setOpenForm(false); setServerErrors({}); setFormInitial(null)
    setQuery((q) => ({ ...q, page: 1 }))
  }

  const confirmMarkPaid = async () => {
    if (!markPaidId) return
    setSubmitting(true)
    const result = await markPayrollAsPaid(markPaidId, paymentDate)
    setSubmitting(false)
    if (!result.ok) {
      toast.error(t('admin.cannotMarkPaid'), { description: result.error })
      return
    }
    toast.success(t('admin.paidMarked'), {
      description: `${result.record.payrollCode} · ${result.record.employeeName}`,
    })
    setOpenMarkPaid(false); setMarkPaidId(null); setOpenDetail(false); setDetailId(null)
  }

  const onApprove = async (id) => {
    if (!id) return
    setActionBusy(true)
    const res = await approvePayroll(id, user?.id || null, '')
    setActionBusy(false)
    if (!res.ok) {
      toast.error(t('admin.cannotApprovePayroll'), { description: res.error || t('common.warning') })
      return
    }
    toast.success(t('admin.payrollApproved'), {
      description: `${res.record.payrollCode} · ${res.record.employeeName}`,
    })
  }

  const onReject = async () => {
    if (!rejectId) return
    setActionBusy(true)
    const res = await rejectPayroll(rejectId, user?.id || null, rejectNote)
    setActionBusy(false)
    if (!res.ok) {
      toast.error(t('admin.cannotRejectPayroll'), { description: res.error || t('common.warning') })
      return
    }
    setRejectId(null); setRejectNote('')
    toast.success(t('admin.payrollRejected'), {
      description: `${res.record.payrollCode} · ${res.record.employeeName}`,
    })
  }

  // ----- Rules -----
  const openCreateRule = () => {
    setEditRuleId(null)
    setRulePayload({ name: '', description: '', type: 'gross', enabled: true })
    setRuleErrors({})
    setOpenRuleForm(true)
  }
  const openEditRule = (id) => {
    const r = rules.find((x) => x.id === id)
    if (!r) return
    setEditRuleId(id)
    setRulePayload({
      name: r.name,
      description: r.description || '',
      type: r.type,
      enabled: r.enabled,
    })
    setRuleErrors({})
    setOpenRuleForm(true)
  }
  const closeRuleForm = () => { setOpenRuleForm(false); setEditRuleId(null); setRuleErrors({}) }
  const onSaveRule = async () => {
    setRuleSubmitting(true)
    const res = editRuleId
      ? await updatePayrollRule(editRuleId, rulePayload)
      : await createPayrollRule({ ...rulePayload, createdBy: user?.id || 'usr-admin-001' })
    setRuleSubmitting(false)
    if (!res.ok) {
      setRuleErrors(res.errors || {})
      toast.error(t('admin.cannotSavePayrollRule'))
      return
    }
    closeRuleForm()
    toast.success(t('admin.payrollRuleSaved'))
  }
  const onToggleRule = async (id, enabled) => {
    const res = await togglePayrollRule(id, enabled)
    if (!res.ok) toast.error(t('admin.cannotChangePayrollRuleStatus'))
    else toast.success(enabled ? t('admin.payrollRuleEnabled') : t('admin.payrollRuleDisabled'))
  }
  const onConfirmDelete = async () => {
    if (!confirmDeleteId) return
    const res = await deletePayrollRule(confirmDeleteId)
    if (!res.ok) toast.error(t('admin.cannotDeletePayrollRule'))
    else toast.success(t('admin.payrollRuleDeleted'))
    setConfirmDeleteId(null)
  }

  const detailRecord = detailId ? getPayrollById(detailId) : null
  const markPaidRecord = markPaidId ? getPayrollById(markPaidId) : null

  const tabs = [
    {
      id: 'payroll',
      label: t('payroll.pageTitle'),
      icon: Wallet,
      badge: data.total,
      panel: (
        <>
          <div className="mb-6"><PayrollStatTiles summary={summary} /></div>

          <div className="mb-4 grid grid-cols-1 gap-3 sm:grid-cols-3">
            <StatCard icon={Clock4}       label={t('status.pending')}  value={approvalSummary.pending}  tone="info" />
            <StatCard icon={CheckCircle2} label={t('status.approved')} value={approvalSummary.approved} tone="success" />
            <StatCard icon={XCircle}      label={t('status.rejected')} value={approvalSummary.rejected} tone="danger" />
          </div>

          <div className="mb-4">
            <PayrollFilterBar
              search={query.search}
              onSearchChange={(v) => setField('search', v)}
              month={query.month}
              onMonthChange={(v) => setField('month', v)}
              year={query.year}
              onYearChange={(v) => setField('year', v)}
              departmentId={query.departmentId}
              onDepartmentChange={(v) => setField('departmentId', v)}
              paymentStatus={query.paymentStatus}
              onPaymentStatusChange={(v) => setField('paymentStatus', v)}
              departments={departments}
              statuses={statuses}
              monthOptions={monthOptions}
              yearOptions={yearOptions}
              onClear={onClear}
              total={data.total}
              showDepartment
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
                title={t('admin.noPayrollDataYet')}
                description={
                  query.search || query.month || query.year || query.departmentId || query.paymentStatus || query.approvalStatus
                    ? t('admin.tryPayrollFilterOrPeriod')
                    : t('admin.noPayrollInSystem')
                }
                actionLabel={t('admin.createPayroll')}
                onAction={openCreate}
              />
            ) : (
              <PayrollTable
                rows={data.items}
                loading={loading}
                onView={openView}
                onEdit={openEdit}
                onMarkPaid={openMarkPaidModal}
                isAdminView
              />
            )}
          </div>

          {data.total > 0 && (
            <div className="mb-6">
              <PayrollPagination
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
      label: t('payroll.pageTitle').includes('Lương') ? 'Quy tắc lương' : 'Payroll Rules',
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
        title={t('admin.payrollTitle')}
        subtitle={t('admin.payrollSubtitle')}
        icon={Wallet}
        breadcrumb={t('admin.payrollBreadcrumb')}
        actions={
          <>
            <Button variant="secondary" icon={RefreshCw} onClick={onRefresh}>{t('admin.refreshPayroll')}</Button>
            <Button variant="secondary" icon={FileDown} onClick={onExportCsv}>{t('admin.exportPayrollCsv')}</Button>
            <Button variant="primary" icon={Plus} onClick={openCreate}>{t('admin.createPayroll')}</Button>
          </>
        }
      />

      <Tabs items={tabs} defaultValue="payroll" variant="underline" />

      <PayrollDetailModal
        open={openDetail}
        onClose={() => { setOpenDetail(false); setDetailId(null) }}
        record={detailRecord}
        isAdminView
        onEdit={openEdit}
        onMarkPaid={openMarkPaidModal}
        approvalActions={
          detailRecord?.approvalStatus !== 'approved' ? (
            <div className="flex flex-wrap justify-end gap-2">
              <Button
                variant="outline"
                icon={XCircle}
                onClick={() => { setRejectId(detailRecord.id); setRejectNote('') }}
                disabled={actionBusy}
              >{t('admin.reject')}</Button>
              <Button
                variant="primary"
                icon={CheckCircle2}
                onClick={() => onApprove(detailRecord.id)}
                disabled={actionBusy}
              >{t('admin.approve')}</Button>
            </div>
          ) : null
        }
      />

      <PayrollFormModal
        open={openForm}
        onClose={() => { setOpenForm(false); setServerErrors({}) }}
        mode={formMode}
        initial={formInitial}
        employees={allEmployees}
        onSubmit={submitForm}
        submitting={submitting}
        serverErrors={serverErrors}
      />

      <MarkPaidConfirmModal
        open={openMarkPaid}
        onClose={() => { setOpenMarkPaid(false); setMarkPaidId(null) }}
        record={markPaidRecord}
        onConfirm={confirmMarkPaid}
        submitting={submitting}
        paymentDate={paymentDate}
        onChangePaymentDate={setPaymentDate}
      />

      <Modal
        open={Boolean(rejectId)}
        onClose={() => { setRejectId(null); setRejectNote('') }}
        title={t('admin.rejectPayrollTitle')}
        description={t('admin.rejectPayrollDesc')}
        size="md"
        footer={
          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={() => { setRejectId(null); setRejectNote('') }}>{t('admin.cancel')}</Button>
            <Button variant="danger" icon={XCircle} onClick={onReject} disabled={actionBusy}>
              {t('admin.confirmRejectPayroll')}
            </Button>
          </div>
        }
      >
        <Input
          label={t('admin.rejectPayrollReasonLabel')}
          value={rejectNote}
          onChange={(e) => setRejectNote(e.target.value)}
          placeholder={t('admin.rejectPayrollReasonPlaceholder')}
        />
      </Modal>

      {/* Rule Form */}
      <Modal
        open={openRuleForm}
        onClose={closeRuleForm}
        title={editRuleId ? t('admin.editPayrollRule') : t('admin.createPayrollRule')}
        size="md"
        footer={
          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={closeRuleForm} disabled={ruleSubmitting}>{t('admin.cancel')}</Button>
            <Button variant="primary" icon={Settings2} onClick={onSaveRule} disabled={ruleSubmitting}>
              {ruleSubmitting ? t('admin.saving') : t('admin.save')}
            </Button>
          </div>
        }
      >
        <div className="flex flex-col gap-3">
          <Input
            label={t('admin.payrollRuleNameLabel')}
            value={rulePayload.name}
            onChange={(e) => setRulePayload((p) => ({ ...p, name: e.target.value }))}
            error={ruleErrors.name}
            placeholder={t('admin.payrollRuleNamePlaceholder')}
          />
          <Input
            label={t('admin.payrollRuleDescriptionLabel')}
            value={rulePayload.description}
            onChange={(e) => setRulePayload((p) => ({ ...p, description: e.target.value }))}
            placeholder={t('admin.payrollRuleDescriptionPlaceholder')}
          />
          <Select
            label={t('admin.payrollRuleTypeLabel')}
            value={rulePayload.type}
            onChange={(e) => setRulePayload((p) => ({ ...p, type: e.target.value }))}
            options={PAYROLL_RULE_TYPES.map((t_) => ({ value: t_.value, label: t_.label }))}
          />
          <div className="flex items-center justify-between rounded-md border border-neutral-200 px-3 py-2">
            <div>
              <p className="text-sm font-medium text-neutral-900">{t('admin.payrollRuleEnabledLabel')}</p>
              <p className="text-xs text-neutral-500">{t('admin.payrollRuleEnabledDesc')}</p>
            </div>
            <Switch
              checked={rulePayload.enabled}
              onChange={(v) => setRulePayload((p) => ({ ...p, enabled: v }))}
              aria-label={t('admin.payrollRuleEnabledLabel')}
            />
          </div>
        </div>
      </Modal>

      <Modal
        open={Boolean(confirmDeleteId)}
        onClose={() => setConfirmDeleteId(null)}
        title={t('admin.deletePayrollRule')}
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
          <span>{t('admin.deletePayrollRuleConfirm')}</span>
        </div>
      </Modal>
    </>
  )
}

// ---------- Pending Approval Panel ---------------------------------------
function PendingApprovalPanel({ query, tick, onView, t }) {
  const [page, setPage] = useState(1)
  const pageSize = 10
  const data = useMemo(
    () => queryPayroll({ ...query, approvalStatus: 'pending', page, pageSize }),
    [query, page, tick], // eslint-disable-line react-hooks/exhaustive-deps
  )

  if (data.total === 0) {
    return (
      <Card>
        <EmptyState
          title={t('admin.noPayrollPending')}
          description={t('admin.payrollPendingAppearHere')}
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
          { key: 'period',  header: t('payroll.columnPeriod') || 'Kỳ lương', render: (r) => `T${String(r.month).padStart(2, '0')}/${r.year}` },
          { key: 'emp',     header: t('attendance.columnEmployee') || 'Nhân viên', render: (r) => (
            <div className="flex flex-col">
              <span className="text-sm font-medium">{r.employeeName}</span>
              <span className="text-xs text-neutral-500">{r.employeeCode} · {r.departmentName}</span>
            </div>
          ) },
          { key: 'net',     header: t('payroll.columnNet') || 'Thực nhận', render: (r) => (
            <span className="text-sm font-medium">{formatNet(r.netSalary)}</span>
          ) },
          { key: 'approval', header: t('leaves.approve') || 'Duyệt', render: (r) => (
            <Badge tone={PAYROLL_APPROVAL_TONE[r.approvalStatus] || 'neutral'}>
              {PAYROLL_APPROVAL_LABEL[r.approvalStatus] || r.approvalStatus}
            </Badge>
          ) },
          { key: 'view',    header: '', render: (r) => (
            <Button variant="ghost" size="sm" icon={CheckCircle2} onClick={() => onView?.(r.id)}>
              {t('admin.view')}
            </Button>
          ) },
        ]}
      />
      <div className="mt-3 flex items-center justify-between text-xs text-neutral-500">
        <span>{data.total} {t('admin.payrollList')}</span>
        <div className="flex items-center gap-1">
          <Button variant="ghost" size="sm" disabled={data.page <= 1} onClick={() => setPage(data.page - 1)}>{t('admin.previous')}</Button>
          <span>{data.page}/{data.totalPages}</span>
          <Button variant="ghost" size="sm" disabled={data.page >= data.totalPages} onClick={() => setPage(data.page + 1)}>{t('admin.next')}</Button>
        </div>
      </div>
    </Card>
  )
}

function formatNet(v) {
  try { return new Intl.NumberFormat('vi-VN').format(v || 0) + ' ₫' } catch (_e) { void _e; return `${v}` }
}

// ---------- Rules Panel --------------------------------------------------
function RulesPanel({ rules, onCreate, onEdit, onToggle, onDelete, t }) {
  if (rules.length === 0) {
    return (
      <Card>
        <EmptyState
          title={t('admin.noPayrollRules')}
          description={t('admin.createPayrollRuleBelow')}
          actionLabel={t('admin.createPayrollRuleTitle')}
          onAction={onCreate}
        />
      </Card>
    )
  }

  return (
    <Card>
      <div className="mb-3 flex justify-end">
        <Button variant="primary" icon={Plus} onClick={onCreate}>{t('admin.createPayrollRuleTitle')}</Button>
      </div>
      <Table
        data={rules}
        rowKey="id"
        columns={[
          { key: 'name', header: t('admin.payrollRuleNameLabel'), render: (r) => (
            <span className="text-sm font-medium">{r.name}</span>
          ) },
          { key: 'type', header: t('admin.payrollRuleTypeLabel'), render: (r) => (
            <Badge tone="info">
              {PAYROLL_RULE_TYPES.find((t_) => t_.value === r.type)?.label || r.type}
            </Badge>
          ) },
          { key: 'description', header: t('admin.payrollRuleDescriptionLabel'), render: (r) => (
            <span className="text-sm text-neutral-700">{r.description || '—'}</span>
          ) },
          { key: 'enabled', header: t('admin.payrollRuleEnabledLabel'), render: (r) => (
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
