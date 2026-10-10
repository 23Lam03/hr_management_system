import { useEffect, useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import { FileText, BookOpen, CheckCircle2, AlertTriangle, Clock } from 'lucide-react'

import PageHeader from '../../components/common/PageHeader'
import Button from '../../components/common/Button'
import EmptyState from '../../components/common/EmptyState'
import { useI18n } from '../../i18n/useI18n'

import ContractStatusPill from '../../components/contracts/ContractStatusPill'
import { ContractHistoryTable } from '../../components/contracts/ContractHistoryTimeline'

import {
  getContractsByEmployee,
  getActiveContract,
  subscribeContracts,
} from '../../services/contractService'
import { resolveEmployeeFromUser } from '../../services/authLinker'
import { useAuth } from '../../contexts/useAuth'
import { formatNumber, formatDate } from '../../utils/format'
import { CONTRACT_TYPE_LABEL } from '../../data/contractMockData'
import { daysUntil, isExpiringSoon } from '../../utils/contractUtils'

export default function EmployeeContractsPage() {
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
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const active = useMemo(() => (employeeId ? getActiveContract(employeeId) : null), [employeeId])

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

  const total = all.length
  const activeCount = all.filter((c) => c.status === 'active').length
  const expiredCount = all.filter((c) => c.status === 'expired').length
  const terminatedCount = all.filter((c) => c.status === 'terminated').length
  const expiringSoon = active && isExpiringSoon(active)
  const days = active?.expiryDate ? daysUntil(active.expiryDate) : null

  return (
    <>
      <PageHeader
        title={t('employeeContracts.myContracts')}
        subtitle={t('employeeContracts.myContractsDesc')}
        icon={FileText}
        breadcrumb="Cá nhân / Hợp đồng"
      />

      {active && expiringSoon && (
        <div className="mb-4 flex items-start gap-3 rounded-md border border-warning-200 bg-warning-50 px-4 py-3 text-sm text-warning-700">
          <AlertTriangle className="mt-0.5 h-4 w-4 flex-shrink-0" aria-hidden="true" />
          <div>
            <p className="font-semibold">{t('employeeContracts.contractExpiringSoon')}</p>
            <p>
              {t('employeeContracts.expiryDate', { n: formatDate(active.expiryDate), m: days })}
            </p>
            <p className="mt-1 text-[12px] text-warning-600">
              {t('employeeContracts.expiryDisclaimer')}
            </p>
          </div>
        </div>
      )}

      <div className="mb-6 grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard icon={FileText} label={t('employeeContracts.totalContracts')} value={formatNumber(total)} tone="primary" />
        <StatCard icon={CheckCircle2} label={t('employeeContracts.active')} value={formatNumber(activeCount)} tone="success" />
        <StatCard icon={Clock} label={t('employeeContracts.expired')} value={formatNumber(expiredCount)} tone="neutral" />
        <StatCard icon={BookOpen} label={t('employeeContracts.terminated')} value={formatNumber(terminatedCount)} tone="warning" />
      </div>

      {/* Current contract */}
      {active ? (
        <article className="mb-6 flex flex-col gap-3 rounded-lg border-2 border-brand-200 bg-brand-50 p-5 shadow-card">
          <div className="flex flex-wrap items-center gap-2">
            <h3 className="text-base font-semibold text-brand-900">{t('employeeContracts.currentContract')}</h3>
            <ContractStatusPill status={active.status} />
          </div>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
            <Detail label={t('employeeContracts.contractCode')} value={active.contractCode} mono />
            <Detail label={t('employeeContracts.type')} value={CONTRACT_TYPE_LABEL[active.contractType] || active.contractType} />
            <Detail label={t('employeeContracts.signedDate')} value={active.signedDate} />
            <Detail label={t('employeeContracts.effectiveDate')} value={active.effectiveDate} />
            <Detail label={t('employeeContracts.expiryDateLabel')} value={active.expiryDate || t('employeeContracts.indefinite')} highlight={expiringSoon} />
            <Detail label={t('employeeContracts.owner')} value={active.owner || '—'} />
          </div>
          {active.note && (
            <div className="rounded-md border border-brand-200 bg-white px-3 py-2 text-[13px] text-neutral-700">
              {active.note}
            </div>
          )}
          <div className="flex items-center justify-end">
            <Button size="sm" onClick={() => navigate(`/employee/contracts/${active.id}`)}>
              {t('employeeContracts.viewDetail')}
            </Button>
          </div>
        </article>
      ) : (
        <EmptyState
          title={t('employeeContracts.noActiveContract')}
          description={t('employeeContracts.contactHR')}
        />
      )}

      {/* History */}
      {all.length > 0 && (
        <section className="mb-6">
          <h3 className="mb-3 text-sm font-semibold uppercase tracking-wider text-neutral-500">
            {t('employeeContracts.contractHistory')}
          </h3>
          <ContractHistoryTable rows={all} />
        </section>
      )}
    </>
  )
}

function StatCard({ icon: Icon, label, value, tone = 'primary' }) {
  const toneClass = {
    primary: 'bg-brand-50 text-brand-700',
    warning: 'bg-warning-50 text-warning-600',
    success: 'bg-success-50 text-success-600',
    info: 'bg-info-50 text-info-600',
    neutral: 'bg-neutral-100 text-neutral-600',
  }[tone]
  return (
    <div className="flex flex-col gap-2 rounded-lg border border-neutral-200 bg-white p-5 shadow-card">
      <div className="flex items-center justify-between">
        <p className="text-[13px] font-medium text-neutral-500">{label}</p>
        <span className={`inline-flex h-9 w-9 items-center justify-center rounded-md ${toneClass}`}>
          <Icon className="h-[18px] w-[18px]" aria-hidden="true" />
        </span>
      </div>
      <p className="text-2xl font-bold text-neutral-900">{value}</p>
    </div>
  )
}

function Detail({ label, value, mono = false, highlight = false }) {
  return (
    <div className={`rounded-md border p-3 shadow-card ${highlight ? 'border-warning-200 bg-warning-50' : 'border-neutral-200 bg-white'}`}>
      <p className="text-[12px] font-medium uppercase tracking-wider text-neutral-500">{label}</p>
      <p className={`mt-1 text-sm font-semibold break-words ${mono ? 'font-mono' : ''} ${highlight ? 'text-warning-700' : 'text-neutral-900'}`}>
        {value}
      </p>
    </div>
  )
}