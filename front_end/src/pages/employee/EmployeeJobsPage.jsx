import { useEffect, useMemo, useState } from 'react'
import {
  AlertTriangle,
  Briefcase,
  Building2,
  Calendar,
  CheckCircle2,
  Clock,
  MapPin,
  X,
} from 'lucide-react'

import PageHeader from '../../components/common/PageHeader'
import Card from '../../components/common/Card'
import Button from '../../components/common/Button'
import Input from '../../components/common/Input'
import Tabs from '../../components/common/Tabs'
import EmptyState from '../../components/common/EmptyState'
import Loading from '../../components/common/Loading'
import Modal from '../../components/common/Modal'
import Badge from '../../components/common/Badge'
import Select from '../../components/common/Select'
import { useToast } from '../../components/common/useToast'

import { useAuth } from '../../contexts/useAuth'

import {
  subscribeRecruitment,
  getJobs,
  getApplicationStatusLabel,
  getJobStatusLabel,
  getApplicationsByEmployeeId,
  hasEmployeeApplied,
  createApplication,
} from '../../services/recruitmentService'

import {
  DEPARTMENT_LABEL,
  EMPLOYMENT_TYPE_LABEL,
} from '../../data/recruitmentData'

import { formatDate } from '../../utils/format'
import { useI18n } from '../../i18n/useI18n'

const EMPLOYEE_TONE = {
  new:       'info',
  screening: 'pending',
  interview: 'warning',
  offer:     'brand',
  hired:     'success',
  rejected:  'danger',
}

const PAGE_SIZE = 8

