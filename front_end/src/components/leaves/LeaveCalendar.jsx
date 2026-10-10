import { useMemo, useState } from 'react'
import { ChevronLeft, ChevronRight, CalendarDays } from 'lucide-react'

import EmptyState from '../common/EmptyState'
import Button from '../common/Button'
import Select from '../common/Select'
import LeaveStatusPill from './LeaveStatusPill'
import { useI18n } from '../../i18n/useI18n'

import { getLeaveCalendar, getMonthGrid } from '../../services/leaveService'
import { LEAVE_TYPE_LABEL } from '../../data/leaveMockData'

const WEEKDAY_LABELS_KEYS = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday']
const MONTH_LABELS_KEYS = [
  'month1', 'month2', 'month3', 'month4', 'month5', 'month6',
  'month7', 'month8', 'month9', 'month10', 'month11', 'month12',
]

function weekdayLabel(key, t) {
  const labels = {
    sunday: t('leaves.component.weekdaySunday'),
    monday: t('leaves.component.weekdayMonday'),
    tuesday: t('leaves.component.weekdayTuesday'),
    wednesday: t('leaves.component.weekdayWednesday'),
    thursday: t('leaves.component.weekdayThursday'),
    friday: t('leaves.component.weekdayFriday'),
    saturday: t('leaves.component.weekdaySaturday'),
  }
  return labels[key] || key
}

function monthLabel(key, t) {
  const labels = {
    month1: t('leaves.component.month1'),
    month2: t('leaves.component.month2'),
    month3: t('leaves.component.month3'),
    month4: t('leaves.component.month4'),
    month5: t('leaves.component.month5'),
    month6: t('leaves.component.month6'),
    month7: t('leaves.component.month7'),
    month8: t('leaves.component.month8'),
    month9: t('leaves.component.month9'),
    month10: t('leaves.component.month10'),
    month11: t('leaves.component.month11'),
    month12: t('leaves.component.month12'),
  }
  return labels[key] || key
}

/**
 * LeaveCalendar - xem lịch nghỉ phép theo tháng.
 *
 * Props:
 *  - employeeId?: chỉ lấy đơn của 1 nhân viên
 *  - departments?: [{ id, name }]
 *  - departmentId?: bộ lọc phòng ban
 *  - onDepartmentChange?(id)
 *  - onDayClick?(dateISO, items) - click 1 ngày có đơn
 *  - selectedDate?: ISO date string đang chọn
 *  - year?: default = today.year
 *  - month?: default = today.month
 *  - onMonthChange?({ year, month })
 */
