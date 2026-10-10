/* eslint-disable react/set-state-in-effect */
import { useEffect, useState } from 'react'

import Modal from '../common/Modal'
import Button from '../common/Button'
import Select from '../common/Select'
import RecruitmentStatusBadge from './RecruitmentStatusBadge'
import { useI18n } from '../../i18n/useI18n'

import { formatDateTime } from '../../utils/format'
import {
  APPLICATION_STATUS_LABEL,
  APPLICATION_STATUSES,
  DEPARTMENT_LABEL,
  EMPLOYMENT_TYPE_LABEL,
} from '../../data/recruitmentData'

/**
 * ApplicationDetailModal - hiển thị chi tiết + cho phép sửa note.
 */
export default function ApplicationDetailModal({
  open,
  onClose,
  application,
  job,
  onChangeStatus,
  onSaveNote,
  statusOptions = APPLICATION_STATUSES,
}) {
  const { t } = useI18n()
  const [note, setNote] = useState('')
  const [savingNote, setSavingNote] = useState(false)

  useEffect(() => {
    if (open) setNote(application?.note ?? '')
  }, [open, application])

  if (!application) return null

  const handleSaveNote = async () => {
    setSavingNote(true)
    try {
      await onSaveNote?.(application.id, note)
    } finally {
      setSavingNote(false)
    }
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={application.candidateName}
      description={t('recruitment.component.applicationCode', { id: application.id })}
      size="lg"
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>
            {t('recruitment.component.close')}
          </Button>
          <Button
            variant="primary"
            onClick={handleSaveNote}
            loading={savingNote}
            disabled={note === (application.note ?? '')}
          >
            {t('recruitment.component.saveNote')}
          </Button>
        </>
      }
    >
      <div className="flex flex-col gap-4">
        <div className="flex flex-wrap items-center gap-2">
          <RecruitmentStatusBadge kind="application" value={application.status} />
        </div>

        <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
          <Field label={t('recruitment.component.email')} value={application.email || '—'} />
          <Field label={t('recruitment.component.phone')} value={application.phone || '—'} />
          <Field label={t('recruitment.component.appliedDate')} value={application.appliedAt || '—'} />
          <Field
            label={t('recruitment.component.job')}
            value={job ? `${job.title} (${DEPARTMENT_LABEL[job.departmentId] ?? ''})` : t('recruitment.component.jobNoLongerAvailable')}
          />
          <Field label={t('recruitment.component.lastUpdated')} value={formatDateTime(application.updatedAt)} />
        </div>

        {job && (
          <div className="rounded-md bg-neutral-50 px-3 py-2 text-[13px] text-neutral-600">
            <p>
              <span className="text-neutral-500">{t('recruitment.component.employmentType')}:</span>{' '}
              <span className="font-medium text-neutral-800">
                {EMPLOYMENT_TYPE_LABEL[job.employmentType] ?? job.employmentType}
              </span>
            </p>
            <p>
              <span className="text-neutral-500">{t('recruitment.component.vacanciesNeeded')}:</span>{' '}
              <span className="font-medium text-neutral-800">{job.vacancies}</span>
            </p>
          </div>
        )}

        {onChangeStatus && (
          <Select
            label={t('recruitment.component.status')}
            options={statusOptions}
            value={application.status}
            onChange={(e) => onChangeStatus(application, e.target.value)}
            helper={t('recruitment.component.currentStatus', { status: APPLICATION_STATUS_LABEL[application.status] ?? application.status })}
          />
        )}

        <div className="flex flex-col gap-1.5">
          <label htmlFor="application-note" className="text-[13px] font-medium text-neutral-900">
            {t('recruitment.component.internalNote')}
          </label>
          <textarea
            id="application-note"
            rows={4}
            value={note}
            onChange={(e) => setNote(e.target.value)}
            placeholder={t('recruitment.component.internalNotePlaceholder')}
            className="w-full rounded-md border border-neutral-200 bg-white px-3 py-2 text-sm text-neutral-700 placeholder:text-neutral-400 focus:border-brand-600 focus:outline-none focus:ring-2 focus:ring-brand-600/20"
          />
          <p className="text-xs text-neutral-500">{t('recruitment.component.noteInternalOnly')}</p>
        </div>

        <div className="rounded-md border border-dashed border-neutral-300 bg-neutral-50 px-3 py-2 text-xs text-neutral-500">
          {t('recruitment.component.resumeNotAvailable')}
        </div>
      </div>
    </Modal>
  )
}

function Field({ label, value }) {
  return (
    <div className="rounded-md border border-neutral-200 bg-white px-3 py-2">
      <p className="text-[11px] uppercase tracking-wider text-neutral-500">{label}</p>
      <p className="mt-0.5 text-sm font-medium text-neutral-900 break-words">{value}</p>
    </div>
  )
}
