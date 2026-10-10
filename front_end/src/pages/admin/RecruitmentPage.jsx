import { useCallback, useEffect, useMemo, useState } from 'react'
import { Briefcase, ClipboardList, Plus, RefreshCcw, Users } from 'lucide-react'

import PageHeader from '../../components/common/PageHeader'
import Card from '../../components/common/Card'
import Button from '../../components/common/Button'
import Input from '../../components/common/Input'
import Select from '../../components/common/Select'
import Loading from '../../components/common/Loading'
import Tabs from '../../components/common/Tabs'
import { useToast } from '../../components/common/useToast'
import { useI18n } from '../../i18n/useI18n'

import RecruitmentSummaryTiles from '../../components/recruitment/RecruitmentSummaryTiles'
import JobTable from '../../components/recruitment/JobTable'
import JobFormModal from '../../components/recruitment/JobFormModal'
import JobDetailModal from '../../components/recruitment/JobDetailModal'
import ApplicationTable from '../../components/recruitment/ApplicationTable'
import ApplicationDetailModal from '../../components/recruitment/ApplicationDetailModal'
import RecruitmentConfirmModal from '../../components/recruitment/RecruitmentConfirmModal'

import {
  queryJobs,
  queryApplications,
  getRecruitmentSummary,
  getJobById as svcGetJobById,
  getJobStatuses,
  getApplicationStatuses,
  getEmploymentTypeOptions,
  getDepartmentOptions,
  createJob,
  updateJob,
  updateJobStatus,
  deleteJob,
  updateApplicationStatus,
  updateApplicationNote,
  deleteApplication,
  subscribeRecruitment,
} from '../../services/recruitmentService'

const PAGE_SIZE = 10

