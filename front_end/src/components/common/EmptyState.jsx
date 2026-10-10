import { Inbox } from 'lucide-react'
import { useI18n } from '../../i18n/useI18n'

import Button from './Button'
import { classNames } from '../../utils/format'

/**
 * EmptyState - shown when a list is empty.
 */
export default function EmptyState({
  icon: Icon = Inbox,
  title,
  description,
  action,
  actionLabel,
  onAction,
  className = '',
}) {
  const { t } = useI18n()
  return (
    <div
      className={classNames(
        'flex flex-col items-center justify-center gap-3 rounded-lg border border-dashed border-neutral-300 bg-white px-6 py-12 text-center',
        className,
      )}
    >
      <span className="inline-flex h-12 w-12 items-center justify-center rounded-full bg-brand-50 text-brand-600">
        <Icon className="h-6 w-6" aria-hidden="true" />
      </span>
      <div className="flex flex-col gap-1">
        <h3 className="text-base font-semibold text-neutral-900">{title ?? t('common.component.noDataYet')}</h3>
        {description && (
          <p className="max-w-sm text-sm text-neutral-500">{description}</p>
        )}
      </div>
      {(action || (actionLabel && onAction)) && (
        <Button
          variant="primary"
          size="sm"
          onClick={onAction}
          icon={action?.icon}
        >
          {actionLabel ?? action?.label ?? t('common.component.retry')}
        </Button>
      )}
    </div>
  )
}