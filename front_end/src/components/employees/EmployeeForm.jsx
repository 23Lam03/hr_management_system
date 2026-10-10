import { useMemo, useRef, useState } from 'react'
import {
  User,
  Mail,
  Phone as PhoneIcon,
  Hash,
  CalendarDays,
  Briefcase,
  MapPin,
  Save,
} from 'lucide-react'
import { useI18n } from '../../i18n/useI18n'

import Input from '../common/Input'
import Select from '../common/Select'
import Button from '../common/Button'

import { validateEmployee } from '../../services/employeeService'

const EMPTY = {
  employeeCode: '',
  fullName: '',
  email: '',
  phone: '',
  avatar: null,
  gender: 'male',
  dateOfBirth: '',
  departmentId: '',
  position: '',
  employmentType: 'full_time',
  hireDate: '',
  managerId: '',
  address: '',
  status: 'active',
}

/**
 * EmployeeForm - form dùng chung cho tạo + sửa.
 *
 * Props:
 * - initialValue: object
 * - departments, employmentTypes, statuses, genders, managers
 * - onSubmit(payload) - cha sẽ gọi service.
 * - onCancel()
 * - submitting: bool (khoá nút submit, chống gửi nhiều lần)
 * - serverErrors: { ... } nếu service trả lỗi -> hiện ngay
 */
