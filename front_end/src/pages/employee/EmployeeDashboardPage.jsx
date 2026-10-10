import { useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  CalendarCheck2,
  Wallet,
  GraduationCap,
  PlaneTakeoff,
  Home,
  UserCircle,
  ArrowRight,
  Bell,
  FileText,
  ClipboardCheck,
  Gift,
  Briefcase,
  Headset,
  FileBarChart2,
  Award,
  BadgeCheck,
} from 'lucide-react'

import { useAuth } from '../../contexts/useAuth'
import { useI18n } from '../../i18n/useI18n'

import PageHeader from '../../components/common/PageHeader'
import Card from '../../components/common/Card'
import Button from '../../components/common/Button'
import Badge from '../../components/common/Badge'
import Avatar from '../../components/common/Avatar'
import EmptyState from '../../components/common/EmptyState'

import DashboardSection from '../../components/dashboard/DashboardSection'
import EmployeeWeekChartLazy from '../../components/dashboard/employeeWeekLazy'
import {
  getEmployeeSummary,
  getEmployeeAttendanceWeek,
} from '../../services/dashboardService'
import { formatCurrencyVnd, formatDate } from '../../utils/format'

const STATUS_BADGE = {
  working: { tone: 'success', labelKey: 'employeeDashboard.working' },
  leave:   { tone: 'warning', labelKey: 'employeeDashboard.onLeave' },
  off:     { tone: 'neutral', labelKey: 'employeeDashboard.dayOff' },
}

const LEAVE_TONE = {
  pending: 'pending',
  approved: 'approved',
  rejected: 'rejected',
}

const PROMO_TONE = {
  pending: 'warning',
  approved: 'success',
  rejected: 'danger',
  cancelled: 'neutral',
}

const APP_TONE = {
  new: 'info',
  screening: 'pending',
  interview: 'warning',
  offer: 'brand',
  hired: 'success',
  rejected: 'danger',
}

/**
 * EmployeeDashboardPage - Phần 27 nâng cấp dashboard hiện có.
 *
 * Phase 27:
 *  - Quick Actions cho toàn bộ module Employee.
 *  - Evaluation / Benefits / Contracts / Support / Promotion / Internal
 *    Applications summary (read-only, aggregate từ các service hiện có).
 *  - KHÔNG tạo Dashboard thứ hai; tái sử dụng layout + AuthContext hiện tại.
 *  - Filter data theo currentUser → chỉ thấy của mình.
 */
