import { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Gift, Plus, RefreshCw } from 'lucide-react'

import PageHeader from '../../components/common/PageHeader'
import Button from '../../components/common/Button'
import EmptyState from '../../components/common/EmptyState'
import { useToast } from '../../components/common/useToast'
import { useI18n } from '../../i18n/useI18n'

import BenefitStatTiles from '../../components/benefits/BenefitStatTiles'
import BenefitFilterBar from '../../components/benefits/BenefitFilterBar'
import BenefitTable from '../../components/benefits/BenefitTable'
import BenefitPagination from '../../components/benefits/BenefitPagination'
import BenefitFormModal from '../../components/benefits/BenefitFormModal'

import {
  queryBenefits,
  getBenefitsSummary,
  createBenefit,
  updateBenefit,
  updateBenefitStatus,
  getBenefitById,
  getBenefitStatuses,
  getBenefitTypes,
  subscribeBenefits,
} from '../../services/benefitService'
import { getDepartments } from '../../services/employeeService'

const DEFAULT_QUERY = {
  search: '',
  type: '',
  status: '',
  departmentId: '',
  startDateFrom: '',
  startDateTo: '',
  sortBy: 'updatedAt',
  sortDir: 'desc',
  page: 1,
  pageSize: 10,
}

export default function AdminBenefitsPage() {
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

  useEffect(() => {
    setLoading(true)
    const tmr = setTimeout(() => setLoading(false), 150)
    return () => clearTimeout(tmr)
  }, [tick, query.search, query.status, query.type, query.departmentId, query.startDateFrom, query.startDateTo])

  useEffect(() => {
    const unsub = subscribeBenefits(() => setTick((n) => n + 1))
    return () => unsub()
  }, [])

  const statuses = useMemo(() => getBenefitStatuses(), [])
  const types = useMemo(() => getBenefitTypes(), [])
  const departments = useMemo(() => getDepartments(), [])
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const data = useMemo(() => queryBenefits(query), [query, tick])
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const summary = useMemo(() => getBenefitsSummary(), [tick])

  const setField = (key, value) => setQuery((q) => ({ ...q, [key]: value, page: 1 }))
  const onClear = () => setQuery({ ...DEFAULT_QUERY })

  const onRefresh = () => {
    setTick((n) => n + 1)
    toast.info(t('admin.benefitsDataRefreshed'))
  }

  const openCreate = () => {
    setServerErrors({})
    setFormMode('create')
    setFormInitial(null)
    setOpenForm(true)
  }

  const openEdit = (id) => {
    const b = getBenefitById(id)
    if (!b) {
      toast.error(t('admin.cannotFindProgram'))
      return
    }
    if (b.status === 'expired') {
      toast.warning(t('admin.programExpired'), { description: t('admin.cannotEditExpiredProgram') })
      return
    }
    setServerErrors({})
    setFormMode('edit')
    setFormInitial(b)
    setOpenForm(true)
  }

  const openView = (id) => navigate(`/admin/benefits/${id}`)
  const openAssign = (id) => navigate(`/admin/benefits/${id}?tab=assignees`)

  const handleStatus = async (id, nextStatus, successMsg) => {
    const result = await updateBenefitStatus(id, nextStatus)
    if (!result.ok) {
      toast.error(t('admin.cannotUpdateStatus'), { description: result.error })
      return
    }
    toast.success(successMsg, { description: result.benefit.name })
  }

  const submitForm = async (values) => {
    setSubmitting(true)
    const result = formMode === 'edit'
      ? await updateBenefit(formInitial.id, values)
      : await createBenefit(values)
    setSubmitting(false)
    if (!result.ok) {
      setServerErrors(result.errors || {})
      toast.error(formMode === 'edit' ? t('admin.cannotUpdate') : t('admin.cannotCreateBenefit'), {
        description: result.errors?._form || t('admin.programCheckFields'),
      })
      return
    }
    toast.success(formMode === 'edit' ? t('admin.programUpdated') : t('admin.programCreated'), {
      description: result.benefit.name,
    })
    setOpenForm(false)
    setServerErrors({})
    setFormInitial(null)
    setQuery((q) => ({ ...q, page: 1 }))
  }

  return (
    <>
      <PageHeader
        title={t('admin.benefitsTitle')}
        subtitle={t('admin.benefitsSubtitle')}
        icon={Gift}
        breadcrumb={t('admin.benefitsBreadcrumb')}
        actions={
          <>
            <Button variant="secondary" icon={RefreshCw} onClick={onRefresh}>{t('admin.refreshBenefits')}</Button>
            <Button icon={Plus} onClick={openCreate}>{t('admin.addBenefit')}</Button>
          </>
        }
      />

      <div className="mb-6">
        <BenefitStatTiles summary={summary} />
      </div>

      <div className="mb-4">
        <BenefitFilterBar
          search={query.search}
          onSearchChange={(v) => setField('search', v)}
          type={query.type}
          onTypeChange={(v) => setField('type', v)}
          status={query.status}
          onStatusChange={(v) => setField('status', v)}
          departmentId={query.departmentId}
          onDepartmentChange={(v) => setField('departmentId', v)}
          startDateFrom={query.startDateFrom}
          startDateTo={query.startDateTo}
          onStartDateFromChange={(v) => setField('startDateFrom', v)}
          onStartDateToChange={(v) => setField('startDateTo', v)}
          statuses={statuses}
          types={types}
          departments={departments}
          onClear={onClear}
          total={data.total}
        />
      </div>

      <div className="mb-4">
        {data.total === 0 && !loading ? (
          <EmptyState
            title={t('admin.noBenefits')}
            description={
              query.search || query.type || query.status || query.departmentId || query.startDateFrom || query.startDateTo
                ? t('admin.noBenefitsDescFiltered')
                : t('admin.noBenefitsDescEmpty')
            }
            actionLabel={t('admin.addBenefit')}
            onAction={openCreate}
          />
        ) : (
          <BenefitTable
            rows={data.items}
            loading={loading}
            onView={openView}
            onEdit={openEdit}
            onAssign={openAssign}
            onPause={(id) => handleStatus(id, 'paused', t('admin.programPaused'))}
            onResume={(id) => handleStatus(id, 'active', t('admin.programResumed'))}
            onExpire={(id) => handleStatus(id, 'expired', t('admin.programEnded'))}
          />
        )}
      </div>

      {data.total > 0 && (
        <div className="mb-6">
          <BenefitPagination
            page={data.page}
            totalPages={data.totalPages}
            pageSize={data.pageSize}
            total={data.total}
            onPageChange={(p) => setQuery((q) => ({ ...q, page: p }))}
            onPageSizeChange={(n) => setQuery((q) => ({ ...q, pageSize: n, page: 1 }))}
          />
        </div>
      )}

      <BenefitFormModal
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
    </>
  )
}
