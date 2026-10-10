import { Eye, Pencil, Users, Calendar, Ban } from 'lucide-react'

import TrainingStatusPill from './TrainingStatusPill'
import { formatDateRange, formatNumber } from '../../utils/format'
import { TRAINING_CATEGORY_LABEL, TRAINING_FORMAT_LABEL } from '../../data/trainingMockData'
import { useI18n } from '../../i18n/useI18n'

export default function TrainingTable({
  rows,
  loading,
  onView,
  onEdit,
  onParticipants,
  onCancel,
}) {
  const { t } = useI18n()

  return (
    <div className="w-full overflow-x-auto rounded-lg border border-neutral-200 bg-white shadow-card">
      <table className="w-full border-separate border-spacing-0 text-sm text-neutral-700">
        <thead>
          <tr>
            <th className="border-b border-neutral-200 bg-neutral-50 px-4 py-3 text-xs font-semibold uppercase tracking-wider text-neutral-500 whitespace-nowrap">{t('trainings.course')}</th>
            <th className="border-b border-neutral-200 bg-neutral-50 px-4 py-3 text-xs font-semibold uppercase tracking-wider text-neutral-500 whitespace-nowrap">{t('trainings.category')}</th>
            <th className="border-b border-neutral-200 bg-neutral-50 px-4 py-3 text-xs font-semibold uppercase tracking-wider text-neutral-500 whitespace-nowrap">{t('trainings.columnInstructor')}</th>
            <th className="border-b border-neutral-200 bg-neutral-50 px-4 py-3 text-xs font-semibold uppercase tracking-wider text-neutral-500 whitespace-nowrap">{t('trainings.format')}</th>
            <th className="border-b border-neutral-200 bg-neutral-50 px-4 py-3 text-xs font-semibold uppercase tracking-wider text-neutral-500 whitespace-nowrap">{t('trainings.columnPeriod')}</th>
            <th className="border-b border-neutral-200 bg-neutral-50 px-4 py-3 text-xs font-semibold uppercase tracking-wider text-neutral-500 whitespace-nowrap text-right">{t('trainings.registrationsCapacity')}</th>
            <th className="border-b border-neutral-200 bg-neutral-50 px-4 py-3 text-xs font-semibold uppercase tracking-wider text-neutral-500 whitespace-nowrap text-center">{t('trainings.columnStatus')}</th>
            <th className="border-b border-neutral-200 bg-neutral-50 px-4 py-3 text-xs font-semibold uppercase tracking-wider text-neutral-500 whitespace-nowrap text-right">{t('trainings.columnActions')}</th>
          </tr>
        </thead>
        <tbody>
          {loading && (
            <tr><td colSpan={8} className="px-4 py-10 text-center text-sm text-neutral-500">{t('common.loading')}</td></tr>
          )}
          {!loading && rows.length === 0 && (
            <tr><td colSpan={8} className="px-4 py-10 text-center text-sm text-neutral-500">{t('trainings.noCourses')}</td></tr>
          )}
          {!loading && rows.map((row) => (
            <tr key={row.id} className="group">
              <td className="border-b border-neutral-200 px-4 py-3 align-middle group-hover:bg-neutral-50">
                <div className="flex min-w-[240px] flex-col">
                  <span className="font-medium text-neutral-900">{row.name}</span>
                  <span className="font-mono text-[12px] text-neutral-500">{row.code}</span>
                </div>
              </td>
              <td className="border-b border-neutral-200 px-4 py-3 align-middle group-hover:bg-neutral-50">
                {TRAINING_CATEGORY_LABEL[row.category] || row.category}
              </td>
              <td className="border-b border-neutral-200 px-4 py-3 align-middle group-hover:bg-neutral-50">{row.instructor}</td>
              <td className="border-b border-neutral-200 px-4 py-3 align-middle group-hover:bg-neutral-50">
                {TRAINING_FORMAT_LABEL[row.format] || row.format}
              </td>
              <td className="border-b border-neutral-200 px-4 py-3 align-middle group-hover:bg-neutral-50 whitespace-nowrap">
                {formatDateRange(row.startDate, row.endDate)}
              </td>
              <td className="border-b border-neutral-200 px-4 py-3 text-right align-middle group-hover:bg-neutral-50">
                {formatNumber(row.registeredCount)}/{formatNumber(row.capacity)}
              </td>
              <td className="border-b border-neutral-200 px-4 py-3 text-center align-middle group-hover:bg-neutral-50">
                <TrainingStatusPill status={row.status} />
              </td>
              <td className="border-b border-neutral-200 px-4 py-3 text-right align-middle group-hover:bg-neutral-50">
                <div className="inline-flex items-center gap-1">
                  <button
                    type="button"
                    onClick={() => onView(row.id)}
                    aria-label={t('trainings.viewDetail')}
                    className="inline-flex h-8 w-8 items-center justify-center rounded-md text-neutral-500 hover:bg-neutral-100 hover:text-neutral-900"
                  >
                    <Eye className="h-4 w-4" aria-hidden="true" />
                  </button>
                  <button
                    type="button"
                    onClick={() => onParticipants(row.id)}
                    aria-label={t('trainings.participantsOf', { course: row.name })}
                    className="inline-flex h-8 items-center gap-1 rounded-md bg-brand-50 px-2 text-xs font-medium text-brand-700 hover:bg-brand-100"
                  >
                    <Users className="h-3.5 w-3.5" aria-hidden="true" />
                    <span>{t('trainings.participants')}</span>
                  </button>
                  {row.status !== 'cancelled' && row.status !== 'completed' && onEdit && (
                    <button
                      type="button"
                      onClick={() => onEdit(row.id)}
                      aria-label={`${t('trainings.edit')} ${row.name}`}
                      className="inline-flex h-8 items-center gap-1 rounded-md border border-neutral-200 px-2 text-xs font-medium text-neutral-700 hover:bg-neutral-100"
                    >
                      <Pencil className="h-3.5 w-3.5" aria-hidden="true" />
                      <span>{t('trainings.edit')}</span>
                    </button>
                  )}
                  {row.status !== 'cancelled' && onCancel && (
                    <button
                      type="button"
                      onClick={() => onCancel(row.id)}
                      aria-label={`${t('trainings.cancel')} ${row.name}`}
                      className="inline-flex h-8 items-center gap-1 rounded-md bg-danger-500 px-2 text-xs font-medium text-white hover:bg-danger-600"
                    >
                      <Ban className="h-3.5 w-3.5" aria-hidden="true" />
                      <span>{t('trainings.cancel')}</span>
                    </button>
                  )}
                  <span className="hidden"><Calendar aria-hidden="true" /></span>
                </div>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
