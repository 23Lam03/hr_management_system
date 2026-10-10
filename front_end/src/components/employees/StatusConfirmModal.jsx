import { ArrowRight, AlertTriangle } from 'lucide-react'
import { useI18n } from '../../i18n/useI18n'

import Modal from '../common/Modal'
import Button from '../common/Button'

import StatusPill from './StatusPill'

import { EMPLOYMENT_STATUS_LABEL } from '../../data/employeeMockData'

/**
 * StatusConfirmModal - xác nhận đổi trạng thái nhân viên.
 */
export default function StatusConfirmModal({
  open,
  onClose,
  employee,
  targetStatus,
  onConfirm,
  submitting = false,
}) {
  const { t } = useI18n()
  if (!employee || !targetStatus) {
    return null
  }

  const fromLabel = EMPLOYMENT_STATUS_LABEL[employee.status] ?? employee.status
  const toLabel = EMPLOYMENT_STATUS_LABEL[targetStatus] ?? targetStatus

  return (
    <Modal
      open={open}
      onClose={onClose}
      size="md"
      title={t('employees.component.confirmStatusChange')}
      description={t('employees.component.aboutToChangeStatus', { n: employee.fullName })}
      footer={
        <>
          <Button variant="secondary" onClick={onClose} disabled={submitting}>
            {t('employees.component.cancel')}
          </Button>
          <Button variant="danger" onClick={onConfirm} loading={submitting}>
            {t('employees.component.confirm')}
          </Button>
        </>
      }
    >
      <div className="flex items-start gap-3 rounded-md border border-warning-200 bg-warning-50 px-4 py-3 text-sm text-warning-700">
        <AlertTriangle className="mt-0.5 h-4 w-4 flex-shrink-0" aria-hidden="true" />
        <p>
          {t('employees.component.thisWillUpdateWorkStatus')}
        </p>
      </div>
      <div className="mt-4 flex items-center justify-center gap-3 rounded-lg border border-neutral-200 bg-neutral-50 p-4">
        <div className="flex flex-col items-center gap-1">
          <span className="text-xs uppercase text-neutral-500">{t('employees.component.current')}</span>
          <StatusPill status={employee.status} />
          <span className="text-sm font-medium text-neutral-900">{fromLabel}</span>
        </div>
        <ArrowRight className="h-5 w-5 text-neutral-400" aria-hidden="true" />
        <div className="flex flex-col items-center gap-1">
          <span className="text-xs uppercase text-neutral-500">{t('employees.component.willChangeTo')}</span>
          <StatusPill status={targetStatus} />
          <span className="text-sm font-medium text-neutral-900">{toLabel}</span>
        </div>
      </div>
    </Modal>
  )
}