export default function EmployeeJobsPage() {
  const { t } = useI18n()
  const { user } = useAuth()
  const toast = useToast()
  const [tab, setTab] = useState('jobs')
  const [tick, setTick] = useState(0)

  const currentEmployeeId = useMemo(() => {
    if (!user) return null
    return user.employeeId ?? user.id
  }, [user])

  useEffect(() => {
    const unsub = subscribeRecruitment(() => setTick((n) => n + 1))
    return unsub
  }, [])

  if (!user) {
    return (
      <div className="flex h-40 items-center justify-center rounded-lg border border-dashed border-neutral-300 bg-white">
        <Loading size="md" label={t('common.loading')} />
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title={t('jobs.internalJobs')}
        subtitle={t('jobs.internalJobsDesc')}
        icon={Briefcase}
      />

      <Tabs
        value={tab}
        onChange={setTab}
        items={[
          { value: 'jobs', label: t('jobs.availableJobs'), icon: Briefcase },
          { value: 'applications', label: t('jobs.myApplications'), icon: CheckCircle2 },
        ]}
      />

      {tab === 'jobs' && (
        <AvailableJobsSection
          employeeId={currentEmployeeId}
          user={user}
          tick={tick}
          onApplySuccess={() => setTab('applications')}
          onApplySubmittedRefresh={() => setTick((n) => n + 1)}
          toast={toast}
          t={t}
        />
      )}

      {tab === 'applications' && (
        <MyApplicationsSection
          employeeId={currentEmployeeId}
          tick={tick}
          t={t}
        />
      )}
    </div>
  )
}

// ---------- Available Jobs ------------------------------------------------
function AvailableJobsSection({ employeeId, user, tick, onApplySuccess, onApplySubmittedRefresh, toast, t }) {
  const [search, setSearch] = useState('')
  const [department, setDepartment] = useState('')
  const [location, setLocation] = useState('')
  const [employmentType, setEmploymentType] = useState('')
  const [page, setPage] = useState(1)
  const [selectedJob, setSelectedJob] = useState(null)
  const [showApply, setShowApply] = useState(false)

  const allJobs = useMemo(() => {
    // chỉ job open (theo yêu cầu + status handling)
    void tick
    return getJobs()
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  const openJobs = useMemo(
    () => allJobs.filter((j) => j.status === 'open' && !isPastClosing(j.closingDate)),
    [allJobs],
  )

  const departmentOptions = useMemo(
    () => Array.from(new Set(openJobs.map((j) => j.departmentId).filter(Boolean))),
    [openJobs],
  )
  const locationOptions = useMemo(
    () => Array.from(new Set(openJobs.map((j) => j.location).filter(Boolean))),
    [openJobs],
  )
  const employmentTypeOptions = useMemo(
    () => Array.from(new Set(openJobs.map((j) => j.employmentType).filter(Boolean))),
    [openJobs],
  )

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase()
    return openJobs.filter((j) => {
      if (q) {
        const hay = `${j.title ?? ''} ${DEPARTMENT_LABEL[j.departmentId] ?? ''} ${j.location ?? ''}`.toLowerCase()
        if (!hay.includes(q)) return false
      }
      if (department && j.departmentId !== department) return false
      if (location && j.location !== location) return false
      if (employmentType && j.employmentType !== employmentType) return false
      return true
    })
  }, [openJobs, search, department, location, employmentType])

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE))
  const safePage = Math.min(page, totalPages)
  const pageItems = filtered.slice((safePage - 1) * PAGE_SIZE, safePage * PAGE_SIZE)

  const hasFilters = Boolean(search || department || location || employmentType)

  const clearFilters = () => {
    setSearch('')
    setDepartment('')
    setLocation('')
    setEmploymentType('')
    setPage(1)
  }

  const onSelectJob = (job) => setSelectedJob(job)
  const onCloseDetail = () => setSelectedJob(null)
  const onApplyClick = (job) => {
    setSelectedJob(job)
    setShowApply(true)
  }
  const onApplySubmitted = () => {
    onApplySubmittedRefresh?.()
    toast.success(t('jobs.applicationSubmitted'))
    setShowApply(false)
    setSelectedJob(null)
    onApplySuccess?.()
  }

  return (
    <div className="flex flex-col gap-4">
      <Card>
        <div className="grid grid-cols-1 gap-3 md:grid-cols-12">
          <div className="md:col-span-4">
            <Input
              placeholder={t('jobs.searchByTitle')}
              value={search}
              onChange={(e) => { setSearch(e.target.value); setPage(1) }}
            />
          </div>
          <div className="md:col-span-3">
            <Select
              value={department}
              onChange={(e) => { setDepartment(e.target.value); setPage(1) }}
              options={[
                { value: '', label: t('jobs.allDepartments') },
                ...departmentOptions.map((d) => ({ value: d, label: DEPARTMENT_LABEL[d] || d })),
              ]}
            />
          </div>
          <div className="md:col-span-2">
            <Select
              value={location}
              onChange={(e) => { setLocation(e.target.value); setPage(1) }}
              options={[
                { value: '', label: t('jobs.allLocations') },
                ...locationOptions.map((l) => ({ value: l, label: l })),
              ]}
            />
          </div>
          <div className="md:col-span-2">
            <Select
              value={employmentType}
              onChange={(e) => { setEmploymentType(e.target.value); setPage(1) }}
              options={[
                { value: '', label: t('jobs.allTypes') },
                ...employmentTypeOptions.map((t) => ({ value: t, label: EMPLOYMENT_TYPE_LABEL[t] || t })),
              ]}
            />
          </div>
          <div className="flex items-center justify-end md:col-span-1">
            {hasFilters && (
              <Button variant="ghost" size="sm" onClick={clearFilters} icon={X}>
                {t('jobs.clearFilters')}
              </Button>
            )}
          </div>
        </div>
      </Card>

      {openJobs.length === 0 ? (
        <Card>
          <EmptyState
            title={t('jobs.noJobsOpen')}
            description={t('jobs.jobsAppear')}
          />
        </Card>
      ) : filtered.length === 0 ? (
        <Card>
          <EmptyState
            title={t('jobs.noResults')}
            description={t('jobs.adjustFilters')}
            actionLabel={t('jobs.clearFilter')}
            onAction={clearFilters}
          />
        </Card>
      ) : (
        <>
          <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-3">
            {pageItems.map((job) => {
              const alreadyApplied = hasEmployeeApplied(job.id, employeeId)
              return (
                <Card
                  key={job.id}
                  className="cursor-pointer transition hover:border-brand-300"
                  onClick={() => onSelectJob(job)}
                >
                  <div className="flex flex-col gap-3">
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex flex-col">
                        <h3 className="text-base font-semibold text-neutral-900">{job.title || '—'}</h3>
                        <p className="text-xs text-neutral-500">
                          {DEPARTMENT_LABEL[job.departmentId] || '—'}
                        </p>
                      </div>
                      <Badge tone="success">{t('jobs.open')}</Badge>
                    </div>
                    <div className="grid grid-cols-2 gap-2 text-xs text-neutral-600">
                      <div className="flex items-center gap-1.5">
                        <MapPin className="h-3.5 w-3.5 text-neutral-400" aria-hidden="true" />
                        <span>{job.location || '—'}</span>
                      </div>
                      <div className="flex items-center gap-1.5">
                        <Building2 className="h-3.5 w-3.5 text-neutral-400" aria-hidden="true" />
                        <span>{EMPLOYMENT_TYPE_LABEL[job.employmentType] || '—'}</span>
                      </div>
                      <div className="flex items-center gap-1.5">
                        <Briefcase className="h-3.5 w-3.5 text-neutral-400" aria-hidden="true" />
                        <span>{t('jobs.vacancies')}: {job.vacancies ?? '—'}</span>
                      </div>
                      {job.closingDate && (
                        <div className="flex items-center gap-1.5">
                          <Calendar className="h-3.5 w-3.5 text-neutral-400" aria-hidden="true" />
                          <span>{t('jobs.deadline')}: {formatDate(job.closingDate)}</span>
                        </div>
                      )}
                    </div>
                    {alreadyApplied && (
                      <div className="flex items-center gap-1.5 rounded-md bg-success-50 px-2 py-1.5 text-xs text-success-700">
                        <CheckCircle2 className="h-3.5 w-3.5" aria-hidden="true" />
                        <span>{t('jobs.applied')}</span>
                      </div>
                    )}
                  </div>
                </Card>
              )
            })}
          </div>
          {totalPages > 1 && (
            <Pagination page={safePage} totalPages={totalPages} onChange={setPage} t={t} />
          )}
        </>
      )}

      {selectedJob && !showApply && (
        <JobDetailModal
          job={selectedJob}
          employeeId={employeeId}
          onClose={onCloseDetail}
          onApply={() => onApplyClick(selectedJob)}
          t={t}
        />
      )}

      {selectedJob && showApply && (
        <ApplyModal
          job={selectedJob}
          user={user}
          employeeId={employeeId}
          onClose={() => setShowApply(false)}
          onSubmitted={onApplySubmitted}
          t={t}
        />
      )}
    </div>
  )
}

