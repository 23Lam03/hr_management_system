import { useEffect, useState } from 'react'
import { Search, X } from 'lucide-react'

import Input from '../common/Input'
import Select from '../common/Select'
import Button from '../common/Button'
import { classNames } from '../../utils/format'
import { useI18n } from '../../i18n/useI18n'

/**
 * AttendanceFilterBar - tìm kiếm + bộ lọc ngày/phòng ban/nhân viên/trạng thái.
 */
export default function AttendanceFilterBar({
  search,
  onSearchChange,
  dateFrom,
  dateTo,
  onDateFromChange,
  onDateToChange,
  departmentId,
  onDepartmentChange,
  employeeId,
  onEmployeeChange,
  status,
  onStatusChange,
  departments = [],
  employees = [],
  statuses = [],
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
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [local])

  const isDirty =
    Boolean(search || dateFrom || dateTo || departmentId || employeeId || status)

  return (
    <div className={classNames(
      'flex flex-col gap-3 rounded-lg border border-neutral-200 bg-white p-4 shadow-card',
    )}>
      <div className="flex flex-col gap-3 md:flex-row md:items-end">
        <div className="flex-1 min-w-0">
          <Input
            label={t('attendance.component.filterSearch')}
            placeholder={t('attendance.component.filterSearchPlaceholder')}
            value={local}
            onChange={(e) => setLocal(e.target.value)}
            leftIcon={Search}
          />
        </div>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <Input
            label={t('attendance.component.dateFrom')}
            type="date"
            value={dateFrom || ''}
            onChange={(e) => onDateFromChange(e.target.value)}
          />
          <Input
            label={t('attendance.component.dateTo')}
            type="date"
            value={dateTo || ''}
            onChange={(e) => onDateToChange(e.target.value)}
          />
        </div>
      </div>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        <Select
          label={t('attendance.component.department')}
          value={departmentId}
          onChange={(e) => onDepartmentChange(e.target.value)}
          placeholder={t('attendance.component.allDepartments')}
          options={[{ value: '', label: t('attendance.component.allDepartments') }, ...departments.map((d) => ({ value: d.id, label: d.name }))]}
        />
        <Select
          label={t('attendance.component.employee')}
          value={employeeId}
          onChange={(e) => onEmployeeChange(e.target.value)}
          placeholder={t('attendance.component.allEmployees')}
          options={[{ value: '', label: t('attendance.component.allEmployees') }, ...employees.map((e) => ({ value: e.id, label: `${e.fullName} (${e.employeeCode})` }))]}
        />
        <Select
          label={t('attendance.component.statusFilter')}
          value={status}
          onChange={(e) => onStatusChange(e.target.value)}
          placeholder={t('attendance.component.allStatuses')}
          options={[{ value: '', label: t('attendance.component.allStatuses') }, ...statuses.map((s) => ({ value: s.value, label: s.label }))]}
        />
      </div>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-[13px] text-neutral-500">
          {t('attendance.component.foundRecords', { n: total })}
        </p>
        {isDirty && (
          <Button variant="ghost" size="sm" icon={X} onClick={onClear}>
            {t('attendance.component.clearFilters')}
          </Button>
        )}
      </div>
    </div>
  )
}