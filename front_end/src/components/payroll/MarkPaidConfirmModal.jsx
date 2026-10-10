import { Banknote, AlertTriangle } from 'lucide-react'

import Modal from '../common/Modal'
import Button from '../common/Button'
import { useI18n } from '../../i18n/useI18n'

import { formatCurrencyVnd } from '../../utils/format'

export default function MarkPaidConfirmModal({
  open,
  onClose,
  record,
  onConfirm,
  submitting = false,
  paymentDate,
  onChangePaymentDate,
}) {
  const { t } = useI18n()

  if (!record) return null

  return (
    <Modal
      open={open}
      onClose={onClose}
      size="md"
      title={t('payrollComponent.confirmPayment')}
      description={t('payrollComponent.confirmPaymentDesc', { n: record.payrollCode, m: String(record.month).padStart(2, '0'), y: record.year })}
      footer={
        <>
          <Button variant="secondary" onClick={onClose} disabled={submitting}>{t('common.cancel')}</Button>
          <Button onClick={onConfirm} loading={submitting} icon={Banknote}>{t('payrollComponent.markAsPaid')}</Button>
        </>
      }
    >
      <div className="flex items-start gap-3 rounded-md border border-success-200 bg-success-50 px-4 py-3 text-sm text-success-700">
        <Banknote className="mt-0.5 h-4 w-4 flex-shrink-0" aria-hidden="true" />
        <p>{t('payrollComponent.confirmPaymentNote')}</p>
      </div>
      <dl className="mt-4 grid grid-cols-1 gap-2 text-sm text-neutral-700">
        <div className="flex justify-between"><dt className="text-neutral-500">{t('payrollComponent.employee')}:</dt><dd className="font-medium text-neutral-900">{record.employeeName}</dd></div>
        <div className="flex justify-between"><dt className="text-neutral-500">{t('payrollComponent.employeeCode')}:</dt><dd>{record.employeeCode}</dd></div>
        <div className="flex justify-between"><dt className="text-neutral-500">{t('payrollComponent.salaryPeriod')}:</dt><dd>T{String(record.month).padStart(2, '0')}/{record.year}</dd></div>
        <div className="flex justify-between"><dt className="text-neutral-500">{t('payrollComponent.netSalary')}:</dt><dd className="font-semibold text-neutral-900">{formatCurrencyVnd(record.netSalary)}</dd></div>
      </dl>
      <div className="mt-4">
        <label htmlFor="payment-date" className="mb-1.5 block text-[13px] font-medium text-neutral-900">
          {t('payrollComponent.paymentDate')}
        </label>
        <input
          id="payment-date"
          type="date"
          value={paymentDate || ''}
          onChange={(e) => onChangePaymentDate?.(e.target.value)}
          className="h-10 w-full rounded-md border border-neutral-200 bg-white px-3 text-sm text-neutral-700 focus:border-brand-600 focus:outline-none focus:ring-2 focus:ring-brand-600/20"
        />
      </div>
      <div className="mt-3 flex items-start gap-2 text-[13px] text-neutral-500">
        <AlertTriangle className="mt-0.5 h-3.5 w-3.5 flex-shrink-0" aria-hidden="true" />
        <span>{t('payrollComponent.demoPaymentNote')}</span>
      </div>
    </Modal>
  )
}
