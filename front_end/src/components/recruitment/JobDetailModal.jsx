import Modal from '../common/Modal'
import RecruitmentStatusBadge from './RecruitmentStatusBadge'
import { useI18n } from '../../i18n/useI18n'

import { formatDate, formatDateTime } from '../../utils/format'
import { DEPARTMENT_LABEL, EMPLOYMENT_TYPE_LABEL } from '../../data/recruitmentData'

/**
 * JobDetailModal - hiển thị chi tiết 1 job.
 */
export default function JobDetailModal({
  open,
  onClose,
  job,
  applicationCount = 0,
}) {
  const { t } = useI18n()
  if (!job) return null
  const deptName = DEPARTMENT_LABEL[job.departmentId] ?? job.departmentId
  const empType = EMPLOYMENT_TYPE_LABEL[job.employmentType] ?? job.employmentType

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={job.title}
      description={t('recruitment.component.jobCode', { id: job.id })}
      size="lg"
      footer={null}
    >
      <div className="flex flex-col gap-4">
        <div className="flex flex-wrap items-center gap-2">
          <RecruitmentStatusBadge kind="job" value={job.status} />
          <span className="text-[13px] text-neutral-500">{empType}</span>
        </div>

        <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
          <DetailItem label={t('recruitment.component.department')} value={deptName} />
          <DetailItem label={t('recruitment.component.location')} value={job.location || '—'} />
          <DetailItem label={t('recruitment.component.vacancies')} value={String(job.vacancies)} />
          <DetailItem label={t('recruitment.component.applications')} value={String(applicationCount)} />
          <DetailItem label={t('recruitment.component.postedDate')} value={job.postedAt ? formatDate(job.postedAt) : '—'} />
          <DetailItem label={t('recruitment.component.closingDate')} value={job.closingDate ? formatDate(job.closingDate) : '—'} />
        </div>

        <section>
          <h4 className="mb-1 text-[13px] font-semibold uppercase tracking-wider text-neutral-500">
            {t('recruitment.component.description')}
          </h4>
          <p className="whitespace-pre-line rounded-md bg-neutral-50 px-3 py-2 text-sm text-neutral-800">
            {job.description}
          </p>
        </section>

        <section>
          <h4 className="mb-1 text-[13px] font-semibold uppercase tracking-wider text-neutral-500">
            {t('recruitment.component.requirements')}
          </h4>
          {Array.isArray(job.requirements) && job.requirements.length > 0 ? (
            <ul className="list-disc space-y-1 pl-5 text-sm text-neutral-800">
              {job.requirements.map((r) => (
                <li key={r}>{r}</li>
              ))}
            </ul>
          ) : (
            <p className="text-sm text-neutral-500">{t('recruitment.component.noSpecificRequirements')}</p>
          )}
        </section>

        <section className="rounded-md border border-neutral-200 bg-neutral-50 px-3 py-2 text-[13px] text-neutral-500">
          <div>{t('recruitment.component.createdBy')}: <span className="font-medium text-neutral-700">{job.createdBy}</span></div>
          <div>{t('recruitment.component.lastUpdatedBy')}: <span className="font-medium text-neutral-700">{formatDateTime(job.updatedAt)}</span></div>
        </section>
      </div>
    </Modal>
  )
}

function DetailItem({ label, value }) {
  return (
    <div className="rounded-md border border-neutral-200 bg-white px-3 py-2">
      <p className="text-[11px] uppercase tracking-wider text-neutral-500">{label}</p>
      <p className="mt-0.5 text-sm font-medium text-neutral-900">{value}</p>
    </div>
  )
}
