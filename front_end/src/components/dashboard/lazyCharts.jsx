import { lazy, Suspense } from 'react'

import Loading from '../common/Loading'
import { useI18n } from '../../i18n/useI18n'

const AttendanceChart = lazy(() => import('./AttendanceChart'))
const DepartmentChart = lazy(() => import('./DepartmentChart'))

function ChartFallback({ heightClass = 'h-72' }) {
  const { t } = useI18n()
  return (
    <div className={`flex w-full ${heightClass} items-center justify-center`}>
      <Loading size="md" label={t('common.component.loadingChart')} />
    </div>
  )
}

/**
 * AttendanceChartLazy - dynamic import để tránh nhồi Recharts vào main chunk.
 */
export default function AttendanceChartLazy(props) {
  return (
    <Suspense fallback={<ChartFallback />}>
      <AttendanceChart {...props} />
    </Suspense>
  )
}

/**
 * DepartmentChartLazy - dynamic import.
 */
export function DepartmentChartLazy(props) {
  return (
    <Suspense fallback={<ChartFallback />}>
      <DepartmentChart {...props} />
    </Suspense>
  )
}