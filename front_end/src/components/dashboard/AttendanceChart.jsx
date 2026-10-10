import { ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip, CartesianGrid, Legend } from 'recharts'
import { useI18n } from '../../i18n/useI18n'

/**
 * AttendanceChart - biểu đồ chấm công 7 ngày gần nhất.
 *
 * data: [{ date, day, present, late, absent }]
 * Responsive theo parent container.
 */
export default function AttendanceChart({ data }) {
  const { t } = useI18n()
  return (
    <div className="h-72 w-full">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data} margin={{ top: 8, right: 8, bottom: 8, left: -16 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
          <XAxis
            dataKey="day"
            tick={{ fill: '#475569', fontSize: 12 }}
            axisLine={false}
            tickLine={false}
          />
          <YAxis
            tick={{ fill: '#475569', fontSize: 12 }}
            axisLine={false}
            tickLine={false}
          />
          <Tooltip
            cursor={{ fill: 'rgba(99,102,241,0.06)' }}
            contentStyle={{
              borderRadius: 8,
              border: '1px solid #e2e8f0',
              fontSize: 12,
              boxShadow: '0 6px 16px rgba(15,23,42,0.08)',
            }}
          />
          <Legend
            wrapperStyle={{ fontSize: 12 }}
            iconType="circle"
            iconSize={8}
          />
          <Bar dataKey="present" name={t('dashboard.component.present')}   stackId="a" fill="#4f46e5" radius={[4, 4, 0, 0]} />
          <Bar dataKey="late"    name={t('dashboard.component.late')}      stackId="a" fill="#f59e0b" radius={[4, 4, 0, 0]} />
          <Bar dataKey="absent"  name={t('dashboard.component.absent')}   stackId="a" fill="#ef4444" radius={[4, 4, 0, 0]} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  )
}