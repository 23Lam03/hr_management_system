import { ChevronLeft, ChevronRight } from 'lucide-react'

import Button from '../common/Button'
import Select from '../common/Select'

import { useI18n } from '../../i18n/useI18n'

export default function TrainingPagination({
  page,
  totalPages,
  pageSize,
  total,
  onPageChange,
  onPageSizeChange,
}) {
  const { t } = useI18n()
  const pageOptions = [5, 10, 20].map((n) => ({ value: String(n), label: t('trainings.rowsPerPage', { n }) }))
  const start = total === 0 ? 0 : (page - 1) * pageSize + 1
  const end = Math.min(page * pageSize, total)
  return (
    <div className="flex flex-col items-center justify-between gap-3 rounded-lg border border-neutral-200 bg-white p-3 shadow-card sm:flex-row">
      <div className="flex items-center gap-3">
        <Select
          aria-label={t('trainings.rowsPerPage', { n: pageSize })}
          value={String(pageSize)}
          onChange={(e) => onPageSizeChange(Number(e.target.value))}
          options={pageOptions}
        />
        <span className="text-[13px] text-neutral-500">
          {t('trainings.showing', { start, end, total })}
        </span>
      </div>
      <div className="flex items-center gap-2">
        <Button
          variant="secondary"
          size="sm"
          icon={ChevronLeft}
          onClick={() => onPageChange(Math.max(1, page - 1))}
          disabled={page <= 1}
        >{t('trainings.previous')}</Button>
        <span className="text-sm text-neutral-700">
          {t('trainings.page', { page, totalPages })}
        </span>
        <Button
          variant="secondary"
          size="sm"
          icon={ChevronRight}
          iconPosition="right"
          onClick={() => onPageChange(Math.min(totalPages, page + 1))}
          disabled={page >= totalPages}
        >{t('trainings.next')}</Button>
      </div>
    </div>
  )
}