// ---------- Job Detail Modal ----------------------------------------------
function JobDetailModal({ job, employeeId, onClose, onApply, t }) {
  const alreadyApplied = hasEmployeeApplied(job.id, employeeId)
  const pastClosing = isPastClosing(job.closingDate)

  return (
    <Modal
      open
      onClose={onClose}
      size="lg"
      title={job.title || t('jobs.jobDetail')}
      description={DEPARTMENT_LABEL[job.departmentId] || '—'}
      footer={
        <div className="flex flex-wrap items-center justify-end gap-2">
          <Button variant="secondary" onClick={onClose}>{t('common.close')}</Button>
          <Button
            variant="primary"
            icon={Briefcase}
            disabled={alreadyApplied || pastClosing}
            onClick={onApply}
          >
            {alreadyApplied ? t('jobs.alreadyApplied') : t('jobs.applyNow')}
          </Button>
        </div>
      }
    >
      <div className="flex flex-col gap-4">
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <DetailRow label={t('jobs.department')} value={DEPARTMENT_LABEL[job.departmentId] || '—'} />
          <DetailRow label={t('jobs.location')} value={job.location || '—'} />
          <DetailRow label={t('jobs.employmentType')} value={EMPLOYMENT_TYPE_LABEL[job.employmentType] || '—'} />
          <DetailRow label={t('jobs.vacancies')} value={job.vacancies != null ? String(job.vacancies) : '—'} />
          <DetailRow label={t('jobs.posted')} value={formatDate(job.postedAt) || '—'} />
          <DetailRow label={t('jobs.closingDate')} value={formatDate(job.closingDate) || '—'} />
          <DetailRow label={t('jobs.status')} value={getJobStatusLabel(job.status) || '—'} />
        </div>

        <DetailBlock label={t('jobs.description')} value={job.description || '—'} />
        <DetailBlock
          label={t('jobs.requirements')}
          value={
            Array.isArray(job.requirements) && job.requirements.length > 0
              ? (
                <ul className="list-disc space-y-1 pl-5 text-sm text-neutral-700">
                  {job.requirements.map((r, i) => <li key={i}>{r}</li>)}
                </ul>
              )
              : '—'
          }
        />

        {alreadyApplied && (
          <div className="rounded-md border border-success-200 bg-success-50 px-3 py-2 text-sm text-success-700">
            {t('jobs.alreadyAppliedMessage')}
          </div>
        )}
        {!alreadyApplied && pastClosing && (
          <div className="rounded-md border border-warning-200 bg-warning-50 px-3 py-2 text-sm text-warning-700">
            {t('jobs.deadlinePassed')}
          </div>
        )}
      </div>
    </Modal>
  )
}

