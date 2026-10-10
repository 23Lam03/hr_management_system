import { useEffect, useMemo, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { ArrowLeft, Star } from 'lucide-react'

import PageHeader from '../../components/common/PageHeader'
import Button from '../../components/common/Button'
import EmptyState from '../../components/common/EmptyState'
import { useI18n } from '../../i18n/useI18n'

import EvaluationDetailModal from '../../components/evaluations/EvaluationDetailModal'

import {
  getMyEvaluationById,
  getEvaluationCycleById,
  subscribeEvaluations,
} from '../../services/evaluationService'
import { getEmployeeById } from '../../services/employeeService'
import { resolveEmployeeFromUser } from '../../services/authLinker'
import { useAuth } from '../../contexts/useAuth'

export default function EmployeeEvaluationDetailPage() {
  const { id } = useParams()
  const navigate = useNavigate()
  const { user: currentUser } = useAuth()
  const { t } = useI18n()
  const employee = useMemo(
    () => resolveEmployeeFromUser(currentUser),
    [currentUser],
  )
  const employeeId = employee?.id ?? null
  const [tick, setTick] = useState(0)

  useEffect(() => {
    const unsub = subscribeEvaluations(() => setTick((n) => n + 1))
    return () => unsub()
  }, [])

  // Service đã tự bảo vệ: chỉ trả về record khi employeeId trùng (Phase 30: bao gồm rejected).
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const record = useMemo(
    () => (employeeId ? getMyEvaluationById(employeeId, id, { includeUnpublished: true }) : null),
    [employeeId, id, tick],
  )

  // Nếu user đổi URL sang id khác không thuộc mình → service trả null
  // Hiển thị thông báo thay vì xem nhầm
  if (!employeeId || !employee) {
    return (
      <>
        <PageHeader title={t('leaves.pageTitle')} icon={Star} breadcrumb="Cá nhân / Đánh giá" />
        <EmptyState
          title={t('employeeEvaluationDetail.notIdentified')}
          description={t('employeeEvaluationDetail.accountNotLinked')}
          actionLabel={t('employeeEvaluationDetail.backToList')}
          onAction={() => navigate('/employee/evaluations')}
        />
      </>
    )
  }

  const employee2 = getEmployeeById(record?.employeeId) || employee
  const cycle = record ? getEvaluationCycleById(record.cycleId) : null

  return (
    <>
      <PageHeader
        title={cycle?.name || t('employeeEvaluations.myEvaluations')}
        subtitle={t('employeeEvaluationDetail.evaluationDetail')}
        icon={Star}
        breadcrumb={`Cá nhân / Đánh giá / ${cycle?.name || ''}`}
        actions={
          <Button variant="secondary" icon={ArrowLeft} onClick={() => navigate('/employee/evaluations')}>
            {t('employeeEvaluationDetail.backToList')}
          </Button>
        }
      />

      {!record ? (
        <EmptyState
          title={t('employeeEvaluationDetail.evaluationNotFound')}
          description={t('employeeEvaluationDetail.evaluationNotFoundDesc')}
          actionLabel={t('employeeEvaluationDetail.backToList')}
          onAction={() => navigate('/employee/evaluations')}
        />
      ) : (
        <EvaluationDetailModal
          open
          onClose={() => navigate('/employee/evaluations')}
          record={record}
          cycle={cycle}
          employee={employee2}
          isAdminView={false}
        />
      )}
    </>
  )
}