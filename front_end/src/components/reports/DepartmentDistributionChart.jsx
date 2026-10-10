import { PieChart } from 'lucide-react'

import Card from '../common/Card'
import EmptyState from '../common/EmptyState'
import MiniBarChart from './MiniBarChart'
import { useI18n } from '../../i18n/useI18n'

/**
 * DepartmentDistributionChart - hiển thị số nhân viên theo phòng ban.
 */
export default function DepartmentDistributionChart({ departments = [], counts = {}, total = 0 }) {
  const { t } = useI18n()
  const data = departments
    .map((d) => ({ label: d.name, value: counts[d.id] ?? 0 }))
    .filter((d) => d.value > 0)
    .sort((a, b) => b.value - a.value)

  return (
    <Card
      title={t('reports.component.employeeDistributionByDept')}
      subtitle={t('reports.component.employeeDistributionSubtitle')}
    >
      {total === 0 ? (
        <EmptyState
          icon={PieChart}
          title={t('reports.component.noDistributionData')}
          description={t('reports.component.activeEmployeesAppearHere')}
        />
      ) : (
        <MiniBarChart data={data} />
      )}
    </Card>
  )
}
