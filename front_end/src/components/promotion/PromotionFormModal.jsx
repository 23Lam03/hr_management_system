/* eslint-disable react/set-state-in-effect */
import { useEffect, useState } from 'react'

import Modal from '../common/Modal'
import Input from '../common/Input'
import Select from '../common/Select'
import Button from '../common/Button'
import { useI18n } from '../../i18n/useI18n'

import { getPromotionStatuses } from '../../services/promotionService'
import { EMPLOYEES, DEPARTMENTS } from '../../data/employeeMockData'

const departmentName = (id) => DEPARTMENTS.find((d) => d.id === id)?.name ?? ''

const EMPLOYEE_OPTIONS = EMPLOYEES.map((e) => ({
  value: e.id,
  label: `${e.fullName} (${e.employeeCode})`,
  position: e.position ?? '',
  departmentId: e.departmentId ?? '',
}))

const EMPTY = {
  employeeId: '',
  currentPosition: '',
  proposedPosition: '',
  currentDepartment: '',
  proposedDepartment: '',
  reason: '',
  effectiveDate: '',
  status: 'pending',
  note: '',
}

/**
 * PromotionFormModal - tạo + sửa promotion record.
 */
export default function PromotionFormModal({
  open,
  onClose,
  onSubmit,
  initialValue = null,
  submitting = false,
}) {
  const { t } = useI18n()
  const [form, setForm] = useState(EMPTY)
  const [errors, setErrors] = useState({})

  useEffect(() => {
    if (!open) return
    if (initialValue) {
      setForm({
        employeeId: initialValue.employeeId ?? '',
        currentPosition: initialValue.currentPosition ?? '',
        proposedPosition: initialValue.proposedPosition ?? '',
        currentDepartment: initialValue.currentDepartment ?? '',
        proposedDepartment: initialValue.proposedDepartment ?? '',
        reason: initialValue.reason ?? '',
        effectiveDate: initialValue.effectiveDate ?? '',
        status: initialValue.status ?? 'pending',
        note: initialValue.note ?? '',
      })
    } else {
      setForm(EMPTY)
    }
    setErrors({})
  }, [open, initialValue])

  const update = (field, value) => setForm((prev) => ({ ...prev, [field]: value }))

  const handleEmployeeChange = (employeeId) => {
    const emp = EMPLOYEES.find((e) => e.id === employeeId)
    if (!emp) {
      update('employeeId', employeeId)
      return
    }
    setForm((prev) => ({
      ...prev,
      employeeId,
      currentPosition: emp.position ?? prev.currentPosition,
      currentDepartment: departmentName(emp.departmentId) || prev.currentDepartment,
      proposedDepartment: prev.proposedDepartment || departmentName(emp.departmentId) || '',
    }))
  }

  const handleSubmit = async (e) => {
    e?.preventDefault?.()
    const result = await onSubmit?.(form)
    if (result && result.ok === false) {
      setErrors(result.errors ?? {})
    } else {
      setErrors({})
    }
  }

  const handleClose = () => {
    setErrors({})
    onClose?.()
  }

  return (
    <Modal
      open={open}
      onClose={handleClose}
      title={initialValue ? t('promotions.component.editPromotionRecord') : t('promotions.component.createPromotionRecord')}
      description={
        initialValue
          ? t('promotions.component.updatePromotionInfo')
          : t('promotions.component.createPromotionInfo')
      }
      size="lg"
      footer={
        <>
          <Button variant="secondary" onClick={handleClose} disabled={submitting}>
            {t('promotions.component.cancel')}
          </Button>
          <Button variant="primary" onClick={handleSubmit} loading={submitting}>
            {initialValue ? t('promotions.component.saveChanges') : t('promotions.component.createPromotion')}
          </Button>
        </>
      }
    >
      <form onSubmit={handleSubmit} className="flex flex-col gap-4">
        <Select
          label={t('promotions.component.employee')}
          required
          options={EMPLOYEE_OPTIONS.map((opt) => ({ value: opt.value, label: opt.label }))}
          value={form.employeeId}
          onChange={(e) => handleEmployeeChange(e.target.value)}
          error={errors.employeeId}
          placeholder={t('promotions.component.selectEmployee')}
          helper={
            form.employeeId
              ? t('promotions.component.currentPositionAutoFilled')
              : undefined
          }
        />

        <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
          <Input
            label={t('promotions.component.currentPositionLabel')}
            value={form.currentPosition}
            onChange={(e) => update('currentPosition', e.target.value)}
          />
          <Input
            label={t('promotions.component.proposedPositionLabel')}
            required
            value={form.proposedPosition}
            onChange={(e) => update('proposedPosition', e.target.value)}
            error={errors.proposedPosition}
            placeholder="VD: Senior Frontend Engineer"
          />
        </div>

        <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
          <Input
            label={t('promotions.component.currentDepartmentLabel')}
            value={form.currentDepartment}
            onChange={(e) => update('currentDepartment', e.target.value)}
          />
          <Input
            label={t('promotions.component.proposedDepartmentLabel')}
            value={form.proposedDepartment}
            onChange={(e) => update('proposedDepartment', e.target.value)}
            helper={t('promotions.component.proposedDepartmentHelper')}
          />
        </div>

        <div className="flex flex-col gap-1.5">
          <label htmlFor="promotion-reason" className="text-[13px] font-medium text-neutral-900">
            {t('promotions.component.reasonLabel')} <span className="text-danger-500">*</span>
          </label>
          <textarea
            id="promotion-reason"
            rows={3}
            value={form.reason}
            onChange={(e) => update('reason', e.target.value)}
            placeholder={t('promotions.component.reasonRequired')}
            aria-invalid={Boolean(errors.reason)}
            className="w-full rounded-md border border-neutral-200 bg-white px-3 py-2 text-sm text-neutral-700 placeholder:text-neutral-400 focus:border-brand-600 focus:outline-none focus:ring-2 focus:ring-brand-600/20"
          />
          {errors.reason && <p className="text-xs text-danger-600">{errors.reason}</p>}
        </div>

        <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
          <Input
            label={t('promotions.component.effectiveDateLabel')}
            type="date"
            required
            value={form.effectiveDate}
            onChange={(e) => update('effectiveDate', e.target.value)}
            error={errors.effectiveDate}
          />
          <Select
            label={t('promotions.component.statusLabel')}
            required
            options={getPromotionStatuses()}
            value={form.status}
            onChange={(e) => update('status', e.target.value)}
          />
        </div>

        <div className="flex flex-col gap-1.5">
          <label htmlFor="promotion-note" className="text-[13px] font-medium text-neutral-900">
            {t('promotions.component.internalNoteLabel')}
          </label>
          <textarea
            id="promotion-note"
            rows={2}
            value={form.note}
            onChange={(e) => update('note', e.target.value)}
            placeholder={t('promotions.component.internalNotePlaceholder')}
            className="w-full rounded-md border border-neutral-200 bg-white px-3 py-2 text-sm text-neutral-700 placeholder:text-neutral-400 focus:border-brand-600 focus:outline-none focus:ring-2 focus:ring-brand-600/20"
          />
        </div>
      </form>
    </Modal>
  )
}
