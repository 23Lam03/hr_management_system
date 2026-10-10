import { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { FileText, Plus, RefreshCw } from 'lucide-react'

import PageHeader from '../../components/common/PageHeader'
import Button from '../../components/common/Button'
import EmptyState from '../../components/common/EmptyState'
import { useToast } from '../../components/common/useToast'
import { useI18n } from '../../i18n/useI18n'

import ContractStatTiles from '../../components/contracts/ContractStatTiles'
import ContractFilterBar from '../../components/contracts/ContractFilterBar'
import ContractTable from '../../components/contracts/ContractTable'
import ContractPagination from '../../components/contracts/ContractPagination'
import ContractFormModal from '../../components/contracts/ContractFormModal'

import {
  queryContracts,
  getContractsSummary,
  createContract,
  updateContract,
  getContractById,
  getContractTypes,
  getContractStatuses,
  subscribeContracts,
} from '../../services/contractService'
import { getEmployees, getDepartments } from '../../services/employeeService'

const DEFAULT_QUERY = {
  search: '',
  departmentId: '',
  contractType: '',
  status: '',
  effectiveFrom: '',
  effectiveTo: '',
  expiringWithinDays: '',
  sortBy: 'updatedAt',
  sortDir: 'desc',
  page: 1,
  pageSize: 10,
}

export default function AdminContractsPage() {
  const { t } = useI18n()
  const navigate = useNavigate()
  const toast = useToast()
  const [query, setQuery] = useState(DEFAULT_QUERY)
  const [loading, setLoading] = useState(true)
  const [tick, setTick] = useState(0)
  const [openForm, setOpenForm] = useState(false)
  const [formMode, setFormMode] = useState('create')
  const [formInitial, setFormInitial] = useState(null)
  const [submitting, setSubmitting] = useState(false)
  const [serverErrors, setServerErrors] = useState({})

  useEffect(() => {
    setLoading(true)
    const tmr = setTimeout(() => setLoading(false), 150)
    return () => clearTimeout(tmr)
  }, [tick, query.search, query.departmentId, query.contractType, query.status, query.effectiveFrom, query.effectiveTo, query.expiringWithinDays])

  useEffect(() => {
    const unsub = subscribeContracts(() => setTick((n) => n + 1))
    return () => unsub()
  }, [])

  const statuses = useMemo(() => getContractStatuses(), [])
  const types = useMemo(() => getContractTypes(), [])
  const departments = useMemo(() => getDepartments(), [])
  const employees = useMemo(() => getEmployees().filter((e) => e.status !== 'inactive'), [])
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const data = useMemo(() => queryContracts(query), [query, tick])
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const summary = useMemo(() => getContractsSummary(), [tick])

  const setField = (key, value) => setQuery((q) => ({ ...q, [key]: value, page: 1 }))
  const onClear = () => setQuery({ ...DEFAULT_QUERY })

  const onRefresh = () => {
    setTick((n) => n + 1)
    toast.info(t('admin.contractsDataRefreshed'))
  }

  const openCreate = () => {
    setServerErrors({})
    setFormMode('create')
    setFormInitial(null)
    setOpenForm(true)
  }

  const openEdit = (id) => {
    const c = getContractById(id)
    if (!c) {
      toast.error(t('admin.cannotFindContract'))
      return
    }
    if (c.status === 'terminated' || c.status === 'cancelled' || c.status === 'expired') {
      toast.warning(t('admin.contractEnded'), { description: t('admin.cannotEditEndedContract') })
      return
    }
    setServerErrors({})
    setFormMode('edit')
    setFormInitial(c)
    setOpenForm(true)
  }

  const openView = (id) => navigate(`/admin/contracts/${id}`)
  const openExtend = (id) => navigate(`/admin/contracts/${id}?action=extend`)
  const openTerminate = (id) => navigate(`/admin/contracts/${id}?action=terminate`)

  const submitForm = async (values) => {
    setSubmitting(true)
    const result = formMode === 'edit'
      ? await updateContract(formInitial.id, values)
      : await createContract(values)
    setSubmitting(false)
    if (!result.ok) {
      setServerErrors(result.errors || {})
      toast.error(formMode === 'edit' ? t('admin.cannotUpdateContract') : t('admin.cannotCreateContract'), {
        description: result.errors?._form || t('admin.contractCheckFields'),
      })
      return
    }
    toast.success(formMode === 'edit' ? t('admin.contractUpdated') : t('admin.contractCreated'), {
      description: result.contract.contractCode,
    })
    setOpenForm(false)
    setServerErrors({})
    setFormInitial(null)
    setQuery((q) => ({ ...q, page: 1 }))
  }

  return (
    <>
      <PageHeader
        title={t('admin.contractsTitle')}
        subtitle={t('admin.contractsSubtitle')}
        icon={FileText}
        breadcrumb={t('admin.contractsBreadcrumb')}
        actions={
          <>
            <Button variant="secondary" icon={RefreshCw} onClick={onRefresh}>{t('admin.refreshContracts')}</Button>
            <Button icon={Plus} onClick={openCreate}>{t('admin.createContract')}</Button>
          </>
        }
      />

      <div className="mb-6">
        <ContractStatTiles summary={summary} />
      </div>

      <div className="mb-4">
        <ContractFilterBar
          search={query.search}
          onSearchChange={(v) => setField('search', v)}
          departmentId={query.departmentId}
          onDepartmentChange={(v) => setField('departmentId', v)}
          contractType={query.contractType}
          onContractTypeChange={(v) => setField('contractType', v)}
          status={query.status}
          onStatusChange={(v) => setField('status', v)}
          effectiveFrom={query.effectiveFrom}
          effectiveTo={query.effectiveTo}
          onEffectiveFromChange={(v) => setField('effectiveFrom', v)}
          onEffectiveToChange={(v) => setField('effectiveTo', v)}
          expiringWithinDays={query.expiringWithinDays}
          onExpiringWithinDaysChange={(v) => setField('expiringWithinDays', v)}
          statuses={statuses}
          types={types}
          departments={departments}
          onClear={onClear}
          total={data.total}
        />
      </div>

      <div className="mb-4">
        {data.total === 0 && !loading ? (
          <EmptyState
            title={t('admin.noContracts')}
            description={
              query.search || query.departmentId || query.contractType || query.status || query.effectiveFrom || query.effectiveTo || query.expiringWithinDays
                ? t('admin.noContractsFiltered')
                : t('admin.noContractsEmpty')
            }
            actionLabel={t('admin.createContract')}
            onAction={openCreate}
          />
        ) : (
          <ContractTable
            rows={data.items}
            loading={loading}
            onView={openView}
            onEdit={openEdit}
            onExtend={openExtend}
            onTerminate={openTerminate}
          />
        )}
      </div>

      {data.total > 0 && (
        <div className="mb-6">
          <ContractPagination
            page={data.page}
            totalPages={data.totalPages}
            pageSize={data.pageSize}
            total={data.total}
            onPageChange={(p) => setQuery((q) => ({ ...q, page: p }))}
            onPageSizeChange={(n) => setQuery((q) => ({ ...q, pageSize: n, page: 1 }))}
          />
        </div>
      )}

      <ContractFormModal
        open={openForm}
        onClose={() => {
          setOpenForm(false)
          setServerErrors({})
        }}
        mode={formMode}
        initial={formInitial}
        employees={employees}
        onSubmit={submitForm}
        submitting={submitting}
        serverErrors={serverErrors}
      />
    </>
  )
}
