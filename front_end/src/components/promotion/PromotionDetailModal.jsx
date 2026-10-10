import Modal from '../common/Modal'
import PromotionStatusBadge from './PromotionStatusBadge'
import { useI18n } from '../../i18n/useI18n'
import { formatDate, formatDateTime } from '../../utils/format'

/**
 * PromotionDetailModal - hiển thị chi tiết promotion.
 */
export default function PromotionDetailModal({
  open,
  onClose,
  promotion,
  employee = null,
  showInternalNote = true,
  footer = null,
}) {
  const { t } = useI18n()
  if (!promotion) return null
  const missing = !employee

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={employee?.fullName ?? t('promotions.component.employeeNotFound')}
      description={t('promotions.component.promotionCode', { id: promotion.id })}
      size="lg"
      footer={footer}
    >
      <div className="flex flex-col gap-4">
        <div className="flex flex-wrap items-center gap-2">
          <PromotionStatusBadge value={promotion.status} />
        </div>

        <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
          <Field label={t('promotions.component.employee')}>
            {missing
              ? <span className="text-sm text-neutral-500">{t('promotions.component.employeeNotFound')}</span>
              : (
                <span className="text-sm">
                  <span className="font-medium text-neutral-900">{employee.fullName}</span>
                  <span className="ml-2 text-[11px] text-neutral-500">
                    {employee.employeeCode ? `${employee.employeeCode} · ` : ''}{promotion.employeeId}
                  </span>
                </span>
              )
            }
          </Field>
          <Field label={t('promotions.component.effectiveDate')}>{formatDate(promotion.effectiveDate) || '—'}</Field>
          <Field label={t('promotions.component.currentPosition')}>{promotion.currentPosition || '—'}</Field>
          <Field label={t('promotions.component.proposedPosition')}>{promotion.proposedPosition}</Field>
          <Field label={t('promotions.component.currentDepartment')}>{promotion.currentDepartment || '—'}</Field>
          <Field label={t('promotions.component.proposedDepartment')}>{promotion.proposedDepartment || promotion.currentDepartment || '—'}</Field>
        </div>

        <section>
          <h4 className="mb-1 text-[13px] font-semibold uppercase tracking-wider text-neutral-500">
            {t('promotions.component.reason')}
          </h4>
          <p className="whitespace-pre-line rounded-md bg-neutral-50 px-3 py-2 text-sm text-neutral-800">
            {promotion.reason}
          </p>
        </section>

        {showInternalNote && promotion.note ? (
          <section>
            <h4 className="mb-1 text-[13px] font-semibold uppercase tracking-wider text-neutral-500">
              {t('promotions.component.internalNote')}
            </h4>
            <p className="whitespace-pre-line rounded-md bg-warning-50 px-3 py-2 text-warning-800">
              {promotion.note}
            </p>
          </section>
        ) : null}

        <section className="rounded-md border border-neutral-200 bg-neutral-50 px-3 py-2 text-[13px] text-neutral-500">
          <div>{t('promotions.component.createdBy')}: <span className="font-medium text-neutral-700">{promotion.createdBy}</span></div>
          <div>{t('promotions.component.createdAt')}: <span className="font-medium text-neutral-700">{formatDateTime(promotion.createdAt)}</span></div>
          <div>{t('promotions.component.lastUpdated')}: <span className="font-medium text-neutral-700">{formatDateTime(promotion.updatedAt)}</span></div>
        </section>
      </div>
    </Modal>
  )
}

function Field({ label, children }) {
  return (
    <div className="rounded-md border border-neutral-200 bg-white px-3 py-2">
      <p className="text-[11px] uppercase tracking-wider text-neutral-500">{label}</p>
      <div className="mt-0.5 text-sm text-neutral-900">{children}</div>
    </div>
  )
}
