import { AlertTriangle } from 'lucide-react'
import { useI18n } from '../../i18n/useI18n'

import { classNames } from '../../utils/format'

/**
 * SecurityWarning - banner cảnh báo cấu hình mô phỏng.
 */
export default function SecurityWarning({ title, message, className = '' }) {
  const { t } = useI18n()
  return (
    <div
      className={classNames(
        'flex items-start gap-3 rounded-md border border-warning-200 bg-warning-50 px-4 py-3 text-warning-700',
        className,
      )}
      role="status"
    >
      <AlertTriangle className="mt-0.5 h-5 w-5 flex-shrink-0" aria-hidden="true" />
      <div className="text-sm">
        <p className="font-medium">{title ?? t('security.component.warning')}</p>
        {message && <p className="mt-0.5 text-warning-700/90">{message}</p>}
      </div>
    </div>
  )
}