export default function EmployeeDashboardPage() {
  const navigate = useNavigate()
  const { user } = useAuth()
  const { t } = useI18n()

  const summary = useMemo(() => {
    if (!user?.id) return null
    // Phase 27: ưu tiên employeeId nếu user đã có (vd. emp-001), fallback user.id.
    const resolvedId = user.employeeId ?? user.id
    return getEmployeeSummary(resolvedId)
  }, [user])

  const weekAttendance = useMemo(() => {
    if (!user?.id) return []
    const resolvedId = user.employeeId ?? user.id
    return getEmployeeAttendanceWeek(resolvedId)
  }, [user])

  if (!user) {
    return (
      <EmptyState
        title={t('employeeDashboard.notLoggedIn')}
        description={t('employeeDashboard.notLoggedInDesc')}
        actionLabel={t('employeeDashboard.loginButton')}
        onAction={() => navigate('/login')}
      />
    )
  }

  if (!summary) {
    return (
      <EmptyState
        title={t('employeeDashboard.noEmployeeData')}
        description={t('employeeDashboard.noEmployeeDataDesc')}
      />
    )
  }

  const {
    employee,
    attendance,
    leave,
    payroll,
    trainings,
    notifications,
    evaluations,
    benefits,
    contracts,
    support,
    promotions,
    applications,
    attendanceApproval,
    payrollApproval,
    evaluationApproval,
  } = summary
  void evaluationApproval

  const status = STATUS_BADGE[attendance?.todayStatus ?? 'off']
  const initialsName = employee.name

  return (
    <>
      {/* Hero */}
      <Card padding={false} className="mb-6 overflow-hidden">
        <div className="relative bg-gradient-to-br from-brand-600 to-brand-800 px-6 py-7 text-white sm:px-8">
          <div className="flex flex-col gap-5 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-center gap-4">
              <Avatar
                src={employee.avatarUrl ?? user.avatarUrl}
                name={initialsName}
                size="lg"
                className="ring-2 ring-white/30"
              />
              <div>
                <p className="text-[13px] uppercase tracking-wider text-brand-100">
                  {t('employeeDashboard.welcome')},
                </p>
                <h1 className="mt-0.5 text-[26px] font-bold leading-tight">
                  {employee.name}
                </h1>
                <p className="mt-1 text-[13px] text-brand-100">
                  {employee.jobTitle} · {employee.department}
                </p>
              </div>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              {status && (
                <Badge tone={status.tone} className="bg-white/15 text-white">
                  {t(status.labelKey)}
                </Badge>
              )}
              {attendance?.checkIn && (
                <span className="inline-flex items-center gap-2 rounded-md bg-white/10 px-3 py-1.5 text-[13px]">
                  <CalendarCheck2 className="h-3.5 w-3.5" aria-hidden="true" />
                  {t('employeeDashboard.checkIn')}: {attendance.checkIn}
                </span>
              )}
              <Button
                variant="secondary"
                icon={Home}
                onClick={() => navigate('/employee/attendance')}
              >
                {t('employeeDashboard.attendanceAction')}
              </Button>
            </div>
          </div>
        </div>
      </Card>

      <PageHeader
        title={t('employeeDashboard.personalOverview')}
        subtitle={t('employeeDashboard.personalOverviewDesc')}
        icon={UserCircle}
      />

      {/* KPI */}
      <DashboardSection className="mb-6">
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <KpiTile
            label={t('employeeDashboard.workDaysThisMonth')}
            value={`${attendance?.monthSummary?.daysWorked ?? 0}/${attendance?.monthSummary?.totalWorkingDays ?? 0}`}
            icon={CalendarCheck2}
            tone="primary"
            note={t('employeeDashboard.lateCountNote', {
              n: attendance?.monthSummary?.lateCount ?? 0,
              m: attendanceApproval.pending,
            })}
          />
          <KpiTile
            label={t('employeeDashboard.remainingLeave')}
            value={leave.remaining}
            icon={PlaneTakeoff}
            tone="warning"
            note={t('employeeDashboard.leaveUsedNote', { n: leave.approved, m: leave.pending })}
          />
          <KpiTile
            label={t('employeeDashboard.latestPayPeriod')}
            value={payroll ? formatCurrencyVnd(payroll.net) : '—'}
            icon={Wallet}
            tone="success"
            note={payroll ? t('employeeDashboard.payPeriodNote', { n: payroll.period, m: payrollApproval.pending }) : t('employeeDashboard.noPayrollData')}
          />
          <KpiTile
            label={t('employeeDashboard.trainingCourses')}
            value={trainings.length}
            icon={GraduationCap}
            tone="info"
            note={trainings.length > 0 ? t('employeeDashboard.coursesAssignedNote', { n: formatDate(earliestDueDate(trainings)) }) : t('employeeDashboard.noTrainingAssigned')}
          />
        </div>
      </DashboardSection>

      {/* Quick Actions */}
      <DashboardSection
        title={t('employeeDashboard.quickActions')}
        description={t('employeeDashboard.quickActionsDesc')}
        className="mb-6"
      >
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 xl:grid-cols-6">
          <QuickAction icon={UserCircle}     label={t('employeeDashboard.myProfile')}        onClick={() => navigate('/employee/profile')} />
          <QuickAction icon={CalendarCheck2} label={t('employeeDashboard.attendanceTab')}    onClick={() => navigate('/employee/attendance')} />
          <QuickAction icon={PlaneTakeoff}   label={t('employeeDashboard.leaveTab')}        onClick={() => navigate('/employee/leaves')} />
          <QuickAction icon={Wallet}         label={t('employeeDashboard.payrollTab')}      onClick={() => navigate('/employee/payroll')} />
          <QuickAction icon={ClipboardCheck}  label={t('employeeDashboard.evaluationsTab')}  onClick={() => navigate('/employee/evaluations')} />
          <QuickAction icon={Bell}           label={t('employeeDashboard.notificationsTab')}  onClick={() => navigate('/employee/notifications')} />
          <QuickAction icon={GraduationCap}  label={t('employeeDashboard.trainingTab')}      onClick={() => navigate('/employee/trainings')} />
          <QuickAction icon={Gift}           label={t('employeeDashboard.benefitsTab')}      onClick={() => navigate('/employee/benefits')} />
          <QuickAction icon={BadgeCheck}     label={t('employeeDashboard.contractsTab')}    onClick={() => navigate('/employee/contracts')} />
          <QuickAction icon={Headset}        label={t('employeeDashboard.supportTab')}       onClick={() => navigate('/employee/support')} />
          <QuickAction icon={FileBarChart2}  label={t('employeeDashboard.reportsTab')}      onClick={() => navigate('/employee/reports')} />
          <QuickAction icon={Briefcase}      label={t('employeeDashboard.internalJobsTab')}  onClick={() => navigate('/employee/jobs')} />
          <QuickAction icon={Award}          label={t('employeeDashboard.promotionsTab')}    onClick={() => navigate('/employee/promotions')} />
          <QuickAction icon={UserCircle}     label={t('employeeDashboard.accountTab')}       onClick={() => navigate('/employee/account')} />
        </div>
      </DashboardSection>

      {/* Biểu đồ + Đơn nghỉ phép */}
      <div className="mb-6 grid grid-cols-1 gap-4 xl:grid-cols-3">
        <DashboardSection
          title={t('employeeDashboard.attendance7Days')}
          description={t('employeeDashboard.attendance7DaysDesc')}
          className="xl:col-span-2"
        >
          <Card padding={false}>
            <div className="p-4">
              <EmployeeWeekChartLazy data={weekAttendance} />
            </div>
          </Card>
        </DashboardSection>

        <DashboardSection
          title={t('employeeDashboard.myLeaveRequests')}
          description={t('employeeDashboard.myLeaveRequestsDesc')}
          actions={
            <Button
              variant="ghost"
              size="sm"
              icon={ArrowRight}
              iconPosition="right"
              onClick={() => navigate('/employee/leaves')}
            >
              {t('employeeDashboard.viewAll')}
            </Button>
          }
        >
          <Card>
            {leave.recent.length === 0 ? (
              <EmptyState
                title={t('employeeDashboard.noLeaveRequests')}
                description={t('employeeDashboard.createLeaveAction')}
                actionLabel={t('employeeDashboard.createLeaveAction')}
                onAction={() => navigate('/employee/leaves')}
              />
            ) : (
              <ul className="flex flex-col gap-3">
                {leave.recent.map((l) => (
                  <li
                    key={l.id}
                    className="flex items-start justify-between gap-3 rounded-md border border-neutral-200 p-3"
                  >
                    <div className="min-w-0">
                      <p className="truncate text-sm font-medium text-neutral-900">{l.type}</p>
                      <p className="mt-0.5 text-xs text-neutral-500">
                        {l.from} → {l.to} · {l.days} {t('employeeDashboard.daysUnit')}
                      </p>
                      {l.reason && (
                        <p className="mt-1 line-clamp-1 text-xs text-neutral-500">
                          {t('employeeDashboard.reasonLabel', { n: l.reason })}
                        </p>
                      )}
                    </div>
                    <Badge tone={LEAVE_TONE[l.status] ?? 'pending'}>
                      {l.status === 'pending' ? t('leaves.typeAnnual') : l.status === 'approved' ? t('status.approved') : t('status.rejected')}
                    </Badge>
                  </li>
                ))}
              </ul>
            )}
          </Card>
        </DashboardSection>
      </div>

      {/* Đào tạo + thông báo */}
      <div className="mb-6 grid grid-cols-1 gap-4 xl:grid-cols-3">
        <DashboardSection
          title={t('employeeDashboard.myTrainings')}
          description={t('employeeDashboard.myTrainingsDesc')}
          className="xl:col-span-2"
          actions={
            <Button
              variant="ghost"
              size="sm"
              icon={ArrowRight}
              iconPosition="right"
              onClick={() => navigate('/employee/trainings')}
            >
              {t('employeeDashboard.viewAll')}
            </Button>
          }
        >
          <Card>
            {trainings.length === 0 ? (
              <EmptyState
                title={t('employeeDashboard.noTrainingCourses')}
                description={t('employeeDashboard.hrWillAssign')}
              />
            ) : (
              <ul className="flex flex-col gap-3">
                {trainings.map((tr) => (
                  <li key={tr.id} className="rounded-md border border-neutral-200 p-3">
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <p className="truncate text-sm font-medium text-neutral-900">{tr.title}</p>
                        <p className="mt-0.5 text-xs text-neutral-500">
                          {tr.provider} · {tr.durationHours}h · Hạn {formatDate(tr.dueAt)}
                        </p>
                      </div>
                      <Badge tone={tr.required ? 'warning' : 'neutral'}>
                        {tr.required ? t('employeeDashboard.required') : t('employeeDashboard.optional')}
                      </Badge>
                    </div>
                    <div className="mt-3">
                      <div className="h-2 w-full overflow-hidden rounded-full bg-neutral-100">
                        <div
                          className="h-full bg-brand-600 transition-all"
                          style={{ width: `${tr.progress}%` }}
                        />
                      </div>
                      <p className="mt-1 text-xs text-neutral-500">{t('employeeDashboard.progressComplete', { n: tr.progress })}</p>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </Card>
        </DashboardSection>

        <DashboardSection
          title={t('employeeDashboard.personalNotifications')}
          description={t('employeeDashboard.notificationsDesc')}
        >
          <Card padding={false}>
            <div className="p-4">
              {notifications.length === 0 ? (
                <EmptyState
                  title={t('employeeDashboard.noNotifications')}
                  description={t('employeeDashboard.notificationsAppear')}
                  icon={Bell}
                />
              ) : (
                <ul className="flex flex-col gap-3">
                  {notifications.slice(0, 4).map((n) => (
                    <li
                      key={n.id}
                      className={
                        'flex items-start gap-3 rounded-md border p-3 ' +
                        (n.read
                          ? 'border-neutral-200 bg-white'
                          : 'border-brand-200 bg-brand-50/40')
                      }
                    >
                      <span className="inline-flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-md bg-brand-50 text-brand-600">
                        <FileText className="h-4 w-4" aria-hidden="true" />
                      </span>
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-medium text-neutral-900">{n.title}</p>
                        {n.description && (
                          <p className="mt-0.5 line-clamp-2 text-[13px] text-neutral-600">
                            {n.description}
                          </p>
                        )}
                        <p className="mt-1 text-xs text-neutral-500">{formatDate(n.createdAt, 'vi-VN')}</p>
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </Card>
        </DashboardSection>
      </div>

      {/* Phase 27 — các summary mới */}
      <DashboardSection
        title={t('employeeDashboard.otherModules')}
        description={t('employeeDashboard.otherModulesDesc')}
        className="mb-6"
      >
        <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-3">
          {/* Evaluation */}
          <SummaryCard
            title={t('employeeDashboard.evaluationsTab')}
            icon={ClipboardCheck}
            actions={
              <Button
                variant="ghost" size="sm" icon={ArrowRight} iconPosition="right"
                onClick={() => navigate('/employee/evaluations')}
              >{t('employeeDashboard.open')}</Button>
            }
          >
            {evaluations.length === 0 ? (
              <EmptyState title={t('employeeDashboard.noEvaluationsYet')} description={t('employeeDashboard.noPublishedCycles')} />
            ) : (
              <ul className="flex flex-col gap-2">
                {evaluations.map((ev) => (
                  <li key={ev.id} className="rounded-md border border-neutral-200 p-3">
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-sm font-medium text-neutral-900">
                        {ev.cycleId || t('employeeDashboard.evaluationCycle')}
                      </span>
                      <Badge tone={ev.status === 'completed' ? 'success' : 'warning'}>
                        {ev.status || '—'}
                      </Badge>
                    </div>
                    {ev.averageScore != null && (
                      <p className="mt-1 text-xs text-neutral-600">
                        {t('employeeDashboard.avgScore', { n: ev.averageScore })}
                      </p>
                    )}
                    <p className="mt-1 text-xs text-neutral-500">
                      {formatDate(ev.publishedAt || ev.updatedAt || ev.createdAt)}
                    </p>
                  </li>
                ))}
              </ul>
            )}
          </SummaryCard>

          {/* Promotion */}
          <SummaryCard
            title={t('employeeDashboard.promotionsTab')}
            icon={Award}
            actions={
              <Button
                variant="ghost" size="sm" icon={ArrowRight} iconPosition="right"
                onClick={() => navigate('/employee/promotions')}
              >{t('employeeDashboard.open')}</Button>
            }
          >
            {promotions.length === 0 ? (
              <EmptyState title={t('employeeDashboard.noPromotionData')} />
            ) : (
              <ul className="flex flex-col gap-2">
                {promotions.map((p) => (
                  <li key={p.id} className="rounded-md border border-neutral-200 p-3">
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-sm font-medium text-neutral-900">
                        {p.proposedPosition || '—'}
                      </span>
                      <Badge tone={PROMO_TONE[p.status] || 'neutral'}>
                        {p.status === 'approved' ? t('promotions.statusApproved') : p.status === 'pending' ? t('promotions.statusSuggested') : p.status === 'rejected' ? t('promotions.statusRejected') : t('promotions.statusApplied')}
                      </Badge>
                    </div>
                    <p className="mt-1 text-xs text-neutral-600">
                      {t('employeeDashboard.currentPosition')}: {p.currentPosition || '—'}
                    </p>
                    <p className="mt-0.5 text-xs text-neutral-500">
                      {t('employeeDashboard.effective')}: {formatDate(p.effectiveDate) || '—'}
                    </p>
                  </li>
                ))}
              </ul>
            )}
          </SummaryCard>

          {/* Internal Applications */}
          <SummaryCard
            title={t('employeeDashboard.internalJobsTab')}
            icon={Briefcase}
            actions={
              <Button
                variant="ghost" size="sm" icon={ArrowRight} iconPosition="right"
                onClick={() => navigate('/employee/jobs')}
              >{t('employeeDashboard.open')}</Button>
            }
          >
            {applications.total === 0 ? (
              <EmptyState title={t('employeeDashboard.noInternalApplications')} />
            ) : (
              <>
                <p className="text-sm text-neutral-600">
                  {t('employeeDashboard.totalApplications', { n: applications.total })}
                </p>
                <ul className="mt-2 flex flex-col gap-2">
                  {applications.recent.map((a) => (
                    <li key={a.id} className="rounded-md border border-neutral-200 p-3">
                      <div className="flex items-center justify-between gap-2">
                        <span className="text-sm font-medium text-neutral-900">
                          {a.jobId || '—'}
                        </span>
                        <Badge tone={APP_TONE[a.status] || 'neutral'}>
                          {a.status === 'new' ? t('jobs.newStatus') : a.status === 'screening' ? t('jobs.screeningStatus') : a.status === 'interview' ? t('jobs.interviewStatus') : a.status === 'offer' ? t('jobs.offerStatus') : a.status === 'hired' ? t('jobs.hiredStatus') : t('jobs.rejectedStatus')}
                        </Badge>
                      </div>
                      <p className="mt-0.5 text-xs text-neutral-500">
                        {t('employeeDashboard.appliedDate', { n: formatDate(a.appliedAt || a.createdAt) || '—' })}
                      </p>
                    </li>
                  ))}
                </ul>
              </>
            )}
          </SummaryCard>

          {/* Benefits */}
          <SummaryCard
            title={t('employeeDashboard.benefitsTab')}
            icon={Gift}
            actions={
              <Button
                variant="ghost" size="sm" icon={ArrowRight} iconPosition="right"
                onClick={() => navigate('/employee/benefits')}
              >{t('employeeDashboard.open')}</Button>
            }
          >
            {benefits.length === 0 ? (
              <EmptyState title={t('employeeDashboard.noBenefitsAssigned')} description={t('employeeDashboard.hrWillAssignBenefits')} />
            ) : (
              <p className="text-sm text-neutral-700">
                {t('employeeDashboard.activeBenefits', { n: benefits.length })}
              </p>
            )}
          </SummaryCard>

          {/* Contracts */}
          <SummaryCard
            title={t('employeeDashboard.contractsTab')}
            icon={BadgeCheck}
            actions={
              <Button
                variant="ghost" size="sm" icon={ArrowRight} iconPosition="right"
                onClick={() => navigate('/employee/contracts')}
              >{t('employeeDashboard.open')}</Button>
            }
          >
            {contracts.length === 0 ? (
              <EmptyState title={t('employeeDashboard.noContracts')} />
            ) : (
              <ul className="flex flex-col gap-2">
                {contracts.slice(0, 2).map((c) => (
                  <li key={c.id} className="rounded-md border border-neutral-200 p-3">
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-sm font-medium text-neutral-900">
                        {c.contractType || '—'}
                      </span>
                      <Badge tone={c.status === 'active' ? 'success' : 'neutral'}>
                        {c.status || '—'}
                      </Badge>
                    </div>
                    <p className="mt-1 text-xs text-neutral-500">
                      {t('employeeDashboard.contractDateRange', { n: formatDate(c.startDate) || '—', m: formatDate(c.endDate) || '—' })}
                    </p>
                  </li>
                ))}
              </ul>
            )}
          </SummaryCard>

          {/* Support */}
          <SummaryCard
            title={t('employeeDashboard.supportTab')}
            icon={Headset}
            actions={
              <Button
                variant="ghost" size="sm" icon={ArrowRight} iconPosition="right"
                onClick={() => navigate('/employee/support')}
              >{t('employeeDashboard.open')}</Button>
            }
          >
            <div className="grid grid-cols-2 gap-2 text-xs">
              <Counter label={t('employeeDashboard.supportOpen')} value={support.open} />
              <Counter label={t('employeeDashboard.supportInProgress')} value={support.in_progress} />
              <Counter label={t('employeeDashboard.supportWaiting')} value={support.waiting} />
              <Counter label={t('employeeDashboard.supportResolved')} value={support.resolved} />
            </div>
          </SummaryCard>
        </div>
      </DashboardSection>
    </>
  )
}

function KpiTile({ label, value, icon: Icon, tone = 'primary', note }) {
  return (
    <div className="flex min-h-[112px] flex-col gap-3 rounded-lg border border-neutral-200 bg-white p-5 shadow-card">
      <div className="flex items-start justify-between gap-3">
        <span className="text-[13px] font-medium text-neutral-500">{label}</span>
        {Icon && (
          <span
            className={
              'inline-flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-md ' +
              TONE_BG[tone]
            }
          >
            <Icon className="h-[18px] w-[18px]" aria-hidden="true" />
          </span>
        )}
      </div>
      <div className="text-[22px] font-bold leading-tight text-neutral-900">{value}</div>
      {note && <div className="text-xs text-neutral-500">{note}</div>}
    </div>
  )
}

const TONE_BG = {
  primary: 'bg-brand-50 text-brand-700',
  success: 'bg-success-50 text-success-600',
  warning: 'bg-warning-50 text-warning-600',
  danger:  'bg-danger-50 text-danger-600',
  info:    'bg-info-50 text-info-600',
}

function earliestDueDate(trainings) {
  return trainings
    .map((t) => t.dueAt)
    .filter(Boolean)
    .sort()[0]
}

function QuickAction({ icon: Icon, label, onClick }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="flex flex-col items-center gap-2 rounded-lg border border-neutral-200 bg-white p-3 text-center transition hover:border-brand-300 hover:bg-brand-50/40"
    >
      <span className="inline-flex h-9 w-9 items-center justify-center rounded-md bg-brand-50 text-brand-700">
        <Icon className="h-[18px] w-[18px]" aria-hidden="true" />
      </span>
      <span className="text-xs font-medium text-neutral-900">{label}</span>
    </button>
  )
}

function SummaryCard({ title, icon: Icon, actions, children }) {
  return (
    <Card>
      <header className="mb-2 flex items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          {Icon && <Icon className="h-4 w-4 text-brand-600" aria-hidden="true" />}
          <h3 className="text-sm font-semibold text-neutral-900">{title}</h3>
        </div>
        {actions}
      </header>
      {children}
    </Card>
  )
}

function Counter({ label, value }) {
  return (
    <div className="rounded-md border border-neutral-200 bg-white px-3 py-2">
      <p className="text-[11px] uppercase tracking-wider text-neutral-500">{label}</p>
      <p className="mt-0.5 text-base font-bold text-neutral-900">{value}</p>
    </div>
  )
}