import {
  LogIn,
  LogOut,
  KeyRound,
  ShieldAlert,
  Lock,
  LockOpen,
} from 'lucide-react'

import { useI18n } from '../../i18n/useI18n'
import Badge from '../common/Badge'

const META = {
  login:                   { Icon: LogIn,       tone: 'info' },
  logout:                  { Icon: LogOut,      tone: 'neutral' },
  password_change:         { Icon: KeyRound,    tone: 'primary' },
  security_setting_update: { Icon: ShieldAlert, tone: 'warning' },
  account_lock:            { Icon: Lock,        tone: 'danger' },
  account_unlock:          { Icon: LockOpen,    tone: 'success' },
}

const LABEL_KEYS = {
  login:                   'security.component.typeLogin',
  logout:                  'security.component.typeLogout',
  password_change:         'security.component.typePasswordChange',
  security_setting_update: 'security.component.typeSecuritySettingUpdate',
  account_lock:            'security.component.typeAccountLock',
  account_unlock:          'security.component.typeAccountUnlock',
}

export default function SecurityActivityTypeBadge({ type, withIcon = true, className = '' }) {
  const { t } = useI18n()
  const meta = META[type] ?? META.security_setting_update
  const Icon = meta.Icon
  return (
    <Badge tone={meta.tone} className={className}>
      {withIcon && <Icon className="h-3.5 w-3.5" aria-hidden="true" />}
      <span>{t(LABEL_KEYS[type] ?? 'security.component.typeSecuritySettingUpdate')}</span>
    </Badge>
  )
}