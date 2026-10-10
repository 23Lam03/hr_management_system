import { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { GraduationCap, Eye, BookOpen, CheckCircle2, Play, Clock, AlertCircle } from 'lucide-react'

import PageHeader from '../../components/common/PageHeader'
import Button from '../../components/common/Button'
import EmptyState from '../../components/common/EmptyState'
import { useI18n } from '../../i18n/useI18n'

import TrainingStatusPill from '../../components/trainings/TrainingStatusPill'
import ParticipantStatusPill from '../../components/trainings/ParticipantStatusPill'

import {
  getAvailableTrainingsForEmployee,
  getMyTrainings,
  getMyTrainingsSummary,
  subscribeTrainings,
} from '../../services/trainingService'
import { resolveEmployeeFromUser } from '../../services/authLinker'
import { useAuth } from '../../contexts/useAuth'
import { formatDateRange, formatNumber } from '../../utils/format'
import { TRAINING_CATEGORY_LABEL, TRAINING_FORMAT_LABEL } from '../../data/trainingMockData'

const FILTERS = (t) => [
  { value: 'all',         label: t('employeeTrainings.all') },
  { value: 'available',   label: t('employeeTrainings.available') },
  { value: 'registered',  label: t('employeeTrainings.registered') },
  { value: 'in_progress', label: t('employeeTrainings.inProgressFilter') },
  { value: 'completed',   label: t('employeeTrainings.completedFilter') },
]

export default function EmployeeTrainingsPage() {
  const navigate = useNavigate()
  const { user } = useAuth()
  const { t } = useI18n()
  const employee = useMemo(() => resolveEmployeeFromUser(user), [user])
  const employeeId = employee?.id ?? null
  const [tick, setTick] = useState(0)
  const [filter, setFilter] = useState('all')

  useEffect(() => {
    const unsub = subscribeTrainings(() => setTick((n) => n + 1))
    return () => unsub()
  }, [])

  // eslint-disable-next-line react-hooks/exhaustive-deps
  const available = useMemo(
    () => (employeeId ? getAvailableTrainingsForEmployee(employeeId) : []),
    [employeeId, tick],
  )
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const myRegistrations = useMemo(
    () => (employeeId ? getMyTrainings(employeeId) : []),
    [employeeId, tick],
  )
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const summary = useMemo(
    () => (employeeId ? getMyTrainingsSummary(employeeId) : null),
    [employeeId, tick],
  )

  if (!employeeId || !employee) {
    return (
      <>
        <PageHeader title={t('employeeTrainings.myTrainings')} icon={GraduationCap} breadcrumb="Cá nhân / Đào tạo" />
        <EmptyState
          title={t('employeeTrainings.notIdentified')}
          description={t('employeeTrainings.accountNotLinked')}
        />
      </>
    )
  }

  // Lọc theo filter
  let visibleRegistrations = myRegistrations
  if (filter === 'registered') {
    visibleRegistrations = myRegistrations.filter((r) =>
      r.registrationStatus === 'registered' || r.registrationStatus === 'confirmed' || r.registrationStatus === 'waitlisted',
    )
  } else if (filter === 'in_progress') {
    visibleRegistrations = myRegistrations.filter((r) => r.learningStatus === 'in_progress')
  } else if (filter === 'completed') {
    visibleRegistrations = myRegistrations.filter((r) =>
      r.learningStatus === 'completed' || r.learningStatus === 'failed',
    )
  }

  return (
    <>
      <PageHeader
        title={t('employeeTrainings.myTrainings')}
        subtitle={t('employeeTrainings.myTrainingsDesc')}
        icon={GraduationCap}
        breadcrumb="Cá nhân / Đào tạo"
      />

      <div className="mb-6 grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard icon={BookOpen} label={t('employeeTrainings.totalRegistered')} value={formatNumber(summary.total)} tone="primary" />
        <StatCard icon={Clock} label={t('employeeTrainings.pendingConfirm')} value={formatNumber(summary.pending)} tone="warning" />
        <StatCard icon={Play} label={t('employeeTrainings.inProgress')} value={formatNumber(summary.inProgress)} tone="info" />
        <StatCard icon={CheckCircle2} label={t('employeeTrainings.completed')} value={formatNumber(summary.completed)} tone="success" />
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

      {filter === 'available' || filter === 'all' ? (
        <section className="mb-6">
          <h3 className="mb-3 text-sm font-semibold uppercase tracking-wider text-neutral-500">
            {t('employeeTrainings.coursesAvailable')}
          </h3>
          {available.length === 0 ? (
            <EmptyState
              title={t('employeeTrainings.noCoursesOpen')}
              description={t('employeeTrainings.comeBackLater')}
            />
          ) : (
            <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-3">
              {available.map((c) => {
                const slotsLeft = Math.max(0, (c.capacity || 0) - (c.registeredCount || 0))
                const full = slotsLeft === 0
                return (
                  <article key={c.id} className="flex flex-col gap-3 rounded-lg border border-neutral-200 bg-white p-5 shadow-card">
                    <div className="flex flex-wrap items-center gap-2">
                      <h4 className="text-base font-semibold text-neutral-900">{c.name}</h4>
                      <TrainingStatusPill status={c.status} />
                    </div>
                    <p className="line-clamp-2 text-[13px] text-neutral-500">{c.description}</p>
                    <dl className="grid grid-cols-2 gap-2 text-[12px] text-neutral-600">
                      <div>
                        <dt className="text-neutral-400">{t('employeeTrainings.category')}</dt>
                        <dd className="font-medium text-neutral-900">{TRAINING_CATEGORY_LABEL[c.category] || c.category}</dd>
                      </div>
                      <div>
                        <dt className="text-neutral-400">{t('employeeTrainings.format')}</dt>
                        <dd className="font-medium text-neutral-900">{TRAINING_FORMAT_LABEL[c.format] || c.format}</dd>
                      </div>
                      <div>
                        <dt className="text-neutral-400">{t('employeeTrainings.instructor')}</dt>
                        <dd className="font-medium text-neutral-900">{c.instructor}</dd>
                      </div>
                      <div>
                        <dt className="text-neutral-400">{t('employeeTrainings.duration')}</dt>
                        <dd className="font-medium text-neutral-900">{t('employeeTrainings.durationHours', { n: c.durationHours })}</dd>
                      </div>
                      <div className="col-span-2">
                        <dt className="text-neutral-400">{t('employeeTrainings.time')}</dt>
                        <dd className="font-medium text-neutral-900">{formatDateRange(c.startDate, c.endDate)}</dd>
                      </div>
                    </dl>
                    <div className="flex items-center justify-between border-t border-neutral-200 pt-3">
                      <span className={`text-[12px] ${full ? 'text-danger-600' : 'text-success-600'}`}>
                        {full ? t('employeeTrainings.slotsFull') : t('employeeTrainings.slotsLeft', { n: slotsLeft })}
                      </span>
                      <Button
                        size="sm"
                        onClick={() => navigate(`/employee/trainings/${c.id}`)}
                      >
                        {t('employeeTrainings.viewDetail')}
                      </Button>
                    </div>
                  </article>
                )
              })}
            </div>
          )}
        </section>
      ) : null}

      {(filter !== 'available') && (
        <section className="mb-6">
          <h3 className="mb-3 text-sm font-semibold uppercase tracking-wider text-neutral-500">
            {t('employeeTrainings.myRegistrations')}
          </h3>
          {visibleRegistrations.length === 0 ? (
            <EmptyState
              title={
                filter === 'all'
                  ? t('employeeTrainings.noRegistrations')
                  : t('employeeTrainings.noMatchingCourses')
              }
              description={
                filter === 'all'
                  ? t('employeeTrainings.switchToAvailable')
                  : t('employeeTrainings.tryOtherFilter')
              }
            />
          ) : (
            <div className="flex flex-col gap-3">
              {visibleRegistrations.map((r) => (
                <article key={r.id} className="flex flex-col gap-3 rounded-lg border border-neutral-200 bg-white p-5 shadow-card sm:flex-row sm:items-center">
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <h4 className="text-base font-semibold text-neutral-900">{r.course?.name}</h4>
                      <ParticipantStatusPill status={r.registrationStatus} />
                    </div>
                    <p className="mt-1 text-[12px] text-neutral-500">
                      {formatDateRange(r.course?.startDate, r.course?.endDate)} · {t('employeeTrainings.instructor')}: {r.course?.instructor}
                    </p>
                    {r.progress > 0 && (
                      <div className="mt-2 max-w-sm">
                        <div className="h-1.5 w-full overflow-hidden rounded-full bg-neutral-100">
                          <div className="h-full bg-brand-500" style={{ width: `${r.progress}%` }} />
                        </div>
                        <p className="mt-1 text-[11px] text-neutral-500">{r.progress}% {t('employeeTrainings.progress')}</p>
                      </div>
                    )}
                  </div>
                  <Button
                    variant="secondary"
                    size="sm"
                    icon={Eye}
                    onClick={() => navigate(`/employee/trainings/${r.trainingId}`)}
                  >
                    {t('employeeTrainings.viewDetail')}
                  </Button>
                </article>
              ))}
            </div>
          )}
        </section>
      )}

      <p className="text-xs text-neutral-400">
        <AlertCircle className="hidden" aria-hidden="true" />
      </p>
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