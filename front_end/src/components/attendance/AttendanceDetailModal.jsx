import { useMemo } from 'react'
import { CalendarDays, Clock3, LogOut, TimerReset, AlertTriangle, LogIn, Pencil } from 'lucide-react'

import Modal from '../common/Modal'
import Avatar from '../common/Avatar'
import Button from '../common/Button'
import AttendanceStatusPill from './AttendanceStatusPill'
import { useI18n } from '../../i18n/useI18n'

import { getEmployeeById } from '../../services/employeeService'
import { formatDate } from '../../utils/format'

/**
 * AttendanceDetailModal - xem chi tiết bản ghi.
 */
export default function AttendanceDetailModal({
  open,
  onClose,
  record,
  onEdit,
}) {
  const { t } = useI18n()
  const employee = useMemo(() => (record ? getEmployeeById(record.employeeId) : null), [record])

  if (!record) {
    return (
      <Modal open={open} onClose={onClose} title={t('attendance.component.notFoundTitle')} size="md">
        <p className="text-sm text-neutral-600">{t('attendance.component.notFoundDesc')}</p>
      </Modal>
    )
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      size="lg"
      title={t('attendance.component.detailTitle')}
      description={`${t('attendance.component.detailDesc', { date: formatDate(record.date), updated: formatDate(record.updatedAt) })}`}
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>
            {t('attendance.component.close')}
          </Button>
          {onEdit && (
            <Button icon={Pencil} onClick={() => onEdit(record.id)}>
              {t('attendance.component.edit')}
            </Button>
          )}
        </>
      }
    >
      <div className="flex flex-col gap-5">
        <div className="flex items-center gap-4">
          <Avatar
            name={employee?.fullName ?? record.employeeName}
            size="lg"
          />
          <div className="min-w-0">
            <h3 className="truncate text-base font-semibold text-neutral-900">
              {employee?.fullName ?? record.employeeName}
            </h3>
            <p className="text-[13px] text-neutral-500">
              {employee?.position || '—'} · {record.departmentName}
            </p>
            <div className="mt-2 flex flex-wrap items-center gap-2">
              <AttendanceStatusPill status={record.status} />
              <span className="inline-flex items-center gap-1 text-xs text-neutral-500">
                <CalendarDays className="h-3.5 w-3.5" aria-hidden="true" />
                {formatDate(record.date)}
              </span>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <Info icon={LogIn} label={t('attendance.component.checkInTime')} value={record.checkIn || '—'} />
          <Info icon={LogOut} label={t('attendance.component.checkOutTime')} value={record.checkOut || '—'} />
          <Info icon={TimerReset} label={t('attendance.component.totalWorkHours')} value={record.workHours > 0 ? t('attendance.component.hoursUnit', { n: record.workHours.toFixed(2) }) : '—'} />
          <Info
            icon={AlertTriangle}
            label={t('attendance.component.lateMinutes')}
            value={record.lateMinutes > 0 ? t('attendance.component.minutesUnit', { n: record.lateMinutes }) : '—'}
          />
          <Info
            icon={LogOut}
            label={t('attendance.component.earlyLeaveMinutes')}
            value={record.earlyLeaveMinutes > 0 ? t('attendance.component.minutesUnit', { n: record.earlyLeaveMinutes }) : '—'}
          />
          <Info
            icon={Clock3}
            label={t('attendance.component.status')}
            value={<AttendanceStatusPill status={record.status} />}
          />
          <div className="sm:col-span-2">
            <p className="text-xs font-medium uppercase tracking-wider text-neutral-500">{t('attendance.component.note')}</p>
            <p className="mt-1 text-sm text-neutral-900">{record.note?.trim() || '—'}</p>
          </div>
        </div>
      </div>
    </Modal>
  )
}

function Info({ icon: Icon, label, value }) {
  return (
    <div>
      <p className="text-xs font-medium uppercase tracking-wider text-neutral-500">{label}</p>
      <p className="mt-1 flex items-center gap-2 text-sm text-neutral-900">
        {Icon && <Icon className="h-4 w-4 flex-shrink-0 text-neutral-400" aria-hidden="true" />}
        <span className="break-words">{value || '—'}</span>
      </p>
    </div>
  )
}