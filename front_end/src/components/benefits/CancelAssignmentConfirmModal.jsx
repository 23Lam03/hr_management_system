import { AlertTriangle } from 'lucide-react'

import Modal from '../common/Modal'
import Button from '../common/Button'
import Avatar from '../common/Avatar'
import { useI18n } from '../../i18n/useI18n'

export default function CancelAssignmentConfirmModal({
  open,
  onClose,
  assignment,
  onConfirm,
  submitting = false,
}) {
  const { t } = useI18n()

  if (!assignment) return null

  return (
    <Modal
      open={open}
      onClose={onClose}
      size="md"
      title={t('benefitsComponent.cancelBenefitTitle')}
      description={t('benefitsComponent.cancelBenefitDesc')}
      footer={
        <>
          <Button variant="secondary" onClick={onClose} disabled={submitting}>{t('benefitsComponent.close')}</Button>
          <Button variant="danger" onClick={onConfirm} loading={submitting}>
            {t('benefitsComponent.confirmCancel')}
          </Button>
        </>
      }
    >
      <div className="flex items-start gap-3 rounded-md border border-warning-200 bg-warning-50 px-4 py-3 text-sm text-warning-700">
        <AlertTriangle className="mt-0.5 h-4 w-4 flex-shrink-0" aria-hidden="true" />
        <p>{t('benefitsComponent.cancelWarning')}</p>
      </div>
      <div className="mt-4 flex items-center gap-3 rounded-md border border-neutral-200 bg-white p-3">
        <Avatar name={assignment.employeeName} size="md" />
        <div>
          <p className="text-sm font-semibold text-neutral-900">{assignment.employeeName}</p>
          <p className="text-[12px] text-neutral-500">
            {assignment.employeeCode} · {assignment.departmentName}
          </p>
        </div>
      </div>
      <dl className="mt-4 grid grid-cols-1 gap-2 text-sm text-neutral-700">
        <div className="flex justify-between"><dt className="text-neutral-500">{t('benefitsComponent.start')}</dt><dd>{assignment.startDate}</dd></div>
        <div className="flex justify-between"><dt className="text-neutral-500">{t('benefitsComponent.end')}</dt><dd>{assignment.endDate || '—'}</dd></div>
        <div className="flex justify-between"><dt className="text-neutral-500">{t('benefitsComponent.currentStatusLabel')}</dt><dd>{assignment.status}</dd></div>
      </dl>
    </Modal>
  )
}
