import { useEffect, useState } from 'react'
import { Search, X } from 'lucide-react'

import Input from '../common/Input'
import Select from '../common/Select'
import Button from '../common/Button'
import { classNames } from '../../utils/format'

import { useI18n } from '../../i18n/useI18n'

export default function EvaluationFilterBar({
  search,
  onSearchChange,
  status,
  onStatusChange,
  departmentId,
  onDepartmentChange,
  dateField = 'startDate',
  dateFrom,
  dateTo,
  onDateFromChange,
  onDateToChange,
  departments = [],
  statuses = [],
  showDepartment = true,
  onClear,
  total = 0,
  searchPlaceholder,
}) {
  const { t } = useI18n()
  const placeholder = searchPlaceholder || t('evaluations.searchPlaceholder')
  const [local, setLocal] = useState(search)
  useEffect(() => setLocal(search), [search])

  useEffect(() => {
    const timer = setTimeout(() => {
      if (local !== search) onSearchChange(local)
    }, 250)
    return () => clearTimeout(timer)
  }, [local])

  const isDirty = Boolean(search || status || departmentId || dateFrom || dateTo)

  return (
    <div className={classNames(
      'flex flex-col gap-3 rounded-lg border border-neutral-200 bg-white p-4 shadow-card',
    )}>
      <div className="flex flex-col gap-3 md:flex-row md:items-end">
        <div className="flex-1 min-w-0">
          <Input
            label={t('common.search')}
            placeholder={placeholder}
            value={local}
            onChange={(e) => setLocal(e.target.value)}
            leftIcon={Search}
          />
        </div>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 md:flex md:flex-1">
          <Input
            label={dateField === 'startDate' ? t('evaluations.startDateFrom') : t('evaluations.endDateDateTo')}
            type="date"
            value={dateFrom || ''}
            onChange={(e) => onDateFromChange(e.target.value)}
          />
          <Input
            label={t('evaluations.toDate')}
            type="date"
            value={dateTo || ''}
            onChange={(e) => onDateToChange(e.target.value)}
          />
        </div>
      </div>
      <div className={`grid grid-cols-1 gap-3 ${showDepartment ? 'sm:grid-cols-2' : 'sm:grid-cols-1'}`}>
        <Select
          label={t('evaluations.status')}
          value={status}
          onChange={(e) => onStatusChange(e.target.value)}
          placeholder={t('evaluations.allStatuses')}
          options={[
            { value: '', label: t('evaluations.allStatuses') },
            ...statuses.map((s) => ({ value: s.value, label: s.label })),
          ]}
        />
        {showDepartment && (
          <Select
            label={t('evaluations.department')}
            value={departmentId}
            onChange={(e) => onDepartmentChange(e.target.value)}
            placeholder={t('evaluations.allDepartments')}
            options={[
              { value: '', label: t('evaluations.allDepartments') },
              ...departments.map((d) => ({ value: d.id, label: d.name })),
            ]}
          />
        )}
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