export default function EmployeeForm({
  initialValue,
  departments = [],
  employmentTypes = [],
  statuses = [],
  genders = [],
  managers = [],
  onSubmit,
  onCancel,
  submitting = false,
  serverErrors = {},
  isEdit = false,
}) {
  const { t } = useI18n()
  // Reset state mỗi lần initialValue thay đổi
  const [values, setValues] = useState(() => ({ ...EMPTY, ...initialValue }))
  const [localErrors, setLocalErrors] = useState(() => ({}))
  const submittedRef = useRef(false)

  // Gộp lỗi: lỗi server (validate từ cha) sẽ override lỗi local.
  const errors = useMemo(
    () => ({ ...localErrors, ...serverErrors }),
    [localErrors, serverErrors],
  )

  function setField(name, value) {
    setValues((prev) => ({ ...prev, [name]: value }))
    // Xoá lỗi của trường đó ngay khi user sửa để UX tốt hơn
    setLocalErrors((prev) => {
      if (!prev[name] && !serverErrors[name]) return prev
      const next = { ...prev }
      delete next[name]
      return next
    })
  }

  function validateAll() {
    const e = validateEmployee(values, { excludeId: initialValue?.id })
    setLocalErrors(e)
    return Object.keys(e).length === 0
  }

  function handleSubmit(e) {
    e.preventDefault()
    if (submittedRef.current || submitting) return
    if (!validateAll()) return
    submittedRef.current = true
    onSubmit(values)
  }

  const statusOptions = useMemo(
    () => statuses.map((s) => ({ value: s.value, label: s.label })),
    [statuses],
  )
  const typeOptions = useMemo(
    () => employmentTypes.map((t) => ({ value: t.value, label: t.label })),
    [employmentTypes],
  )
  const departmentOptions = useMemo(
    () => departments.map((d) => ({ value: d.id, label: d.name })),
    [departments],
  )
  const genderOptions = useMemo(
    () => genders.map((g) => ({ value: g.value, label: g.label })),
    [genders],
  )
  const managerOptions = useMemo(
    () => [
      { value: '', label: t('employees.component.noManager') },
      ...managers.map((m) => ({ value: m.id, label: `${m.name}${m.position ? ' · ' + m.position : ''}` })),
    ],
    [managers, t],
  )

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-5" noValidate>
      {/* Phần 1: thông tin cơ bản */}
      <section className="flex flex-col gap-4">
        <header className="flex items-center gap-2 border-b border-neutral-200 pb-2">
          <User className="h-4 w-4 text-brand-600" aria-hidden="true" />
          <h3 className="text-sm font-semibold text-neutral-900">{t('employees.component.basicInfo')}</h3>
        </header>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <Input
            label={t('employees.component.employeeCode')}
            required
            placeholder="VD: NV0016"
            leftIcon={Hash}
            value={values.employeeCode}
            onChange={(e) => setField('employeeCode', e.target.value)}
            error={errors.employeeCode}
            helper={!isEdit ? t('employees.component.autoGenerate') : undefined}
          />
          <Input
            label={t('employees.component.fullName')}
            required
            placeholder="Nguyễn Văn A"
            leftIcon={User}
            value={values.fullName}
            onChange={(e) => setField('fullName', e.target.value)}
            error={errors.fullName}
          />
          <Input
            label={t('employees.component.email')}
            required
            type="email"
            placeholder="name@company.vn"
            leftIcon={Mail}
            value={values.email}
            onChange={(e) => setField('email', e.target.value)}
            error={errors.email}
          />
          <Input
            label={t('employees.component.phone')}
            required
            placeholder="0901 234 567"
            leftIcon={PhoneIcon}
            value={values.phone}
            onChange={(e) => setField('phone', e.target.value)}
            error={errors.phone}
          />
          <Select
            label={t('employees.component.gender')}
            value={values.gender}
            onChange={(e) => setField('gender', e.target.value)}
            options={genderOptions}
          />
          <Input
            label={t('employees.component.dateOfBirth')}
            type="date"
            value={values.dateOfBirth || ''}
            onChange={(e) => setField('dateOfBirth', e.target.value)}
            error={errors.dateOfBirth}
            helper={t('employees.component.optional')}
          />
        </div>
      </section>

      {/* Phần 2: công việc */}
      <section className="flex flex-col gap-4">
        <header className="flex items-center gap-2 border-b border-neutral-200 pb-2">
          <Briefcase className="h-4 w-4 text-brand-600" aria-hidden="true" />
          <h3 className="text-sm font-semibold text-neutral-900">{t('employees.component.workInfo')}</h3>
        </header>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <Select
            label={t('employees.component.department')}
            required
            value={values.departmentId}
            onChange={(e) => setField('departmentId', e.target.value)}
            options={departmentOptions}
            placeholder={t('employees.component.selectDepartment')}
            error={errors.departmentId}
          />
          <Input
            label={t('employees.component.position')}
            required
            placeholder="VD: Frontend Engineer"
            leftIcon={Briefcase}
            value={values.position}
            onChange={(e) => setField('position', e.target.value)}
            error={errors.position}
          />
          <Select
            label={t('employees.component.employmentType')}
            required
            value={values.employmentType}
            onChange={(e) => setField('employmentType', e.target.value)}
            options={typeOptions}
            error={errors.employmentType}
          />
          <Input
            label={t('employees.component.hireDate')}
            required
            type="date"
            leftIcon={CalendarDays}
            value={values.hireDate || ''}
            onChange={(e) => setField('hireDate', e.target.value)}
            error={errors.hireDate}
          />
          <Select
            label={t('employees.component.manager')}
            value={values.managerId || ''}
            onChange={(e) => setField('managerId', e.target.value)}
            options={managerOptions}
            helper={t('employees.component.optional')}
          />
          <Select
            label={t('common.status')}
            required
            value={values.status}
            onChange={(e) => setField('status', e.target.value)}
            options={statusOptions}
            error={errors.status}
          />
        </div>
      </section>

      {/* Phần 3: địa chỉ */}
      <section className="flex flex-col gap-4">
        <header className="flex items-center gap-2 border-b border-neutral-200 pb-2">
          <MapPin className="h-4 w-4 text-brand-600" aria-hidden="true" />
          <h3 className="text-sm font-semibold text-neutral-900">{t('employees.component.other')}</h3>
        </header>
        <div className="grid grid-cols-1 gap-3">
          <Input
            label={t('employees.component.address')}
            placeholder="Số nhà, đường, phường, quận, tỉnh"
            leftIcon={MapPin}
            value={values.address || ''}
            onChange={(e) => setField('address', e.target.value)}
          />
        </div>
      </section>

      {/* Hiển thị lỗi chung */}
      {errors._form && (
        <p className="text-sm text-danger-600">{errors._form}</p>
      )}

      <div className="flex flex-wrap items-center justify-end gap-2 border-t border-neutral-200 pt-4">
        <Button variant="secondary" onClick={onCancel} disabled={submitting}>
          {t('employees.component.cancel')}
        </Button>
        <Button type="submit" icon={Save} loading={submitting}>
          {isEdit ? t('employees.component.saveChanges') : t('employees.component.createEmployee')}
        </Button>
      </div>
    </form>
  )
}