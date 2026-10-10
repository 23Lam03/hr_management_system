import { Eye } from 'lucide-react'

import Card from '../common/Card'
import Button from '../common/Button'
import EmptyState from '../common/EmptyState'
import PromotionStatusBadge from './PromotionStatusBadge'
import { useI18n } from '../../i18n/useI18n'
import { formatDate } from '../../utils/format'

/**
 * PromotionCardList - danh sách card cho Employee tracking.
 */
export default function PromotionCardList({ items, onView }) {
  const { t } = useI18n()
  if (!items || items.length === 0) {
    return (
      <Card>
        <EmptyState
          title={t('promotions.component.noPromotionRecordsFound')}
          description={t('promotions.component.noPromotionRecordsYet')}
        />
      </Card>
    )
  }

  return (
    <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
      {items.map((p) => (
        <Card key={p.id} className="flex flex-col gap-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <PromotionStatusBadge value={p.status} />
            <span className="text-[13px] text-neutral-500">
              {t('promotions.component.effective', { date: formatDate(p.effectiveDate) || '—' })}
            </span>
          </div>

          <div className="flex flex-col gap-1">
            <div className="text-[13px] text-neutral-500">
              {t('promotions.component.current', { position: p.currentPosition || '—' })}
            </div>
            <div className="text-sm font-medium text-neutral-900">
              {t('promotions.component.proposed', { position: p.proposedPosition })}
            </div>
            <div className="text-[13px] text-neutral-500">
              {t('promotions.component.department', { dept: p.proposedDepartment || p.currentDepartment || '—' })}
            </div>
          </div>

          {p.reason ? (
            <p className="line-clamp-3 rounded-md bg-neutral-50 px-3 py-2 text-[13px] text-neutral-700">
              {p.reason}
            </p>
          ) : null}

          <div className="flex justify-end">
            <Button
              variant="outline"
              size="sm"
              icon={Eye}
              onClick={() => onView?.(p)}
            >
              {t('promotions.component.viewDetail')}
            </Button>
          </div>
        </Card>
      ))}
    </div>
  )
}
