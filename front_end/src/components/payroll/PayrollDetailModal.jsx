import {
  Wallet,
  TrendingUp,
  TrendingDown,
  Banknote,
  CalendarDays,
  FileEdit,
  CheckCircle2,
  User,
  Building2,
} from 'lucide-react'

import Modal from '../common/Modal'
import Button from '../common/Button'
import PaymentStatusPill from './PaymentStatusPill'

import { formatCurrencyVnd, formatDate } from '../../utils/format'
import { useMemo } from 'react'
import { getEmployeeById } from '../../services/employeeService'
import { useI18n } from '../../i18n/useI18n'

export default function PayrollDetailModal({
  open,
  onClose,
  record,
  isAdminView = false,
  onEdit,
  onMarkPaid,
  approvalActions,
}) {
  const { t } = useI18n()
  const employee = useMemo(() => (record ? getEmployeeById(record.employeeId) : null), [record])

  if (!record) {
    return (
      <Modal open={open} onClose={onClose} title={t('payrollComponent.notFound')} size="md">
        <p className="text-sm text-neutral-600">{t('payrollComponent.notFoundDesc')}</p>
      </Modal>
    )
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      size="xl"
      title={t('payrollComponent.payrollDetail')}
      description={`${record.payrollCode} · Kỳ T${String(record.month).padStart(2, '0')}/${record.year}`}
      footer={
        <>
          <Button variant="secondary" onClick={() => window.print()}>
            {t('payrollComponent.printPayslip')}
          </Button>
          <Button variant="secondary" onClick={onClose}>{t('payrollComponent.close')}</Button>
          {isAdminView && record.paymentStatus !== 'paid' && (
            <>
              {onEdit && (
                <Button variant="primary" onClick={() => onEdit(record.id)}>
                  {t('payrollComponent.edit')}
                </Button>
              )}
              {onMarkPaid && (
                <Button onClick={() => onMarkPaid(record.id)}>{t('payrollComponent.markPaid')}</Button>
              )}
            </>
          )}
          {approvalActions}
        </>
      }
    >
      <div className="flex flex-col gap-5 print:p-0">
        <div className="flex items-center justify-between gap-4 rounded-md border border-neutral-200 bg-neutral-50 px-4 py-3">
          <div className="flex items-center gap-3">
            <span className="inline-flex h-10 w-10 items-center justify-center rounded-md bg-brand-50 text-brand-600">
              <User className="h-5 w-5" aria-hidden="true" />
            </span>
            <div className="min-w-0">
              <h3 className="truncate text-base font-semibold text-neutral-900">
                {employee?.fullName ?? record.employeeName}
              </h3>
              <p className="text-[13px] text-neutral-500">
                {record.employeeCode} · {record.departmentName}
              </p>
            </div>
          </div>
          <PaymentStatusPill status={record.paymentStatus} />
        </div>

        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          <Info icon={CalendarDays} label={t('payrollComponent.salaryPeriod')} value={`T${String(record.month).padStart(2, '0')}/${record.year}`} />
          <Info icon={Building2} label={t('payrollComponent.payrollCode')} value={record.payrollCode} />
          <Info icon={Wallet} label={t('payrollComponent.paymentDate')} value={record.paymentDate ? formatDate(record.paymentDate) : '—'} />
          <Info icon={FileEdit} label={t('payrollComponent.note')} value={record.note || '—'} />
        </div>

        <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
          <Section
            title={t('payrollComponent.incomeSection')}
            tone="success"
            icon={TrendingUp}
            rows={[
              [t('payrollComponent.baseSalary'),     record.baseSalary],
              [t('payrollComponent.allowance'),      record.allowance],
              [t('payrollComponent.bonus'),          record.bonus],
              [t('payrollComponent.overtimePay'),    record.overtimePay],
            ]}
            totalLabel={t('payrollComponent.totalIncome')}
            total={record.grossSalary}
          />
          <Section
            title={t('payrollComponent.deductionSection')}
            tone="danger"
            icon={TrendingDown}
            rows={[
              [t('payrollComponent.insuranceDeduction'), record.insuranceDeduction],
              [t('payrollComponent.taxDeduction'),        record.taxDeduction],
              [t('payrollComponent.otherDeduction'),      record.otherDeduction],
            ]}
            totalLabel={t('payrollComponent.totalDeduction')}
            total={record.totalDeduction}
          />
        </div>

        <div className="flex items-center justify-between rounded-md border border-brand-200 bg-brand-50 px-5 py-4">
          <div className="flex items-center gap-3">
            <span className="inline-flex h-10 w-10 items-center justify-center rounded-md bg-white text-brand-600">
              <Banknote className="h-5 w-5" aria-hidden="true" />
            </span>
            <div>
              <p className="text-xs font-semibold uppercase tracking-wider text-brand-700">
                {t('payrollComponent.netSalaryPreview')}
              </p>
              <p className="text-[13px] text-neutral-600">
                {t('payrollComponent.netSalaryNote')}
              </p>
            </div>
          </div>
          <span className="text-2xl font-bold text-brand-700">
            {formatCurrencyVnd(record.netSalary)}
          </span>
        </div>

        {record.paymentStatus === 'paid' && (
          <div className="flex items-center gap-2 rounded-md border border-success-200 bg-success-50 px-4 py-3 text-sm text-success-700">
            <CheckCircle2 className="h-4 w-4" aria-hidden="true" />
            <span>
              {t('payrollComponent.paidOn', { n: formatDate(record.paymentDate) })}
            </span>
          </div>
        )}
      </div>
    </Modal>
  )
}

function Info({ icon: Icon, label, value }) {
  return (
    <div>
      <p className="text-xs font-medium uppercase tracking-wider text-neutral-500">{label}</p>
      <p className="mt-1 flex items-center gap-2 text-sm text-neutral-900">
        {Icon && <Icon className="h-4 w-4 flex-shrink-0 text-neutral-400" aria-hidden="true" />}
        <span className="break-words">{value}</span>
      </p>
    </div>
  )
}

function Section({ title, tone, icon: Icon, rows, totalLabel, total }) {
  const toneClass = tone === 'success'
    ? 'border-success-200 bg-success-50/40'
    : 'border-danger-200 bg-danger-50/40'
  const headerTone = tone === 'success' ? 'text-success-700' : 'text-danger-700'
  return (
    <div className={`rounded-lg border p-4 ${toneClass}`}>
      <div className={`mb-3 flex items-center gap-2 text-xs font-semibold uppercase tracking-wider ${headerTone}`}>
        <Icon className="h-4 w-4" aria-hidden="true" />
        <span>{title}</span>
      </div>
      <ul className="space-y-2">
        {rows.map(([label, value]) => (
          <li key={label} className="flex items-center justify-between gap-3 text-sm text-neutral-700">
            <span>{label}</span>
            <span className="font-medium text-neutral-900">{formatCurrencyVnd(value)}</span>
          </li>
        ))}
      </ul>
      <div className="mt-3 flex items-center justify-between border-t border-neutral-200/70 pt-3">
        <span className={`text-sm font-semibold ${headerTone}`}>{totalLabel}</span>
        <span className={`text-base font-bold ${headerTone}`}>{formatCurrencyVnd(total)}</span>
      </div>
    </div>
  )
}
