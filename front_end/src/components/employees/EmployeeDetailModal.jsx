import { useMemo } from 'react'
import { Mail, Phone, MapPin, Briefcase, Building2, CalendarDays, IdCard, Pencil, Users, User } from 'lucide-react'
import { useI18n } from '../../i18n/useI18n'

import Modal from '../common/Modal'
import Avatar from '../common/Avatar'
import Button from '../common/Button'
import StatusPill from './StatusPill'

import { getEmployeeById, getDepartments } from '../../services/employeeService'
import { formatDate } from '../../utils/format'
import { GENDER_LABEL } from '../../data/employeeMockData'

/**
 * EmployeeDetailModal - xem chi tiết nhân viên.
 */
export default function EmployeeDetailModal({
  employeeId,
  open,
  onClose,
  onEdit,
}) {
  const { t } = useI18n()
  const employee = useMemo(() => (employeeId ? getEmployeeById(employeeId) : null), [employeeId])

  const departments = useMemo(() => getDepartments(), [])
  const department = departments.find((d) => d.id === employee?.departmentId)
  const managerId = employee ? employee.managerId : null
  const manager = useMemo(
    () => (managerId ? getEmployeeById(managerId) : null),
    [managerId],
  )

  if (!employee) {
    return (
      <Modal open={open} onClose={onClose} title={t('employees.component.employeeNotFound')} size="md">
        <p className="text-sm text-neutral-600">{t('employees.component.recordDeletedOrNotExist')}</p>
      </Modal>
    )
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      size="lg"
      title={t('employees.component.employeeProfile')}
      description={t('employees.component.code', { n: employee.employeeCode }) + ' · ' + t('employees.component.updated', { n: formatDate(employee.updatedAt) })}
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>
            {t('common.close')}
          </Button>
          {onEdit && (
            <Button icon={Pencil} onClick={() => onEdit(employee.id)}>
              {t('employees.component.edit')}
            </Button>
          )}
        </>
      }
    >
      <div className="flex flex-col gap-5">
        <div className="flex items-center gap-4">
          <Avatar
            src={employee.avatar}
            name={employee.fullName}
            size="lg"
          />
          <div className="min-w-0">
            <h3 className="truncate text-base font-semibold text-neutral-900">{employee.fullName}</h3>
            <p className="text-[13px] text-neutral-500">{employee.position} · {department?.name ?? '—'}</p>
            <div className="mt-2 flex flex-wrap items-center gap-2">
              <StatusPill status={employee.status} />
              <span className="inline-flex items-center gap-1 text-xs text-neutral-500">
                <IdCard className="h-3.5 w-3.5" aria-hidden="true" />
                {employee.employeeCode}
              </span>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <Info icon={Mail}        label={t('employees.component.email')}          value={employee.email} />
          <Info icon={Phone}       label={t('employees.component.phone')}         value={employee.phone} />
          <Info icon={Building2}   label={t('employees.component.department')}      value={department?.name ?? '—'} />
          <Info icon={Briefcase}   label={t('employees.component.position')}        value={employee.position} />
          <Info icon={Briefcase}   label={t('employees.component.employmentType')} value={employmentTypeLabel(employee.employmentType)} />
          <Info icon={CalendarDays} label={t('employees.component.hireDate')}       value={formatDate(employee.hireDate)} />
          <Info icon={CalendarDays} label={t('employees.component.dateOfBirth')}   value={employee.dateOfBirth ? formatDate(employee.dateOfBirth) : '—'} />
          <Info icon={User}        label={t('employees.component.gender')}        value={GENDER_LABEL[employee.gender] ?? '—'} />
          <Info icon={Users}        label={t('employees.component.manager')}       value={manager ? `${manager.fullName} (${manager.position})` : '—'} />
          <Info icon={MapPin}       label={t('employees.component.address')}       value={employee.address || '—'} fullWidth />
        </div>
      </div>
    </Modal>
  )
}

function Info({ icon: Icon, label, value, fullWidth = false }) {
  return (
    <div className={fullWidth ? 'sm:col-span-2' : ''}>
      <p className="text-xs font-medium uppercase tracking-wider text-neutral-500">{label}</p>
      <p className="mt-1 flex items-center gap-2 text-sm text-neutral-900">
        {Icon && <Icon className="h-4 w-4 flex-shrink-0 text-neutral-400" aria-hidden="true" />}
        <span className="break-words">{value || '—'}</span>
      </p>
    </div>
  )
}

function employmentTypeLabel(value) {
  return ({
    full_time: 'Toàn thời gian',
    part_time: 'Bán thời gian',
    contract:  'Hợp đồng',
    intern:    'Thực tập sinh',
  })[value] ?? value
}