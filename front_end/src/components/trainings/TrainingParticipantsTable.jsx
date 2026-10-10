import { Pencil, Trash2 } from 'lucide-react'

import Avatar from '../common/Avatar'
import ParticipantStatusPill from './ParticipantStatusPill'
import LearningStatusPill from './LearningStatusPill'

import { formatDate } from '../../utils/format'
import { useI18n } from '../../i18n/useI18n'

/**
 * TrainingParticipantsTable - bảng học viên của 1 khóa học (admin).
 */
export default function TrainingParticipantsTable({
  rows,
  loading,
  onEditProgress,
  onRemove,
  canEdit,
}) {
  const { t } = useI18n()

  return (
    <div className="w-full overflow-x-auto rounded-lg border border-neutral-200 bg-white shadow-card">
      <table className="w-full border-separate border-spacing-0 text-sm text-neutral-700">
        <thead>
          <tr>
            <th className="border-b border-neutral-200 bg-neutral-50 px-4 py-3 text-xs font-semibold uppercase tracking-wider text-neutral-500 whitespace-nowrap">{t('trainings.employee')}</th>
            <th className="border-b border-neutral-200 bg-neutral-50 px-4 py-3 text-xs font-semibold uppercase tracking-wider text-neutral-500 whitespace-nowrap">{t('trainings.department')}</th>
            <th className="border-b border-neutral-200 bg-neutral-50 px-4 py-3 text-xs font-semibold uppercase tracking-wider text-neutral-500 whitespace-nowrap">{t('trainings.position')}</th>
            <th className="border-b border-neutral-200 bg-neutral-50 px-4 py-3 text-xs font-semibold uppercase tracking-wider text-neutral-500 whitespace-nowrap whitespace-nowrap">{t('trainings.registeredAt')}</th>
            <th className="border-b border-neutral-200 bg-neutral-50 px-4 py-3 text-xs font-semibold uppercase tracking-wider text-neutral-500 whitespace-nowrap text-center">{t('trainings.registrationStatus')}</th>
            <th className="border-b border-neutral-200 bg-neutral-50 px-4 py-3 text-xs font-semibold uppercase tracking-wider text-neutral-500 whitespace-nowrap text-center">{t('trainings.learning')}</th>
            <th className="border-b border-neutral-200 bg-neutral-50 px-4 py-3 text-xs font-semibold uppercase tracking-wider text-neutral-500 whitespace-nowrap text-right">{t('trainings.progress')}</th>
            <th className="border-b border-neutral-200 bg-neutral-50 px-4 py-3 text-xs font-semibold uppercase tracking-wider text-neutral-500 whitespace-nowrap text-right">{t('trainings.score')}</th>
            <th className="border-b border-neutral-200 bg-neutral-50 px-4 py-3 text-xs font-semibold uppercase tracking-wider text-neutral-500 whitespace-nowrap text-right">{t('trainings.actions')}</th>
          </tr>
        </thead>
        <tbody>
          {loading && (
            <tr><td colSpan={9} className="px-4 py-10 text-center text-sm text-neutral-500">{t('common.loading')}</td></tr>
          )}
          {!loading && rows.length === 0 && (
            <tr><td colSpan={9} className="px-4 py-10 text-center text-sm text-neutral-500">{t('trainings.noParticipants')}</td></tr>
          )}
          {!loading && rows.map((row) => (
            <tr key={row.id} className="group">
              <td className="border-b border-neutral-200 px-4 py-3 align-middle group-hover:bg-neutral-50">
                <div className="flex items-center gap-3 min-w-[220px]">
                  <Avatar name={row.employeeName} size="sm" />
                  <div className="flex min-w-0 flex-col">
                    <span className="font-medium text-neutral-900">{row.employeeName}</span>
                    <span className="font-mono text-[12px] text-neutral-500">{row.employeeCode}</span>
                  </div>
                </div>
              </td>
              <td className="border-b border-neutral-200 px-4 py-3 align-middle group-hover:bg-neutral-50">{row.departmentName}</td>
              <td className="border-b border-neutral-200 px-4 py-3 align-middle group-hover:bg-neutral-50">{row.position || '—'}</td>
              <td className="border-b border-neutral-200 px-4 py-3 align-middle group-hover:bg-neutral-50">{formatDate(row.registeredAt)}</td>
              <td className="border-b border-neutral-200 px-4 py-3 text-center align-middle group-hover:bg-neutral-50">
                <ParticipantStatusPill status={row.registrationStatus} />
              </td>
              <td className="border-b border-neutral-200 px-4 py-3 text-center align-middle group-hover:bg-neutral-50">
                <LearningStatusPill status={row.learningStatus} />
              </td>
              <td className="border-b border-neutral-200 px-4 py-3 text-right align-middle group-hover:bg-neutral-50">
                {row.progress ?? 0}%
              </td>
              <td className="border-b border-neutral-200 px-4 py-3 text-right align-middle group-hover:bg-neutral-50">
                {row.score !== null && row.score !== undefined ? row.score : '—'}
              </td>
              <td className="border-b border-neutral-200 px-4 py-3 text-right align-middle group-hover:bg-neutral-50">
                {canEdit && (
                  <div className="inline-flex items-center gap-1">
                    <button
                      type="button"
                      onClick={() => onEditProgress(row.id)}
                      className="inline-flex h-8 items-center gap-1 rounded-md bg-brand-600 px-2 text-xs font-medium text-white hover:bg-brand-700"
                    >
                      <Pencil className="h-3.5 w-3.5" aria-hidden="true" />
                      <span>{t('trainings.update')}</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => onRemove(row.id)}
                      aria-label={t('trainings.removeEmployee', { name: row.employeeName })}
                      className="inline-flex h-8 w-8 items-center justify-center rounded-md text-danger-500 hover:bg-danger-50"
                    >
                      <Trash2 className="h-4 w-4" aria-hidden="true" />
                    </button>
                  </div>
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
