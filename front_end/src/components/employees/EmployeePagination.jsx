import { ChevronLeft, ChevronRight } from 'lucide-react'
import { useI18n } from '../../i18n/useI18n'

import Button from '../common/Button'
import Select from '../common/Select'

/**
 * EmployeePagination - phân trang + chọn pageSize.
 */
export default function EmployeePagination({
  page,
  totalPages,
  pageSize,
  total,
  onPageChange,
  onPageSizeChange,
}) {
  const { t } = useI18n()
  const pageOptions = [5, 10, 20].map((n) => ({ value: String(n), label: `${n} ${t('employees.component.employeesPerPage')}` }))

  const start = total === 0 ? 0 : (page - 1) * pageSize + 1
  const end = Math.min(page * pageSize, total)

  return (
    <div className="flex flex-col items-center justify-between gap-3 rounded-lg border border-neutral-200 bg-white p-3 shadow-card sm:flex-row">
      <div className="flex items-center gap-3">
        <Select
          aria-label={t('employees.component.employeesPerPage')}
          value={String(pageSize)}
          onChange={(e) => onPageSizeChange(Number(e.target.value))}
          options={pageOptions}
        />
        <span className="text-[13px] text-neutral-500">
          {t('employees.component.show')} <b className="text-neutral-900">{start}</b>–
          <b className="text-neutral-900">{end}</b> {t('employees.component.inTotal')}{' '}
          <b className="text-neutral-900">{total}</b>
        </span>
      </div>
      <div className="flex items-center gap-2">
        <Button
          variant="secondary"
          size="sm"
          icon={ChevronLeft}
          onClick={() => onPageChange(Math.max(1, page - 1))}
          disabled={page <= 1}
        >
          {t('employees.component.previous')}
        </Button>
        <span className="text-sm text-neutral-700">
          {t('employees.component.page')} <b className="text-neutral-900">{page}</b> / {totalPages}
        </span>
        <Button
          variant="secondary"
          size="sm"
          icon={ChevronRight}
          iconPosition="right"
          onClick={() => onPageChange(Math.min(totalPages, page + 1))}
          disabled={page >= totalPages}
        >
          {t('employees.component.next')}
        </Button>
      </div>
    </div>
  )
}