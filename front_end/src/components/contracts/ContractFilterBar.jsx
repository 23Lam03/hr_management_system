import { useEffect, useState } from 'react'
import { Search, X } from 'lucide-react'

import Input from '../common/Input'
import Select from '../common/Select'
import Button from '../common/Button'

import { useI18n } from '../../i18n/useI18n'

export default function ContractFilterBar({
  search,
  onSearchChange,
  departmentId,
  onDepartmentChange,
  contractType,
  onContractTypeChange,
  status,
  onStatusChange,
  effectiveFrom,
  effectiveTo,
  onEffectiveFromChange,
  onEffectiveToChange,
  expiringWithinDays,
  onExpiringWithinDaysChange,
  types = [],
  statuses = [],
  departments = [],
  onClear,
  total = 0,
}) {
  const { t } = useI18n()
  const [local, setLocal] = useState(search)
  useEffect(() => setLocal(search), [search])

  useEffect(() => {
    const timer = setTimeout(() => {
      if (local !== search) onSearchChange(local)
    }, 250)
    return () => clearTimeout(timer)
  }, [local])

  const isDirty = Boolean(
    search || departmentId || contractType || status || effectiveFrom || effectiveTo || (expiringWithinDays !== '' && expiringWithinDays !== null),
  )

  return (
    <div className="flex flex-col gap-3 rounded-lg border border-neutral-200 bg-white p-4 shadow-card">
      <div className="flex flex-col gap-3 md:flex-row md:items-end">
        <div className="flex-1 min-w-0">
          <Input
            label={t('common.search')}
            placeholder={t('contracts.searchPlaceholder')}
            value={local}
            onChange={(e) => setLocal(e.target.value)}
            leftIcon={Search}
          />
        </div>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 md:flex md:flex-1">
          <Input
            label={t('contracts.effectiveDate')}
            type="date"
            value={effectiveFrom || ''}
            onChange={(e) => onEffectiveFromChange(e.target.value)}
          />
          <Input
            label={t('evaluations.toDate')}
            type="date"
            value={effectiveTo || ''}
            onChange={(e) => onEffectiveToChange(e.target.value)}
          />
        </div>
      </div>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Select
          label={t('contracts.department')}
          value={departmentId}
          onChange={(e) => onDepartmentChange(e.target.value)}
          options={[
            { value: '', label: t('contracts.allDepartments') },
            ...departments.map((d) => ({ value: d.id, label: d.name })),
          ]}
        />
        <Select
          label={t('contracts.contractType')}
          value={contractType}
          onChange={(e) => onContractTypeChange(e.target.value)}
          options={[
            { value: '', label: t('contracts.allTypes') },
            ...types.map((ty) => ({ value: ty.value, label: ty.label })),
          ]}
        />
        <Select
          label={t('contracts.status')}
          value={status}
          onChange={(e) => onStatusChange(e.target.value)}
          options={[
            { value: '', label: t('contracts.allStatuses') },
            ...statuses.map((s) => ({ value: s.value, label: s.label })),
          ]}
        />
        <Select
          label={t('contracts.expiringWithin')}
          value={expiringWithinDays ?? ''}
          onChange={(e) => onExpiringWithinDaysChange(e.target.value)}
          options={[
            { value: '', label: t('contracts.all') },
            { value: '7', label: t('contracts.within7Days') },
            { value: '30', label: t('contracts.within30Days') },
            { value: '60', label: t('contracts.within60Days') },
            { value: '90', label: t('contracts.within90Days') },
          ]}
        />
      </div>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-[13px] text-neutral-500">
          {t('evaluations.found', { count: total })}
        </p>
        {isDirty && (
          <Button variant="ghost" size="sm" icon={X} onClick={onClear}>
            {t('evaluations.clearFilters')}
          </Button>
        )}
      </div>
    </div>
  )
}
