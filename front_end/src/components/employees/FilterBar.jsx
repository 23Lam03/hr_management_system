import { useEffect, useState } from 'react'
import { Search } from 'lucide-react'
import { useI18n } from '../../i18n/useI18n'

import Input from '../common/Input'
import Select from '../common/Select'
import Button from '../common/Button'
import { classNames } from '../../utils/format'

/**
 * FilterBar - thanh tìm kiếm + bộ lọc + nút xoá.
 */
export default function FilterBar({
  search,
  onSearchChange,
  departmentId,
  onDepartmentChange,
  employmentType,
  onEmploymentTypeChange,
  status,
  onStatusChange,
  departments = [],
  employmentTypes = [],
  statuses = [],
  onClear,
  total = 0,
}) {
  const { t } = useI18n()
  const [local, setLocal] = useState(search)
  useEffect(() => {
    setLocal(search)
  }, [search])

  // Debounce 250ms cho input tìm kiếm
  useEffect(() => {
    const t = setTimeout(() => {
      if (local !== search) onSearchChange(local)
    }, 250)
    return () => clearTimeout(t)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [local])

  const isDirty = Boolean(departmentId || employmentType || status || search)

  return (
    <div className={classNames(
      'flex flex-col gap-3 rounded-lg border border-neutral-200 bg-white p-4 shadow-card',
    )}>
      <div className="flex flex-col gap-3 md:flex-row md:items-end">
        <div className="flex-1 min-w-0">
          <Input
            label={t('employees.component.search')}
            placeholder={t('employees.component.searchPlaceholder')}
            value={local}
            onChange={(e) => setLocal(e.target.value)}
            leftIcon={Search}
          />
        </div>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-3 md:flex md:flex-1">
          <Select
            label={t('employees.component.department')}
            value={departmentId}
            onChange={(e) => onDepartmentChange(e.target.value)}
            placeholder={t('employees.component.allDepartments')}
            options={[{ value: '', label: t('employees.component.allDepartments') }, ...departments.map((d) => ({ value: d.id, label: d.name }))]}
          />
          <Select
            label={t('employees.component.employmentType')}
            value={employmentType}
            onChange={(e) => onEmploymentTypeChange(e.target.value)}
            placeholder={t('employees.component.allTypes')}
            options={[{ value: '', label: t('employees.component.allTypes') }, ...employmentTypes.map((empType) => ({ value: empType.value, label: empType.label }))]}
          />
          <Select
            label={t('common.status')}
            value={status}
            onChange={(e) => onStatusChange(e.target.value)}
            placeholder={t('employees.component.allStatuses')}
            options={[{ value: '', label: t('employees.component.allStatuses') }, ...statuses.map((s) => ({ value: s.value, label: s.label }))]}
          />
        </div>
      </div>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-[13px] text-neutral-500">
          {t('common.found')} <b className="text-neutral-900">{total}</b> {t('employees.component.foundEmployees')}
        </p>
        {isDirty && (
          <Button variant="ghost" size="sm" onClick={onClear}>
            {t('employees.component.clearFilters')}
          </Button>
        )}
      </div>
    </div>
  )
}