import { lazy, Suspense } from 'react'

import Loading from '../common/Loading'
import { useI18n } from '../../i18n/useI18n'

const EmployeeWeekChart = lazy(() => import('./EmployeeWeekChart'))

function ChartFallback({ heightClass = 'h-64' }) {
  const { t } = useI18n()
  return (
    <div className={`flex w-full ${heightClass} items-center justify-center`}>
      <Loading size="md" label={t('common.component.loadingChart')} />
    </div>
  )
}

export default function EmployeeWeekChartLazy(props) {
  return (
    <Suspense fallback={<ChartFallback />}>
      <EmployeeWeekChart {...props} />
    </Suspense>
  )
}