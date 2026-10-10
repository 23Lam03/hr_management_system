import { useMemo, useRef, useState } from 'react'
import { Save, Wallet, TrendingUp, TrendingDown, FileEdit } from 'lucide-react'

import Input from '../common/Input'
import Select from '../common/Select'
import Button from '../common/Button'
import { useI18n } from '../../i18n/useI18n'

import { calcPayroll, normalizePayrollPayload } from '../../utils/payrollUtils'
import { formatCurrencyVnd } from '../../utils/format'

const EMPTY = {
  employeeId: '',
  month: '',
  year: new Date().getFullYear(),
  baseSalary: '',
  allowance: 0,
  bonus: 0,
  overtimePay: 0,
  insuranceDeduction: 0,
  taxDeduction: 0,
  otherDeduction: 0,
  note: '',
}

export default function PayrollForm({
  mode = 'create',
  initial,
  employees = [],
  onSubmit,
  onCancel,
  submitting = false,
  serverErrors = {},
  readOnly = false,
}) {
  const { t } = useI18n()
  const [values, setValues] = useState(() => {
    const v = initial ? { ...EMPTY, ...initial } : { ...EMPTY }
    for (const k of [
      'baseSalary', 'allowance', 'bonus', 'overtimePay',
      'insuranceDeduction', 'taxDeduction', 'otherDeduction',
    ]) {
      v[k] = v[k] === 0 || v[k] === null || v[k] === undefined ? '' : String(v[k])
    }
    return v
  })
  const [localErrors, setLocalErrors] = useState({})
  const submittedRef = useRef(false)

  const errors = useMemo(
    () => ({ ...localErrors, ...serverErrors }),
    [localErrors, serverErrors],
  )

  const totals = useMemo(
    () => calcPayroll(normalizePayrollPayload(values)),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [
      values.baseSalary, values.allowance, values.bonus, values.overtimePay,
      values.insuranceDeduction, values.taxDeduction, values.otherDeduction,
    ],
  )

  function setField(name, value) {
    if (readOnly) return
    setValues((prev) => ({ ...prev, [name]: value }))
    setLocalErrors((prev) => {
      if (!prev[name] && !serverErrors[name]) return prev
      const next = { ...prev }
      delete next[name]
      return next
    })
  }

  function handleSubmit(e) {
    e.preventDefault()
    if (submittedRef.current || submitting) return
    submittedRef.current = true
    onSubmit(values)
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-5" noValidate>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        <Select
          label={t('payrollComponent.employeeLabel')}
          required
          value={values.employeeId}
          onChange={(e) => setField('employeeId', e.target.value)}
          options={[
            { value: '', label: t('payrollComponent.selectEmployee') },
            ...employees.map((emp) => ({
              value: emp.id,
              label: emp.label,
            })),
          ]}
          error={errors.employeeId}
          disabled={mode === 'edit' || readOnly}
        />
        <Select
          label={t('payrollComponent.monthLabel')}
          required
          value={values.month}
          onChange={(e) => setField('month', e.target.value)}
          options={[
            { value: '', label: t('payrollComponent.selectMonth') },
            ...Array.from({ length: 12 }, (_, i) => ({
              value: String(i + 1),
              label: `${t('payrollComponent.month')} ${i + 1}`,
            })),
          ]}
          error={errors.month}
          disabled={mode === 'edit' || readOnly}
        />
        <Input
          label={t('payrollComponent.yearLabel')}
          required
          type="number"
          value={values.year || ''}
          onChange={(e) => setField('year', e.target.value)}
          error={errors.year}
          disabled={mode === 'edit' || readOnly}
        />
      </div>

      <fieldset className="rounded-lg border border-success-200 bg-success-50/40 p-4">
        <legend className="px-2 text-xs font-semibold uppercase tracking-wider text-success-700">
          {t('payrollComponent.incomeSectionLegend')}
        </legend>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <Input
            label={t('payrollComponent.baseSalaryLabel')}
            type="number"
            required
            value={values.baseSalary ?? ''}
            onChange={(e) => setField('baseSalary', e.target.value)}
            error={errors.baseSalary}
            leftIcon={Wallet}
            disabled={readOnly}
          />
          <Input
            label={t('payrollComponent.allowanceLabel')}
            type="number"
            value={values.allowance ?? ''}
            onChange={(e) => setField('allowance', e.target.value)}
            error={errors.allowance}
            leftIcon={Wallet}
            disabled={readOnly}
          />
          <Input
            label={t('payrollComponent.bonusLabel')}
            type="number"
            value={values.bonus ?? ''}
            onChange={(e) => setField('bonus', e.target.value)}
            error={errors.bonus}
            leftIcon={TrendingUp}
            disabled={readOnly}
          />
          <Input
            label={t('payrollComponent.overtimeLabel')}
            type="number"
            value={values.overtimePay ?? ''}
            onChange={(e) => setField('overtimePay', e.target.value)}
            error={errors.overtimePay}
            leftIcon={TrendingUp}
            disabled={readOnly}
          />
        </div>
      </fieldset>

      <fieldset className="rounded-lg border border-danger-200 bg-danger-50/40 p-4">
        <legend className="px-2 text-xs font-semibold uppercase tracking-wider text-danger-700">
          {t('payrollComponent.deductionSectionLegend')}
        </legend>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
          <Input
            label={t('payrollComponent.insuranceLabel')}
            type="number"
            value={values.insuranceDeduction ?? ''}
            onChange={(e) => setField('insuranceDeduction', e.target.value)}
            error={errors.insuranceDeduction}
            leftIcon={TrendingDown}
            disabled={readOnly}
          />
          <Input
            label={t('payrollComponent.taxLabel')}
            type="number"
            value={values.taxDeduction ?? ''}
            onChange={(e) => setField('taxDeduction', e.target.value)}
            error={errors.taxDeduction}
            leftIcon={TrendingDown}
            disabled={readOnly}
          />
          <Input
            label={t('payrollComponent.otherDeductionLabel')}
            type="number"
            value={values.otherDeduction ?? ''}
            onChange={(e) => setField('otherDeduction', e.target.value)}
            error={errors.otherDeduction}
            leftIcon={TrendingDown}
            disabled={readOnly}
          />
        </div>
      </fieldset>

      <Input
        label={t('payrollComponent.noteLabel')}
        placeholder={t('payrollComponent.notePlaceholder')}
        value={values.note ?? ''}
        onChange={(e) => setField('note', e.target.value)}
        leftIcon={FileEdit}
        disabled={readOnly}
      />

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        <SummaryCard
          tone="success"
          label={t('payrollComponent.totalIncomePreview')}
          value={formatCurrencyVnd(totals.grossSalary)}
        />
        <SummaryCard
          tone="danger"
          label={t('payrollComponent.totalDeductionPreview')}
          value={formatCurrencyVnd(totals.totalDeduction)}
        />
        <SummaryCard
          tone="primary"
          label={t('payrollComponent.netSalaryFormPreview')}
          value={formatCurrencyVnd(totals.netSalary)}
        />
      </div>

      {errors._form && (
        <p className="text-sm text-danger-600">{errors._form}</p>
      )}

      {!readOnly && (
        <div className="flex flex-wrap items-center justify-end gap-2 border-t border-neutral-200 pt-4">
          <Button variant="secondary" onClick={onCancel} disabled={submitting}>
            {t('payrollComponent.cancel')}
          </Button>
          <Button type="submit" icon={Save} loading={submitting}>
            {mode === 'edit' ? t('payrollComponent.saveChanges') : t('payrollComponent.createPayroll')}
          </Button>
        </div>
      )}
    </form>
  )
}

function SummaryCard({ tone, label, value }) {
  const toneClass = {
    success: 'bg-success-50 text-success-700 border-success-200',
    danger:  'bg-danger-50 text-danger-700 border-danger-200',
    primary: 'bg-brand-50 text-brand-700 border-brand-200',
  }[tone]
  return (
    <div className={`flex flex-col gap-1 rounded-md border px-3 py-2 ${toneClass}`}>
      <span className="text-xs font-medium uppercase tracking-wider opacity-80">{label}</span>
      <span className="text-base font-bold">{value}</span>
    </div>
  )
}
