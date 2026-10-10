import { useEffect, useMemo, useState } from 'react'
import { Users, UserPlus, Download, RefreshCw } from 'lucide-react'

import PageHeader from '../../components/common/PageHeader'
import Button from '../../components/common/Button'
import EmptyState from '../../components/common/EmptyState'
import { useToast } from '../../components/common/useToast'
import { useI18n } from '../../i18n/useI18n'

import FilterBar from '../../components/employees/FilterBar'
import StatTiles from '../../components/employees/StatTiles'
import EmployeeTable from '../../components/employees/EmployeeTable'
import EmployeePagination from '../../components/employees/EmployeePagination'
import EmployeeFormModal from '../../components/employees/EmployeeFormModal'
import EmployeeDetailModal from '../../components/employees/EmployeeDetailModal'
import StatusConfirmModal from '../../components/employees/StatusConfirmModal'

import {
  queryEmployees,
  getEmployeeStats,
  getDepartments,
  getEmploymentTypes,
  getEmploymentStatuses,
  getEmployeeById,
  createEmployee,
  updateEmployee,
  updateEmployeeStatus,
  subscribeEmployees,
} from '../../services/employeeService'

import { useAuth } from '../../contexts/useAuth'

const SORT_FIELDS = ['fullName', 'employeeCode', 'departmentName', 'hireDate']
const DEFAULT_QUERY = {
  search: '',
  departmentId: '',
  employmentType: '',
  status: '',
  sortBy: 'fullName',
  sortDir: 'asc',
  page: 1,
  pageSize: 10,
}