function DetailRow({ label, value }) {
  return (
    <div className="flex flex-col gap-1">
      <span className="text-xs font-medium uppercase tracking-wide text-neutral-500">{label}</span>
      <span className="text-sm text-neutral-900">{value}</span>
    </div>
  )
}

function DetailBlock({ label, value }) {
  return (
    <div className="flex flex-col gap-1">
      <span className="text-xs font-medium uppercase tracking-wide text-neutral-500">{label}</span>
      <div className="rounded-md border border-neutral-200 bg-neutral-50 px-3 py-2 text-sm text-neutral-700">
        {value}
      </div>
    </div>
  )
}

// ---------- Apply Modal ---------------------------------------------------
function ApplyModal({ job, user, employeeId, onClose, onSubmitted, t }) {
  const toast = useToast()
  const [form, setForm] = useState({
    candidateName: user?.name || '',
    email: user?.email || '',
    phone: user?.phone || '',
    note: '',
  })
  const [errors, setErrors] = useState({})
  const [submitting, setSubmitting] = useState(false)
  const [serverError, setServerError] = useState('')

  const update = (field) => (e) => {
    const value = e?.target ? e.target.value : e
    setForm((p) => ({ ...p, [field]: value }))
  }

  const validate = () => {
    const next = {}
    if (!form.candidateName.trim()) next.candidateName = t('validation.nameRequired')
    if (!form.email.trim()) next.email = t('validation.emailRequired')
    else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email.trim())) next.email = t('validation.emailInvalid')
    if (form.phone && !/^[0-9+\-\s()]{6,20}$/.test(form.phone.trim())) next.phone = t('validation.phoneInvalid')
    setErrors(next)
    return Object.keys(next).length === 0
  }

  const handleSubmit = async () => {
    if (!validate()) return
    setSubmitting(true)
    setServerError('')
    try {
      const res = await createApplication({
        jobId: job.id,
        employeeId,
        candidateName: form.candidateName,
        email: form.email,
        phone: form.phone,
        note: form.note,
      })
      if (!res?.ok) {
        setServerError(res?.error || t('jobs.submitFailed'))
        return
      }
      onSubmitted?.()
    } catch (err) {
      void toast
      setServerError(err?.message || t('jobs.submitFailed'))
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <Modal
      open
      onClose={submitting ? undefined : onClose}
      size="md"
      title={t('jobs.applyForJob')}
      description={job.title}
      footer={
        <div className="flex flex-wrap items-center justify-end gap-2">
          <Button variant="secondary" onClick={onClose} disabled={submitting}>{t('common.cancel')}</Button>
          <Button variant="primary" onClick={handleSubmit} loading={submitting}>
            {t('jobs.submitApplication')}
          </Button>
        </div>
      }
    >
      <div className="flex flex-col gap-3">
        <div className="rounded-md border border-neutral-200 bg-neutral-50 px-3 py-2 text-sm text-neutral-700">
          <p><b>{t('jobs.job')}:</b> {job.title}</p>
          <p><b>{t('jobs.department')}:</b> {DEPARTMENT_LABEL[job.departmentId] || '—'}</p>
          <p><b>{t('jobs.location')}:</b> {job.location || '—'}</p>
        </div>
        <Field label={t('jobs.fullName')} required error={errors.candidateName}>
          <Input value={form.candidateName} onChange={update('candidateName')} placeholder={t('jobs.namePlaceholder')} />
        </Field>
        <Field label={t('jobs.email')} required error={errors.email}>
          <Input type="email" value={form.email} onChange={update('email')} placeholder="email@example.com" />
        </Field>
        <Field label={t('jobs.phone')} error={errors.phone}>
          <Input value={form.phone} onChange={update('phone')} placeholder="0900000000" />
        </Field>
        <Field label={t('jobs.note')}>
          <textarea
            value={form.note}
            onChange={update('note')}
            rows={4}
            placeholder={t('jobs.notePlaceholder')}
            className="w-full rounded-md border border-neutral-200 bg-white px-3 py-2 text-sm text-neutral-700 placeholder:text-neutral-400 focus:border-brand-600 focus:outline-none focus:ring-2 focus:ring-brand-600/20"
          />
        </Field>
        {serverError && (
          <div className="flex items-start gap-2 rounded-md border border-danger-200 bg-danger-50 px-3 py-2 text-sm text-danger-700">
            <AlertTriangle className="mt-0.5 h-4 w-4" aria-hidden="true" />
            <span>{serverError}</span>
          </div>
        )}
      </div>
    </Modal>
  )
}