export default function RecruitmentPage() {
  const { t } = useI18n()
  const toast = useToast()
  const [version, setVersion] = useState(0)
  const [activeTab, setActiveTab] = useState('jobs')

  // Filters & pagination cho Jobs
  const [jobFilters, setJobFilters] = useState({
    search: '',
    status: '',
    employmentType: '',
    departmentId: '',
    sortBy: 'postedAt',
    sortDir: 'desc',
    page: 1,
  })
  const [jobSubmitting, setJobSubmitting] = useState(false)
  const [jobFormOpen, setJobFormOpen] = useState(false)
  const [editingJob, setEditingJob] = useState(null)
  const [detailJob, setDetailJob] = useState(null)
  const [deleteJobTarget, setDeleteJobTarget] = useState(null)

  // Filters & pagination cho Applications
  const [appFilters, setAppFilters] = useState({
    search: '',
    status: '',
    jobId: '',
    sortBy: 'appliedAt',
    sortDir: 'desc',
    page: 1,
  })
  const [detailApp, setDetailApp] = useState(null)
  const [deleteAppTarget, setDeleteAppTarget] = useState(null)

  // Pub-sub
  useEffect(() => {
    const unsub = subscribeRecruitment(() => setVersion((v) => v + 1))
    return () => unsub()
  }, [])

  const refresh = useCallback(() => {
    setVersion((v) => v + 1)
    toast.success(t('admin.recruitmentDataRefreshed'))
  }, [toast, t])

  // Derived data
  const jobQuery = useMemo(() => queryJobs({
    search: jobFilters.search,
    status: jobFilters.status,
    employmentType: jobFilters.employmentType,
    departmentId: jobFilters.departmentId,
    sortBy: jobFilters.sortBy,
    sortDir: jobFilters.sortDir,
    page: jobFilters.page,
    pageSize: PAGE_SIZE,
  }), [jobFilters, version]) // eslint-disable-line react-hooks/exhaustive-deps

  const appQuery = useMemo(() => {
    const r = queryApplications({
      search: appFilters.search,
      status: appFilters.status,
      jobId: appFilters.jobId,
      sortBy: appFilters.sortBy,
      sortDir: appFilters.sortDir,
      page: appFilters.page,
      pageSize: PAGE_SIZE,
    })
    return {
      ...r,
      items: r.items.map((a) => {
        const job = svcGetJobById(a.jobId)
        return { ...a, jobTitle: job?.title ?? null }
      }),
    }
  }, [appFilters, version]) // eslint-disable-line react-hooks/exhaustive-deps

  const summary = useMemo(() => getRecruitmentSummary(), [version]) // eslint-disable-line react-hooks/exhaustive-deps

  const jobStatusOptions = getJobStatuses()
  const appStatusOptions = getApplicationStatuses()

  // ----------- Handlers: Jobs -----------
  const updateJobFilter = (field) => (value) => {
    setJobFilters((prev) => ({ ...prev, [field]: value, page: 1 }))
  }

  const handleSortJobs = (sortBy, sortDir) => {
    setJobFilters((prev) => ({ ...prev, sortBy, sortDir, page: 1 }))
  }

  const handleOpenCreateJob = () => {
    setEditingJob(null)
    setJobFormOpen(true)
  }

  const handleOpenEditJob = (row) => {
    setEditingJob(row)
    setJobFormOpen(true)
  }

  const handleSubmitJob = async (form) => {
    setJobSubmitting(true)
    try {
      const result = editingJob
        ? await updateJob(editingJob.id, form)
        : await createJob(form)
      if (result.ok) {
        toast.success(editingJob ? t('admin.jobUpdated') : t('admin.jobCreated'))
        setJobFormOpen(false)
        setEditingJob(null)
        return { ok: true }
      }
      if (result.error === 'hasApplications') {
        toast.error(t('admin.cannotDeleteJobWithApplications'))
        return { ok: false }
      }
      toast.error(t('admin.cannotSaveJobFields'))
      return { ok: false, errors: result.errors ?? {} }
    } catch (_e) {
      void _e
      toast.error('Something went wrong.')
      return { ok: false }
    } finally {
      setJobSubmitting(false)
    }
  }

  const handleChangeJobStatus = async (row, status) => {
    const result = await updateJobStatus(row.id, status)
    if (result.ok) {
      toast.success(t('admin.jobStatusUpdated'))
    } else {
      toast.error(t('admin.cannotUpdateJob'))
    }
  }

  const handleDeleteJobConfirm = async () => {
    if (!deleteJobTarget) return
    const result = await deleteJob(deleteJobTarget.id)
    if (result.ok) {
      toast.success(t('admin.jobDeleted'))
    } else if (result.error === 'hasApplications') {
      toast.error(t('admin.jobHasApplications'))
    } else {
      toast.error('Something went wrong.')
    }
    setDeleteJobTarget(null)
  }

  // ----------- Handlers: Applications -----------
  const updateAppFilter = (field) => (value) => {
    setAppFilters((prev) => ({ ...prev, [field]: value, page: 1 }))
  }

  const handleSortApps = (sortBy, sortDir) => {
    setAppFilters((prev) => ({ ...prev, sortBy, sortDir, page: 1 }))
  }

  const handleViewApp = (row) => {
    setDetailApp(row)
  }

  const handleEditApp = (row) => {
    setDetailApp(row)
  }

  const handleChangeAppStatus = async (row, status) => {
    const result = await updateApplicationStatus(row.id, status)
    if (result.ok) {
      toast.success(t('admin.applicationStatusUpdated'))
      if (detailApp && detailApp.id === row.id) {
        setDetailApp({ ...detailApp, status })
      }
    } else {
      toast.error('Something went wrong.')
    }
  }

  const handleSaveAppNote = async (id, note) => {
    const result = await updateApplicationNote(id, note)
    if (result.ok) {
      toast.success(t('admin.applicationNoteSaved'))
      if (detailApp && detailApp.id === id) {
        setDetailApp({ ...detailApp, note })
      }
    } else {
      toast.error('Something went wrong.')
    }
    return result
  }

  const handleDeleteAppConfirm = async () => {
    if (!deleteAppTarget) return
    const result = await deleteApplication(deleteAppTarget.id)
    if (result.ok) {
      toast.success(t('admin.applicationDeleted'))
    } else {
      toast.error('Something went wrong.')
    }
    setDeleteAppTarget(null)
  }

  // ----------- Tabs -----------
  const tabs = [
    {
      id: 'jobs',
      label: t('admin.jobsTab'),
      icon: Briefcase,
      badge: summary.totalJobs,
      panel: (
        <div className="flex flex-col gap-4">
          <Card>
            <div className="grid grid-cols-1 gap-3 md:grid-cols-12">
              <div className="md:col-span-5">
                <Input
                  placeholder={t('admin.searchJobsPlaceholder')}
                  value={jobFilters.search}
                  onChange={(e) => updateJobFilter('search')(e.target.value)}
                />
              </div>
              <div className="md:col-span-3">
                <Select
                  options={[{ value: '', label: t('admin.allStatuses') }, ...jobStatusOptions.map((s) => ({ value: s.value, label: s.label }))]}
                  value={jobFilters.status}
                  onChange={(e) => updateJobFilter('status')(e.target.value)}
                />
              </div>
              <div className="md:col-span-2">
                <Select
                  options={[{ value: '', label: t('admin.allDepartments') }, ...getDepartmentOptions()]}
                  value={jobFilters.departmentId}
                  onChange={(e) => updateJobFilter('departmentId')(e.target.value)}
                />
              </div>
              <div className="md:col-span-2">
                <Select
                  options={[{ value: '', label: t('admin.allTypes') }, ...getEmploymentTypeOptions()]}
                  value={jobFilters.employmentType}
                  onChange={(e) => updateJobFilter('employmentType')(e.target.value)}
                />
              </div>
            </div>
            {(jobFilters.search || jobFilters.status || jobFilters.employmentType || jobFilters.departmentId) && (
              <div className="mt-3 flex justify-end">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setJobFilters((p) => ({ ...p, search: '', status: '', employmentType: '', departmentId: '', page: 1 }))}
                >
                  {t('admin.resetFilters')}
                </Button>
              </div>
            )}
          </Card>

          <JobTable
                rows={jobQuery.items}
                loading={false}
                pagination={{
                  page: jobQuery.page,
                  pageSize: jobQuery.pageSize,
                  total: jobQuery.total,
                  onChange: (p) => setJobFilters((prev) => ({ ...prev, page: p })),
                }}
                sortBy={jobFilters.sortBy}
                sortDir={jobFilters.sortDir}
                onSortChange={handleSortJobs}
                statusOptions={jobStatusOptions}
                onView={setDetailJob}
                onEdit={handleOpenEditJob}
                onDelete={setDeleteJobTarget}
                onChangeStatus={handleChangeJobStatus}
              />
        </div>
      ),
    },
    {
      id: 'applications',
      label: t('admin.applicationsTab'),
      icon: Users,
      badge: summary.totalApplications,
      panel: (
        <div className="flex flex-col gap-4">
          <Card>
            <div className="grid grid-cols-1 gap-3 md:grid-cols-12">
              <div className="md:col-span-5">
                <Input
                  placeholder={t('admin.searchAppsPlaceholder')}
                  value={appFilters.search}
                  onChange={(e) => updateAppFilter('search')(e.target.value)}
                />
              </div>
              <div className="md:col-span-3">
                <Select
                  options={[{ value: '', label: t('admin.allStatuses') }, ...appStatusOptions.map((s) => ({ value: s.value, label: s.label }))]}
                  value={appFilters.status}
                  onChange={(e) => updateAppFilter('status')(e.target.value)}
                />
              </div>
              <div className="md:col-span-4">
                <Select
                  options={[{ value: '', label: t('admin.allPositions') }, ...jobQuery.items.map((j) => ({ value: j.id, label: j.title }))]}
                  value={appFilters.jobId}
                  onChange={(e) => updateAppFilter('jobId')(e.target.value)}
                />
              </div>
            </div>
            {(appFilters.search || appFilters.status || appFilters.jobId) && (
              <div className="mt-3 flex justify-end">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setAppFilters((p) => ({ ...p, search: '', status: '', jobId: '', page: 1 }))}
                >
                  {t('admin.resetFilters')}
                </Button>
              </div>
            )}
          </Card>

          <ApplicationTable
            rows={appQuery.items}
            loading={false}
            pagination={{
              page: appQuery.page,
              pageSize: appQuery.pageSize,
              total: appQuery.total,
              onChange: (p) => setAppFilters((prev) => ({ ...prev, page: p })),
            }}
            sortBy={appFilters.sortBy}
            sortDir={appFilters.sortDir}
            onSortChange={handleSortApps}
            statusOptions={appStatusOptions}
            onChangeStatus={handleChangeAppStatus}
            onView={handleViewApp}
            onEdit={handleEditApp}
            onDelete={setDeleteAppTarget}
          />
        </div>
      ),
    },
  ]

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title={t('admin.recruitmentTitle')}
        subtitle={t('admin.recruitmentSubtitle')}
        icon={Briefcase}
        actions={
          <div className="flex flex-wrap items-center gap-2">
            <Button
              variant="secondary"
              size="md"
              icon={RefreshCcw}
              onClick={refresh}
            >
              {t('admin.refreshRecruitment')}
            </Button>
            <Button
              variant="primary"
              size="md"
              icon={Plus}
              onClick={handleOpenCreateJob}
            >
              {t('admin.createJob')}
            </Button>
          </div>
        }
      />

      <RecruitmentSummaryTiles summary={summary} />

      <Tabs items={tabs} value={activeTab} onChange={setActiveTab} variant="underline" />

      {/* Job create/edit modal */}
      <JobFormModal
        open={jobFormOpen}
        onClose={() => {
          setJobFormOpen(false)
          setEditingJob(null)
        }}
        onSubmit={handleSubmitJob}
        initialValue={editingJob}
        submitting={jobSubmitting}
      />

      <JobDetailModal
        open={Boolean(detailJob)}
        onClose={() => setDetailJob(null)}
        job={detailJob}
        applicationCount={detailJob ? getRecruitmentSummary().totalApplications : 0}
      />

      <ApplicationDetailModal
        open={Boolean(detailApp)}
        onClose={() => setDetailApp(null)}
        application={detailApp}
        job={detailApp ? svcGetJobById(detailApp.jobId) : null}
        statusOptions={appStatusOptions}
        onChangeStatus={handleChangeAppStatus}
        onSaveNote={handleSaveAppNote}
      />

      <RecruitmentConfirmModal
        open={Boolean(deleteJobTarget)}
        onClose={() => setDeleteJobTarget(null)}
        onConfirm={handleDeleteJobConfirm}
        title={t('admin.deleteJobTitle')}
        description={t('admin.deleteJobConfirm', { title: deleteJobTarget?.title })}
        confirmLabel={t('admin.delete')}
        variant="danger"
      />

      <RecruitmentConfirmModal
        open={Boolean(deleteAppTarget)}
        onClose={() => setDeleteAppTarget(null)}
        onConfirm={handleDeleteAppConfirm}
        title={t('admin.deleteAppTitle')}
        description={t('admin.deleteAppConfirm', { name: deleteAppTarget?.candidateName })}
        confirmLabel={t('admin.delete')}
        variant="danger"
      />
    </div>
  )
}

void Loading
void ClipboardList
