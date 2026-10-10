import { useMemo, useState } from 'react'
import { Save, CheckCircle2, Star, MessageSquare, TrendingUp, TrendingDown, Target, GraduationCap } from 'lucide-react'

import Avatar from '../common/Avatar'
import Input from '../common/Input'
import Button from '../common/Button'
import CycleStatusPill from './CycleStatusPill'
import EvaluationStatusPill from './EvaluationStatusPill'

import { calcAverageScore, isValidScore } from '../../utils/evaluationUtils'
import { formatDate } from '../../utils/format'
import { useI18n } from '../../i18n/useI18n'

const SCORE_LABELS_KEYS = ['score1', 'score2', 'score3', 'score4', 'score5']

const EMPTY_FORM = {
  strengths: '',
  improvements: '',
  generalComment: '',
  developmentGoals: '',
  trainingRecommendations: '',
  reviewerId: '',
  reviewerName: '',
}

/**
 * EvaluationForm - form đánh giá 1 nhân viên trong 1 kỳ.
 *
 * Props:
 *  - cycle, employee, evaluation (có thể null nếu pending)
 *  - criteria: danh sách tiêu chí mặc định
 *  - mode: 'draft' | 'complete'
 *  - onSaveDraft(values), onComplete(values)
 */
export default function EvaluationForm({
  cycle,
  employee,
  evaluation,
  criteria = [],
  onSaveDraft,
  onComplete,
  submitting = false,
  serverErrors = {},
}) {
  const { t } = useI18n()
  const [scores, setScores] = useState(() => {
    const map = {}
    for (const c of criteria) {
      const cs = evaluation?.criteriaScores?.find((x) => x.criteriaId === c.id)
      map[c.id] = cs?.score ?? 0
    }
    return map
  })
  const [comments, setComments] = useState(() => {
    const map = {}
    for (const c of criteria) {
      const cs = evaluation?.criteriaScores?.find((x) => x.criteriaId === c.id)
      map[c.id] = cs?.comment ?? ''
    }
    return map
  })
  const [form, setForm] = useState(() => ({
    ...EMPTY_FORM,
    ...(evaluation || {}),
    reviewerId: evaluation?.reviewerId || '',
    reviewerName: evaluation?.reviewerName || '',
  }))

  const errors = serverErrors

  const avg = useMemo(
    () => calcAverageScore(criteria.map((c) => ({ criteriaId: c.id, score: scores[c.id] }))),
    [scores, criteria],
  )

  function setScore(criteriaId, score) {
    setScores((prev) => ({ ...prev, [criteriaId]: Number(score) }))
  }
  function setComment(criteriaId, comment) {
    setComments((prev) => ({ ...prev, [criteriaId]: comment }))
  }
  function setField(name, value) {
    setForm((prev) => ({ ...prev, [name]: value }))
  }

  function buildPayload() {
    return {
      ...form,
      criteriaScores: criteria.map((c) => ({
        criteriaId: c.id,
        criteriaName: c.name,
        score: Number(scores[c.id]) || 0,
        comment: comments[c.id] || '',
      })),
    }
  }

  function handleSaveDraft() {
    onSaveDraft(buildPayload())
  }
  function handleComplete() {
    onComplete(buildPayload())
  }

  const isPublished = evaluation?.status === 'published'

  return (
    <div className="flex flex-col gap-5">
      {/* Header */}
      <div className="flex flex-col gap-4 rounded-lg border border-neutral-200 bg-neutral-50 p-4 sm:flex-row sm:items-center">
        <Avatar name={employee?.fullName} size="lg" />
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <h3 className="text-base font-semibold text-neutral-900">{employee?.fullName}</h3>
            <span className="font-mono text-[12px] text-neutral-500">{employee?.employeeCode}</span>
          </div>
          <p className="text-[13px] text-neutral-500">{employee?.position} · {cycle?.departmentIds?.length === 0 ? t('evaluations.companyWide') : t('evaluations.selectiveScope')}</p>
          <div className="mt-2 flex flex-wrap items-center gap-2">
            <EvaluationStatusPill status={evaluation?.status || 'pending'} />
            {cycle && <CycleStatusPill status={cycle.status} />}
            <span className="inline-flex items-center gap-1 text-xs text-neutral-500">
              {t('evaluations.cycle')}: <b className="text-neutral-700">{cycle?.name}</b> ({formatDate(cycle?.startDate)} → {formatDate(cycle?.endDate)})
            </span>
          </div>
        </div>
      </div>

      {/* Criteria scoring */}
      <fieldset className="rounded-lg border border-neutral-200 bg-white p-4">
        <legend className="px-2 text-xs font-semibold uppercase tracking-wider text-neutral-700">
          {t('evaluations.criteriaScoring')}
        </legend>
        <div className="flex flex-col gap-4">
          {criteria.map((c) => {
            const score = scores[c.id] ?? 0
            const err = errors[`criteria.${c.id}`]
            return (
              <div key={c.id} className="rounded-md border border-neutral-100 bg-neutral-50/50 p-3">
                <div className="flex flex-col gap-1 sm:flex-row sm:items-start sm:justify-between">
                  <div className="min-w-0">
                    <p className="text-sm font-semibold text-neutral-900">
                      {c.name}
                      {c.required && <span className="ml-1 text-danger-500">*</span>}
                    </p>
                    <p className="text-[12px] text-neutral-500">{c.description}</p>
                  </div>
                  <div className="inline-flex shrink-0 items-center gap-1 rounded-md border border-neutral-200 bg-white p-1">
                    {[1, 2, 3, 4, 5].map((n) => {
                      const active = score === n
                      return (
                        <button
                          key={n}
                          type="button"
                          disabled={isPublished}
                          onClick={() => setScore(c.id, n)}
                          className={`flex h-8 w-8 items-center justify-center rounded text-sm font-semibold transition ${
                            active
                              ? 'bg-brand-600 text-white'
                              : 'text-neutral-500 hover:bg-neutral-100'
                          } ${isPublished ? 'cursor-not-allowed opacity-70' : ''}`}
                          aria-label={t('evaluations.scoreForCriteria', { n, criteria: c.name })}
                          aria-pressed={active}
                        >
                          {n}
                        </button>
                      )
                    })}
                  </div>
                </div>
                <div className="mt-2 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                  <Input
                    placeholder={t('evaluations.criterionCommentPlaceholder')}
                    value={comments[c.id] || ''}
                    onChange={(e) => setComment(c.id, e.target.value)}
                    disabled={isPublished}
                  />
                  <span className="min-w-[100px] text-right text-xs text-neutral-500">
                    {score > 0 ? `${score}/5 · ${t(`evaluations.${SCORE_LABELS_KEYS[score - 1]}`)}` : t('evaluations.notYetScored')}
                  </span>
                </div>
                {err && <p className="mt-1 text-xs text-danger-600">{err}</p>}
              </div>
            )
          })}
        </div>
      </fieldset>

      {/* Summary fields */}
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        <SummaryField
          icon={Star}
          label={t('evaluations.totalScoreAuto')}
          value={avg > 0 ? `${avg}/5` : '—'}
          tone="primary"
        />
        <SummaryField
          icon={CheckCircle2}
          label={t('evaluations.scoredCriteriaCount')}
          value={`${criteria.filter((c) => isValidScore(scores[c.id])).length}/${criteria.length}`}
          tone="neutral"
        />
        <SummaryField
          icon={MessageSquare}
          label={t('evaluations.recordStatus')}
          value={evaluation?.status || 'pending'}
          tone="neutral"
        />
      </div>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <Input
          label={t('evaluations.strengths')}
          required
          placeholder={t('evaluations.strengths')}
          leftIcon={TrendingUp}
          value={form.strengths}
          onChange={(e) => setField('strengths', e.target.value)}
          error={errors.strengths}
          disabled={isPublished}
        />
        <Input
          label={t('evaluations.improvements')}
          required
          placeholder={t('evaluations.improvements')}
          leftIcon={TrendingDown}
          value={form.improvements}
          onChange={(e) => setField('improvements', e.target.value)}
          error={errors.improvements}
          disabled={isPublished}
        />
      </div>

      <Input
        label={t('evaluations.generalComment')}
        required
        placeholder={t('evaluations.generalComment')}
        leftIcon={MessageSquare}
        value={form.generalComment}
        onChange={(e) => setField('generalComment', e.target.value)}
        error={errors.generalComment}
        helper={t('evaluations.minCharsRequired')}
        disabled={isPublished}
      />
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <Input
          label={t('evaluations.developmentGoals')}
          placeholder={t('evaluations.developmentGoals')}
          leftIcon={Target}
          value={form.developmentGoals}
          onChange={(e) => setField('developmentGoals', e.target.value)}
          disabled={isPublished}
        />
        <Input
          label={t('evaluations.trainingRecommendations')}
          placeholder={t('evaluations.trainingRecommendations')}
          leftIcon={GraduationCap}
          value={form.trainingRecommendations}
          onChange={(e) => setField('trainingRecommendations', e.target.value)}
          disabled={isPublished}
        />
      </div>

      {errors._form && (
        <p className="text-sm text-danger-600">{errors._form}</p>
      )}

      {!isPublished && (
        <div className="flex flex-wrap items-center justify-end gap-2 border-t border-neutral-200 pt-4">
          <Button
            variant="secondary"
            onClick={handleSaveDraft}
            icon={Save}
            loading={submitting}
            disabled={submitting}
          >
            {t('evaluations.saveDraft')}
          </Button>
          <Button
            onClick={handleComplete}
            icon={CheckCircle2}
            loading={submitting}
            disabled={submitting}
          >
            {t('evaluations.completeEvaluation')}
          </Button>
        </div>
      )}
    </div>
  )
}

function SummaryField({ icon: Icon, label, value, tone = 'neutral' }) {
  const toneClass = {
    primary: 'bg-brand-50 text-brand-700 border-brand-200',
    neutral: 'bg-neutral-100 text-neutral-700 border-neutral-200',
    success: 'bg-success-50 text-success-700 border-success-200',
  }[tone]
  return (
    <div className={`flex items-center gap-3 rounded-md border px-3 py-2 ${toneClass}`}>
      <Icon className="h-4 w-4 flex-shrink-0" aria-hidden="true" />
      <div className="min-w-0">
        <p className="text-[11px] font-medium uppercase tracking-wider opacity-80">{label}</p>
        <p className="text-sm font-bold">{value}</p>
      </div>
    </div>
  )
}
