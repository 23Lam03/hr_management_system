import { useMemo } from 'react'
import { useI18n } from '../../i18n/useI18n'

import Modal from '../common/Modal'

import EmployeeForm from './EmployeeForm'

import {
  getDepartments,
  getEmploymentTypes,
  getEmploymentStatuses,
  getGenders,
  getManagers,
} from '../../services/employeeService'

/**
 * EmployeeFormModal - wrapper Modal cho tạo/sửa nhân viên.
 */
export default function EmployeeFormModal({
  open,
  onClose,
  initialValue = null,
  onSubmit,
  submitting = false,
  serverErrors = {},
}) {
  const { t } = useI18n()
  const departments = useMemo(() => getDepartments(), [])
  const types = useMemo(() => getEmploymentTypes(), [])
  const statuses = useMemo(() => getEmploymentStatuses(), [])
  const genders = useMemo(() => getGenders(), [])
  const managers = useMemo(
    () => (initialValue ? getManagers(initialValue.id) : getManagers()),
    [initialValue],
  )

  const isEdit = Boolean(initialValue?.id)

  return (
    <Modal
      open={open}
      onClose={onClose}
      size="xl"
      title={isEdit ? t('employees.component.editEmployeeModal') : t('employees.component.addEmployeeModal')}
      description={
        isEdit
          ? t('employees.component.updateFor', { n: initialValue.fullName })
          : t('employees.component.createNewEmployee')
      }
    >
      {/*
        key={isEdit ? initialValue.id : 'new'} để ép EmployeeForm
        khởi tạo lại state khi mở tạo/sửa khác nhau, tránh effect reset.
      */}
      <EmployeeForm
        key={isEdit ? initialValue.id : 'new'}
        initialValue={initialValue || {}}
        departments={departments}
        employmentTypes={types}
        statuses={statuses}
        genders={genders}
        managers={managers}
        onSubmit={onSubmit}
        onCancel={onClose}
        submitting={submitting}
        serverErrors={serverErrors}
        isEdit={isEdit}
      />
    </Modal>
  )
}