import { Eye, Pencil, Banknote } from 'lucide-react'

import PaymentStatusPill from './PaymentStatusPill'
import Badge from '../common/Badge'
import { useI18n } from '../../i18n/useI18n'

import { formatCurrencyVnd, formatDate } from '../../utils/format'

const APPROVAL_LABEL = {
  pending: 'pending',
  approved: 'approved',
  rejected: 'rejected',
}
const APPROVAL_TONE = {
  pending: 'warning',
  approved: 'success',
  rejected: 'danger',
}

export default function PayrollTable({
  rows,
  loading,
  onView,
  onEdit,
  onMarkPaid,
  isAdminView = true,
}) {
  const { t } = useI18n()

  return (
    <div className="w-full overflow-x-auto rounded-lg border border-neutral-200 bg-white shadow-card">
      <table className="w-full border-separate border-spacing-0 text-sm text-neutral-700">
        <thead>
          <tr>
            <th className="border-b border-neutral-200 bg-neutral-50 px-4 py-3 text-xs font-semibold uppercase tracking-wider text-neutral-500 whitespace-nowrap">{t('payrollComponent.employee')}</th>
            <th className="border-b border-neutral-200 bg-neutral-50 px-4 py-3 text-xs font-semibold uppercase tracking-wider text-neutral-500 whitespace-nowrap">{t('payrollComponent.empCode')}</th>
            <th className="border-b border-neutral-200 bg-neutral-50 px-4 py-3 text-xs font-semibold uppercase tracking-wider text-neutral-500 whitespace-nowrap">{t('payrollComponent.dept')}</th>
            <th className="border-b border-neutral-200 bg-neutral-50 px-4 py-3 text-xs font-semibold uppercase tracking-wider text-neutral-500 whitespace-nowrap">{t('payrollComponent.period')}</th>
            <th className="border-b border-neutral-200 bg-neutral-50 px-4 py-3 text-xs font-semibold uppercase tracking-wider text-neutral-500 whitespace-nowrap text-right">{t('payrollComponent.basePay')}</th>
            <th className="border-b border-neutral-200 bg-neutral-50 px-4 py-3 text-xs font-semibold uppercase tracking-wider text-neutral-500 whitespace-nowrap text-right">{t('payrollComponent.totalIncomeCol')}</th>
            <th className="border-b border-neutral-200 bg-neutral-50 px-4 py-3 text-xs font-semibold uppercase tracking-wider text-neutral-500 whitespace-nowrap text-right">{t('payrollComponent.totalDeductionCol')}</th>
            <th className="border-b border-neutral-200 bg-neutral-50 px-4 py-3 text-xs font-semibold uppercase tracking-wider text-neutral-500 whitespace-nowrap text-right">{t('payrollComponent.netPay')}</th>
            <th className="border-b border-neutral-200 bg-neutral-50 px-4 py-3 text-xs font-semibold uppercase tracking-wider text-neutral-500 whitespace-nowrap text-center">{t('payrollComponent.status')}</th>
            <th className="border-b border-neutral-200 bg-neutral-50 px-4 py-3 text-xs font-semibold uppercase tracking-wider text-neutral-500 whitespace-nowrap text-right">{t('payrollComponent.actions')}</th>
          </tr>
        </thead>
        <tbody>
          {loading && (
            <tr>
              <td colSpan={10} className="px-4 py-10 text-center text-sm text-neutral-500">
                {t('payrollComponent.loading')}
              </td>
            </tr>
          )}
          {!loading && rows.length === 0 && (
            <tr>
              <td colSpan={10} className="px-4 py-10 text-center text-sm text-neutral-500">
                {t('payrollComponent.emptyRows')}
              </td>
            </tr>
          )}
          {!loading && rows.map((row) => (
            <tr key={row.id} className="group">
              <td className="border-b border-neutral-200 px-4 py-3 align-middle group-hover:bg-neutral-50">
                <div className="flex min-w-[200px] flex-col">
                  <span className="font-medium text-neutral-900">{row.employeeName}</span>
                  <span className="font-mono text-[13px] text-neutral-500">{row.payrollCode}</span>
                </div>
              </td>
              <td className="border-b border-neutral-200 px-4 py-3 align-middle group-hover:bg-neutral-50">
                {row.employeeCode}
              </td>
              <td className="border-b border-neutral-200 px-4 py-3 align-middle group-hover:bg-neutral-50">
                {row.departmentName}
              </td>
              <td className="border-b border-neutral-200 px-4 py-3 align-middle group-hover:bg-neutral-50 whitespace-nowrap">
                T{String(row.month).padStart(2, '0')}/{row.year}
              </td>
              <td className="border-b border-neutral-200 px-4 py-3 text-right align-middle group-hover:bg-neutral-50 whitespace-nowrap">
                {formatCurrencyVnd(row.baseSalary)}
              </td>
              <td className="border-b border-neutral-200 px-4 py-3 text-right align-middle group-hover:bg-neutral-50 whitespace-nowrap">
                {formatCurrencyVnd(row.grossSalary)}
              </td>
              <td className="border-b border-neutral-200 px-4 py-3 text-right align-middle group-hover:bg-neutral-50 whitespace-nowrap">
                {formatCurrencyVnd(row.totalDeduction)}
              </td>
              <td className="border-b border-neutral-200 px-4 py-3 text-right align-middle group-hover:bg-neutral-50 font-semibold text-neutral-900 whitespace-nowrap">
                {formatCurrencyVnd(row.netSalary)}
              </td>
              <td className="border-b border-neutral-200 px-4 py-3 text-center align-middle group-hover:bg-neutral-50">
                <div className="flex flex-col items-center gap-1">
                  <PaymentStatusPill status={row.paymentStatus} />
                  {isAdminView && row.approvalStatus && (
                    <Badge tone={APPROVAL_TONE[row.approvalStatus]}>
                      {t(`payrollComponent.${APPROVAL_LABEL[row.approvalStatus]}`)}
                    </Badge>
                  )}
                  {row.paymentStatus === 'paid' && row.paymentDate && (
                    <span className="text-[11px] text-neutral-500">
                      {formatDate(row.paymentDate)}
                    </span>
                  )}
                </div>
              </td>
              <td className="border-b border-neutral-200 px-4 py-3 text-right align-middle group-hover:bg-neutral-50">
                <div className="inline-flex items-center gap-1">
                  <button
                    type="button"
                    onClick={() => onView(row.id)}
                    aria-label={t('payrollComponent.viewDetailAria', { n: row.payrollCode })}
                    className="inline-flex h-8 w-8 items-center justify-center rounded-md text-neutral-500 hover:bg-neutral-100 hover:text-neutral-900"
                  >
                    <Eye className="h-4 w-4" aria-hidden="true" />
                  </button>
                  {isAdminView && row.paymentStatus !== 'paid' && onEdit && (
                    <button
                      type="button"
                      onClick={() => onEdit(row.id)}
                      aria-label={t('payrollComponent.editPayslipAria', { n: row.payrollCode })}
                      className="inline-flex h-8 items-center gap-1 rounded-md bg-brand-50 px-2 text-xs font-medium text-brand-700 hover:bg-brand-100"
                    >
                      <Pencil className="h-3.5 w-3.5" aria-hidden="true" />
                      <span>{t('payrollComponent.edit')}</span>
                    </button>
                  )}
                  {isAdminView && row.paymentStatus !== 'paid' && onMarkPaid && (
                    <button
                      type="button"
                      onClick={() => onMarkPaid(row.id)}
                      aria-label={t('payrollComponent.markPaidAria', { n: row.payrollCode })}
                      className="inline-flex h-8 items-center gap-1 rounded-md bg-success-500 px-2 text-xs font-medium text-white hover:bg-success-600"
                    >
                      <Banknote className="h-3.5 w-3.5" aria-hidden="true" />
                      <span>{t('payrollComponent.pay')}</span>
                    </button>
                  )}
                </div>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
