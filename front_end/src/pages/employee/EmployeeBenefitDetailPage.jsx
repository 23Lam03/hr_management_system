import { useEffect, useMemo } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { ArrowLeft, Gift, AlertCircle } from 'lucide-react'

import PageHeader from '../../components/common/PageHeader'
import Button from '../../components/common/Button'
import EmptyState from '../../components/common/EmptyState'
import { useI18n } from '../../i18n/useI18n'

import BenefitDetailPanel from '../../components/benefits/BenefitDetailPanel'

import { getMyBenefitById, subscribeBenefits } from '../../services/benefitService'
import { resolveEmployeeFromUser } from '../../services/authLinker'
import { useAuth } from '../../contexts/useAuth'

export default function EmployeeBenefitDetailPage() {
  const { id } = useParams()
  const navigate = useNavigate()
  const { user } = useAuth()
  const { t } = useI18n()
  const employee = useMemo(() => resolveEmployeeFromUser(user), [user])
  const employeeId = employee?.id ?? null

  // Subscribe to keep in sync with admin updates
  useEffect(() => {
    const unsub = subscribeBenefits(() => {})
    return () => unsub()
  }, [])

  // eslint-disable-next-line react-hooks/exhaustive-deps
  const record = useMemo(
    () => (employeeId && id ? getMyBenefitById(employeeId, id) : null),
    [employeeId, id],
  )

  if (!employeeId || !employee) {
    return (
      <>
        <PageHeader title={t('employeeBenefits.myBenefits')} icon={Gift} breadcrumb="Cá nhân / Phúc lợi" />
        <EmptyState
          title={t('employeeBenefits.notIdentified')}
          description={t('employeeBenefits.accountNotLinked')}
        />
      </>
    )
  }

  if (!record) {
    return (
      <>
        <PageHeader title={t('employeeBenefits.myBenefits')} icon={Gift} breadcrumb="Cá nhân / Phúc lợi" />
        <EmptyState
          title={t('employeeBenefitDetail.notFound')}
          description={t('employeeBenefitDetail.notFoundDesc')}
          actionLabel={t('employeeBenefitDetail.backToList')}
          onAction={() => navigate('/employee/benefits')}
        />
      </>
    )
  }

  return (
    <>
      <PageHeader
        title={record.benefit.name}
        subtitle={record.benefit.description || t('employeeBenefitDetail.benefitDetail')}
        icon={Gift}
        breadcrumb={`Cá nhân / Phúc lợi / ${record.benefit.name}`}
        actions={
          <Button variant="secondary" icon={ArrowLeft} onClick={() => navigate('/employee/benefits')}>
            {t('employeeBenefitDetail.back')}
          </Button>
        }
      />

      {record.benefit.status === 'expired' && (
        <div className="mb-4 flex items-start gap-3 rounded-md border border-danger-200 bg-danger-50 px-4 py-3 text-sm text-danger-700">
          <AlertCircle className="mt-0.5 h-4 w-4 flex-shrink-0" aria-hidden="true" />
          <p>{t('employeeBenefitDetail.benefitExpired')}</p>
        </div>
      )}

      <BenefitDetailPanel
        benefit={record.benefit}
        record={record}
        mode="employee"
      />
    </>
  )
}