function Field({ label, required, error, children }) {
  return (
    <div className="flex flex-col gap-1.5">
      <label className="text-[13px] font-medium text-neutral-900">
        {label}{required && <span className="text-danger-500"> *</span>}
      </label>
      {children}
      {error && <p className="text-xs text-danger-600">{error}</p>}
    </div>
  )
}

// ---------- My Applications -----------------------------------------------
function MyApplicationsSection({ employeeId, tick, t }) {
  const [search, setSearch] = useState('')
  const [status, setStatus] = useState('')
  const [page, setPage] = useState(1)
  const [selectedApp, setSelectedApp] = useState(null)

  // eslint-disable-next-line react-hooks/exhaustive-deps
  const allJobs = useMemo(() => getJobs(), [tick])

  const items = useMemo(() => {
    const list = getApplicationsByEmployeeId(employeeId) || []
    const q = search.trim().toLowerCase()
    return list.filter((a) => {
      if (status && a.status !== status) return false
      if (q) {
        const job = allJobs.find((j) => j.id === a.jobId)
        const hay = `${job?.title || ''} ${DEPARTMENT_LABEL[job?.departmentId] || ''} ${a.candidateName || ''}`.toLowerCase()
        if (!hay.includes(q)) return false
      }
      return true
    })
  }, [employeeId, allJobs, search, status])

  const totalPages = Math.max(1, Math.ceil(items.length / PAGE_SIZE))
  const safePage = Math.min(page, totalPages)
  const pageItems = items.slice((safePage - 1) * PAGE_SIZE, safePage * PAGE_SIZE)

  return (
    <div className="flex flex-col gap-4">
      <Card>
        <div className="grid grid-cols-1 gap-3 md:grid-cols-12">
          <div className="md:col-span-7">
            <Input
              placeholder={t('jobs.searchByJob')}
              value={search}
              onChange={(e) => { setSearch(e.target.value); setPage(1) }}
            />
          </div>
          <div className="md:col-span-3">
            <Select
              value={status}
              onChange={(e) => { setStatus(e.target.value); setPage(1) }}
              options={[
                { value: '', label: t('jobs.allStatuses') },
                { value: 'new', label: t('jobs.statusNew') },
                { value: 'screening', label: t('jobs.statusScreening') },
                { value: 'interview', label: t('jobs.statusInterview') },
                { value: 'offer', label: t('jobs.statusOffer') },
                { value: 'hired', label: t('jobs.statusHired') },
                { value: 'rejected', label: t('jobs.statusRejected') },
              ]}
            />
          </div>
        </div>
      </Card>

      {items.length === 0 ? (
        <Card>
          <EmptyState
            title={t("jobs.noApplications")}
            description={t("jobs.exploreJobsHint")}
          />
        </Card>
      ) : (
        <Card>
          <div className="flex flex-col gap-2">
            {pageItems.map((app) => {
              const job = allJobs.find((j) => j.id === app.jobId)
              return (
                <button
                  key={app.id}
                  type="button"
                  onClick={() => setSelectedApp({ app, job })}
                  className="flex flex-col gap-2 rounded-md border border-neutral-200 bg-white px-3 py-2 text-left transition hover:border-brand-300 hover:bg-brand-50"
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex flex-col">
                      <span className="text-sm font-semibold text-neutral-900">
                        {job?.title || '—'}
                      </span>
                      <span className="text-xs text-neutral-500">
                        {DEPARTMENT_LABEL[job?.departmentId] || '—'}
                      </span>
                    </div>
                    <Badge tone={EMPLOYEE_TONE[app.status] || 'neutral'}>
                      {getApplicationStatusLabel(app.status) || '—'}
                    </Badge>
                  </div>
                  <div className="flex flex-wrap items-center gap-3 text-xs text-neutral-600">
                    {job?.location && (
                      <span className="flex items-center gap-1"><MapPin className="h-3.5 w-3.5" aria-hidden="true" /> {job.location}</span>
                    )}
                    {job?.employmentType && (
                      <span className="flex items-center gap-1"><Briefcase className="h-3.5 w-3.5" aria-hidden="true" /> {EMPLOYMENT_TYPE_LABEL[job.employmentType] || job.employmentType}</span>
                    )}
                    <span className="flex items-center gap-1"><Clock className="h-3.5 w-3.5" aria-hidden="true" /> {t('jobs.applied')} {formatDate(app.appliedAt) || '—'}</span>
                  </div>
                </button>
              )
            })}
          </div>
          {totalPages > 1 && (
            <div className="mt-3">
              <Pagination page={safePage} totalPages={totalPages} onChange={setPage} t={t} />
            </div>
          )}
        </Card>
      )}

      {selectedApp && (
        <ApplicationDetailModal
          app={selectedApp.app}
          job={selectedApp.job}
          onClose={() => setSelectedApp(null)}
          t={t}
        />
      )}
    </div>
  )
}

