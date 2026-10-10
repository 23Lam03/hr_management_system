import { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { GraduationCap, Plus, RefreshCw } from 'lucide-react'

import PageHeader from '../../components/common/PageHeader'
import Button from '../../components/common/Button'
import EmptyState from '../../components/common/EmptyState'
import { useToast } from '../../components/common/useToast'
import { useI18n } from '../../i18n/useI18n'

import TrainingStatTiles from '../../components/trainings/TrainingStatTiles'
import TrainingFilterBar from '../../components/trainings/TrainingFilterBar'
import TrainingTable from '../../components/trainings/TrainingTable'
import TrainingPagination from '../../components/trainings/TrainingPagination'
import TrainingFormModal from '../../components/trainings/TrainingFormModal'
import CancelTrainingConfirmModal from '../../components/trainings/CancelTrainingConfirmModal'

import {
  queryTrainings,
  getTrainingsSummary,
  createTraining,
  updateTraining,
  cancelTraining,
  getTrainingById,
  getTrainingStatuses,
  getTrainingCategories,
  getTrainingFormats,
  subscribeTrainings,
} from '../../services/trainingService'

const DEFAULT_QUERY = {
  search: '',
  status: '',
  category: '',
  format: '',
  startDateFrom: '',
  startDateTo: '',
  sortBy: 'updatedAt',
  sortDir: 'desc',
  page: 1,
  pageSize: 10,
}

export default function AdminTrainingsPage() {
  const { t } = useI18n()
  const navigate = useNavigate()
  const toast = useToast()
  const [query, setQuery] = useState(DEFAULT_QUERY)
  const [loading, setLoading] = useState(true)
  const [tick, setTick] = useState(0)
  const [openForm, setOpenForm] = useState(false)
  const [formMode, setFormMode] = useState('create')
  const [formInitial, setFormInitial] = useState(null)
  const [submitting, setSubmitting] = useState(false)
  const [serverErrors, setServerErrors] = useState({})
  const [openCancel, setOpenCancel] = useState(false)
  const [cancelCourseId, setCancelCourseId] = useState(null)

  useEffect(() => {
    setLoading(true)
    const tmr = setTimeout(() => setLoading(false), 150)
    return () => clearTimeout(tmr)
  }, [tick, query.search, query.status, query.category, query.format, query.startDateFrom, query.startDateTo])

  useEffect(() => {
    const unsub = subscribeTrainings(() => setTick((n) => n + 1))
    return () => unsub()
  }, [])

  const statuses = useMemo(() => getTrainingStatuses(), [])
  const categories = useMemo(() => getTrainingCategories(), [])
  const formats = useMemo(() => getTrainingFormats(), [])

  // eslint-disable-next-line react-hooks/exhaustive-deps
  const data = useMemo(() => queryTrainings(query), [query, tick])
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const summary = useMemo(() => getTrainingsSummary(), [tick])

  const setField = (key, value) => setQuery((q) => ({ ...q, [key]: value, page: 1 }))
  const onClear = () => setQuery({ ...DEFAULT_QUERY })

  const onRefresh = () => {
    setTick((n) => n + 1)
    toast.info(t('admin.trainingsDataRefreshed'))
  }

  const openCreate = () => {
    setServerErrors({})
    setFormMode('create')
    setFormInitial(null)
    setOpenForm(true)
  }

  const openEdit = (id) => {
    const course = getTrainingById(id)
    if (!course) {
      toast.error(t('admin.cannotFindCourse'))
      return
    }
    if (course.status === 'cancelled' || course.status === 'completed') {
      toast.warning(t('admin.courseClosed'), { description: t('admin.cannotEditClosedCourse') })
      return
    }
    setServerErrors({})
    setFormMode('edit')
    setFormInitial(course)
    setOpenForm(true)
  }

  const openView = (id) => navigate(`/admin/trainings/${id}`)
  const openParticipants = (id) => navigate(`/admin/trainings/${id}?tab=participants`)

  const openCancelConfirm = (id) => {
    setCancelCourseId(id)
    setOpenCancel(true)
  }

  const submitForm = async (values) => {
    setSubmitting(true)
    const result = formMode === 'edit'
      ? await updateTraining(formInitial.id, values)
      : await createTraining(values)
    setSubmitting(false)
    if (!result.ok) {
      setServerErrors(result.errors || {})
      toast.error(formMode === 'edit' ? t('admin.cannotUpdateTraining') : t('admin.cannotCreateTraining'), {
        description: result.errors?._form || t('admin.trainingCheckFields'),
      })
      return
    }
    toast.success(formMode === 'edit' ? t('admin.trainingUpdated') : t('admin.trainingCreated'), {
      description: result.course.name,
    })
    setOpenForm(false)
    setServerErrors({})
    setFormInitial(null)
    setQuery((q) => ({ ...q, page: 1 }))
  }

  const confirmCancel = async () => {
    if (!cancelCourseId) return
    setSubmitting(true)
    const result = await cancelTraining(cancelCourseId)
    setSubmitting(false)
    if (!result.ok) {
      toast.error(t('admin.cannotCancelTraining'), { description: result.error })
      return
    }
    toast.success(t('admin.trainingCancelled'), { description: result.course.name })
    setOpenCancel(false)
    setCancelCourseId(null)
  }

  const cancelCourse = cancelCourseId ? getTrainingById(cancelCourseId) : null

  return (
    <>
      <PageHeader
        title={t('admin.trainingsTitle')}
        subtitle={t('admin.trainingsSubtitle')}
        icon={GraduationCap}
        breadcrumb={t('admin.trainingsBreadcrumb')}
        actions={
          <>
            <Button variant="secondary" icon={RefreshCw} onClick={onRefresh}>{t('admin.refreshTrainings')}</Button>
            <Button icon={Plus} onClick={openCreate}>{t('admin.createTraining')}</Button>
          </>
        }
      />

      <div className="mb-6">
        <TrainingStatTiles summary={summary} />
      </div>

      <div className="mb-4">
        <TrainingFilterBar
          search={query.search}
          onSearchChange={(v) => setField('search', v)}
          status={query.status}
          onStatusChange={(v) => setField('status', v)}
          category={query.category}
          onCategoryChange={(v) => setField('category', v)}
          format={query.format}
          onFormatChange={(v) => setField('format', v)}
          startDateFrom={query.startDateFrom}
          startDateTo={query.startDateTo}
          onStartDateFromChange={(v) => setField('startDateFrom', v)}
          onStartDateToChange={(v) => setField('startDateTo', v)}
          statuses={statuses}
          categories={categories}
          formats={formats}
          onClear={onClear}
          total={data.total}
        />
      </div>

      <div className="mb-4">
        {data.total === 0 && !loading ? (
          <EmptyState
            title={t('admin.noTrainings')}
            description={
              query.search || query.status || query.category || query.format || query.startDateFrom || query.startDateTo
                ? t('admin.noTrainingsFiltered')
                : t('admin.noTrainingsEmpty')
            }
            actionLabel={t('admin.createTraining')}
            onAction={openCreate}
          />
        ) : (
          <TrainingTable
            rows={data.items}
            loading={loading}
            onView={openView}
            onEdit={openEdit}
            onParticipants={openParticipants}
            onCancel={openCancelConfirm}
          />
        )}
      </div>

      {data.total > 0 && (
        <div className="mb-6">
          <TrainingPagination
            page={data.page}
            totalPages={data.totalPages}
            pageSize={data.pageSize}
            total={data.total}
            onPageChange={(p) => setQuery((q) => ({ ...q, page: p }))}
            onPageSizeChange={(n) => setQuery((q) => ({ ...q, pageSize: n, page: 1 }))}
          />
        </div>
      )}

      <TrainingFormModal
        open={openForm}
        onClose={() => {
          setOpenForm(false)
          setServerErrors({})
        }}
        mode={formMode}
        initial={formInitial}
        onSubmit={submitForm}
        submitting={submitting}
        serverErrors={serverErrors}
      />

      <CancelTrainingConfirmModal
        open={openCancel}
        onClose={() => {
          setOpenCancel(false)
          setCancelCourseId(null)
        }}
        course={cancelCourse}
        onConfirm={confirmCancel}
        submitting={submitting}
      />
    </>
  )
}
