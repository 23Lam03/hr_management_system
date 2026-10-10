import { AlertTriangle } from 'lucide-react'
import { useI18n } from '../../i18n/useI18n'

import Button from './Button'
import { classNames } from '../../utils/format'

/**
 * ErrorState - thông báo lỗi khi không thể tải dữ liệu.
 * Tách từ EmptyState để người dùng phân biệt giữa "rỗng" và "lỗi".
 *
 * Props:
 * - title, description
 * - onRetry: () => void
 * - actionLabel: mặc định "Thử lại"
 */
export default function ErrorState({
  title,
  description,
  onRetry,
  actionLabel,
  icon: Icon = AlertTriangle,
  className = '',
}) {
  const { t } = useI18n()
  return (
    <div
      role="alert"
      className={classNames(
        'flex flex-col items-center justify-center gap-3 rounded-lg border border-dashed border-danger-200 bg-white px-6 py-10 text-center',
        className,
      )}
    >
      <span className="inline-flex h-12 w-12 items-center justify-center rounded-full bg-danger-50 text-danger-600">
        <Icon className="h-6 w-6" aria-hidden="true" />
      </span>
      <div className="flex flex-col gap-1">
        <h3 className="text-base font-semibold text-neutral-900">{title ?? t('validation.invalidFormat')}</h3>
        {description && (
          <p className="max-w-sm text-sm text-neutral-500">{description}</p>
        )}
      </div>
      {onRetry && (
        <Button variant="primary" size="sm" onClick={onRetry}>
          {actionLabel ?? t('common.component.retry')}
        </Button>
      )}
    </div>
  )
}