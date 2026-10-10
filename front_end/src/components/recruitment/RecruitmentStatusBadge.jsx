import { useI18n } from '../../i18n/useI18n'
import Badge from '../common/Badge'
import {
  JOB_STATUSES,
  JOB_STATUS_TONE,
  APPLICATION_STATUSES,
  APPLICATION_STATUS_TONE,
} from '../../data/recruitmentData'

/**
 * RecruitmentStatusBadge - badge cho Job status hoặc Application status.
 *
 * Props:
 * - kind: 'job' | 'application'
 * - value: status value
 */
export default function RecruitmentStatusBadge({ kind, value, className = '' }) {
  const { t } = useI18n()
  const list = kind === 'job' ? JOB_STATUSES : APPLICATION_STATUSES
  const toneMap = kind === 'job' ? JOB_STATUS_TONE : APPLICATION_STATUS_TONE
  const found = list.find((s) => s.value === value)
  if (!found) return <Badge tone="neutral" className={className}>{value ?? '—'}</Badge>
  return (
    <Badge tone={toneMap[value] ?? 'neutral'} className={className}>
      {found.label}
    </Badge>
  )
}