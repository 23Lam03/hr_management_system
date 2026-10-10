/* eslint-disable react/set-state-in-effect */
import { useEffect, useState } from 'react'

import Modal from '../common/Modal'
import Input from '../common/Input'
import Select from '../common/Select'
import Button from '../common/Button'
import { useI18n } from '../../i18n/useI18n'

import {
  getDepartmentOptions,
  getEmploymentTypeOptions,
  getJobStatuses,
} from '../../services/recruitmentService'

const EMPTY = {
  title: '',
  departmentId: '',
  location: '',
  employmentType: 'full_time',
  description: '',
  requirementsText: '',
  vacancies: 1,
  status: 'draft',
  closingDate: '',
}

/**
 * JobFormModal - dùng cho create + edit.
 */
export default function JobFormModal({
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
        title: initialValue.title ?? '',
        departmentId: initialValue.departmentId ?? '',
        location: initialValue.location ?? '',
        employmentType: initialValue.employmentType ?? 'full_time',
        description: initialValue.description ?? '',
        requirementsText: Array.isArray(initialValue.requirements)
          ? initialValue.requirements.join('\n')
          : '',
        vacancies: initialValue.vacancies ?? 1,
        status: initialValue.status ?? 'draft',
        closingDate: initialValue.closingDate ?? '',
      })
    } else {
      setForm(EMPTY)
    }
    setErrors({})
  }, [open, initialValue])

  const update = (field, value) => setForm((prev) => ({ ...prev, [field]: value }))

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
      title={initialValue ? t('recruitment.component.editJobPosition') : t('recruitment.component.createJobPosition')}
      description={
        initialValue
          ? t('recruitment.component.updateJobInfo')
          : t('recruitment.component.composeNewJob')
      }
      size="lg"
      footer={
        <>
          <Button variant="secondary" onClick={handleClose} disabled={submitting}>
            {t('recruitment.component.cancel')}
          </Button>
          <Button variant="primary" onClick={handleSubmit} loading={submitting}>
            {initialValue ? t('recruitment.component.saveChanges') : t('recruitment.component.createPosition')}
          </Button>
        </>
      }
    >
      <form onSubmit={handleSubmit} className="flex flex-col gap-4">
        <Input
          label={t('recruitment.component.jobTitle')}
          required
          value={form.title}
          onChange={(e) => update('title', e.target.value)}
          error={errors.title}
          placeholder={t('recruitment.component.exampleFrontendDev')}
        />

        <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
          <Select
            label={t('recruitment.component.department')}
            required
            options={getDepartmentOptions()}
            value={form.departmentId}
            onChange={(e) => update('departmentId', e.target.value)}
            error={errors.departmentId}
            placeholder={t('recruitment.component.selectDepartment')}
          />
          <Select
            label={t('recruitment.component.employmentType')}
            required
            options={getEmploymentTypeOptions()}
            value={form.employmentType}
            onChange={(e) => update('employmentType', e.target.value)}
            error={errors.employmentType}
          />
        </div>

        <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
          <Input
            label={t('recruitment.component.location')}
            value={form.location}
            onChange={(e) => update('location', e.target.value)}
            placeholder={t('recruitment.component.exampleHCM')}
          />
          <Input
            label={t('recruitment.component.numberOfVacancies')}
            type="number"
            min={1}
            required
            value={form.vacancies}
            onChange={(e) => update('vacancies', e.target.value)}
            error={errors.vacancies}
          />
        </div>

        <Input
          label={t('recruitment.component.closingDate')}
          type="date"
          value={form.closingDate}
          onChange={(e) => update('closingDate', e.target.value)}
        />

        <div className="flex flex-col gap-1.5">
          <label htmlFor="job-description" className="text-[13px] font-medium text-neutral-900">
            {t('recruitment.component.jobDescriptionRequired')} <span className="text-danger-500">*</span>
          </label>
          <textarea
            id="job-description"
            rows={3}
            value={form.description}
            onChange={(e) => update('description', e.target.value)}
            placeholder={t('recruitment.component.jobDescriptionPlaceholder')}
            aria-invalid={Boolean(errors.description)}
            className="w-full rounded-md border border-neutral-200 bg-white px-3 py-2 text-sm text-neutral-700 placeholder:text-neutral-400 focus:border-brand-600 focus:outline-none focus:ring-2 focus:ring-brand-600/20"
          />
          {errors.description && <p className="text-xs text-danger-600">{errors.description}</p>}
        </div>

        <div className="flex flex-col gap-1.5">
          <label htmlFor="job-requirements" className="text-[13px] font-medium text-neutral-900">
            {t('recruitment.component.requirementsLabel')}
          </label>
          <textarea
            id="job-requirements"
            rows={4}
            value={form.requirementsText}
            onChange={(e) => update('requirementsText', e.target.value)}
            placeholder={t('recruitment.component.requirementsPlaceholder')}
            className="w-full rounded-md border border-neutral-200 bg-white px-3 py-2 text-sm text-neutral-700 placeholder:text-neutral-400 focus:border-brand-600 focus:outline-none focus:ring-2 focus:ring-brand-600/20"
          />
          <p className="text-xs text-neutral-500">{t('recruitment.component.requirementsNote')}</p>
        </div>

        <Select
          label={t('recruitment.component.status')}
          required
          options={getJobStatuses()}
          value={form.status}
          onChange={(e) => update('status', e.target.value)}
        />
      </form>
    </Modal>
  )
}
