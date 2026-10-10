import {
  Eye,
  Pencil,
} from 'lucide-react'

import Avatar from '../common/Avatar'
import Badge from '../common/Badge'
import AttendanceStatusPill from './AttendanceStatusPill'
import AttendanceSortableTh from './AttendanceSortableTh'
import { classNames } from '../../utils/format'
import { formatDate } from '../../utils/format'
import { useI18n } from '../../i18n/useI18n'

const APPROVAL_LABEL_KEY = { pending: 'attendance.component.approvalStatusPending', approved: 'attendance.component.approvalStatusApproved', rejected: 'attendance.component.approvalStatusRejected' }
const APPROVAL_TONE  = { pending: 'warning',   approved: 'success', rejected: 'danger' }
function approvalLabel(v, t) { return APPROVAL_LABEL_KEY[v] ? t(APPROVAL_LABEL_KEY[v]) : v }
function approvalTone(v)  { return APPROVAL_TONE[v]  || 'neutral' }

/**
 * AttendanceTable - bảng chấm công với sắp xếp + thao tác xem/sửa.
 */
export default function AttendanceTable({
  rows,
  loading,
  sortBy,
  sortDir,
  onSort,
  onView,
  onEdit,
}) {
  const { t: ti18n } = useI18n()
  const sortableKeys = {
    employeeName: 'attendance.component.sortByEmployeeName',
    date: 'attendance.component.sortByDate',
    checkIn: 'attendance.component.sortByCheckIn',
    checkOut: 'attendance.component.sortByCheckOut',
    workHours: 'attendance.component.sortByWorkHours',
  }
  const sortableColumns = ['employeeName', 'date', 'checkIn', 'checkOut', 'workHours']

  return (
    <div className="w-full overflow-x-auto rounded-lg border border-neutral-200 bg-white shadow-card">
      <table className="w-full border-separate border-spacing-0 text-sm text-neutral-700">
        <thead>
          <tr>
            <th
              scope="col"
              className="border-b border-neutral-200 bg-neutral-50 px-4 py-3 text-xs font-semibold uppercase tracking-wider text-neutral-500 whitespace-nowrap"
            >
              {ti18n('attendance.component.employeeCol')}
            </th>
            <th
              scope="col"
              className="border-b border-neutral-200 bg-neutral-50 px-4 py-3 text-xs font-semibold uppercase tracking-wider text-neutral-500 whitespace-nowrap"
            >
              {ti18n('attendance.component.employeeCodeCol')}
            </th>
            <th
              scope="col"
              className="border-b border-neutral-200 bg-neutral-50 px-4 py-3 text-xs font-semibold uppercase tracking-wider text-neutral-500 whitespace-nowrap"
            >
              {ti18n('attendance.component.departmentCol')}
            </th>
            {sortableColumns.map((key) => (
              <AttendanceSortableTh
                key={key}
                field={key}
                currentField={sortBy}
                currentDir={sortDir}
                onSort={onSort}
                align={['checkIn', 'checkOut', 'workHours'].includes(key) ? 'right' : 'left'}
                numeric={['workHours'].includes(key)}
              >
                {ti18n(sortableKeys[key])}
              </AttendanceSortableTh>
            ))}
            <th
              scope="col"
              className="border-b border-neutral-200 bg-neutral-50 px-4 py-3 text-xs font-semibold uppercase tracking-wider text-neutral-500 whitespace-nowrap text-center"
            >
              {ti18n('attendance.component.statusCol')}
            </th>
            <th
              scope="col"
              className="border-b border-neutral-200 bg-neutral-50 px-4 py-3 text-xs font-semibold uppercase tracking-wider text-neutral-500 whitespace-nowrap text-right"
            >
              {ti18n('attendance.component.actionsCol')}
            </th>
          </tr>
        </thead>
        <tbody>
          {loading && (
            <tr>
              <td colSpan={9} className="px-4 py-10 text-center text-sm text-neutral-500">
                {ti18n('attendance.component.loading')}
              </td>
            </tr>
          )}
          {!loading && rows.length === 0 && (
            <tr>
              <td colSpan={9} className="px-4 py-10 text-center text-sm text-neutral-500">
                {ti18n('attendance.component.noMatchingRecords')}
              </td>
            </tr>
          )}
          {!loading && rows.map((row) => (
            <tr key={row.id} className="group">
              <td className="border-b border-neutral-200 px-4 py-3 align-middle last:border-b group-hover:bg-neutral-50">
                <div className="flex min-w-[200px] items-center gap-3">
                  <Avatar name={row.employeeName} size="sm" />
                  <div className="min-w-0">
                    <div className="truncate font-medium text-neutral-900">{row.employeeName}</div>
                    <div className="truncate text-xs text-neutral-500">{row.position || '—'}</div>
                  </div>
                </div>
              </td>
              <td className="border-b border-neutral-200 px-4 py-3 align-middle group-hover:bg-neutral-50">{row.employeeCode || '—'}</td>
              <td className="border-b border-neutral-200 px-4 py-3 align-middle group-hover:bg-neutral-50">{row.departmentName}</td>
              <td className="border-b border-neutral-200 px-4 py-3 text-left align-middle group-hover:bg-neutral-50">{formatDate(row.date)}</td>
              <td className="border-b border-neutral-200 px-4 py-3 text-right align-middle group-hover:bg-neutral-50">{row.checkIn || '—'}</td>
              <td className="border-b border-neutral-200 px-4 py-3 text-right align-middle group-hover:bg-neutral-50">{row.checkOut || '—'}</td>
              <td className="border-b border-neutral-200 px-4 py-3 text-right align-middle group-hover:bg-neutral-50">
                {row.workHours > 0 ? `${row.workHours.toFixed(2)}h` : '—'}
              </td>
              <td className={classNames(
                'border-b border-neutral-200 px-4 py-3 text-right align-middle group-hover:bg-neutral-50',
                row.lateMinutes > 0 ? 'text-warning-700' : 'text-neutral-500',
              )}>
                {row.lateMinutes > 0 ? ti18n('attendance.component.minutesUnit', { n: row.lateMinutes }) : '—'}
              </td>
              <td className={classNames(
                'border-b border-neutral-200 px-4 py-3 text-right align-middle group-hover:bg-neutral-50',
                row.earlyLeaveMinutes > 0 ? 'text-warning-700' : 'text-neutral-500',
              )}>
                {row.earlyLeaveMinutes > 0 ? ti18n('attendance.component.minutesUnit', { n: row.earlyLeaveMinutes }) : '—'}
              </td>
              <td className="border-b border-neutral-200 px-4 py-3 text-center align-middle group-hover:bg-neutral-50">
                <AttendanceStatusPill status={row.status} />
              </td>
              <td className="border-b border-neutral-200 px-4 py-3 text-center align-middle group-hover:bg-neutral-50">
                {row.approvalStatus && (
                  <Badge tone={approvalTone(row.approvalStatus)}>
                    {approvalLabel(row.approvalStatus, ti18n)}
                  </Badge>
                )}
              </td>
              <td className="border-b border-neutral-200 px-4 py-3 text-right align-middle group-hover:bg-neutral-50">
                <div className="inline-flex items-center gap-1">
                  <button
                    type="button"
                    onClick={() => onView(row.id)}
                    aria-label={ti18n('attendance.component.viewDetailFor', { employee: row.employeeName, date: row.date })}
                    className="inline-flex h-8 w-8 items-center justify-center rounded-md text-neutral-500 hover:bg-neutral-100 hover:text-neutral-900"
                  >
                    <Eye className="h-4 w-4" aria-hidden="true" />
                  </button>
                  <button
                    type="button"
                    onClick={() => onEdit(row.id)}
                    aria-label={ti18n('attendance.component.editRecordFor', { employee: row.employeeName, date: row.date })}
                    className="inline-flex h-8 w-8 items-center justify-center rounded-md text-neutral-500 hover:bg-neutral-100 hover:text-neutral-900"
                  >
                    <Pencil className="h-4 w-4" aria-hidden="true" />
                  </button>
                </div>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}