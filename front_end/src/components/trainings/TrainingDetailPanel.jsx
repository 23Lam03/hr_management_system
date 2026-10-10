import { Eye, MapPin, Globe, CalendarDays, Users, Clock } from 'lucide-react'

import Avatar from '../common/Avatar'
import Button from '../common/Button'
import TrainingStatusPill from './TrainingStatusPill'
import ParticipantStatusPill from './ParticipantStatusPill'
import LearningStatusPill from './LearningStatusPill'

import { TRAINING_CATEGORY_LABEL, TRAINING_FORMAT_LABEL } from '../../data/trainingMockData'
import { formatDateRange, formatNumber } from '../../utils/format'
import { useI18n } from '../../i18n/useI18n'

/**
 * TrainingDetailPanel - panel thông tin + học viên cho trang detail / employee detail.
 */
export default function TrainingDetailPanel({
  course,
  registration = null,
  mode = 'admin',
  onEdit,
  onCancelCourse,
  onAddEmployee,
  onRegister,
  onCancelRegistration,
}) {
  const { t } = useI18n()

  if (!course) return null

  const slotsLeft = (course.capacity || 0) - (course.registeredCount || 0)
  const canEdit = mode === 'admin' && course.status !== 'cancelled' && course.status !== 'completed'
  const canRegister = mode === 'employee' && !registration && course.status === 'open'
  const canCancelReg = mode === 'employee' && registration && registration.registrationStatus !== 'cancelled'

  return (
    <div className="flex flex-col gap-5">
      <header className="flex flex-col gap-3 rounded-lg border border-neutral-200 bg-white p-5 shadow-card sm:flex-row sm:items-start">
        <div className="flex-1 min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <h2 className="text-lg font-semibold text-neutral-900">{course.name}</h2>
            <TrainingStatusPill status={course.status} />
          </div>
          <p className="mt-1 font-mono text-[12px] text-neutral-500">{course.code}</p>
          <div className="mt-2 flex flex-wrap items-center gap-2 text-[13px] text-neutral-600">
            <span className="rounded bg-neutral-100 px-2 py-0.5 text-xs">
              {TRAINING_CATEGORY_LABEL[course.category] || course.category}
            </span>
            <span className="rounded bg-neutral-100 px-2 py-0.5 text-xs">
              {TRAINING_FORMAT_LABEL[course.format] || course.format}
            </span>
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {mode === 'admin' && canEdit && onEdit && (
            <Button variant="secondary" onClick={onEdit}>{t('trainings.editCourse')}</Button>
          )}
          {mode === 'admin' && canEdit && onCancelCourse && (
            <Button variant="danger" onClick={onCancelCourse}>{t('trainings.cancelCourse')}</Button>
          )}
          {mode === 'employee' && canRegister && onRegister && (
            <Button onClick={onRegister}>{t('trainings.register')}</Button>
          )}
          {mode === 'employee' && canCancelReg && onCancelRegistration && (
            <Button variant="danger" onClick={onCancelRegistration}>{t('trainings.cancelRegistration')}</Button>
          )}
        </div>
      </header>

      <section className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        <InfoCard icon={CalendarDays} label={t('trainings.columnStart') + ' – ' + t('trainings.columnEnd')} value={formatDateRange(course.startDate, course.endDate)} />
        <InfoCard icon={Clock} label={t('trainings.registrationDeadlineLabel')} value={course.registrationDeadline} />
        <InfoCard icon={Users} label={t('trainings.registrationsCapacity')} value={`${formatNumber(course.registeredCount)}/${formatNumber(course.capacity)} · ${t('trainings.slotsAvailable', { available: formatNumber(Math.max(0, slotsLeft)) })}`} />
        {course.format !== 'online' && course.location && (
          <InfoCard icon={MapPin} label={t('trainings.location')} value={course.location} />
        )}
        {course.format !== 'offline' && course.meetingUrl && (
          <InfoCard
            icon={Globe}
            label={t('trainings.learningOnline')}
            value={
              <a href={course.meetingUrl} target="_blank" rel="noopener noreferrer" className="text-brand-600 underline">
                {course.meetingUrl}
              </a>
            }
          />
        )}
        <InfoCard icon={Users} label={t('trainings.instructorLabel')} value={course.instructor} />
        <InfoCard icon={Clock} label={t('trainings.duration')} value={t('trainings.hours', { n: course.durationHours })} />
      </section>

      {mode === 'employee' && registration && (
        <section className="rounded-lg border border-brand-200 bg-brand-50 p-5">
          <h3 className="text-sm font-semibold text-brand-700">{t('trainings.yourParticipationStatus')}</h3>
          <div className="mt-2 flex flex-wrap items-center gap-3">
            <ParticipantStatusPill status={registration.registrationStatus} />
            <LearningStatusPill status={registration.learningStatus} />
            {registration.resultPublished && registration.learningStatus === 'completed' && (
              <span className="rounded bg-success-50 px-2 py-1 text-xs font-medium text-success-700">
                {t('trainings.passScore', { score: registration.score ?? '—' })}
              </span>
            )}
            {registration.resultPublished && registration.learningStatus === 'failed' && (
              <span className="rounded bg-danger-50 px-2 py-1 text-xs font-medium text-danger-700">
                {t('trainings.failScore')}
              </span>
            )}
          </div>
          {registration.progress > 0 && registration.learningStatus !== 'completed' && (
            <div className="mt-3">
              <div className="h-2 w-full overflow-hidden rounded-full bg-white">
                <div
                  className="h-full bg-brand-500"
                  style={{ width: `${registration.progress}%` }}
                />
              </div>
              <p className="mt-1 text-xs text-brand-700">{t('trainings.progressPercent', { n: registration.progress })}</p>
            </div>
          )}
          {registration.resultPublished && registration.instructorComment && (
            <p className="mt-3 rounded-md border border-brand-200 bg-white px-3 py-2 text-[13px] text-neutral-700">
              <b className="text-brand-700">{t('trainings.instructorComment')}:</b> {registration.instructorComment}
            </p>
          )}
          {!registration.resultPublished && (registration.learningStatus === 'completed' || registration.learningStatus === 'failed') && (
            <p className="mt-2 text-xs text-brand-700">{t('trainings.resultNotPublished')}</p>
          )}
        </section>
      )}

      <section className="rounded-lg border border-neutral-200 bg-white p-5 shadow-card">
        <h3 className="text-sm font-semibold text-neutral-900">{t('trainings.courseDescription')}</h3>
        <p className="mt-2 whitespace-pre-wrap text-sm leading-relaxed text-neutral-700">
          {course.description || '—'}
        </p>
        {course.objectives && (
          <>
            <h3 className="mt-4 text-sm font-semibold text-neutral-900">{t('trainings.courseObjectives')}</h3>
            <p className="mt-2 whitespace-pre-wrap text-sm leading-relaxed text-neutral-700">
              {course.objectives}
            </p>
          </>
        )}
      </section>

      {mode === 'admin' && onAddEmployee && canEdit && (
        <div className="flex justify-end">
          <Button onClick={onAddEmployee}>{t('trainings.addEmployee')}</Button>
        </div>
      )}

      <span className="hidden"><Eye aria-hidden="true" /><Avatar aria-hidden="true" /></span>
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
