import { useEffect, useMemo, useState } from 'react'
import {
  ShieldCheck,
  KeyRound,
  LogIn,
  Clock4,
  Lock,
  Bell,
  Save,
  RotateCcw,
  RefreshCcw,
} from 'lucide-react'

import PageHeader from '../../components/common/PageHeader'
import Button from '../../components/common/Button'
import Loading from '../../components/common/Loading'
import { useToast } from '../../components/common/useToast'
import { useAuth } from '../../contexts/useAuth'
import useSecurity from '../../contexts/useSecurity'
import { useI18n } from '../../i18n/useI18n'
import {
  querySecurityActivities,
  getSecurityKpi,
} from '../../services/securityService'

import SecurityStatTiles from '../../components/security/SecurityStatTiles'
import SecurityOverviewCard from '../../components/security/SecurityOverviewCard'
import SecurityWarning from '../../components/security/SecurityWarning'
import SecuritySettingsForm from '../../components/security/SecuritySettingsForm'
import SecurityActivityTable from '../../components/security/SecurityActivityTable'
import SecurityActivityFilterBar from '../../components/security/SecurityActivityFilterBar'
import SecurityActivityDetailModal from '../../components/security/SecurityActivityDetailModal'

const DEFAULT_FILTERS = { search: '', type: '', status: '' }

function setIn(obj, path, value) {
  const keys = path.split('.')
  const next = Array.isArray(obj) ? [...obj] : { ...obj }
  let cursor = next
  for (let i = 0; i < keys.length - 1; i += 1) {
    cursor[keys[i]] = { ...(cursor[keys[i]] ?? {}) }
    cursor = cursor[keys[i]]
  }
  cursor[keys[keys.length - 1]] = value
  return next
}

function deepEqual(a, b) {
  if (a === b) return true
  if (typeof a !== typeof b) return false
  if (a && b && typeof a === 'object') {
    const ka = Object.keys(a)
    const kb = Object.keys(b)
    if (ka.length !== kb.length) return false
    return ka.every((k) => deepEqual(a[k], b[k]))
  }
  return false
}

