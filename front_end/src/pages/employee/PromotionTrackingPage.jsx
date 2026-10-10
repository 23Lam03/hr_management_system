import { useCallback, useEffect, useMemo, useState } from 'react'
import {
  AlertTriangle,
  Award,
  ChevronRight,
  ClipboardCheck,
  Flag,
  RefreshCcw,
  TrendingUp,
} from 'lucide-react'

import PageHeader from '../../components/common/PageHeader'
import Card from '../../components/common/Card'
import Button from '../../components/common/Button'
import Input from '../../components/common/Input'
import Select from '../../components/common/Select'
import EmptyState from '../../components/common/EmptyState'
import Loading from '../../components/common/Loading'
import Table from '../../components/common/Table'
import Badge from '../../components/common/Badge'
import { useToast } from '../../components/common/useToast'

import PromotionSummaryTiles from '../../components/promotion/PromotionSummaryTiles'
import PromotionDetailModal from '../../components/promotion/PromotionDetailModal'

import { useAuth } from '../../contexts/useAuth'
import {
  getPromotionsByEmployeeId,
  subscribePromotions,
} from '../../services/promotionService'
import { PROMOTION_STATUS_LABEL } from '../../data/promotionData'
import { getEmployeeById } from '../../services/employeeService'
import { EMPLOYEES, DEPARTMENTS } from '../../data/employeeMockData'

import {
  getEvaluationCriteria,
  getMyEvaluations,
  subscribeEvaluations,
} from '../../services/evaluationService'

import { useI18n } from '../../i18n/useI18n'

import { formatDate, formatDateTime } from '../../utils/format'

function STATUS_OPTIONS(t) {
  return [
    { value: '',           label: t('promotionTracking.allStatuses') },
    { value: 'pending',    label: PROMOTION_STATUS_LABEL.pending },
    { value: 'approved',   label: PROMOTION_STATUS_LABEL.approved },
    { value: 'rejected',   label: PROMOTION_STATUS_LABEL.rejected },
    { value: 'cancelled',  label: PROMOTION_STATUS_LABEL.cancelled },
  ]
}

/**
 * PromotionTrackingPage - Employee tự theo dõi promotion của mình.
 *
 * Phase 25 (EMP-PRM01 enhancement):
 * - Promotion Roadmap (timeline theo các bản ghi promotion).
 * - Promotion Evaluation Criteria (từ Performance Evaluation data).
 * - Promotion History (table có filter/search).
 * - Career Summary (current position/department từ Employee Profile data).
 */
