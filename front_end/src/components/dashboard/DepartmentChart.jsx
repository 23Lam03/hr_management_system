import { ResponsiveContainer, PieChart, Pie, Cell, Tooltip, Legend } from 'recharts'
import { useI18n } from '../../i18n/useI18n'

const COLORS = ['#4f46e5', '#10b981', '#f59e0b', '#ef4444', '#06b6d4', '#8b5cf6', '#ec4899']

/**
 * DepartmentChart - biểu đồ tròn phân bố nhân viên theo phòng ban.
 *
 * data: [{ id, name, headcount }]
 */
export default function DepartmentChart({ data }) {
  const { t } = useI18n()
  return (
    <div className="h-72 w-full">
      <ResponsiveContainer width="100%" height="100%">
        <PieChart>
          <Tooltip
            contentStyle={{
              borderRadius: 8,
              border: '1px solid #e2e8f0',
              fontSize: 12,
              boxShadow: '0 6px 16px rgba(15,23,42,0.08)',
            }}
            formatter={(value, name) => [`${value} ${t('dashboard.component.employees')}`, name]}
          />
          <Legend
            layout="vertical"
            verticalAlign="middle"
            align="right"
            wrapperStyle={{ fontSize: 12, lineHeight: '20px' }}
            iconType="circle"
            iconSize={8}
          />
          <Pie
            data={data}
            dataKey="headcount"
            nameKey="name"
            innerRadius={50}
            outerRadius={90}
            paddingAngle={2}
            stroke="#fff"
          >
            {data.map((entry, index) => (
              <Cell key={entry.id} fill={COLORS[index % COLORS.length]} />
            ))}
          </Pie>
        </PieChart>
      </ResponsiveContainer>
    </div>
  )
}