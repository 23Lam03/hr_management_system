import Badge from '../common/Badge'
import { useI18n } from '../../i18n/useI18n'

/**
 * StatusBadge - "Đang bật" / "Đang tắt".
 */
export default function SecurityStatusBadge({ enabled, className = '' }) {
  const { t } = useI18n()
  return (
    <Badge tone={enabled ? 'success' : 'neutral'} className={className}>
      {enabled ? t('security.component.enabled') : t('security.component.disabled')}
    </Badge>
  )
}