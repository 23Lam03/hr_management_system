import Card from '../common/Card'
import Button from '../common/Button'
import SecurityStatusBadge from './SecurityStatusBadge'
import { useI18n } from '../../i18n/useI18n'

/**
 * SecurityOverviewCard - card tổng quan 1 mục bảo mật.
 *
 * Props:
 * - title, description, icon
 * - enabled
 * - summary: ReactNode (mô tả chi tiết cấu hình hiện tại)
 * - onConfigure
 */
export default function SecurityOverviewCard({
  title,
  description,
  icon: Icon,
  enabled = false,
  summary,
  onConfigure,
  meta,
}) {
  const { t } = useI18n()
  return (
    <Card padding className="flex h-full flex-col gap-4">
      <div className="flex items-start gap-3">
        {Icon && (
          <span className="inline-flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-md bg-brand-50 text-brand-600">
            <Icon className="h-5 w-5" aria-hidden="true" />
          </span>
        )}
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <h3 className="text-base font-semibold text-neutral-900">{title}</h3>
            <SecurityStatusBadge enabled={enabled} />
          </div>
          {description && (
            <p className="mt-1 text-[13px] text-neutral-500">{description}</p>
          )}
        </div>
      </div>
      {summary && (
        <div className="rounded-md bg-neutral-50 px-4 py-3 text-sm text-neutral-700">
          {summary}
        </div>
      )}
      {meta && <div className="text-xs text-neutral-500">{meta}</div>}
      <div className="mt-auto flex justify-end">
        <Button variant="secondary" size="sm" onClick={onConfigure}>
          {t('security.component.configure')}
        </Button>
      </div>
    </Card>
  )
}