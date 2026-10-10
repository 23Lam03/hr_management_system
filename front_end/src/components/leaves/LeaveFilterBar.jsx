import { useEffect, useState } from 'react'
import { Search, X } from 'lucide-react'

import Input from '../common/Input'
import Select from '../common/Select'
import Button from '../common/Button'
import { classNames } from '../../utils/format'
import { useI18n } from '../../i18n/useI18n'

export default function LeaveFilterBar({
  search,
  onSearchChange,
  status,
  onStatusChange,
  leaveType,
  onLeaveTypeChange,
  departmentId,
  onDepartmentChange,
  dateField = 'startDate',
  dateFrom,
  dateTo,
  onDateFromChange,
  onDateToChange,
  departments = [],
  statuses = [],
  types = [],
  showDepartment = true,
  onClear,
  total = 0,
  searchPlaceholder,
}) {
  const { t } = useI18n()
  const placeholder = searchPlaceholder || t('leaves.component.filterSearchPlaceholder')
  const [local, setLocal] = useState(search)
  useEffect(() => setLocal(search), [search])

  useEffect(() => {
    const timer = setTimeout(() => {
      if (local !== search) onSearchChange(local)
    }, 250)
    return () => clearTimeout(timer)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [local])

  const isDirty = Boolean(search || status || leaveType || departmentId || dateFrom || dateTo)

  const dateFieldLabel = dateField === 'createdAt'
    ? t('leaves.component.submittedDateFilter')
    : t('leaves.component.startDateFilter')

  return (
    <div className={classNames(
      'flex flex-col gap-3 rounded-lg border border-neutral-200 bg-white p-4 shadow-card',
    )}>
      <div className="flex flex-col gap-3 md:flex-row md:items-end">
        <div className="flex-1 min-w-0">
          <Input
            label={t('leaves.component.filterSearch')}
            placeholder={placeholder}
            value={local}
            onChange={(e) => setLocal(e.target.value)}
            leftIcon={Search}
          />
        </div>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <Input
            label={dateFieldLabel}
            type="date"
            value={dateFrom || ''}
            onChange={(e) => onDateFromChange(e.target.value)}
          />
          <Input
            label={t('leaves.component.dateToLabel')}
            type="date"
            value={dateTo || ''}
            onChange={(e) => onDateToChange(e.target.value)}
          />
        </div>
      </div>
      <div className={`grid grid-cols-1 gap-3 ${showDepartment ? 'sm:grid-cols-3' : 'sm:grid-cols-2'}`}>
        <Select
          label={t('leaves.component.statusFilter')}
          value={status}
          onChange={(e) => onStatusChange(e.target.value)}
          placeholder={t('leaves.component.allStatuses')}
          options={[{ value: '', label: t('leaves.component.allStatuses') }, ...statuses.map((s) => ({ value: s.value, label: s.label }))]}
        />
        <Select
          label={t('leaves.component.leaveTypeFilter')}
          value={leaveType}
          onChange={(e) => onLeaveTypeChange(e.target.value)}
          placeholder={t('leaves.component.allTypes')}
          options={[{ value: '', label: t('leaves.component.allTypes') }, ...types.map((tp) => ({ value: tp.value, label: tp.label }))]}
        />
        {showDepartment && (
          <Select
            label={t('leaves.component.departmentFilter')}
            value={departmentId}
            onChange={(e) => onDepartmentChange(e.target.value)}
            placeholder={t('leaves.component.allDepartments')}
            options={[{ value: '', label: t('leaves.component.allDepartments') }, ...departments.map((d) => ({ value: d.id, label: d.name }))]}
          />
        )}
      </div>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-[13px] text-neutral-500">
          {t('leaves.component.foundRequests', { n: total })}
        </p>
        {isDirty && (
          <Button variant="ghost" size="sm" icon={X} onClick={onClear}>
            {t('leaves.component.clearFilters')}
          </Button>
        )}
      </div>
    </div>
  )
}
