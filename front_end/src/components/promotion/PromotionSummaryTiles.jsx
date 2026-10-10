import {
  Award,
  CheckCircle2,
  ClipboardList,
  Hourglass,
  XCircle,
} from 'lucide-react'

import StatCard from '../common/StatCard'
import { useI18n } from '../../i18n/useI18n'

/**
 * PromotionSummaryTiles - 4 card tổng quan.
 */
export default function PromotionSummaryTiles({ summary }) {
  const { t } = useI18n()
  if (!summary) return null
  return (
    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
      <StatCard
        label={t('promotions.component.totalPromotions')}
        value={summary.total}
        icon={ClipboardList}
        tone="primary"
      />
      <StatCard
        label={t('promotions.component.pending')}
        value={summary.pending}
        icon={Hourglass}
        tone="warning"
      />
      <StatCard
        label={t('promotions.component.approved')}
        value={summary.approved}
        icon={CheckCircle2}
        tone="success"
      />
      <StatCard
        label={t('promotions.component.rejected')}
        value={summary.rejected}
        icon={XCircle}
        tone="danger"
        delta={t('promotions.component.cancelledN', { n: summary.cancelled ?? 0 })}
      />
    </div>
  )
}

void Award