export default function AdminEmployeesPage() {
  const { t } = useI18n()
  const toast = useToast()
  const { user: currentUser } = useAuth()
  const [query, setQuery] = useState(DEFAULT_QUERY)
  const [loading, setLoading] = useState(true)
  const [tick, setTick] = useState(0) // bump version when service changes

  // Forms / dialogs state
  const [openForm, setOpenForm] = useState(false)
  const [editId, setEditId] = useState(null)
  const [submitting, setSubmitting] = useState(false)
  const [serverErrors, setServerErrors] = useState({})

  const [openDetail, setOpenDetail] = useState(false)
  const [detailId, setDetailId] = useState(null)

  const [openStatus, setOpenStatus] = useState(false)
  const [statusTarget, setStatusTarget] = useState(null) // { id, status }
  const [statusSubmitting, setStatusSubmitting] = useState(false)

  // Mô phỏng loading khi service đổi dữ liệu (UX thân thiện)
  useEffect(() => {
    setLoading(true)
    const t = setTimeout(() => setLoading(false), 150)
    return () => clearTimeout(t)
  }, [tick, query.departmentId, query.employmentType, query.status])

  // Subscribe thay đổi từ service
  useEffect(() => {
    const unsub = subscribeEmployees(() => setTick((n) => n + 1))
    return () => unsub()
  }, [])

  // Lấy danh sách filter option (memo)
  const departments = useMemo(() => getDepartments(), [])
  const employmentTypes = useMemo(() => getEmploymentTypes(), [])
  const statuses = useMemo(() => getEmploymentStatuses(), [])

  // Query chính - chỉ phụ thuộc query + tick (đã cover tick)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const data = useMemo(() => queryEmployees(query), [query, tick])

  // eslint-disable-next-line react-hooks/exhaustive-deps
  const stats = useMemo(() => getEmployeeStats(), [tick])

  // ---- Handlers -------------------------------------------------------------

  const setField = (key, value) => setQuery((q) => ({ ...q, [key]: value, page: 1 }))
  const onSort = (field) => {
    setQuery((q) => {
      if (q.sortBy === field) {
        return { ...q, sortDir: q.sortDir === 'asc' ? 'desc' : 'asc', page: 1 }
      }
      return { ...q, sortBy: field, sortDir: 'asc', page: 1 }
    })
  }
  const onClearFilters = () => setQuery({ ...DEFAULT_QUERY })

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

  const onSubmitForm = async (values) => {
    setSubmitting(true)
    const result = editId
      ? await updateEmployee(editId, values)
      : await createEmployee(values)
    setSubmitting(false)

    if (!result.ok) {
      setServerErrors(result.errors || {})
      toast.error(t('admin.cannotSaveEmployee'), {
        description: result.errors?._form || t('admin.checkInvalidFields'),
      })
      return
    }
    setOpenForm(false)
    setEditId(null)
    setServerErrors({})
    toast.success(editId ? t('admin.employeeUpdated') : t('admin.employeeCreated'), {
      description: `${result.employee.fullName} · ${result.employee.employeeCode}`,
    })
    // Reset filter có thể ẩn bản ghi mới (ví dụ status) - đưa về page 1
    setQuery((q) => ({ ...q, page: 1 }))
  }

  const openView = (id) => {
    setDetailId(id)
    setOpenDetail(true)
  }

  const handleChangeStatus = (id, status) => {
    setStatusTarget({ id, status })
    setOpenStatus(true)
  }

  const confirmStatus = async () => {
    if (!statusTarget) return
    setStatusSubmitting(true)
    const result = await updateEmployeeStatus(statusTarget.id, statusTarget.status)
    setStatusSubmitting(false)

    if (!result.ok) {
      toast.error(t('admin.cannotChangeStatus'), { description: result.error })
      setOpenStatus(false)
      setStatusTarget(null)
      return
    }
    toast.success(t('admin.statusUpdated'), {
      description: `${result.employee.fullName} → ${result.employee.status}`,
    })
    setOpenStatus(false)
    setStatusTarget(null)
  }

  const onExport = () => {
    // Thực sự export CSV từ bộ dữ liệu đang lọc
    try {
      const rows = data.items
      const header = [t('employees.columnEmployeeCode') || 'Mã NV', t('employees.columnName') || 'Họ tên', t('employees.columnEmail') || 'Email', t('employees.columnPhone') || 'Số điện thoại', t('employees.columnDepartment') || 'Phòng ban', t('employees.columnPosition') || 'Chức vụ', t('employees.columnEmploymentType') || 'Loại hình', t('employees.columnJoined') || 'Ngày vào', t('employees.columnStatus') || 'Trạng thái']
      const lines = [header.join(',')]
      rows.forEach((r) => {
        const cells = [
          r.employeeCode,
          r.fullName,
          r.email,
          r.phone,
          r.departmentName,
          r.position,
          r.employmentTypeLabel,
          r.hireDate,
          r.statusLabel,
        ].map((v) => `"${String(v ?? '').replace(/"/g, '""')}"`)
        lines.push(cells.join(','))
      })
      const blob = new Blob(['\ufeff' + lines.join('\n')], { type: 'text/csv;charset=utf-8' })
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `danh-sach-nhan-vien-${new Date().toISOString().slice(0, 10)}.csv`
      document.body.appendChild(a)
      a.click()
      document.body.removeChild(a)
      URL.revokeObjectURL(url)
      toast.success(t('admin.exportCsvSuccess'), { description: `${rows.length} ${t('admin.employeesInPage')}` })
    } catch (e) {
      toast.error(t('admin.exportCsvFail'), { description: t('admin.exportCsvFailDesc') })
      void e
    }
  }

  // ---- Render ---------------------------------------------------------------

  const detailEmployee = detailId ? getEmployeeById(detailId) : null
  const editEmployee = editId ? getEmployeeById(editId) : null
  const statusEmployee = statusTarget ? getEmployeeById(statusTarget.id) : null

  return (
    <>
      <PageHeader
        title={t('admin.employeesTitle')}
        subtitle={t('admin.employeesSubtitle')}
        icon={Users}
        breadcrumb={t('admin.employeesBreadcrumb')}
        actions={
          <>
            <Button variant="secondary" icon={Download} onClick={onExport}>
              {t('admin.exportCsv')}
            </Button>
            <Button variant="primary" icon={UserPlus} onClick={openCreate}>
              {t('admin.addEmployee')}
            </Button>
          </>
        }
      />

      <div className="mb-6">
        <StatTiles stats={stats} />
      </div>

      <div className="mb-4">
        <FilterBar
          search={query.search}
          onSearchChange={(v) => setField('search', v)}
          departmentId={query.departmentId}
          onDepartmentChange={(v) => setField('departmentId', v)}
          employmentType={query.employmentType}
          onEmploymentTypeChange={(v) => setField('employmentType', v)}
          status={query.status}
          onStatusChange={(v) => setField('status', v)}
          departments={departments}
          employmentTypes={employmentTypes}
          statuses={statuses}
          onClear={onClearFilters}
          total={data.total}
        />
      </div>

      <div className="mb-4">
        {data.total === 0 && !loading ? (
          <EmptyState
            title={t('admin.noEmployeesTitle')}
            description={
              query.search || query.departmentId || query.employmentType || query.status
                ? t('admin.noEmployeesDescFiltered')
                : t('admin.noEmployeesDescEmpty')
            }
            actionLabel={t('admin.addEmployee')}
            onAction={openCreate}
          />
        ) : (
          <EmployeeTable
            rows={data.items}
            loading={loading}
            sortBy={query.sortBy}
            sortDir={query.sortDir}
            onSort={onSort}
            onView={openView}
            onEdit={openEdit}
            onChangeStatus={handleChangeStatus}
            currentUserId={currentUser?.id}
          />
        )}
      </div>

      {data.total > 0 && (
        <div className="mb-6">
          <EmployeePagination
            page={data.page}
            totalPages={data.totalPages}
            pageSize={data.pageSize}
            total={data.total}
            onPageChange={(p) => setQuery((q) => ({ ...q, page: p }))}
            onPageSizeChange={(n) => setQuery((q) => ({ ...q, pageSize: n, page: 1 }))}
          />
        </div>
      )}

      {/* Modals */}
      <EmployeeFormModal
        open={openForm}
        onClose={closeForm}
        initialValue={editEmployee}
        onSubmit={onSubmitForm}
        submitting={submitting}
        serverErrors={serverErrors}
      />

      <EmployeeDetailModal
        open={openDetail}
        onClose={() => {
          setOpenDetail(false)
          setDetailId(null)
        }}
        employeeId={detailEmployee?.id ?? null}
        onEdit={(id) => {
          setOpenDetail(false)
          setDetailId(null)
          openEdit(id)
        }}
      />

      <StatusConfirmModal
        open={openStatus}
        onClose={() => {
          setOpenStatus(false)
          setStatusTarget(null)
        }}
        employee={statusEmployee}
        targetStatus={statusTarget?.status}
        onConfirm={confirmStatus}
        submitting={statusSubmitting}
      />

      {/* Floating small toolbar */}
      <div className="hidden">
        {/* icons kept alive for tree-shaking */}
        <RefreshCw />
      </div>
    </>
  )
}

export { SORT_FIELDS }
