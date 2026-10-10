import { useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  Users,
  UserCheck2,
  Building2,
  FileClock,
  TrendingUp,
  LayoutDashboard,
} from 'lucide-react'

import PageHeader from '../../components/common/PageHeader'
import Card from '../../components/common/Card'
import Button from '../../components/common/Button'
import { useI18n } from '../../i18n/useI18n'

import DashboardSection from '../../components/dashboard/DashboardSection'
import AttendanceChartLazy from '../../components/dashboard/lazyCharts'
import DepartmentChartLazy from '../../components/dashboard/lazyCharts'
import RecentEmployeesTable from '../../components/dashboard/RecentEmployeesTable'
import RecentActivities from '../../components/dashboard/RecentActivities'
import PendingLeaveTable from '../../components/dashboard/PendingLeaveTable'
import QuickActions from '../../components/dashboard/QuickActions'

import {
  getAdminOverview,
  getRecentEmployees,
  getPendingLeaveRequests,
  getRecentActivities,
} from '../../services/dashboardService'

export default function AdminDashboardPage() {
  const { t } = useI18n()
  const navigate = useNavigate()
  const [rangeId, setRangeId] = useState('7d')
  const [loading] = useState(false)

  const overview = useMemo(() => getAdminOverview(), [])
  const recentEmployees = useMemo(() => getRecentEmployees(5), [])
  const pendingLeaves = useMemo(() => getPendingLeaveRequests(5), [])
  const activities = useMemo(() => getRecentActivities(6), [])

  const stats = overview.stats

  const RANGE_OPTIONS = [
    { id: '7d', label: t('admin.range7d') },
    { id: '30d', label: t('admin.range30d') },
  ]

  return (
    <>
      <PageHeader
        title={t('admin.dashboardTitle')}
        subtitle={t('admin.dashboardSubtitle')}
        icon={LayoutDashboard}
        actions={
          <div className="flex items-center gap-2">
            <div className="inline-flex rounded-md border border-neutral-200 bg-white p-0.5 text-sm">
              {RANGE_OPTIONS.map((r) => (
                <button
                  key={r.id}
                  type="button"
                  onClick={() => setRangeId(r.id)}
                  className={
                    'h-8 rounded-md px-3 text-[13px] font-medium transition ' +
                    (rangeId === r.id
                      ? 'bg-brand-600 text-white shadow-sm'
                      : 'text-neutral-600 hover:text-neutral-900')
                  }
                >
                  {r.label}
                </button>
              ))}
            </div>
            <Button
              variant="secondary"
              onClick={() => navigate('/admin/employees')}
            >
              {t('admin.manageEmployees')}
            </Button>
          </div>
        }
      />

      {/* Hàng KPI */}
      <DashboardSection className="mb-6">
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <StatTile
            label={t('admin.statTotal')}
            value={stats.totalEmployees}
            icon={Users}
            tone="primary"
            note={t('admin.noteTotal')}
          />
          <StatTile
            label={t('admin.statActive')}
            value={stats.activeEmployees}
            icon={UserCheck2}
            tone="success"
            note={t('admin.noteActive', { n: stats.totalEmployees - stats.activeEmployees })}
          />
          <StatTile
            label={t('admin.statDepartments')}
            value={stats.departments}
            icon={Building2}
            tone="info"
            note={t('admin.noteDepartments')}
          />
          <StatTile
            label={t('admin.statPendingLeaves')}
            value={stats.pendingLeaves}
            icon={FileClock}
            tone="warning"
            note={t('admin.notePendingLeaves')}
          />
        </div>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
          <KpiCard
            label={t('admin.kpiAttendanceRate')}
            value={`${stats.attendanceRate}%`}
            icon={TrendingUp}
            tone={stats.attendanceRate >= 90 ? 'success' : stats.attendanceRate >= 80 ? 'warning' : 'danger'}
            note={t('admin.noteAttendanceRate', { n: stats.activeEmployees })}
          />
          <KpiCard
            label={t('admin.kpiNewHires')}
            value={stats.newHiresThisMonth}
            icon={UserCheck2}
            tone="primary"
            note={t('admin.noteNewHires')}
          />
          <KpiCard
            label={t('admin.kpiProcessedLeaves')}
            value={pendingLeaves.length === 0 ? stats.pendingLeaves : stats.pendingLeaves}
            icon={FileClock}
            tone="info"
            note={t('admin.noteProcessedLeaves')}
          />
        </div>
      </DashboardSection>

      {/* Hàng Quick actions */}
      <DashboardSection title={t('admin.quickActionsTitle')} className="mb-6">
        <Card padding>
          <QuickActions />
        </Card>
      </DashboardSection>

      {/* Hàng biểu đồ */}
      <div className="mb-6 grid grid-cols-1 gap-4 xl:grid-cols-3">
        <DashboardSection
          title={t('admin.attendance7dTitle')}
          description={t('admin.attendance7dDesc')}
          className="xl:col-span-2"
        >
          <Card padding={false}>
            <div className="p-4">
              <AttendanceChartLazy data={overview.attendanceLast7Days} />
            </div>
          </Card>
        </DashboardSection>

        <DashboardSection
          title={t('admin.departmentTitle')}
          description={t('admin.departmentDesc')}
        >
          <Card padding={false}>
            <div className="p-4">
              <DepartmentChartLazy data={overview.departments} />
            </div>
          </Card>
        </DashboardSection>
      </div>

      {/* Hàng bảng + feed */}
      <div className="grid grid-cols-1 gap-4 xl:grid-cols-3">
        <DashboardSection
          title={t('admin.pendingLeaveTitle')}
          description={t('admin.pendingLeaveDesc')}
          actions={
            <Button
              variant="ghost"
              size="sm"
              onClick={() => navigate('/admin/leave')}
            >
              {t('admin.viewAll')}
            </Button>
          }
          className="xl:col-span-2"
        >
          <Card padding={false}>
            <div className="p-4">
              <PendingLeaveTable rows={pendingLeaves} loading={loading} />
            </div>
          </Card>
        </DashboardSection>

        <DashboardSection
          title={t('admin.recentActivityTitle')}
          description={t('admin.recentActivityDesc')}
        >
          <Card>
            <RecentActivities items={activities} />
          </Card>
        </DashboardSection>

        <DashboardSection
          title={t('admin.newEmployeesTitle')}
          description={t('admin.newEmployeesDesc')}
          actions={
            <Button
              variant="ghost"
              size="sm"
              onClick={() => navigate('/admin/employees')}
            >
              {t('admin.viewAll')}
            </Button>
          }
          className="xl:col-span-3"
        >
          <Card padding={false}>
            <div className="p-4">
              <RecentEmployeesTable rows={recentEmployees} loading={loading} />
            </div>
          </Card>
        </DashboardSection>
      </div>
    </>
  )
}

// --------- Internal helpers ----------------------------------------------
function StatTile({ label, value, icon: Icon, tone = 'primary', note }) {
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
      <div className="text-[28px] font-bold leading-tight text-neutral-900">
        {value}
      </div>
      {note && <div className="text-xs text-neutral-500">{note}</div>}
    </div>
  )
}

function KpiCard({ label, value, icon: Icon, tone = 'info', note }) {
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
      <div className="text-[22px] font-bold leading-tight text-neutral-900">
        {value}
      </div>
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
