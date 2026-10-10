import { useEffect, useState } from 'react'
import { Search, X } from 'lucide-react'

import Input from '../common/Input'
import Select from '../common/Select'
import Button from '../common/Button'
import { useI18n } from '../../i18n/useI18n'

export default function BenefitFilterBar({
  search,
  onSearchChange,
  type,
  onTypeChange,
  status,
  onStatusChange,
  startDateFrom,
  startDateTo,
  onStartDateFromChange,
  onStartDateToChange,
  departmentId,
  onDepartmentChange,
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
    const t_timer = setTimeout(() => {
      if (local !== search) onSearchChange(local)
    }, 250)
    return () => clearTimeout(t_timer)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [local])

  const isDirty = Boolean(
    search || type || status || startDateFrom || startDateTo || departmentId,
  )

  return (
    <div className="flex flex-col gap-3 rounded-lg border border-neutral-200 bg-white p-4 shadow-card">
      <div className="flex flex-col gap-3 md:flex-row md:items-end">
        <div className="flex-1 min-w-0">
          <Input
            label={t('benefitsComponent.search')}
            placeholder={t('benefitsComponent.searchPlaceholder')}
            value={local}
            onChange={(e) => setLocal(e.target.value)}
            leftIcon={Search}
          />
        </div>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 md:flex md:flex-1">
          <Input
            label={t('benefitsComponent.startDateFrom')}
            type="date"
            value={startDateFrom || ''}
            onChange={(e) => onStartDateFromChange(e.target.value)}
          />
          <Input
            label={t('benefitsComponent.startDateTo')}
            type="date"
            value={startDateTo || ''}
            onChange={(e) => onStartDateToChange(e.target.value)}
          />
        </div>
      </div>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        <Select
          label={t('benefitsComponent.benefitTypeLabel')}
          value={type}
          onChange={(e) => onTypeChange(e.target.value)}
          options={[
            { value: '', label: t('benefitsComponent.allTypes') },
            ...types.map((tp) => ({ value: tp.value, label: tp.label })),
          ]}
        />
        <Select
          label={t('benefitsComponent.statusSelect')}
          value={status}
          onChange={(e) => onStatusChange(e.target.value)}
          options={[
            { value: '', label: t('benefitsComponent.allStatuses') },
            ...statuses.map((s) => ({ value: s.value, label: s.label })),
          ]}
        />
        <Select
          label={t('benefitsComponent.department')}
          value={departmentId}
          onChange={(e) => onDepartmentChange(e.target.value)}
          options={[
            { value: '', label: t('benefitsComponent.allDepts') },
            ...departments.map((d) => ({ value: d.id, label: d.name })),
          ]}
        />
      </div>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-[13px] text-neutral-500">
          {t('benefitsComponent.found')} <b className="text-neutral-900">{total}</b> {t('benefitsComponent.results')}
        </p>
        {isDirty && (
          <Button variant="ghost" size="sm" icon={X} onClick={onClear}>
            {t('benefitsComponent.clearFilters')}
          </Button>
        )}
      </div>
    </div>
  )
}
