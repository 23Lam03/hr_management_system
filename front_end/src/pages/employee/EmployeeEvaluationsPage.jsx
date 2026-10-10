import { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Star, Eye } from 'lucide-react'

import PageHeader from '../../components/common/PageHeader'
import Button from '../../components/common/Button'
import EmptyState from '../../components/common/EmptyState'
import { useI18n } from '../../i18n/useI18n'

import EvaluationStatusPill from '../../components/evaluations/EvaluationStatusPill'
import CycleStatusPill from '../../components/evaluations/CycleStatusPill'

import {
  getMyEvaluations,
  getMyEvaluationSummary,
  subscribeEvaluations,
} from '../../services/evaluationService'
import { getEvaluationCycleById } from '../../services/evaluationService'
import { resolveEmployeeFromUser } from '../../services/authLinker'
import { useAuth } from '../../contexts/useAuth'
import { formatDateRange, formatNumber } from '../../utils/format'

export default function EmployeeEvaluationsPage() {
  const { user: currentUser } = useAuth()
  const navigate = useNavigate()
  const { t } = useI18n()
  const employee = useMemo(
    () => resolveEmployeeFromUser(currentUser),
    [currentUser],
  )
  const employeeId = employee?.id ?? null
  const [tick, setTick] = useState(0)

  useEffect(() => {
    const unsub = subscribeEvaluations(() => setTick((n) => n + 1))
    return () => unsub()
  }, [])

  // eslint-disable-next-line react-hooks/exhaustive-deps
  const evaluations = useMemo(
    () => (employeeId ? getMyEvaluations(employeeId, { includeUnpublished: false }) : []),
    [employeeId, tick],
  )
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const summary = useMemo(
    () => (employeeId ? getMyEvaluationSummary(employeeId) : { total: 0, publishedCount: 0, averageScore: 0 }),
    [employeeId, tick],
  )

  if (!employeeId || !employee) {
    return (
      <>
        <PageHeader
          title={t('employeeEvaluations.myEvaluations')}
          icon={Star}
          breadcrumb="Cá nhân / Đánh giá"
        />
        <EmptyState
          title={t('employeeEvaluations.notIdentified')}
          description={t('employeeEvaluations.accountNotLinked')}
        />
      </>
    )
  }

  return (
    <>
      <PageHeader
        title={t('employeeEvaluations.myEvaluations')}
        subtitle={t('employeeEvaluations.myEvaluationsDesc')}
        icon={Star}
        breadcrumb="Cá nhân / Đánh giá"
      />

      <div className="mb-6 grid grid-cols-1 gap-4 sm:grid-cols-3">
        <StatCard
          label={t('employeeEvaluations.periodsJoined')}
          value={formatNumber(summary.total)}
          hint={t('employeeEvaluations.periodsJoinedHint')}
        />
        <StatCard
          label={t('employeeEvaluations.publishedReviews')}
          value={formatNumber(summary.publishedCount)}
          hint={t('employeeEvaluations.publishedReviewsHint')}
        />
        <StatCard
          label={t('employeeEvaluations.averageScore')}
          value={summary.averageScore ? `${summary.averageScore}/5` : '—'}
          hint={t('employeeEvaluations.averageScoreHint')}
        />
      </div>

      <div className="rounded-lg border border-neutral-200 bg-white shadow-card">
        {evaluations.length === 0 ? (
          <EmptyState
            title={t('employeeEvaluations.noPublishedResults')}
            description={t('employeeEvaluations.managerPublishes')}
          />
        ) : (
          <ul className="divide-y divide-neutral-100">
            {evaluations.map((e) => {
              const cycle = getEvaluationCycleById(e.cycleId)
              return (
                <li key={e.id} className="flex flex-col gap-3 p-4 sm:flex-row sm:items-center sm:justify-between">
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <h3 className="text-sm font-semibold text-neutral-900">{cycle?.name || t('employeeEvaluations.evaluationCycle')}</h3>
                      <EvaluationStatusPill status={e.status} />
                      {cycle && <CycleStatusPill status={cycle.status} />}
                    </div>
                    <p className="mt-1 text-[12px] text-neutral-500">
                      {formatDateRange(cycle?.startDate, cycle?.endDate)} · {t('employeeEvaluations.reviewer')}: {e.reviewerName || '—'}
                    </p>
                  </div>
                  <div className="flex items-center gap-3">
                    <div className="text-right">
                      <p className="text-[11px] uppercase tracking-wider text-neutral-500">{t('employeeEvaluations.compositeScore')}</p>
                      <p className="text-base font-bold text-neutral-900">
                        {e.averageScore > 0 ? `${e.averageScore}/5` : '—'}
                      </p>
                    </div>
                    <Button
                      variant="secondary"
                      size="sm"
                      icon={Eye}
                      onClick={() => navigate(`/employee/evaluations/${e.id}`)}
                    >
                      {t('employeeEvaluations.viewDetail')}
                    </Button>
                  </div>
                </li>
              )
            })}
          </ul>
        )}
      </div>
    </>
  )
}

function StatCard({ label, value, hint }) {
  return (
    <div className="flex flex-col gap-2 rounded-lg border border-neutral-200 bg-white p-5 shadow-card">
      <p className="text-[13px] font-medium text-neutral-500">{label}</p>
      <p className="text-2xl font-bold text-neutral-900">{value}</p>
      <p className="text-xs text-neutral-500">{hint}</p>
    </div>
  )
}