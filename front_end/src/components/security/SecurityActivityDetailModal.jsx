import Modal from '../common/Modal'
import SecurityActivityTypeBadge from './SecurityActivityTypeBadge'
import SecurityActivityStatusBadge from './SecurityActivityStatusBadge'
import { formatDateTime } from '../../utils/format'
import { useI18n } from '../../i18n/useI18n'

/**
 * SecurityActivityDetailModal - hiển thị chi tiết 1 activity.
 */
export default function SecurityActivityDetailModal({ open, onClose, activity }) {
  const { t } = useI18n()
  if (!activity) return null
  return (
    <Modal
      open={open}
      onClose={onClose}
      title={t('security.component.securityDetail')}
      description={`${t('security.component.activityCode')}: ${activity.id}`}
      size="md"
    >
      <div className="flex flex-col gap-5">
        <div className="flex flex-wrap items-center gap-2">
          <SecurityActivityTypeBadge type={activity.type} />
          <SecurityActivityStatusBadge status={activity.status} />
        </div>

        <div className="rounded-md bg-neutral-50 px-4 py-3 text-sm text-neutral-700">
          {activity.description}
        </div>

        <dl className="grid grid-cols-1 gap-3 text-sm sm:grid-cols-2">
          <div>
            <dt className="text-xs text-neutral-500">{t('security.component.actor')}</dt>
            <dd className="text-neutral-900">{activity.actorName}</dd>
          </div>
          <div>
            <dt className="text-xs text-neutral-500">{t('security.component.actorId')}</dt>
            <dd className="font-mono text-xs text-neutral-700">{activity.actorId}</dd>
          </div>
          <div>
            <dt className="text-xs text-neutral-500">{t('security.component.ip')}</dt>
            <dd className="font-mono text-xs text-neutral-700">{activity.ipAddress}</dd>
          </div>
          <div>
            <dt className="text-xs text-neutral-500">{t('security.component.time')}</dt>
            <dd className="text-neutral-900">{formatDateTime(activity.createdAt)}</dd>
          </div>
          <div className="sm:col-span-2">
            <dt className="text-xs text-neutral-500">{t('security.component.userAgent')}</dt>
            <dd className="text-xs text-neutral-700">{activity.userAgent}</dd>
          </div>
        </dl>
      </div>
    </Modal>
  )
}