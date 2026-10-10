import { useEffect, useState } from 'react'
import { Search, X } from 'lucide-react'

import Input from '../common/Input'
import Select from '../common/Select'
import Button from '../common/Button'
import { classNames } from '../../utils/format'

import { useI18n } from '../../i18n/useI18n'

export default function TrainingFilterBar({
  search,
  onSearchChange,
  status,
  onStatusChange,
  category,
  onCategoryChange,
  format,
  onFormatChange,
  startDateFrom,
  startDateTo,
  onStartDateFromChange,
  onStartDateToChange,
  statuses = [],
  categories = [],
  formats = [],
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

  const isDirty = Boolean(search || status || category || format || startDateFrom || startDateTo)

  return (
    <div className={classNames(
      'flex flex-col gap-3 rounded-lg border border-neutral-200 bg-white p-4 shadow-card',
    )}>
      <div className="flex flex-col gap-3 md:flex-row md:items-end">
        <div className="flex-1 min-w-0">
          <Input
            label={t('common.search')}
            placeholder={t('trainings.searchPlaceholder')}
            value={local}
            onChange={(e) => setLocal(e.target.value)}
            leftIcon={Search}
          />
        </div>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 md:flex md:flex-1">
          <Input
            label={t('evaluations.startDateFrom')}
            type="date"
            value={startDateFrom || ''}
            onChange={(e) => onStartDateFromChange(e.target.value)}
          />
          <Input
            label={t('evaluations.toDate')}
            type="date"
            value={startDateTo || ''}
            onChange={(e) => onStartDateToChange(e.target.value)}
          />
        </div>
      </div>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        <Select
          label={t('trainings.status')}
          value={status}
          onChange={(e) => onStatusChange(e.target.value)}
          options={[{ value: '', label: t('trainings.allStatuses') }, ...statuses.map((s) => ({ value: s.value, label: s.label }))]}
        />
        <Select
          label={t('trainings.category')}
          value={category}
          onChange={(e) => onCategoryChange(e.target.value)}
          options={[{ value: '', label: t('trainings.allCategories') }, ...categories.map((c) => ({ value: c.value, label: c.label }))]}
        />
        <Select
          label={t('trainings.format')}
          value={format}
          onChange={(e) => onFormatChange(e.target.value)}
          options={[{ value: '', label: t('trainings.allFormats') }, ...formats.map((f) => ({ value: f.value, label: f.label }))]}
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
