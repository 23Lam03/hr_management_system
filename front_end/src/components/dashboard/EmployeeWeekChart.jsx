import {
  ResponsiveContainer,
  AreaChart,
  Area,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
} from 'recharts'
import { useI18n } from '../../i18n/useI18n'

/**
 * EmployeeWeekChart - area chart 7 ngày cho nhân viên.
 * data: [{ date, day, present }]
 */
export default function EmployeeWeekChart({ data }) {
  const { t } = useI18n()
  return (
    <div className="h-64 w-full">
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart data={data} margin={{ top: 8, right: 8, bottom: 8, left: -16 }}>
          <defs>
            <linearGradient id="empPresent" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#4f46e5" stopOpacity={0.35} />
              <stop offset="100%" stopColor="#4f46e5" stopOpacity={0.02} />
            </linearGradient>
          </defs>
          <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
          <XAxis
            dataKey="day"
            tick={{ fill: '#475569', fontSize: 12 }}
            axisLine={false}
            tickLine={false}
          />
          <YAxis hide domain={[0, 1.4]} />
          <Tooltip
            contentStyle={{
              borderRadius: 8,
              border: '1px solid #e2e8f0',
              fontSize: 12,
            }}
            formatter={(v) => [v === 1 ? t('dashboard.component.present') : t('dashboard.component.absent'), t('status.status')]}
          />
          <Area
            type="monotone"
            dataKey="present"
            stroke="#4f46e5"
            strokeWidth={2}
            fill="url(#empPresent)"
          />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  )
}