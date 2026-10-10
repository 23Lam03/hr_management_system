import { ArrowRight, CalendarClock, CheckCircle2 } from 'lucide-react'
import { useI18n } from '../../i18n/useI18n'

import Modal from '../common/Modal'
import SupportCategoryBadge from './SupportCategoryBadge'
import SupportPriorityBadge from './SupportPriorityBadge'
import SupportStatusBadge from './SupportStatusBadge'
import SupportConversation from './SupportConversation'
import { formatDateTime } from '../../utils/format'
import { relatedEntityRoute, relatedEntityLabel } from '../../utils/notificationUtils'

/**
 * SupportDetailModal - hiển thị chi tiết yêu cầu hỗ trợ + conversation.
 *
 * Props:
 * - open, onClose
 * - request
 * - currentRole
 * - currentUserId
 * - canReply: bool
 * - onReply(message)
 * - requesterName(id)
 * - adminName(id)
 */
export default function SupportDetailModal({
  open,
  onClose,
  request,
  currentRole,
  currentUserId,
  canReply,
  onReply,
  requesterName,
  adminName,
}) {
  const { t } = useI18n()
  if (!request) return null
  const link = relatedEntityRoute(request.category, currentRole)
  const entityLabel = relatedEntityLabel(request.category)

  const handleViewRelated = () => {
    if (!link) return
    onClose?.()
    if (typeof window !== 'undefined') {
      window.location.href = link
    }
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={request.subject}
      description={`${t('support.component.requestCode')}: ${request.id}`}
      size="xl"
    >
      <div className="flex flex-col gap-5">
        <div className="flex flex-wrap items-center gap-2">
          <SupportCategoryBadge category={request.category} />
          <SupportPriorityBadge priority={request.priority} />
          <SupportStatusBadge status={request.status} />
        </div>

        <div className="rounded-md bg-neutral-50 px-4 py-3 text-sm text-neutral-700">
          {request.description}
        </div>

        <dl className="grid grid-cols-1 gap-3 text-sm sm:grid-cols-2">
          <div>
            <dt className="text-xs text-neutral-500">{t('support.component.requester')}</dt>
            <dd className="text-neutral-900">{requesterName?.(request.requesterId) ?? request.requesterId}</dd>
          </div>
          <div>
            <dt className="text-xs text-neutral-500">{t('support.component.handler')}</dt>
            <dd className="text-neutral-900">
              {request.assignedTo
                ? adminName?.(request.assignedTo) ?? request.assignedTo
                : <span className="text-neutral-400">—</span>}
            </dd>
          </div>
          <div>
            <dt className="text-xs text-neutral-500">{t('support.component.createdDate')}</dt>
            <dd className="inline-flex items-center gap-1 text-neutral-900">
              <CalendarClock className="h-4 w-4 text-neutral-400" aria-hidden="true" />
              {formatDateTime(request.createdAt)}
            </dd>
          </div>
          <div>
            <dt className="text-xs text-neutral-500">{t('support.component.updated')}</dt>
            <dd className="text-neutral-900">{formatDateTime(request.updatedAt)}</dd>
          </div>
          {request.resolvedAt && (
            <div>
              <dt className="text-xs text-neutral-500">{t('support.component.resolvedAt')}</dt>
              <dd className="inline-flex items-center gap-1 text-success-700">
                <CheckCircle2 className="h-4 w-4" aria-hidden="true" />
                {formatDateTime(request.resolvedAt)}
              </dd>
            </div>
          )}
        </dl>

        {link && (
          <div className="flex items-center justify-between rounded-md border border-neutral-200 bg-white px-4 py-3 text-sm">
            <div>
              <p className="text-xs text-neutral-500">{t('support.component.relatedModule')}</p>
              <p className="text-neutral-900">{entityLabel}</p>
            </div>
            <button
              type="button"
              onClick={handleViewRelated}
              className="inline-flex items-center gap-1 text-sm font-medium text-brand-600 hover:underline"
            >
              {t('support.component.viewDetail')}
              <ArrowRight className="h-3.5 w-3.5" aria-hidden="true" />
            </button>
          </div>
        )}

        <section>
          <h3 className="mb-2 text-sm font-semibold text-neutral-900">{t('support.component.supportConversation')}</h3>
          <SupportConversation
            messages={request.messages}
            currentRole={currentRole}
            currentUserId={currentUserId}
            canReply={canReply}
            onReply={onReply}
            employeeName={requesterName}
            adminName={adminName}
          />
        </section>
      </div>
    </Modal>
  )
}