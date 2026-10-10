import { useMemo } from 'react'

import Modal from '../common/Modal'
import { useI18n } from '../../i18n/useI18n'

import AttendanceForm from './AttendanceForm'

import {
  getAttendanceStatuses,
} from '../../services/attendanceService'
import { getEmployees } from '../../services/employeeService'

/**
 * AttendanceFormModal - wrapper Modal cho tạo/sửa bản ghi chấm công.
 */
export default function AttendanceFormModal({
  open,
  onClose,
  initialValue = null,
  onSubmit,
  submitting = false,
  serverErrors = {},
}) {
  const { t } = useI18n()
  const statuses = useMemo(() => getAttendanceStatuses(), [])
  const employees = useMemo(() => getEmployees(), [])
  const isEdit = Boolean(initialValue?.id)

  return (
    <Modal
      open={open}
      onClose={onClose}
      size="lg"
      title={isEdit ? t('attendance.component.formTitleEdit') : t('attendance.component.formTitleCreate')}
      description={
        isEdit
          ? t('attendance.component.formDescEdit', { date: initialValue.date })
          : t('attendance.component.formDescCreate')
      }
    >
      <AttendanceForm
        key={isEdit ? initialValue.id : 'new'}
        initialValue={initialValue || {}}
        employees={employees}
        statuses={statuses}
        onSubmit={onSubmit}
        onCancel={onClose}
        submitting={submitting}
        serverErrors={serverErrors}
        isEdit={isEdit}
      />
    </Modal>
  )
}