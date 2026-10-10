import {
  Briefcase,
  CheckCircle2,
  ClipboardList,
  UserCheck,
} from 'lucide-react'

import StatCard from '../common/StatCard'
import { useI18n } from '../../i18n/useI18n'

/**
 * RecruitmentSummaryTiles - top-level summary.
 */
export default function RecruitmentSummaryTiles({ summary }) {
  const { t } = useI18n()
  if (!summary) return null
  return (
    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
      <StatCard
        label={t('recruitment.component.totalPositions')}
        value={summary.totalJobs}
        icon={Briefcase}
        tone="primary"
        delta={`${t('recruitment.component.openN', { n: summary.openJobs })} · ${t('recruitment.component.pausedN', { n: summary.pausedJobs })} · ${t('recruitment.component.closedN', { n: summary.closedJobs })}`}
      />
      <StatCard
        label={t('recruitment.component.openPositions')}
        value={summary.openJobs}
        icon={CheckCircle2}
        tone="success"
      />
      <StatCard
        label={t('recruitment.component.totalApplications')}
        value={summary.totalApplications}
        icon={ClipboardList}
        tone="info"
      />
      <StatCard
        label={t('recruitment.component.candidatesInterviewing')}
        value={summary.applicationsByStatus?.interview ?? 0}
        icon={UserCheck}
        tone="warning"
        delta={`${t('recruitment.component.newN', { n: summary.applicationsByStatus?.new ?? 0 })} · ${t('recruitment.component.screeningN', { n: summary.applicationsByStatus?.screening ?? 0 })}`}
      />
    </div>
  )
}