export default function AdminSecurityPage() {
  const { t } = useI18n()
  const toast = useToast()
  const { user } = useAuth()
  const security = useSecurity()

  const originalSettings = security?.settings
  const allActivities = security?.activities ?? []
  const recentActivities = allActivities.slice(0, 5)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const kpi = useMemo(() => getSecurityKpi(), [security?.tick])

  const [draft, setDraft] = useState(null)
  const [errors, setErrors] = useState({})
  const [submitting, setSubmitting] = useState(false)

  const [filters, setFilters] = useState(DEFAULT_FILTERS)
  const [page, setPage] = useState(1)
  const [pageSize] = useState(10)
  const [openDetail, setOpenDetail] = useState(null)

  // Đồng bộ draft với snapshot từ context khi provider thay đổi.
  useEffect(() => {
    if (originalSettings) {
      // eslint-disable-next-line react/set-state-in-effect
      setDraft((prev) => (prev && deepEqual(prev, originalSettings) ? prev : originalSettings))
    }
  }, [originalSettings])

  const handleChange = (path, value) => {
    setDraft((prev) => (prev ? setIn(prev, path, value) : prev))
    setErrors((prev) => {
      if (!prev[path]) return prev
      const next = { ...prev }
      delete next[path]
      return next
    })
  }

  const isDirty = useMemo(() => {
    if (!draft || !originalSettings) return false
    return !deepEqual(draft, originalSettings)
  }, [draft, originalSettings])

  // eslint-disable-next-line react-hooks/exhaustive-deps
  const activityData = useMemo(() => {
    return querySecurityActivities({
      ...filters,
      sortBy: 'createdAt',
      sortDir: 'desc',
      page,
      pageSize,
    })
  }, [filters, page, pageSize])

  const handleFilterChange = (patch) => {
    setFilters((prev) => ({ ...prev, ...patch }))
    setPage(1)
  }

  const handleResetFilter = () => {
    setFilters(DEFAULT_FILTERS)
    setPage(1)
  }

  const handleSave = async () => {
    if (!draft) return
    setSubmitting(true)
    const r = await security?.updateSettings?.(draft, user ?? undefined)
    setSubmitting(false)
    if (r?.ok) {
      toast.success(t('admin.settingsUpdated'))
      setErrors({})
      // eslint-disable-next-line react/set-state-in-effect
      setDraft(r.settings)
    } else {
      setErrors(r?.errors ?? {})
      toast.error(t('admin.cannotUpdateSettings'))
    }
  }

  const handleCancel = () => {
    if (originalSettings) setDraft(originalSettings)
    setErrors({})
  }

  if (!originalSettings || !draft) {
    return (
      <div className="flex h-40 items-center justify-center rounded-lg border border-dashed border-neutral-300 bg-white">
        <Loading size="md" label={t('admin.loadingSecuritySettings')} />
      </div>
    )
  }

  const pp = originalSettings.passwordPolicy
  const ls = originalSettings.loginSecurity
  const ss = originalSettings.sessionSecurity
  const tfa = originalSettings.twoFactorAuthentication
  const noti = originalSettings.notifications

  const show2FAWarning = !tfa.enabled
  const showSessionWarning = !ss.sessionTimeoutEnabled
  const showExpiryWarning = !pp.passwordExpiryEnabled

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title={t('admin.securityTitle')}
        subtitle={t('admin.securitySubtitle')}
        icon={ShieldCheck}
      />

      <SecurityStatTiles
        totalActivities={kpi.totalActivities}
        loginSuccess={kpi.loginSuccess}
        loginFailed={kpi.loginFailed}
        enabledCount={kpi.enabledCount}
      />

      <section>
        <h2 className="mb-3 text-base font-semibold text-neutral-900">{t('admin.settingsOverviewTitle')}</h2>
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
          <SecurityOverviewCard
            title={t('admin.passwordPolicy')}
            description={t('admin.passwordPolicyDesc')}
            icon={KeyRound}
            enabled
            summary={
              <ul className="flex flex-col gap-1 text-[13px]">
                <li>{t('admin.minLength', { n: pp.minLength })}</li>
                <li>{t('admin.requireUppercase', { yes: pp.requireUppercase ? t('admin.yes') : t('admin.no') })}</li>
                <li>{t('admin.requireLowercase', { yes: pp.requireLowercase ? t('admin.yes') : t('admin.no') })}</li>
                <li>{t('admin.requireNumber', { yes: pp.requireNumber ? t('admin.yes') : t('admin.no') })}</li>
                <li>{t('admin.requireSpecialChar', { yes: pp.requireSpecialCharacter ? t('admin.yes') : t('admin.no') })}</li>
                <li>{pp.passwordExpiryEnabled ? t('admin.passwordExpiry', { value: `${pp.passwordExpiryDays} ngày` }) : t('admin.passwordExpiry', { value: t('admin.passwordExpiryDisabled') })}</li>
              </ul>
            }
            onConfigure={() => document.getElementById('settings-form-anchor')?.scrollIntoView({ behavior: 'smooth' })}
          />

          <SecurityOverviewCard
            title={t('admin.loginSecurity')}
            description={t('admin.loginSecurityDesc')}
            icon={LogIn}
            enabled={ls.failedLoginLimitEnabled || ls.accountLockoutEnabled}
            summary={
              <ul className="flex flex-col gap-1 text-[13px]">
                <li>{ls.failedLoginLimitEnabled ? t('admin.failedLoginLimit', { n: ls.failedLoginLimit }) : t('admin.failedLoginLimitDisabled')}</li>
                <li>{ls.accountLockoutEnabled ? t('admin.lockoutDuration', { n: ls.lockoutDurationMinutes }) : t('admin.lockoutDurationDisabled')}</li>
              </ul>
            }
            onConfigure={() => document.getElementById('settings-form-anchor')?.scrollIntoView({ behavior: 'smooth' })}
          />

          <SecurityOverviewCard
            title={t('admin.sessionManagement')}
            description={t('admin.sessionManagementDesc')}
            icon={Clock4}
            enabled={ss.sessionTimeoutEnabled}
            summary={
              <span className="text-[13px]">
                {ss.sessionTimeoutEnabled
                  ? t('admin.sessionTimeoutNote', { n: ss.sessionTimeoutMinutes })
                  : t('admin.sessionNoTimeoutNote')}
              </span>
            }
            onConfigure={() => document.getElementById('settings-form-anchor')?.scrollIntoView({ behavior: 'smooth' })}
          />

          <SecurityOverviewCard
            title={t('admin.twoFactorAuth')}
            description={t('admin.twoFactorAuthDesc')}
            icon={Lock}
            enabled={tfa.enabled}
            summary={
              <span className="text-[13px]">
                {tfa.enabled ? t('admin.twoFactorEnabledNote') : t('admin.twoFactorDisabledNote')}
              </span>
            }
            onConfigure={() => document.getElementById('settings-form-anchor')?.scrollIntoView({ behavior: 'smooth' })}
          />

          <SecurityOverviewCard
            title={t('admin.securityNotifications')}
            description={t('admin.securityNotificationsDesc')}
            icon={Bell}
            enabled={noti.securityNotificationEnabled}
            summary={
              <span className="text-[13px]">
                {noti.securityNotificationEnabled ? t('admin.securityNotificationsEnabledNote') : t('admin.securityNotificationsDisabledNote')}
              </span>
            }
            onConfigure={() => document.getElementById('settings-form-anchor')?.scrollIntoView({ behavior: 'smooth' })}
          />
        </div>
      </section>

      {(show2FAWarning || showSessionWarning || showExpiryWarning) && (
        <section className="flex flex-col gap-3">
          {show2FAWarning && (
            <SecurityWarning
              title={t('admin.2FAWarningTitle')}
              message={t('admin.2FAWarningMsg')}
            />
          )}
          {showSessionWarning && (
            <SecurityWarning
              title={t('admin.sessionWarningTitle')}
              message={t('admin.sessionWarningMsg')}
            />
          )}
          {showExpiryWarning && (
            <SecurityWarning
              title={t('admin.expiryWarningTitle')}
              message={t('admin.expiryWarningMsg')}
            />
          )}
        </section>
      )}

      <section id="settings-form-anchor" className="flex flex-col gap-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2 className="text-base font-semibold text-neutral-900">{t('admin.settingsDetailTitle')}</h2>
          <div className="flex flex-wrap items-center gap-2">
            <Button
              variant="secondary"
              size="md"
              icon={RotateCcw}
              onClick={handleCancel}
              disabled={!isDirty || submitting}
            >
              {t('admin.cancel')}
            </Button>
            <Button
              variant="primary"
              size="md"
              icon={Save}
              loading={submitting}
              disabled={!isDirty || submitting}
              onClick={handleSave}
            >
              {t('admin.saveChanges')}
            </Button>
          </div>
        </div>

        <SecuritySettingsForm value={draft} errors={errors} onChange={handleChange} />
      </section>

      <section className="flex flex-col gap-4">
        <div className="flex items-center justify-between">
          <h2 className="text-base font-semibold text-neutral-900">{t('admin.recentActivityTitle')}</h2>
          <Button
            variant="ghost"
            size="sm"
            icon={RefreshCcw}
            onClick={() => security?.loadSecurityActivities?.()}
          >
            {t('admin.reload')}
          </Button>
        </div>
        <SecurityActivityTable
          data={recentActivities}
          pagination={null}
          onView={(row) => setOpenDetail(row)}
          emptyTitle={t('admin.noSecurityActivities')}
          emptyDescription={t('admin.securityActivitiesAppearHere')}
        />
      </section>

      <section className="flex flex-col gap-4">
        <h2 className="text-base font-semibold text-neutral-900">{t('admin.securityActivityHistoryTitle')}</h2>
        <SecurityActivityFilterBar
          search={filters.search}
          type={filters.type}
          status={filters.status}
          onChange={handleFilterChange}
          onReset={handleResetFilter}
        />
        <SecurityActivityTable
          data={activityData.items}
          pagination={{
            page: activityData.page,
            pageSize,
            total: activityData.total,
            onChange: (p) => setPage(p),
          }}
          onView={(row) => setOpenDetail(row)}
        />
      </section>

      <SecurityActivityDetailModal
        open={Boolean(openDetail)}
        activity={openDetail}
        onClose={() => setOpenDetail(null)}
      />
    </div>
  )
}
