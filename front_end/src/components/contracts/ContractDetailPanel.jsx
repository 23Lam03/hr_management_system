import { Calendar, Briefcase, FileText, Hash, AlertTriangle } from 'lucide-react'

import Avatar from '../common/Avatar'
import ContractStatusPill from './ContractStatusPill'

import { CONTRACT_TYPE_LABEL } from '../../data/contractMockData'
import { daysUntil, isExpiringSoon } from '../../utils/contractUtils'
import { formatDate } from '../../utils/format'
import { useI18n } from '../../i18n/useI18n'

/**
 * ContractDetailPanel - panel thông tin hợp đồng (admin + employee).
 */
export default function ContractDetailPanel({ contract, mode = 'admin' }) {
  const { t } = useI18n()

  if (!contract) return null
  const days = contract.expiryDate ? daysUntil(contract.expiryDate) : null
  const expiringSoon = isExpiringSoon(contract)
  const alreadyExpired = contract.status === 'expired' || contract.status === 'terminated' || contract.status === 'cancelled'

  return (
    <div className="flex flex-col gap-5">
      <header className="flex flex-col gap-3 rounded-lg border border-neutral-200 bg-white p-5 shadow-card sm:flex-row sm:items-start">
        <div className="flex-1 min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <h2 className="text-lg font-semibold text-neutral-900">{CONTRACT_TYPE_LABEL[contract.contractType] || contract.contractType}</h2>
            <ContractStatusPill status={contract.status} />
          </div>
          <p className="mt-1 font-mono text-[12px] text-neutral-500">{contract.contractCode}</p>
          <div className="mt-2 flex flex-wrap items-center gap-2 text-[13px] text-neutral-600">
            <span className="rounded bg-neutral-100 px-2 py-0.5 text-xs">
              {contract.employeeName}
            </span>
            <span className="rounded bg-neutral-100 px-2 py-0.5 text-xs">
              {contract.departmentName}
            </span>
          </div>
        </div>
      </header>

      {expiringSoon && !alreadyExpired && (
        <div className="flex items-start gap-3 rounded-md border border-warning-200 bg-warning-50 px-4 py-3 text-sm text-warning-700">
          <AlertTriangle className="mt-0.5 h-4 w-4 flex-shrink-0" aria-hidden="true" />
          <div>
            <p className="font-semibold">{t('contracts.contractExpiringSoon')}</p>
            <p className="mt-1">
              {t('contracts.expiryDateDetail')}: <b>{formatDate(contract.expiryDate)}</b>. {t('contracts.daysRemaining', { n: days })}
            </p>
            <p className="mt-1 text-[12px] text-warning-600">
              {t('contracts.expiryThresholdNote')}
            </p>
          </div>
        </div>
      )}

      {contract.status === 'expired' && (
        <div className="flex items-start gap-3 rounded-md border border-danger-200 bg-danger-50 px-4 py-3 text-sm text-danger-700">
          <AlertTriangle className="mt-0.5 h-4 w-4 flex-shrink-0" aria-hidden="true" />
          <div>
            <p className="font-semibold">{t('contracts.contractExpired')}</p>
            <p className="mt-1 text-[12px] text-danger-600">
              {t('contracts.contactHRNote')}
            </p>
          </div>
        </div>
      )}

      <section className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
        <InfoCard icon={Hash} label={t('contracts.contractCode')} value={contract.contractCode} mono />
        <InfoCard icon={Calendar} label={t('contracts.signedDate')} value={contract.signedDate} />
        <InfoCard icon={Calendar} label={t('contracts.effectiveDate')} value={contract.effectiveDate} />
        <InfoCard
          icon={Calendar}
          label={t('contracts.expiryDate')}
          value={contract.expiryDate || t('contracts.noExpiryIndefinite')}
          highlight={expiringSoon ? 'warning' : null}
        />
        <InfoCard icon={Briefcase} label={t('contracts.contractTypeLabel')} value={CONTRACT_TYPE_LABEL[contract.contractType] || contract.contractType} />
        <InfoCard icon={FileText} label={t('contracts.ownerLabel')} value={contract.owner || '—'} />
      </section>

      {mode === 'admin' && (
        <section className="rounded-lg border border-neutral-200 bg-white p-5 shadow-card">
          <h3 className="text-sm font-semibold text-neutral-900">{t('contracts.employeeInfoSection')}</h3>
          <div className="mt-3 flex items-center gap-3">
            <Avatar name={contract.employeeName} size="md" />
            <div>
              <p className="font-medium text-neutral-900">{contract.employeeName}</p>
              <p className="text-[12px] text-neutral-500">
                {contract.employeeCode} · {contract.departmentName} · {contract.position}
              </p>
              {contract.email && (
                <p className="text-[12px] text-neutral-500">{contract.email}</p>
              )}
            </div>
          </div>
        </section>
      )}

      <section className="rounded-lg border border-neutral-200 bg-white p-5 shadow-card">
        <h3 className="text-sm font-semibold text-neutral-900">{t('contracts.notes')}</h3>
        <p className="mt-2 whitespace-pre-wrap text-sm leading-relaxed text-neutral-700">
          {contract.note || '—'}
        </p>
      </section>
    </div>
  )
}

function InfoCard({ icon: Icon, label, value, mono = false, highlight = null }) {
  const toneBg = {
    warning: 'border-warning-200 bg-warning-50',
  }[highlight] || 'border-neutral-200 bg-white'
  const toneText = {
    warning: 'text-warning-700',
  }[highlight] || 'text-neutral-900'
  return (
    <div className={`flex items-start gap-3 rounded-md border p-3 shadow-card ${toneBg}`}>
      <span className="inline-flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-md bg-brand-50 text-brand-600">
        <Icon className="h-4 w-4" aria-hidden="true" />
      </span>
      <div className="min-w-0">
        <p className="text-[12px] font-medium uppercase tracking-wider text-neutral-500">{label}</p>
        <p className={`mt-1 text-sm font-semibold break-words ${mono ? 'font-mono' : ''} ${toneText}`}>
          {value}
        </p>
      </div>
    </div>
  )
}
