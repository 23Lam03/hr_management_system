import { useEffect, useMemo, useState } from 'react'
import { useNavigate, useParams, useSearchParams } from 'react-router-dom'
import { ArrowLeft, FileText, BookOpen, History, CalendarPlus, Pencil, Ban } from 'lucide-react'

import PageHeader from '../../components/common/PageHeader'
import Button from '../../components/common/Button'
import EmptyState from '../../components/common/EmptyState'
import { useToast } from '../../components/common/useToast'
import { useI18n } from '../../i18n/useI18n'

import ContractDetailPanel from '../../components/contracts/ContractDetailPanel'
import ContractFormModal from '../../components/contracts/ContractFormModal'
import ContractHistoryTimeline from '../../components/contracts/ContractHistoryTimeline'
import ExtendContractModal from '../../components/contracts/ExtendContractModal'
import TerminateContractModal from '../../components/contracts/TerminateContractModal'

import {
  getContractById,
  updateContract,
  extendContract,
  terminateContract,
  subscribeContracts,
} from '../../services/contractService'
import { getEmployees } from '../../services/employeeService'

export default function AdminContractDetailPage() {
  const { t } = useI18n()
  const { id } = useParams()
  const navigate = useNavigate()
  const toast = useToast()
  const [searchParams, setSearchParams] = useSearchParams()
  const initialTab = searchParams.get('tab') === 'history' ? 'history' : 'overview'
  const actionParam = searchParams.get('action')
  const [tick, setTick] = useState(0)
  const [activeTab, setActiveTab] = useState(initialTab)
  const [openForm, setOpenForm] = useState(false)
  const [openExtend, setOpenExtend] = useState(actionParam === 'extend')
  const [openTerminate, setOpenTerminate] = useState(actionParam === 'terminate')
  const [submitting, setSubmitting] = useState(false)
  const [serverErrors, setServerErrors] = useState({})

  useEffect(() => {
    setOpenExtend(actionParam === 'extend')
    setOpenTerminate(actionParam === 'terminate')
  }, [actionParam])

  useEffect(() => {
    const unsub = subscribeContracts(() => setTick((n) => n + 1))
    return () => unsub()
  }, [])

  // eslint-disable-next-line react-hooks/exhaustive-deps
  const contract = useMemo(() => getContractById(id), [id, tick])
  const employees = useMemo(() => getEmployees().filter((e) => e.status !== 'inactive'), [])

  if (!contract) {
    return (
      <>
        <PageHeader title={t('admin.contractNotFound')} icon={FileText} breadcrumb={t('admin.contractsBreadcrumb')} />
        <EmptyState
          title={t('admin.contractNotFound')}
          description={t('admin.contractNotFoundDesc')}
          actionLabel={t('admin.backToContractList')}
          onAction={() => navigate('/admin/contracts')}
        />
      </>
    )
  }

  const submitEdit = async (values) => {
    setSubmitting(true)
    const result = await updateContract(contract.id, values)
    setSubmitting(false)
    if (!result.ok) {
      setServerErrors(result.errors || {})
      toast.error(t('admin.cannotUpdate'), { description: result.errors?._form || t('admin.checkInvalidFields') })
      return
    }
    toast.success(t('admin.contractUpdated'), { description: result.contract.contractCode })
    setOpenForm(false)
    setServerErrors({})
  }

  const submitExtend = async (payload) => {
    setSubmitting(true)
    const result = await extendContract(contract.id, payload)
    setSubmitting(false)
    if (!result.ok) {
      toast.error(t('admin.cannotExtend'), { description: result.errors?._form || t('admin.contractExtendCheckFields') })
      return
    }
    toast.success(t('admin.contractExtended'), { description: result.contract.contractCode })
    setSearchParams({})
  }

  const submitTerminate = async (payload) => {
    setSubmitting(true)
    const result = await terminateContract(contract.id, payload)
    setSubmitting(false)
    if (!result.ok) {
      toast.error(t('admin.cannotTerminate'), { description: result.errors?._form || t('admin.contractTerminateCheckFields') })
      return
    }
    toast.success(t('admin.contractTerminated'), { description: result.contract.contractCode })
    setSearchParams({})
  }

  const canEdit = contract.status !== 'terminated' && contract.status !== 'cancelled' && contract.status !== 'expired'
  const canExtend = ['active', 'pending', 'expired'].includes(contract.status)
  const canTerminate = !['terminated', 'cancelled'].includes(contract.status)

  return (
    <>
      <PageHeader
        title={contract.contractCode}
        subtitle={`${contract.employeeName} · ${CONTRACT_TYPE_LABEL_VALUE(contract.contractType)}`}
        icon={FileText}
        breadcrumb={t('admin.contractDetailBreadcrumb', { code: contract.contractCode })}
        actions={
          <Button variant="secondary" icon={ArrowLeft} onClick={() => navigate('/admin/contracts')}>
            {t('admin.backToList')}
          </Button>
        }
      />

      <div className="mb-4 inline-flex rounded-md border border-neutral-200 bg-white p-1 shadow-card">
        <button
          type="button"
          onClick={() => setActiveTab('overview')}
          className={`inline-flex items-center gap-1.5 rounded px-3 py-1.5 text-sm font-medium transition ${
            activeTab === 'overview'
              ? 'bg-brand-600 text-white shadow-sm'
              : 'text-neutral-600 hover:bg-neutral-50'
          }`}
        >
          <BookOpen className="h-4 w-4" aria-hidden="true" />
          {t('admin.contractOverview')}
        </button>
        <button
          type="button"
          onClick={() => setActiveTab('history')}
          className={`inline-flex items-center gap-1.5 rounded px-3 py-1.5 text-sm font-medium transition ${
            activeTab === 'history'
              ? 'bg-brand-600 text-white shadow-sm'
              : 'text-neutral-600 hover:bg-neutral-50'
          }`}
        >
          <History className="h-4 w-4" aria-hidden="true" />
          {t('admin.contractHistory')}
        </button>
      </div>

      {activeTab === 'overview' ? (
        <div className="flex flex-col gap-4">
          <ContractDetailPanel contract={contract} mode="admin" />
          <div className="flex flex-wrap items-center justify-end gap-2">
            {canExtend && (
              <Button
                icon={CalendarPlus}
                onClick={() => setSearchParams({ action: 'extend' })}
              >
                {t('admin.extend')}
              </Button>
            )}
            {canEdit && (
              <Button
                variant="secondary"
                icon={Pencil}
                onClick={() => setOpenForm(true)}
              >
                {t('admin.edit')}
              </Button>
            )}
            {canTerminate && (
              <Button
                variant="danger"
                icon={Ban}
                onClick={() => setSearchParams({ action: 'terminate' })}
              >
                {t('admin.terminateContract')}
              </Button>
            )}
          </div>
        </div>
      ) : (
        <div className="rounded-lg border border-neutral-200 bg-white p-5 shadow-card">
          <h3 className="text-sm font-semibold text-neutral-900">{t('admin.contractHistory')}</h3>
          <div className="mt-3">
            <ContractHistoryTimeline history={contract.history || []} />
          </div>
        </div>
      )}

      <ContractFormModal
        open={openForm}
        onClose={() => {
          setOpenForm(false)
          setServerErrors({})
        }}
        mode="edit"
        initial={contract}
        employees={employees}
        onSubmit={submitEdit}
        submitting={submitting}
        serverErrors={serverErrors}
      />

      <ExtendContractModal
        key={openExtend ? `ext-${contract.id}` : 'closed-ext'}
        open={openExtend}
        onClose={() => setSearchParams({})}
        contract={contract}
        onSubmit={submitExtend}
        submitting={submitting}
      />

      <TerminateContractModal
        key={openTerminate ? `term-${contract.id}` : 'closed-term'}
        open={openTerminate}
        onClose={() => setSearchParams({})}
        contract={contract}
        onSubmit={submitTerminate}
        submitting={submitting}
      />
    </>
  )
}

function CONTRACT_TYPE_LABEL_VALUE(v) {
  const map = {
    probation: 'Hợp đồng thử việc',
    fixed_term: 'Hợp đồng xác định thời hạn',
    indefinite: 'Hợp đồng không xác định thời hạn',
    internship: 'Hợp đồng thực tập',
    other: 'Khác',
  }
  return map[v] || v
}
