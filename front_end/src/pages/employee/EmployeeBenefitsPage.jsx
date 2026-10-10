import { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Gift, Eye, Heart, Wallet, AlertTriangle, Sparkles } from 'lucide-react'

import PageHeader from '../../components/common/PageHeader'
import Button from '../../components/common/Button'
import EmptyState from '../../components/common/EmptyState'
import { useI18n } from '../../i18n/useI18n'

import EmployeeBenefitPill from '../../components/benefits/EmployeeBenefitPill'
import BenefitStatusPill from '../../components/benefits/BenefitStatusPill'

import {
  getMyBenefits,
  getMyBenefitsSummary,
  subscribeBenefits,
} from '../../services/benefitService'
import { resolveEmployeeFromUser } from '../../services/authLinker'
import { useAuth } from '../../contexts/useAuth'
import { formatDate, formatNumber } from '../../utils/format'
import {
  BENEFIT_TYPE_LABEL,
  VALUE_UNIT_LABEL,
} from '../../data/benefitMockData'

const FILTERS = (t) => [
  { value: 'all',       label: t('employeeBenefits.all') },
  { value: 'insurance', label: t('employeeBenefits.insuranceFilter') },
  { value: 'allowance', label: t('employeeBenefits.allowanceFilter') },
  { value: 'other',     label: t('employeeBenefits.otherBenefits') },
  { value: 'active',    label: t('employeeBenefits.active') },
  { value: 'expired',   label: t('employeeBenefits.expired') },
]

const FORMAT_VALUE = (v) => {
  if (v === null || v === undefined || v === '') return '—'
  const n = Number(v)
  if (Number.isNaN(n)) return '—'
  if (Number.isInteger(n)) return n.toLocaleString('vi-VN')
  return n.toLocaleString('vi-VN', { maximumFractionDigits: 2 })
}

export default function EmployeeBenefitsPage() {
  const navigate = useNavigate()
  const { user } = useAuth()
  const { t } = useI18n()
  const employee = useMemo(() => resolveEmployeeFromUser(user), [user])
  const employeeId = employee?.id ?? null
  const [tick, setTick] = useState(0)
  const [filter, setFilter] = useState('all')

  useEffect(() => {
    const unsub = subscribeBenefits(() => setTick((n) => n + 1))
    return () => unsub()
  }, [])

  // eslint-disable-next-line react-hooks/exhaustive-deps
  const records = useMemo(
    () => (employeeId ? getMyBenefits(employeeId) : []),
    [employeeId, tick],
  )
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const summary = useMemo(
    () => (employeeId ? getMyBenefitsSummary(employeeId) : null),
    [employeeId, tick],
  )

  if (!employeeId || !employee) {
    return (
      <>
        <PageHeader title={t('employeeBenefits.myBenefits')} icon={Gift} breadcrumb="Cá nhân / Phúc lợi" />
        <EmptyState
          title={t('employeeBenefits.notIdentified')}
          description={t('employeeBenefits.accountNotLinked')}
        />
      </>
    )
  }

  let visible = records
  if (filter === 'insurance') visible = records.filter((r) => r.benefit?.type === 'insurance')
  else if (filter === 'allowance') visible = records.filter((r) => r.benefit?.type === 'allowance')
  else if (filter === 'other') visible = records.filter(
    (r) => !['insurance', 'allowance'].includes(r.benefit?.type),
  )
  else if (filter === 'active') visible = records.filter((r) => r.status === 'active')
  else if (filter === 'expired') visible = records.filter((r) => r.status === 'expired')

  return (
    <>
      <PageHeader
        title={t('employeeBenefits.myBenefits')}
        subtitle={t('employeeBenefits.myBenefitsDesc')}
        icon={Gift}
        breadcrumb="Cá nhân / Phúc lợi"
      />

      <div className="mb-6 grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard icon={Sparkles} label={t('employeeBenefits.totalBenefits')} value={formatNumber(summary.total)} tone="primary" />
        <StatCard icon={Heart} label={t('employeeBenefits.insurance')} value={formatNumber(summary.insurance)} tone="info" />
        <StatCard icon={Wallet} label={t('employeeBenefits.allowance')} value={formatNumber(summary.allowance)} tone="warning" />
        <StatCard icon={AlertTriangle} label={t('employeeBenefits.expiringSoon')} value={formatNumber(summary.expiringSoon)} tone="danger" />
      </div>

      <div className="mb-4 inline-flex rounded-md border border-neutral-200 bg-white p-1 shadow-card">
        {FILTERS(t).map((f) => (
          <button
            key={f.value}
            type="button"
            onClick={() => setFilter(f.value)}
            className={`rounded px-3 py-1.5 text-sm font-medium transition ${
              filter === f.value
                ? 'bg-brand-600 text-white shadow-sm'
                : 'text-neutral-600 hover:bg-neutral-50'
            }`}
          >
            {f.label}
          </button>
        ))}
      </div>

      {visible.length === 0 ? (
        <EmptyState
          title={
            filter === 'all'
              ? t('employeeBenefits.noBenefits')
              : t('employeeBenefits.noMatchingBenefits')
          }
          description={
            filter === 'all'
              ? t('employeeBenefits.contactHR')
              : t('employeeBenefits.tryOtherFilter')
          }
        />
      ) : (
        <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-3">
          {visible.map((r) => (
            <article key={r.id} className="flex flex-col gap-3 rounded-lg border border-neutral-200 bg-white p-5 shadow-card">
              <div className="flex flex-wrap items-center gap-2">
                <h4 className="text-base font-semibold text-neutral-900">{r.benefit?.name}</h4>
                <BenefitStatusPill status={r.benefit?.status} />
                <EmployeeBenefitPill status={r.status} />
              </div>
              <p className="line-clamp-2 text-[13px] text-neutral-500">{r.benefit?.description}</p>
              {r.benefit?.value !== null && r.benefit?.value !== undefined && (
                <div className="flex items-center gap-2 rounded-md bg-brand-50 px-3 py-2 text-sm text-brand-700">
                  <span className="font-medium">{FORMAT_VALUE(r.benefit?.value)}</span>
                  <span className="text-[12px]">{VALUE_UNIT_LABEL[r.benefit?.valueUnit] || ''}</span>
                </div>
              )}
              <dl className="grid grid-cols-2 gap-2 text-[12px] text-neutral-600">
                <div>
                  <dt className="text-neutral-400">{t('employeeBenefits.type')}</dt>
                  <dd className="font-medium text-neutral-900">{BENEFIT_TYPE_LABEL[r.benefit?.type] || r.benefit?.type}</dd>
                </div>
                <div>
                  <dt className="text-neutral-400">{t('employeeBenefits.startDate')}</dt>
                  <dd className="font-medium text-neutral-900">{formatDate(r.startDate)}</dd>
                </div>
                <div className="col-span-2">
                  <dt className="text-neutral-400">{t('employeeBenefits.endDate')}</dt>
                  <dd className="font-medium text-neutral-900">{r.endDate ? formatDate(r.endDate) : '—'}</dd>
                </div>
              </dl>
              <div className="flex items-center justify-end border-t border-neutral-200 pt-3">
                <Button
                  size="sm"
                  variant="secondary"
                  icon={Eye}
                  onClick={() => navigate(`/employee/benefits/${r.benefit?.id}`)}
                >
                  {t('employeeBenefits.viewDetail')}
                </Button>
              </div>
            </article>
          ))}
        </div>
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
    danger: 'bg-danger-50 text-danger-600',
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