export default function LeaveCalendar({
  employeeId,
  departments = [],
  departmentId = '',
  onDepartmentChange,
  onDayClick,
  selectedDate = null,
  year: yearProp,
  month: monthProp,
  onMonthChange,
}) {
  const { t } = useI18n()
  const today = new Date()
  const [internalYear, setInternalYear] = useState(yearProp ?? today.getFullYear())
  const [internalMonth, setInternalMonth] = useState(monthProp ?? today.getMonth() + 1)

  const year = yearProp ?? internalYear
  const month = monthProp ?? internalMonth

  function changeMonth(delta) {
    let m = month + delta
    let y = year
    if (m < 1) { m = 12; y -= 1 }
    if (m > 12) { m = 1; y += 1 }
    if (onMonthChange) onMonthChange({ year: y, month: m })
    else {
      setInternalMonth(m)
      setInternalYear(y)
    }
  }

  function jumpToToday() {
    if (onMonthChange) onMonthChange({ year: today.getFullYear(), month: today.getMonth() + 1 })
    else {
      setInternalMonth(today.getMonth() + 1)
      setInternalYear(today.getFullYear())
    }
  }

  // eslint-disable-next-line react-hooks/exhaustive-deps
  const calendar = useMemo(
    () => getLeaveCalendar({ year, month, employeeId, departmentId }),
    [year, month, employeeId, departmentId],
  )
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const grid = useMemo(() => getMonthGrid({ year, month }), [year, month])

  const selectedItems = selectedDate ? (calendar.byDate?.[selectedDate] || []) : []

  const totalInMonth = Object.values(calendar.byDate || {}).reduce(
    (sum, list) => sum + list.length,
    0,
  )

  return (
    <div className="flex flex-col gap-4 rounded-lg border border-neutral-200 bg-white p-5 shadow-card">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-2">
          <span className="inline-flex h-9 w-9 items-center justify-center rounded-md bg-brand-50 text-brand-600">
            <CalendarDays className="h-5 w-5" aria-hidden="true" />
          </span>
          <div>
            <h3 className="text-base font-semibold text-neutral-900">{t('leaves.component.leaveCalendarTitle')}</h3>
            <p className="text-[12px] text-neutral-500">
              {t('leaves.component.leaveCalendarMonth', { month: monthLabel(`month${month}`, t), year, n: totalInMonth })}
            </p>
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {departments.length > 0 && onDepartmentChange && (
            <Select
              aria-label={t('leaves.component.department')}
              value={departmentId}
              onChange={(e) => onDepartmentChange(e.target.value)}
              options={[
                { value: '', label: t('leaves.component.allDepartments') },
                ...departments.map((d) => ({ value: d.id, label: d.name })),
              ]}
            />
          )}
          <Button size="sm" variant="secondary" onClick={jumpToToday}>
            {t('leaves.component.today')}
          </Button>
          <Button
            size="sm"
            variant="secondary"
            icon={ChevronLeft}
            onClick={() => changeMonth(-1)}
            aria-label={t('leaves.component.previousMonth')}
          />
          <Button
            size="sm"
            variant="secondary"
            icon={ChevronRight}
            iconPosition="right"
            onClick={() => changeMonth(1)}
            aria-label={t('leaves.component.nextMonth')}
          />
        </div>
      </div>

      <div className="grid grid-cols-7 gap-px overflow-hidden rounded-md border border-neutral-200 bg-neutral-200 text-center text-[11px] font-semibold uppercase tracking-wider text-neutral-500">
        {WEEKDAY_LABELS_KEYS.map((w) => (
          <div key={w} className="bg-neutral-50 px-2 py-2">{weekdayLabel(w, t)}</div>
        ))}
      </div>

      <div className="grid grid-cols-7 gap-px overflow-hidden rounded-md border border-neutral-200 bg-neutral-200">
        {grid.weeks.map((week, wi) =>
          week.map((cell, ci) => {
            const items = calendar.byDate?.[cell.date] || []
            const isSelected = selectedDate === cell.date
            const isToday = cell.date === today.toISOString().slice(0, 10)
            const approvedCount = items.filter((i) => i.status === 'approved').length
            const pendingCount = items.filter((i) => i.status === 'pending').length
            return (
              <button
                key={`${wi}-${ci}`}
                type="button"
                onClick={() => items.length > 0 && onDayClick?.(cell.date, items)}
                disabled={items.length === 0}
                className={`flex min-h-[72px] flex-col items-stretch gap-1 bg-white p-1.5 text-left transition ${
                  cell.inMonth ? '' : 'opacity-40'
                } ${isSelected ? 'ring-2 ring-brand-500' : ''} ${
                  items.length > 0 ? 'hover:bg-brand-50 cursor-pointer' : 'cursor-default'
                }`}
              >
                <span
                  className={`text-xs font-semibold ${
                    isToday ? 'inline-flex h-5 w-5 items-center justify-center rounded-full bg-brand-600 text-white' : 'text-neutral-700'
                  }`}
                >
                  {cell.day}
                </span>
                {items.length > 0 && (
                  <div className="flex flex-col gap-0.5">
                    {approvedCount > 0 && (
                      <span className="inline-flex items-center gap-1 rounded bg-success-50 px-1 py-0.5 text-[10px] font-medium text-success-700">
                        <span className="inline-block h-1.5 w-1.5 rounded-full bg-success-500" />
                        {t('leaves.component.approvedCount', { n: approvedCount })}
                      </span>
                    )}
                    {pendingCount > 0 && (
                      <span className="inline-flex items-center gap-1 rounded bg-warning-50 px-1 py-0.5 text-[10px] font-medium text-warning-700">
                        <span className="inline-block h-1.5 w-1.5 rounded-full bg-warning-500" />
                        {t('leaves.component.pendingCount', { n: pendingCount })}
                      </span>
                    )}
                  </div>
                )}
              </button>
            )
          }),
        )}
      </div>

      <div className="flex flex-wrap items-center gap-3 text-[12px] text-neutral-500">
        <span className="inline-flex items-center gap-1">
          <span className="inline-block h-2 w-2 rounded-full bg-success-500" /> {t('leaves.component.calendarLegendApproved')}
        </span>
        <span className="inline-flex items-center gap-1">
          <span className="inline-block h-2 w-2 rounded-full bg-warning-500" /> {t('leaves.component.calendarLegendPending')}
        </span>
        <span>{t('leaves.component.calendarLegendNote')}</span>
      </div>

      {selectedDate && (
        <div className="rounded-md border border-neutral-200 bg-neutral-50 p-4">
          <p className="text-xs font-semibold uppercase tracking-wider text-neutral-500">
            {t('leaves.component.requestsOnDate', { date: selectedDate })}
          </p>
          {selectedItems.length === 0 ? (
            <p className="mt-2 text-[13px] text-neutral-500">{t('leaves.component.noRequestsOnDate')}</p>
          ) : (
            <ul className="mt-2 flex flex-col gap-2">
              {selectedItems.map((item) => (
                <li key={item.id} className="flex flex-col gap-1 rounded-md border border-neutral-200 bg-white px-3 py-2">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="font-mono text-[12px] text-neutral-500">{item.requestCode}</span>
                    <LeaveStatusPill status={item.status} />
                    <span className="rounded bg-neutral-100 px-1.5 py-0.5 text-[11px] font-medium text-neutral-700">
                      {LEAVE_TYPE_LABEL[item.leaveType] ?? item.leaveType}
                    </span>
                  </div>
                  <p className="text-sm font-medium text-neutral-900">{item.employeeName}</p>
                  <p className="text-[12px] text-neutral-500">
                    {item.startDate} → {item.endDate} · {item.departmentName} · {item.totalDays} {t('leaves.component.daysUnit')}
                  </p>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}

      {totalInMonth === 0 && !selectedDate && (
        <EmptyState
          title={t('leaves.component.noLeavesInMonth')}
          description={t('leaves.component.noLeavesInMonthDesc')}
        />
      )}
    </div>
  )
}