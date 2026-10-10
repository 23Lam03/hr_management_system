import Card from '../common/Card'
import Input from '../common/Input'
import Switch from '../common/Switch'
import SecurityStatusBadge from './SecurityStatusBadge'
import SecurityWarning from './SecurityWarning'
import { formatDateTime } from '../../utils/format'
import { useI18n } from '../../i18n/useI18n'

/**
 * SecuritySettingsForm - form chỉnh sửa các thiết lập bảo mật.
 *
 * Props:
 * - value: settings object
 * - errors: validation errors keyed by `${section}.${field}`
 * - onChange(path, value): cập nhật value
 */
export default function SecuritySettingsForm({ value, errors = {}, onChange }) {
  const { t } = useI18n()
  if (!value) return null
  const pp = value.passwordPolicy
  const ls = value.loginSecurity
  const ss = value.sessionSecurity
  const tfa = value.twoFactorAuthentication
  const noti = value.notifications

  const errorAt = (path) => errors[path]

  return (
    <div className="flex flex-col gap-4">
      <Card
        title={t('security.component.passwordPolicy')}
        subtitle={t('security.component.simulatedSettings')}
      >
        <div className="flex flex-col gap-4">
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            <Input
              label={t('security.component.minimumLength')}
              type="number"
              min={1}
              value={pp.minLength}
              onChange={(e) => onChange('passwordPolicy.minLength', Number(e.target.value))}
              helper={t('security.component.recommendMin8')}
              error={errorAt('passwordPolicy.minLength')}
            />
          </div>

          <Switch
            id="pw-uppercase"
            checked={pp.requireUppercase}
            onChange={(v) => onChange('passwordPolicy.requireUppercase', v)}
            label={t('security.component.requireUppercase')}
            description={t('security.component.uppercaseDescription')}
          />
          <Switch
            id="pw-lowercase"
            checked={pp.requireLowercase}
            onChange={(v) => onChange('passwordPolicy.requireLowercase', v)}
            label={t('security.component.requireLowercase')}
            description={t('security.component.lowercaseDescription')}
          />
          <Switch
            id="pw-number"
            checked={pp.requireNumber}
            onChange={(v) => onChange('passwordPolicy.requireNumber', v)}
            label={t('security.component.requireNumber')}
            description={t('security.component.numberDescription')}
          />
          <Switch
            id="pw-special"
            checked={pp.requireSpecialCharacter}
            onChange={(v) => onChange('passwordPolicy.requireSpecialCharacter', v)}
            label={t('security.component.requireSpecialChar')}
            description={t('security.component.specialCharDescription')}
          />

          <Switch
            id="pw-expiry"
            checked={pp.passwordExpiryEnabled}
            onChange={(v) => onChange('passwordPolicy.passwordExpiryEnabled', v)}
            label={t('security.component.enablePasswordExpiry')}
            description={t('security.component.expiryDescription')}
          />
          {pp.passwordExpiryEnabled && (
            <Input
              label={t('security.component.passwordExpiryDays')}
              type="number"
              min={1}
              value={pp.passwordExpiryDays}
              onChange={(e) => onChange('passwordPolicy.passwordExpiryDays', Number(e.target.value))}
              error={errorAt('passwordPolicy.passwordExpiryDays')}
            />
          )}
        </div>
      </Card>

      <Card
        title={t('security.component.loginSecurity')}
        subtitle={t('security.component.simulatedLoginPolicies')}
      >
        <div className="flex flex-col gap-4">
          <Switch
            id="login-limit"
            checked={ls.failedLoginLimitEnabled}
            onChange={(v) => onChange('loginSecurity.failedLoginLimitEnabled', v)}
            label={t('security.component.enableLoginLimit')}
            description={t('security.component.loginLimitDescription')}
          />
          {ls.failedLoginLimitEnabled && (
            <Input
              label={t('security.component.maxFailedLogins')}
              type="number"
              min={1}
              value={ls.failedLoginLimit}
              onChange={(e) => onChange('loginSecurity.failedLoginLimit', Number(e.target.value))}
              error={errorAt('loginSecurity.failedLoginLimit')}
            />
          )}

          <Switch
            id="login-lockout"
            checked={ls.accountLockoutEnabled}
            onChange={(v) => onChange('loginSecurity.accountLockoutEnabled', v)}
            label={t('security.component.enableLockout')}
            description={t('security.component.lockoutDescription')}
          />
          {ls.accountLockoutEnabled && (
            <Input
              label={t('security.component.lockoutDuration')}
              type="number"
              min={1}
              value={ls.lockoutDurationMinutes}
              onChange={(e) => onChange('loginSecurity.lockoutDurationMinutes', Number(e.target.value))}
              error={errorAt('loginSecurity.lockoutDurationMinutes')}
            />
          )}
        </div>
      </Card>

      <Card
        title={t('security.component.sessionManagement')}
        subtitle={t('security.component.simulatedSessionTimeout')}
      >
        <div className="flex flex-col gap-4">
          <Switch
            id="session-timeout"
            checked={ss.sessionTimeoutEnabled}
            onChange={(v) => onChange('sessionSecurity.sessionTimeoutEnabled', v)}
            label={t('security.component.enableSessionTimeout')}
            description={t('security.component.sessionTimeoutDescription')}
          />
          {ss.sessionTimeoutEnabled && (
            <Input
              label={t('security.component.sessionDuration')}
              type="number"
              min={1}
              value={ss.sessionTimeoutMinutes}
              onChange={(e) => onChange('sessionSecurity.sessionTimeoutMinutes', Number(e.target.value))}
              error={errorAt('sessionSecurity.sessionTimeoutMinutes')}
            />
          )}
        </div>
      </Card>

      <Card
        title={t('security.component.twoFactorAuth')}
        subtitle={t('security.component.simulated2FA')}
      >
        <div className="flex flex-col gap-4">
          <Switch
            id="tfa-enabled"
            checked={tfa.enabled}
            onChange={(v) => onChange('twoFactorAuthentication.enabled', v)}
            label={t('security.component.enable2FA')}
            description={t('security.component.noReal2FA')}
          />
          {tfa.enabled && (
            <SecurityWarning
              title={t('security.component.warning')}
              message={t('security.component.simulationWarning')}
            />
          )}
        </div>
      </Card>

      <Card
        title={t('security.component.securityNotifications')}
        subtitle={t('security.component.simulatedNotifications')}
      >
        <Switch
          id="security-noti"
          checked={noti.securityNotificationEnabled}
          onChange={(v) => onChange('notifications.securityNotificationEnabled', v)}
          label={t('security.component.enableSecurityNotifications')}
          description={t('security.component.securityNotiDescription')}
        />
      </Card>

      <div className="flex items-center justify-between text-xs text-neutral-500">
        <span>{t('security.component.simulatedSetting')}</span>
        <SecurityStatusBadge enabled={Boolean(value.notifications?.securityNotificationEnabled)} />
      </div>

      <div className="text-xs text-neutral-400">
        {t('security.component.lastUpdated')}: {formatDateTime(value.updatedAt)}
      </div>
    </div>
  )
}
