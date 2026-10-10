import { Construction } from 'lucide-react'
import { useI18n } from '../../i18n/useI18n'

/**
 * PlaceholderPanel - shown for not-yet-implemented HRM screens.
 */
export default function PlaceholderPanel({ title, description, icon: Icon = Construction }) {
  const { t } = useI18n()
  return (
    <div className="flex flex-col items-center gap-3 rounded-lg border border-dashed border-neutral-300 bg-white px-6 py-16 text-center">
      <span className="inline-flex h-14 w-14 items-center justify-center rounded-full bg-brand-50 text-brand-600">
        <Icon className="h-7 w-7" />
      </span>
      <h2 className="text-[22px] font-semibold text-neutral-900">{title}</h2>
      {description && (
        <p className="max-w-md text-sm text-neutral-500">{description}</p>
      )}
      <span className="inline-flex h-6 items-center rounded-full bg-neutral-100 px-3 text-xs font-medium text-neutral-500">
        {t('common.component.inProgress')}
      </span>
    </div>
  )
}