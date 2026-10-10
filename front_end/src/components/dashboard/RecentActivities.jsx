import { Clock3, UserPlus, FileCheck2, GraduationCap, UserCog } from 'lucide-react'
import { useI18n } from '../../i18n/useI18n'

import { classNames } from '../../utils/format'

const ICONS = {
  profile:  UserCog,
  leave:    FileCheck2,
  training: GraduationCap,
  attendance: Clock3,
}

function actionVerb(type) {
  switch (type) {
    case 'leave':    return 'Nghỉ phép'
    case 'training': return 'Đào tạo'
    case 'profile':  return 'Hồ sơ'
    default:         return 'Hoạt động'
  }
}

function formatTime(iso) {
  if (!iso) return ''
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return ''
  return d.toLocaleString('vi-VN', {
    day: '2-digit',
    month: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  })
}

/**
 * RecentActivities - feed hoạt động admin.
 */
export default function RecentActivities({ items }) {
  const { t } = useI18n()
  if (!items || items.length === 0) {
    return (
      <p className="rounded-md border border-dashed border-neutral-300 bg-neutral-50 px-4 py-6 text-center text-sm text-neutral-500">
        {t('dashboard.component.noActivities')}
      </p>
    )
  }

  return (
    <ul className="flex flex-col divide-y divide-neutral-200">
      {items.map((it) => {
        const Icon = ICONS[it.targetType] ?? UserPlus
        return (
          <li key={it.id} className="flex items-start gap-3 py-3 first:pt-0 last:pb-0">
            <span
              className={classNames(
                'inline-flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-full bg-brand-50 text-brand-600',
              )}
            >
              <Icon className="h-4 w-4" aria-hidden="true" />
            </span>
            <div className="min-w-0 flex-1">
              <p className="text-sm text-neutral-700">
                <span className="font-medium text-neutral-900">{it.actorName}</span>{' '}
                {it.action}
                {it.targetName ? (
                  <>
                    {' '}
                    <span className="font-medium text-neutral-900">{it.targetName}</span>
                  </>
                ) : null}
              </p>
              <p className="mt-0.5 text-xs text-neutral-500">
                {actionVerb(it.targetType)} · {formatTime(it.createdAt)}
              </p>
            </div>
          </li>
        )
      })}
    </ul>
  )
}