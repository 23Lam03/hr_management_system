import { Calendar, Users, Tag } from 'lucide-react'

import BenefitStatusPill from './BenefitStatusPill'
import { useI18n } from '../../i18n/useI18n'

import { BENEFIT_TYPE_LABEL, VALUE_UNIT_LABEL } from '../../data/benefitMockData'
import { formatDateRange } from '../../utils/format'

const FORMAT_VALUE = (v) => {
  if (v === null || v === undefined || v === '') return '—'
  const n = Number(v)
  if (Number.isNaN(n)) return '—'
  if (Number.isInteger(n)) return n.toLocaleString('vi-VN')
  return n.toLocaleString('vi-VN', { maximumFractionDigits: 2 })
}

export default function BenefitDetailPanel({
  benefit,
  record = null,
  mode = 'admin',
}) {
  const { t } = useI18n()

  if (!benefit) return null

  return (
    <div className="flex flex-col gap-5">
      <header className="flex flex-col gap-3 rounded-lg border border-neutral-200 bg-white p-5 shadow-card sm:flex-row sm:items-start">
        <div className="flex-1 min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <h2 className="text-lg font-semibold text-neutral-900">{benefit.name}</h2>
            <BenefitStatusPill status={benefit.status} />
          </div>
          <p className="mt-1 font-mono text-[12px] text-neutral-500">{benefit.code}</p>
          <div className="mt-2 flex flex-wrap items-center gap-2 text-[13px] text-neutral-600">
            <span className="rounded bg-neutral-100 px-2 py-0.5 text-xs">
              {BENEFIT_TYPE_LABEL[benefit.type] || benefit.type}
            </span>
            {benefit.value !== null && benefit.value !== undefined && (
              <span className="rounded bg-brand-50 px-2 py-0.5 text-xs font-medium text-brand-700">
                {FORMAT_VALUE(benefit.value)} {VALUE_UNIT_LABEL[benefit.valueUnit] || ''}
              </span>
            )}
          </div>
        </div>
      </header>

      <section className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        <InfoCard icon={Calendar} label={t('benefitsComponent.benefitPeriod')} value={formatDateRange(benefit.startDate, benefit.endDate)} />
        <InfoCard icon={Users} label={t('benefitsComponent.activeAssignees')} value={`${benefit.activeAssigneesCount ?? 0} / ${benefit.totalAssignees ?? 0}`} />
        <InfoCard icon={Tag} label={t('benefitsComponent.benefitType')} value={BENEFIT_TYPE_LABEL[benefit.type] || benefit.type} />
      </section>

      {record && mode === 'employee' && (
        <section className="rounded-lg border border-brand-200 bg-brand-50 p-5">
          <h3 className="text-sm font-semibold text-brand-700">{t('benefitsComponent.yourBenefit')}</h3>
          <dl className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-3 text-sm">
            <div>
              <dt className="text-[12px] uppercase tracking-wider text-brand-600">{t('benefitsComponent.startDate')}</dt>
              <dd className="font-medium text-neutral-900">{record.startDate}</dd>
            </div>
            <div>
              <dt className="text-[12px] uppercase tracking-wider text-brand-600">{t('benefitsComponent.endDate')}</dt>
              <dd className="font-medium text-neutral-900">{record.endDate || '—'}</dd>
            </div>
            <div>
              <dt className="text-[12px] uppercase tracking-wider text-brand-600">{t('benefitsComponent.currentStatus')}</dt>
              <dd className="font-medium text-neutral-900">{record.status}</dd>
            </div>
          </dl>
          {record.note && (
            <p className="mt-3 rounded-md border border-brand-200 bg-white px-3 py-2 text-[13px] text-neutral-700">
              {record.note}
            </p>
          )}
        </section>
      )}

      <section className="rounded-lg border border-neutral-200 bg-white p-5 shadow-card">
        <h3 className="text-sm font-semibold text-neutral-900">{t('benefitsComponent.benefitDescription')}</h3>
        <p className="mt-2 whitespace-pre-wrap text-sm leading-relaxed text-neutral-700">
          {benefit.description || '—'}
        </p>
        {benefit.eligibility && (
          <>
            <h3 className="mt-4 text-sm font-semibold text-neutral-900">{t('benefitsComponent.eligibility')}</h3>
            <p className="mt-2 whitespace-pre-wrap text-sm leading-relaxed text-neutral-700">
              {benefit.eligibility}
            </p>
          </>
        )}
      </section>

      {mode === 'admin' && benefit.departmentIds?.length > 0 && (
        <section className="rounded-md border border-info-200 bg-info-50 px-4 py-3 text-sm text-info-700">
          {t('benefitsComponent.departmentLimited', { n: benefit.departmentIds.length })}
        </section>
      )}
    </div>
  )
}

function InfoCard({ icon: Icon, label, value }) {
  return (
    <div className="flex items-start gap-3 rounded-md border border-neutral-200 bg-white p-3 shadow-card">
      <span className="inline-flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-md bg-brand-50 text-brand-600">
        <Icon className="h-4 w-4" aria-hidden="true" />
      </span>
      <div className="min-w-0">
        <p className="text-[12px] font-medium uppercase tracking-wider text-neutral-500">{label}</p>
        <p className="mt-1 text-sm font-semibold text-neutral-900 break-words">{value}</p>
      </div>
    </div>
  )
}
