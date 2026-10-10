import { useI18n } from '../../i18n/useI18n'
import Badge from '../common/Badge'
import { PROMOTION_STATUSES, PROMOTION_STATUS_TONE } from '../../data/promotionData'

/**
 * PromotionStatusBadge - dùng cho status pending/approved/rejected/cancelled.
 */
export default function PromotionStatusBadge({ value, className = '' }) {
  const { t } = useI18n()
  const found = PROMOTION_STATUSES.find((s) => s.value === value)
  const labelMap = {
    pending:   t('promotions.component.promotionStatusPending'),
    approved:  t('promotions.component.promotionStatusApproved'),
    rejected:  t('promotions.component.promotionStatusRejected'),
    cancelled: t('promotions.component.promotionStatusCancelled'),
  }
  if (!found) return <Badge tone="neutral" className={className}>{value ?? '—'}</Badge>
  return (
    <Badge tone={PROMOTION_STATUS_TONE[value] ?? 'neutral'} className={className}>
      {labelMap[value] ?? found.label}
    </Badge>
  )
}