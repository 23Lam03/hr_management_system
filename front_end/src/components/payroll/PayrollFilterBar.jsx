import { useEffect, useState } from 'react'
import { Search, X } from 'lucide-react'

import Input from '../common/Input'
import Select from '../common/Select'
import Button from '../common/Button'
import { classNames } from '../../utils/format'
import { useI18n } from '../../i18n/useI18n'

export default function PayrollFilterBar({
  search,
  onSearchChange,
  month,
  onMonthChange,
  year,
  onYearChange,
  departmentId,
  onDepartmentChange,
  paymentStatus,
  onPaymentStatusChange,
  departments = [],
  statuses = [],
  yearOptions = [],
  monthOptions = [],
  showDepartment = true,
  onClear,
  total = 0,
  searchPlaceholder,
  extra,
}) {
  const { t } = useI18n()
  const [local, setLocal] = useState(search)
  useEffect(() => setLocal(search), [search])

  useEffect(() => {
    const t_timer = setTimeout(() => {
      if (local !== search) onSearchChange(local)
    }, 250)
    return () => clearTimeout(t_timer)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [local])

  const isDirty =
    Boolean(search || month || year || departmentId || paymentStatus)

  const resolvedPlaceholder = searchPlaceholder || t('payrollComponent.searchPlaceholder')

  return (
    <div
      className={classNames(
        'flex flex-col gap-3 rounded-lg border border-neutral-200 bg-white p-4 shadow-card',
      )}
    >
      <div className="flex flex-col gap-3 md:flex-row md:items-end">
        <div className="flex-1 min-w-0">
          <Input
            label={t('payrollComponent.search')}
            placeholder={resolvedPlaceholder}
            value={local}
            onChange={(e) => setLocal(e.target.value)}
            leftIcon={Search}
          />
        </div>
        <div className="grid grid-cols-2 gap-3 md:flex md:w-auto">
          <Select
            label={t('payrollComponent.month')}
            value={month || ''}
            onChange={(e) => onMonthChange(e.target.value)}
            placeholder={t('payrollComponent.allMonths')}
            options={[{ value: '', label: t('payrollComponent.allMonths') }, ...monthOptions]}
          />
          <Select
            label={t('payrollComponent.year')}
            value={year || ''}
            onChange={(e) => onYearChange(e.target.value)}
            placeholder={t('payrollComponent.allYears')}
            options={[{ value: '', label: t('payrollComponent.allYears') }, ...yearOptions]}
          />
        </div>
      </div>
      <div
        className={`grid grid-cols-1 gap-3 ${showDepartment ? 'sm:grid-cols-2' : 'sm:grid-cols-1'}`}
      >
        <Select
          label={t('payrollComponent.paymentStatus')}
          value={paymentStatus}
          onChange={(e) => onPaymentStatusChange(e.target.value)}
          placeholder={t('payrollComponent.allStatuses')}
          options={[
            { value: '', label: t('payrollComponent.allStatuses') },
            ...statuses.map((s) => ({ value: s.value, label: s.label })),
          ]}
        />
        {showDepartment && (
          <Select
            label={t('payrollComponent.department')}
            value={departmentId}
            onChange={(e) => onDepartmentChange(e.target.value)}
            placeholder={t('payrollComponent.allDepartments')}
            options={[
              { value: '', label: t('payrollComponent.allDepartments') },
              ...departments.map((d) => ({ value: d.id, label: d.name })),
            ]}
          />
        )}
        {extra}
      </div>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-[13px] text-neutral-500">
          {t('payrollComponent.found')} <b className="text-neutral-900">{total}</b> {t('payrollComponent.payrollsFound')}
        </p>
        {isDirty && (
          <Button variant="ghost" size="sm" icon={X} onClick={onClear}>
            {t('payrollComponent.clearFilters')}
          </Button>
        )}
      </div>
    </div>
  )
}
