import { CheckCircle2, Star, TrendingUp, TrendingDown, MessageSquare, Target, GraduationCap, AlertCircle } from 'lucide-react'

import Modal from '../common/Modal'
import Button from '../common/Button'
import Avatar from '../common/Avatar'
import CycleStatusPill from './CycleStatusPill'
import EvaluationStatusPill from './EvaluationStatusPill'

import { formatDate } from '../../utils/format'
import { useI18n } from '../../i18n/useI18n'

/**
 * EvaluationDetailModal - xem chi tiết đánh giá (admin / employee).
 * - Khi isAdminView=false (employee), ẩn các trường nội bộ (comment tiêu chí, người duyệt).
 */
export default function EvaluationDetailModal({
  open,
  onClose,
  record,
  cycle,
  employee,
  isAdminView = true,
  onPublish,
  onEdit,
  onReject: _onReject,
  showPublish = false,
  approvalActions,
}) {
  const { t } = useI18n()

  if (!record) {
    return (
      <Modal open={open} onClose={onClose} title={t('evaluations.evaluationNotFound')} size="md">
        <p className="text-sm text-neutral-600">{t('evaluations.evaluationNotFoundDesc')}</p>
      </Modal>
    )
  }

  const visibleCriteria = record.criteriaScores || []

  return (
    <Modal
      open={open}
      onClose={onClose}
      size="xl"
      title={t('evaluations.evaluationDetailTitle')}
      description={`${cycle?.name || ''} · ${employee?.fullName || record.employeeName}`}
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>{t('evaluations.close')}</Button>
          {isAdminView && record.status !== 'published' && onEdit && (
            <Button onClick={() => onEdit(record.id)}>{t('evaluations.edit')}</Button>
          )}
          {showPublish && record.status === 'completed' && onPublish && (
            <Button variant="primary" onClick={() => onPublish(record.id)}>{t('evaluations.publish')}</Button>
          )}
          {approvalActions}
        </>
      }
    >
      <div className="flex flex-col gap-5">
        <div className="flex items-center gap-4 rounded-md border border-neutral-200 bg-neutral-50 px-4 py-3">
          <Avatar name={employee?.fullName || record.employeeName} size="lg" />
          <div className="min-w-0 flex-1">
            <h3 className="truncate text-base font-semibold text-neutral-900">
              {employee?.fullName || record.employeeName}
            </h3>
            <p className="text-[13px] text-neutral-500">
              {record.employeeCode} · {record.departmentName} · {employee?.position || ''}
            </p>
            <div className="mt-2 flex flex-wrap items-center gap-2">
              <EvaluationStatusPill status={record.status} />
              {cycle && <CycleStatusPill status={cycle.status} />}
              <span className="text-xs text-neutral-500">
                {t('evaluations.reviewer')}: <b className="text-neutral-700">{record.reviewerName || '—'}</b>
              </span>
            </div>
          </div>
          <div className="text-right">
            <p className="text-xs text-neutral-500">{t('evaluations.compositeScore')}</p>
            <p className="text-2xl font-bold text-neutral-900">
              {record.averageScore > 0 ? `${record.averageScore}/5` : '—'}
            </p>
          </div>
        </div>

        {!isAdminView && record.status !== 'published' ? (
          <div className="flex items-start gap-3 rounded-md border border-warning-200 bg-warning-50 px-4 py-3 text-sm text-warning-700">
            <AlertCircle className="mt-0.5 h-4 w-4 flex-shrink-0" aria-hidden="true" />
            <p>{t('evaluations.unpublishedResult')}</p>
          </div>
        ) : (
          <>
            <section className="rounded-lg border border-neutral-200 bg-white">
              <header className="flex items-center gap-2 border-b border-neutral-200 px-4 py-2">
                <Star className="h-4 w-4 text-brand-600" aria-hidden="true" />
                <h4 className="text-sm font-semibold text-neutral-900">{t('evaluations.scoresByCriteria')}</h4>
              </header>
              <ul className="divide-y divide-neutral-100">
                {visibleCriteria.map((cs) => (
                  <li key={cs.criteriaId} className="flex items-center justify-between gap-3 px-4 py-3">
                    <div className="min-w-0">
                      <p className="text-sm font-medium text-neutral-900">{cs.criteriaName}</p>
                      {isAdminView && cs.comment && (
                        <p className="text-[12px] text-neutral-500">{cs.comment}</p>
                      )}
                    </div>
                    <span className="rounded-md bg-brand-50 px-2 py-1 text-sm font-semibold text-brand-700">
                      {cs.score > 0 ? `${cs.score}/5` : '—'}
                    </span>
                  </li>
                ))}
              </ul>
            </section>

            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <DetailBlock icon={TrendingUp} label={t('evaluations.strengths')} value={record.strengths} tone="success" />
              <DetailBlock icon={TrendingDown} label={t('evaluations.improvements')} value={record.improvements} tone="danger" />
              <DetailBlock icon={MessageSquare} label={t('evaluations.generalComment')} value={record.generalComment} tone="primary" fullWidth />
              <DetailBlock icon={Target} label={t('evaluations.developmentGoals')} value={record.developmentGoals} tone="neutral" />
              <DetailBlock icon={GraduationCap} label={t('evaluations.trainingRecommendations')} value={record.trainingRecommendations} tone="neutral" />
            </div>

            {record.status === 'published' && (
              <div className="flex items-center gap-2 rounded-md border border-success-200 bg-success-50 px-4 py-3 text-sm text-success-700">
                <CheckCircle2 className="h-4 w-4" aria-hidden="true" />
                <span>{t('evaluations.publishedOn', { date: formatDate(record.publishedAt) })}</span>
              </div>
            )}
          </>
        )}
      </div>
    </Modal>
  )
}

function DetailBlock({ icon: Icon, label, value, tone = 'neutral', fullWidth = false }) {
  const toneClass = {
    success: 'bg-success-50/60 border-success-200 text-success-700',
    danger: 'bg-danger-50/60 border-danger-200 text-danger-700',
    primary: 'bg-brand-50/60 border-brand-200 text-brand-700',
    neutral: 'bg-neutral-50 border-neutral-200 text-neutral-700',
  }[tone]
  return (
    <div className={`rounded-md border p-3 ${toneClass} ${fullWidth ? 'sm:col-span-2' : ''}`}>
      <p className="mb-1 flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider">
        <Icon className="h-3.5 w-3.5" aria-hidden="true" />
        {label}
      </p>
      <p className="whitespace-pre-wrap text-sm leading-relaxed">{value || '—'}</p>
    </div>
  )
}
