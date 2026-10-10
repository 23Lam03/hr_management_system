import {
  Users,
  CalendarCheck,
  Wallet,
  FileText,
  GraduationCap,
  Gift,
  FileSignature,
} from 'lucide-react'

import Card from '../common/Card'
import ReportSummary from './ReportSummary'
import { formatCurrencyVnd, formatNumber } from '../../utils/format'
import { useI18n } from '../../i18n/useI18n'

/**
 * SystemOverviewSection - top-level overview.
 */
export default function SystemOverviewSection({ overview = {} }) {
  const { t } = useI18n()
  const emp = overview.employees ?? { total: 0, active: 0, inactive: 0 }
  const att = overview.attendance ?? { total: 0, byStatus: {} }
  const pay = overview.payroll ?? { total: 0, gross: 0, deduction: 0, net: 0 }
  const lv  = overview.leave ?? { total: 0, byStatus: {} }
  const tr  = overview.training ?? { total: 0 }
  const bn  = overview.benefit ?? { total: 0 }
  const ct  = overview.contract ?? { total: 0 }

  const items = [
    {
      label: t('reports.component.totalEmployeesN'),
      value: formatNumber(emp.total),
      Icon: Users,
      sub: `${t('reports.component.activeN', { n: emp.active })} · ${t('reports.component.inactiveN', { n: emp.inactive })}`,
      toneClass: 'bg-brand-50 text-brand-600',
    },
    {
      label: t('reports.component.attendanceRecords'),
      value: formatNumber(att.total),
      Icon: CalendarCheck,
      sub: subAttendance(att.byStatus, t),
      toneClass: 'bg-info-50 text-info-600',
    },
    {
      label: t('reports.component.payrollSheets'),
      value: formatNumber(pay.total),
      Icon: Wallet,
      sub: t('reports.component.totalNetN', { n: formatCurrencyVnd(pay.net) }),
      toneClass: 'bg-warning-50 text-warning-600',
    },
    {
      label: t('reports.component.leaveRequests'),
      value: formatNumber(lv.total),
      Icon: FileText,
      sub: subLeave(lv.byStatus, t),
      toneClass: 'bg-success-50 text-success-600',
    },
    {
      label: t('reports.component.trainingCourses'),
      value: formatNumber(tr.total),
      Icon: GraduationCap,
      toneClass: 'bg-brand-50 text-brand-600',
    },
    {
      label: t('reports.component.benefits'),
      value: formatNumber(bn.total),
      Icon: Gift,
      toneClass: 'bg-warning-50 text-warning-600',
    },
    {
      label: t('reports.component.contracts'),
      value: formatNumber(ct.total),
      Icon: FileSignature,
      toneClass: 'bg-info-50 text-info-600',
    },
  ]

  return (
    <Card
      title={t('reports.component.systemOverviewTitle')}
      subtitle={t('reports.component.systemOverviewSubtitle')}
    >
      <ReportSummary items={items} columns={4} />
    </Card>
  )
}

function subAttendance(byStatus = {}, t) {
  const present = (byStatus.on_time ?? 0) + (byStatus.late ?? 0) + (byStatus.early_leave ?? 0)
  const absent = byStatus.absent ?? 0
  const leave = byStatus.on_leave ?? 0
  return `${t('reports.component.presentN', { n: present })} · ${t('reports.component.absentN', { n: absent })} · ${t('reports.component.onLeaveN', { n: leave })}`
}

function subLeave(byStatus = {}, t) {
  const approved = byStatus.approved ?? 0
  const pending = byStatus.pending ?? 0
  const rejected = byStatus.rejected ?? 0
  return `${t('reports.component.approvedN', { n: approved })} · ${t('reports.component.pendingN', { n: pending })} · ${t('reports.component.rejectedN', { n: rejected })}`
}
