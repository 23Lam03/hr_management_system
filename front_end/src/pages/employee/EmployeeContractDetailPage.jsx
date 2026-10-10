import { useEffect, useMemo } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { ArrowLeft, FileText, AlertCircle, History } from 'lucide-react'

import PageHeader from '../../components/common/PageHeader'
import Button from '../../components/common/Button'
import EmptyState from '../../components/common/EmptyState'
import { useI18n } from '../../i18n/useI18n'

import ContractDetailPanel from '../../components/contracts/ContractDetailPanel'
import ContractHistoryTimeline from '../../components/contracts/ContractHistoryTimeline'

import {
  getContractsByEmployee,
  subscribeContracts,
} from '../../services/contractService'
import { resolveEmployeeFromUser } from '../../services/authLinker'
import { useAuth } from '../../contexts/useAuth'

export default function EmployeeContractDetailPage() {
  const { id } = useParams()
  const navigate = useNavigate()
  const { user } = useAuth()
  const { t } = useI18n()
  const employee = useMemo(() => resolveEmployeeFromUser(user), [user])
  const employeeId = employee?.id ?? null

  useEffect(() => {
    const unsub = subscribeContracts(() => {})
    return () => unsub()
  }, [])

  // eslint-disable-next-line react-hooks/exhaustive-deps
  const all = useMemo(() => (employeeId ? getContractsByEmployee(employeeId) : []), [employeeId])
  const contract = all.find((c) => c.id === id) || null

  if (!employeeId || !employee) {
    return (
      <>
        <PageHeader title={t('employeeContracts.myContracts')} icon={FileText} breadcrumb="Cá nhân / Hợp đồng" />
        <EmptyState
          title={t('employeeContracts.notIdentified')}
          description={t('employeeContracts.accountNotLinked')}
        />
      </>
    )
  }

  if (!contract) {
    return (
      <>
        <PageHeader title={t('employeeContracts.myContracts')} icon={FileText} breadcrumb="Cá nhân / Hợp đồng" />
        <EmptyState
          title={t('employeeContractDetail.notFound')}
          description={t('employeeContractDetail.notFoundDesc')}
          actionLabel={t('employeeContractDetail.backToList')}
          onAction={() => navigate('/employee/contracts')}
        />
      </>
    )
  }

  return (
    <>
      <PageHeader
        title={contract.contractCode}
        subtitle={`${contract.employeeName} · Hợp đồng`}
        icon={FileText}
        breadcrumb={`Cá nhân / Hợp đồng / ${contract.contractCode}`}
        actions={
          <Button variant="secondary" icon={ArrowLeft} onClick={() => navigate('/employee/contracts')}>
            {t('employeeContractDetail.back')}
          </Button>
        }
      />

      {contract.status === 'expired' && (
        <div className="mb-4 flex items-start gap-3 rounded-md border border-danger-200 bg-danger-50 px-4 py-3 text-sm text-danger-700">
          <AlertCircle className="mt-0.5 h-4 w-4 flex-shrink-0" aria-hidden="true" />
          <p>
            {t('employeeContractDetail.contractExpired')}
          </p>
        </div>
      )}

      <ContractDetailPanel contract={contract} mode="employee" />

      <section className="mt-5 rounded-lg border border-neutral-200 bg-white p-5 shadow-card">
        <h3 className="inline-flex items-center gap-2 text-sm font-semibold text-neutral-900">
          <History className="h-4 w-4" aria-hidden="true" />
          {t('employeeContractDetail.contractHistory')}
        </h3>
        <div className="mt-3">
          <ContractHistoryTimeline history={contract.history || []} />
        </div>
      </section>
    </>
  )
}