function ApplicationDetailModal({ app, job, onClose, t }) {
  return (
    <Modal
      open
      onClose={onClose}
      size="md"
      title={t('jobs.applicationDetail')}
      description={job?.title || '—'}
      footer={
        <div className="flex justify-end">
          <Button variant="secondary" onClick={onClose}>{t('common.close')}</Button>
        </div>
      }
    >
      <div className="flex flex-col gap-3">
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <DetailRow label={t('jobs.job')} value={job?.title || '—'} />
          <DetailRow label={t('jobs.department')} value={DEPARTMENT_LABEL[job?.departmentId] || '—'} />
          <DetailRow label={t('jobs.location')} value={job?.location || '—'} />
          <DetailRow label={t('jobs.employmentType')} value={EMPLOYMENT_TYPE_LABEL[job?.employmentType] || '—'} />
          <DetailRow label={t('jobs.appliedDate')} value={formatDate(app.appliedAt) || '—'} />
          <DetailRow
            label={t('jobs.status')}
            value={
              <Badge tone={EMPLOYEE_TONE[app.status] || 'neutral'}>
                {getApplicationStatusLabel(app.status) || '—'}
              </Badge>
            }
          />
          <DetailRow label={t('jobs.candidate')} value={app.candidateName || '—'} />
          <DetailRow label={t('jobs.email')} value={app.email || '—'} />
          <DetailRow label={t('jobs.phone')} value={app.phone || '—'} />
        </div>
        <DetailBlock label={t('jobs.note')} value={app.note || '—'} />
        <p className="text-xs text-neutral-500">
          {t('jobs.applicationManagedNote')}
        </p>
      </div>
    </Modal>
  )
}

// ---------- helpers -------------------------------------------------------
function isPastClosing(dateStr) {
  if (!dateStr) return false
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  const d = new Date(dateStr)
  if (Number.isNaN(d.getTime())) return false
  return d.getTime() < today.getTime()
}

function Pagination({ page, totalPages, onChange, t }) {
  return (
    <div className="flex items-center justify-between rounded-md border border-neutral-200 bg-white px-3 py-2 text-sm">
      <span className="text-neutral-500">{t('common.page')} {page}/{totalPages}</span>
      <div className="flex gap-2">
        <Button variant="secondary" size="sm" disabled={page <= 1} onClick={() => onChange(page - 1)}>{t('common.prev')}</Button>
        <Button variant="secondary" size="sm" disabled={page >= totalPages} onClick={() => onChange(page + 1)}>{t('common.next')}</Button>
      </div>
    </div>
  )
}