export default function PromotionTrackingPage() {
  const { t } = useI18n()
  const toast = useToast()
  const { user } = useAuth()
  const [version, setVersion] = useState(0)
  const [evalVersion, setEvalVersion] = useState(0)
  const [detail, setDetail] = useState(null)

  useEffect(() => {
    const unsub = subscribePromotions(() => setVersion((v) => v + 1))
    const unsubEval = subscribeEvaluations(() => setEvalVersion((v) => v + 1))
    return () => { unsub(); unsubEval() }
  }, [])

  const refresh = useCallback(() => {
    setVersion((v) => v + 1)
    setEvalVersion((v) => v + 1)
    toast.success(t('promotionTracking.dataRefreshed'))
  }, [toast, t])

  // Map currentUser → employeeId (single source of truth từ employee data)
  const currentEmployeeId = useMemo(() => {
    if (!user?.id) return null
    const matched = EMPLOYEES.find((e) => e.userId === user.id || e.id === user.id)
    return matched?.id ?? null
  }, [user])

  const employee = useMemo(() => {
    if (!currentEmployeeId) return null
    const raw = getEmployeeById(currentEmployeeId)
    if (!raw) return null
    const deptName = DEPARTMENTS.find((d) => d.id === raw.departmentId)?.name
    return { ...raw, departmentName: deptName || raw.departmentId }
  }, [currentEmployeeId])

  const items = useMemo(() => {
    if (!currentEmployeeId) return []
    return getPromotionsByEmployeeId(currentEmployeeId)
  }, [currentEmployeeId, version]) // eslint-disable-line react-hooks/exhaustive-deps

  const summary = useMemo(() => {
    const base = {
      total: items.length,
      pending: items.filter((p) => p.status === 'pending').length,
      approved: items.filter((p) => p.status === 'approved').length,
      rejected: items.filter((p) => p.status === 'rejected').length,
      cancelled: items.filter((p) => p.status === 'cancelled').length,
    }
    return base
  }, [items])

  // Đánh giá gần nhất của employee để lấy criteriaScores (chỉ published)
  const latestEvaluation = useMemo(() => {
    if (!currentEmployeeId) return null
    const list = getMyEvaluations(currentEmployeeId)
    return list[0] || null
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentEmployeeId, evalVersion])

  if (!user) {
    return (
      <div className="flex h-40 items-center justify-center rounded-lg border border-dashed border-neutral-300 bg-white">
        <Loading size="md" label={t('common.loading')} />
      </div>
    )
  }

  if (!currentEmployeeId) {
    return (
      <div className="flex flex-col gap-4">
        <PageHeader
          title={t('promotionTracking.careerPromotion')}
          subtitle={t('promotionTracking.subtitle')}
          icon={Award}
        />
        <Card>
          <div className="flex items-start gap-2 rounded-md border border-warning-200 bg-warning-50 px-3 py-2 text-sm text-warning-700">
            <AlertTriangle className="mt-0.5 h-4 w-4" aria-hidden="true" />
            <span>{t('promotionTracking.accountNotLinked')}</span>
          </div>
        </Card>
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title={t('promotionTracking.careerPromotion')}
        subtitle={t('promotionTracking.careerPromotionDesc')}
        icon={Award}
        actions={
          <Button variant="secondary" size="md" icon={RefreshCcw} onClick={refresh}>
            {t('promotionTracking.refresh')}
          </Button>
        }
      />

      {/* ---------- Career Summary ---------- */}
      <SectionTitle icon={TrendingUp}>{t('promotionTracking.careerSummary')}</SectionTitle>
      <CareerSummary employee={employee} summary={summary} t={t} />

      {/* ---------- Promotion Overview ---------- */}
      <SectionTitle icon={ClipboardCheck}>{t('promotionTracking.promotionOverview')}</SectionTitle>
      <PromotionSummaryTiles summary={summary} />

      {/* ---------- Promotion Roadmap ---------- */}
      <SectionTitle icon={Flag}>{t('promotionTracking.promotionRoadmap')}</SectionTitle>
      <PromotionRoadmap items={items} employee={employee} t={t} />

      {/* ---------- Promotion Evaluation Criteria ---------- */}
      <SectionTitle icon={ClipboardCheck}>{t('promotionTracking.promotionCriteria')}</SectionTitle>
      <EvaluationCriteriaSection latestEvaluation={latestEvaluation} t={t} />

      {/* ---------- Promotion History ---------- */}
      <SectionTitle icon={Award}>{t('promotionTracking.promotionHistory')}</SectionTitle>
      <PromotionHistory items={items} onView={setDetail} t={t} />

      {/* ---------- Detail Modal ---------- */}
      <PromotionDetailModal
        open={Boolean(detail)}
        onClose={() => setDetail(null)}
        promotion={detail}
        employee={detail ? EMPLOYEES.find((e) => e.id === detail.employeeId) : null}
        showInternalNote={false}
      />
    </div>
  )
}

// ---------- Section Title ------------------------------------------------
function SectionTitle({ icon: Icon, children }) {
  return (
    <div className="flex items-center gap-2 text-[15px] font-semibold text-neutral-800">
      {Icon && <Icon className="h-4 w-4 text-brand-600" aria-hidden="true" />}
      <span>{children}</span>
    </div>
  )
}

// ---------- Career Summary ---------------------------------------------
function CareerSummary({ employee, summary, t }) {
  if (!employee) {
    return (
      <Card>
        <EmptyState title={t('promotionTracking.noProfileData')} description={t('promotionTracking.noEmployeeData')} />
      </Card>
    )
  }

  return (
    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
      <SummaryField label={t('promotionTracking.currentPosition')} value={employee.position || '—'} />
      <SummaryField label={t('promotionTracking.currentDepartment')} value={employee.departmentName || employee.departmentId || '—'} />
      <SummaryField label={t('promotionTracking.latestStatus')} value={latestStatusText(summary, t)} />
      <SummaryField label={t('promotionTracking.promotionRecords')} value={String(summary.total)} />
    </div>
  )
}

function SummaryField({ label, value }) {
  return (
    <Card>
      <p className="text-xs uppercase tracking-wider text-neutral-500">{label}</p>
      <p className="mt-1 text-base font-semibold text-neutral-900">{value}</p>
    </Card>
  )
}

function latestStatusText(summary, t) {
  if (summary.pending) return t('promotionTracking.statusPending')
  if (summary.approved) return t('promotionTracking.statusApproved')
  if (summary.rejected) return t('promotionTracking.statusRejected')
  if (summary.cancelled) return t('promotionTracking.statusCancelled')
  return t('promotionTracking.noPromotion')
}

// ---------- Promotion Roadmap ------------------------------------------
function PromotionRoadmap({ items, employee, t }) {
  // Sắp xếp promotion theo thứ tự thời gian (cũ → mới) để vẽ timeline.
  const sorted = useMemo(() => {
    return items.slice().sort((a, b) => {
      const ak = a.effectiveDate || a.createdAt || ''
      const bk = b.effectiveDate || b.createdAt || ''
      return String(ak).localeCompare(String(bk))
    })
  }, [items])

  if (sorted.length === 0) {
    return (
      <Card>
        <EmptyState
          title={t('promotionTracking.noRoadmap')}
          description={t('promotionTracking.roadmapBuildFromRecords')}
        />
      </Card>
    )
  }

  return (
    <Card>
      <ol className="flex flex-col gap-4">
        {/* Starting point: current position */}
        <TimelineNode
          index={0}
          title={t('promotionTracking.currentPosition')}
          subtitle={employee?.position || sorted[0]?.currentPosition || '—'}
          status="current"
          statusLabel={t('promotionTracking.current')}
          tone="info"
        />

        {sorted.map((p, idx) => (
          <TimelineNode
            key={p.id}
            index={idx + 1}
            title={p.proposedPosition || '—'}
            subtitle={
              <span className="flex flex-wrap items-center gap-2 text-xs text-neutral-600">
                <span>{t('promotionTracking.department')}: {p.proposedDepartment || p.currentDepartment || '—'}</span>
                <span>·</span>
                <span>{t('promotionTracking.effective')}: {formatDate(p.effectiveDate) || '—'}</span>
              </span>
            }
            status={p.status}
            statusLabel={PROMOTION_STATUS_LABEL[p.status] || p.status}
            tone={roadmapTone(p.status)}
            note={p.reason}
          />
        ))}
      </ol>
    </Card>
  )
}

function TimelineNode({ index, title, subtitle, statusLabel, tone, note }) {
  return (
    <li className="flex gap-3">
      <div className="flex flex-col items-center">
        <div className={`flex h-7 w-7 items-center justify-center rounded-full border text-[11px] font-semibold ${
          tone === 'info' ? 'border-brand-200 bg-brand-50 text-brand-700'
          : tone === 'success' ? 'border-success-200 bg-success-50 text-success-700'
          : tone === 'warning' ? 'border-warning-200 bg-warning-50 text-warning-700'
          : tone === 'danger' ? 'border-danger-200 bg-danger-50 text-danger-700'
          : 'border-neutral-200 bg-neutral-50 text-neutral-700'
        }`}>
          {index + 1}
        </div>
        <div className="mt-1 h-full w-px bg-neutral-200" />
      </div>
      <div className="flex-1 pb-2">
        <div className="flex flex-wrap items-center gap-2">
          <p className="text-sm font-semibold text-neutral-900">{title}</p>
          <Badge tone={tone}>{statusLabel}</Badge>
        </div>
        {subtitle && <div className="mt-1">{subtitle}</div>}
        {note && (
          <p className="mt-1 line-clamp-2 text-[13px] text-neutral-600">{note}</p>
        )}
      </div>
    </li>
  )
}

function roadmapTone(status) {
  if (status === 'approved') return 'success'
  if (status === 'pending') return 'warning'
  if (status === 'rejected') return 'danger'
  if (status === 'cancelled') return 'neutral'
  if (status === 'current') return 'info'
  return 'neutral'
}

// ---------- Evaluation Criteria ---------------------------------------
function EvaluationCriteriaSection({ latestEvaluation, t }) {
  const criteria = getEvaluationCriteria()

  if (criteria.length === 0) {
    return (
      <Card>
        <EmptyState title={t('promotionTracking.noCriteriaConfigured')} />
      </Card>
    )
  }

  // Map score từ evaluation criteriaScores (nếu có)
  const scoreMap = new Map()
  if (latestEvaluation?.criteriaScores) {
    latestEvaluation.criteriaScores.forEach((cs) => {
      scoreMap.set(cs.criteriaId, cs)
    })
  }

  return (
    <Card>
      {latestEvaluation ? (
        <div className="flex flex-wrap items-center gap-2 pb-3 text-xs text-neutral-500">
          <Badge tone="info">{t('promotionTracking.latestEvaluation')}</Badge>
          <span>{t('promotionTracking.updatedAt')}: {formatDateTime(latestEvaluation.updatedAt || latestEvaluation.createdAt)}</span>
          {latestEvaluation.averageScore != null && (
            <span>· {t('promotionTracking.avgScore')}: <b className="text-neutral-800">{latestEvaluation.averageScore}</b></span>
          )}
        </div>
      ) : (
        <p className="pb-3 text-xs text-neutral-500">
          {t('promotionTracking.noPublishedEvaluation')}
        </p>
      )}

      <Table
        data={criteria.map((c) => {
          const sc = scoreMap.get(c.id)
          return {
            ...c,
            score: sc?.score ?? null,
            comment: sc?.comment || '',
          }
        })}
        rowKey="id"
        emptyTitle={t('promotionTracking.criterion')}
        columns={[
          { key: 'name', header: t('promotionTracking.criterion'), render: (c) => (
            <div className="flex flex-col">
              <span className="text-sm font-medium text-neutral-900">{c.name}</span>
              {c.description && <span className="text-xs text-neutral-500">{c.description}</span>}
            </div>
          ) },
          { key: 'weight', header: t('promotionTracking.weight'), render: (c) => c.weight ?? '—' },
          { key: 'required', header: t('promotionTracking.required'), render: (c) => c.required ? <Badge tone="warning">{t('promotionTracking.yes')}</Badge> : <Badge tone="neutral">{t('promotionTracking.no')}</Badge> },
          { key: 'score', header: t('promotionTracking.score'), render: (c) => (
            c.score == null || c.score === 0
              ? <span className="text-neutral-400">—</span>
              : <span className="font-medium text-neutral-900">{c.score}/5</span>
          ) },
        ]}
      />
    </Card>
  )
}

// ---------- Promotion History -----------------------------------------
function PromotionHistory({ items, onView, t }) {
  const [search, setSearch] = useState('')
  const [status, setStatus] = useState('')

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase()
    return items.filter((p) => {
      if (status && p.status !== status) return false
      if (q) {
        const hay = `${p.currentPosition} ${p.proposedPosition} ${p.currentDepartment} ${p.proposedDepartment}`.toLowerCase()
        if (!hay.includes(q)) return false
      }
      return true
    })
  }, [items, search, status])

  const sorted = useMemo(
    () => filtered.slice().sort((a, b) => String(b.createdAt || '').localeCompare(String(a.createdAt || ''))),
    [filtered],
  )

  if (items.length === 0) {
    return (
      <Card>
        <EmptyState
          title={t('promotionTracking.noHistoryData')}
          description={t('promotionTracking.historyAppear')}
        />
      </Card>
    )
  }

  return (
    <div className="flex flex-col gap-3">
      <Card>
        <div className="grid grid-cols-1 gap-3 md:grid-cols-12">
          <div className="md:col-span-7">
            <Input
              placeholder={t('promotionTracking.searchPlaceholder')}
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
          <div className="md:col-span-3">
            <Select options={STATUS_OPTIONS(t)} value={status} onChange={(e) => setStatus(e.target.value)} />
          </div>
        </div>
      </Card>

      {filtered.length === 0 ? (
        <Card>
          <EmptyState title={t('promotionTracking.noResults')} description={t('promotionTracking.adjustFilters')} />
        </Card>
      ) : (
        <Table
          data={sorted}
          rowKey="id"
          emptyTitle={t('promotionTracking.noResults')}
          columns={[
            { key: 'current', header: t('promotionTracking.currentPosition'), render: (r) => r.currentPosition || '—' },
            { key: 'proposed', header: t('promotionTracking.proposedPosition'), render: (r) => r.proposedPosition || '—' },
            { key: 'dept', header: t('promotionTracking.department'), render: (r) => r.proposedDepartment || r.currentDepartment || '—' },
            { key: 'status', header: t('promotionTracking.status'), render: (r) => (
              <Badge tone={historyTone(r.status)}>{PROMOTION_STATUS_LABEL[r.status] || r.status}</Badge>
            ) },
            { key: 'effective', header: t('promotionTracking.effectiveDate'), render: (r) => formatDate(r.effectiveDate) || '—' },
            { key: 'created', header: t('promotionTracking.createdAt'), render: (r) => formatDate(r.createdAt) || '—' },
            { key: 'view', header: '', render: (r) => (
              <Button variant="ghost" size="sm" icon={ChevronRight} onClick={() => onView?.(r)}>
                {t('promotionTracking.detail')}
              </Button>
            ) },
          ]}
        />
      )}
    </div>
  )
}

function historyTone(s) {
  if (s === 'approved') return 'success'
  if (s === 'pending') return 'warning'
  if (s === 'rejected') return 'danger'
  return 'neutral'
}