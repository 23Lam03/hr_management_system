import { useCallback, useEffect, useMemo, useState } from 'react'
import {
  Save,
  RotateCcw,
  Settings as SettingsIcon,
  RefreshCcw,
  AlertCircle,
  Building2,
  Globe,
  Palette,
  Bell,
  Cog,
} from 'lucide-react'

import PageHeader from '../../components/common/PageHeader'
import Card from '../../components/common/Card'
import Button from '../../components/common/Button'
import Input from '../../components/common/Input'
import Select from '../../components/common/Select'
import Switch from '../../components/common/Switch'
import Modal from '../../components/common/Modal'
import Loading from '../../components/common/Loading'
import EmptyState from '../../components/common/EmptyState'
import { useToast } from '../../components/common/useToast'
import { useI18n } from '../../i18n/useI18n'

import { classNames, formatDateTime } from '../../utils/format'

import {
  getSystemConfig,
  updateSystemConfig,
  resetSystemConfig,
} from '../../services/systemConfigService'

import {
  DEFAULT_SYSTEM_CONFIG,
  CONFIG_SECTIONS,
  LANGUAGES,
  TIMEZONES,
  DATE_FORMATS,
  CURRENCIES,
  THEMES,
} from '../../data/systemConfigData'

const SECTION_ICONS = {
  general: Building2,
  localization: Globe,
  appearance: Palette,
  notifications: Bell,
  system: Cog,
}

const EMAIL_RE = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/

/**
 * SystemConfigurationPage - cấu hình thiết lập chung frontend.
 */
export default function SystemConfigurationPage() {
  const { t } = useI18n()
  const toast = useToast()
  const [draft, setDraft] = useState(null)
  const [saved, setSaved] = useState(null)
  const [activeSection, setActiveSection] = useState('general')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [saving, setSaving] = useState(false)
  const [confirmReset, setConfirmReset] = useState(false)

  const fetchConfig = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const cfg = await getSystemConfig()
      setDraft(cfg)
      setSaved(cfg)
    } catch (_e) {
      void _e
      setError(t('admin.cannotLoadConfig'))
    } finally {
      setLoading(false)
    }
  }, [t])

  useEffect(() => {
    // eslint-disable-next-line react/set-state-in-effect
    fetchConfig()
  }, [fetchConfig])

  const isDirty = useMemo(() => !sameShape(draft, saved), [draft, saved])
  const errors = useMemo(() => validate(draft ?? {}, t), [draft, t])

  const handleSectionChange = (section, field, value) => {
    setDraft((prev) => {
      if (!prev) return prev
      return {
        ...prev,
        [section]: { ...prev[section], [field]: value },
      }
    })
  }

  const handleReset = () => {
    if (!isDirty) return
    setDraft(saved)
    toast.info(t('admin.reload') + '...')
  }

  const handleResetAll = () => {
    setConfirmReset(false)
    setSaving(true)
    resetSystemConfig()
      .then((cfg) => {
        setDraft(cfg)
        setSaved(cfg)
        toast.success(t('admin.saveChanges') + ' - default restored.')
      })
      .catch(() => {
        toast.error(t('admin.cannotLoadConfig'))
      })
      .finally(() => setSaving(false))
  }

  const handleSave = async () => {
    if (!draft) return
    const errs = validate(draft, t)
    if (hasErrors(errs)) {
      toast.error(t('admin.invalidFields'))
      return
    }
    setSaving(true)
    try {
      const next = await updateSystemConfig(draft, 'admin')
      setDraft(next)
      setSaved(next)
      toast.success(t('admin.configUpdated'))
    } catch (_e) {
      void _e
      toast.error(t('admin.cannotLoadConfig'))
    } finally {
      setSaving(false)
    }
  }

  if (loading && !draft) {
    return (
      <div className="flex h-40 items-center justify-center rounded-lg border border-dashed border-neutral-300 bg-white">
        <Loading size="md" label={t('admin.loadingSecuritySettings')} />
      </div>
    )
  }

  if (error && !draft) {
    return (
      <div className="flex flex-col gap-4">
        <PageHeader
          title={t('admin.systemConfigTitle')}
          subtitle={t('admin.systemConfigSubtitle')}
          icon={SettingsIcon}
        />
        <EmptyState
          icon={AlertCircle}
          title={error}
          description={t('admin.cannotLoadConfigDesc')}
          actionLabel={t('admin.tryAgain')}
          onAction={fetchConfig}
        />
      </div>
    )
  }

  if (!draft) {
    return (
      <div className="flex flex-col gap-4">
        <PageHeader
          title={t('admin.systemConfigTitle')}
          subtitle={t('admin.systemConfigSubtitle')}
          icon={SettingsIcon}
        />
        <EmptyState
          icon={SettingsIcon}
          title={t('admin.noConfigFound')}
          description={t('admin.noConfigFoundDesc')}
          actionLabel={t('admin.createDefaultConfig')}
          onAction={async () => {
            setSaving(true)
            try {
              const fresh = await resetSystemConfig()
              setDraft(fresh)
              setSaved(fresh)
            } finally {
              setSaving(false)
            }
          }}
        />
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title={t('admin.systemConfigTitle')}
        subtitle={t('admin.systemConfigSubtitle')}
        icon={SettingsIcon}
        actions={
          <div className="flex flex-wrap items-center gap-2">
            <Button
              variant="outline"
              size="md"
              icon={RefreshCcw}
              onClick={fetchConfig}
              loading={loading}
            >
              {t('admin.reload')}
            </Button>
            <Button
              variant="ghost"
              size="md"
              icon={RotateCcw}
              onClick={handleReset}
              disabled={!isDirty || saving}
            >
              {t('admin.reset')}
            </Button>
            <Button
              variant="primary"
              size="md"
              icon={Save}
              onClick={handleSave}
              loading={saving}
              disabled={!isDirty || hasErrors(errors)}
            >
              {t('admin.saveChanges')}
            </Button>
          </div>
        }
      />

      {isDirty && (
        <div
          className="flex items-center gap-2 rounded-md border border-warning-200 bg-warning-50 px-4 py-2 text-[13px] text-warning-700"
          role="status"
        >
          <AlertCircle className="h-4 w-4" aria-hidden="true" />
          <span>{t('admin.unsavedChanges')}</span>
        </div>
      )}

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-12">
        {/* Sidebar / Tabs */}
        <Card className="lg:col-span-3">
          <nav aria-label="Cấu hình" className="flex flex-col gap-1">
            {CONFIG_SECTIONS.map((s) => {
              const Icon = SECTION_ICONS[s.id] ?? SettingsIcon
              const active = s.id === activeSection
              return (
                <button
                  key={s.id}
                  type="button"
                  onClick={() => setActiveSection(s.id)}
                  aria-current={active ? 'true' : undefined}
                  className={classNames(
                    'flex items-start gap-3 rounded-md px-3 py-2 text-left text-sm transition',
                    'focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-600/40',
                    active
                      ? 'bg-brand-50 text-brand-700'
                      : 'text-neutral-700 hover:bg-neutral-100',
                  )}
                >
                  <Icon className="mt-0.5 h-4 w-4 flex-shrink-0" aria-hidden="true" />
                  <span className="flex min-w-0 flex-col">
                    <span className="font-medium">{s.label}</span>
                    <span className="text-[11px] text-neutral-500">{s.description}</span>
                  </span>
                </button>
              )
            })}
          </nav>

          <div className="mt-4 border-t border-neutral-200 pt-4">
            <button
              type="button"
              onClick={() => setConfirmReset(true)}
              className="flex w-full items-center justify-center gap-2 rounded-md border border-danger-200 bg-white px-3 py-2 text-sm font-medium text-danger-700 hover:bg-danger-50"
            >
              <RotateCcw className="h-4 w-4" aria-hidden="true" />
              {t('admin.resetToDefault')}
            </button>
          </div>
        </Card>

        {/* Content */}
        <div className="flex flex-col gap-4 lg:col-span-9">
          <CurrentConfigCard config={saved ?? draft} />

          {activeSection === 'general' && (
            <SectionCard title="General Settings" description="Thông tin doanh nghiệp hiển thị trên hệ thống.">
              <GeneralSection draft={draft} errors={errors} onChange={handleSectionChange} />
            </SectionCard>
          )}

          {activeSection === 'localization' && (
            <SectionCard title="Localization" description="Ngôn ngữ, múi giờ, định dạng ngày và tiền tệ.">
              <LocalizationSection draft={draft} errors={errors} onChange={handleSectionChange} />
            </SectionCard>
          )}

          {activeSection === 'appearance' && (
            <SectionCard title="Appearance" description="Tùy chỉnh theme và mật độ hiển thị.">
              <AppearanceSection draft={draft} onChange={handleSectionChange} />
            </SectionCard>
          )}

          {activeSection === 'notifications' && (
            <SectionCard title="Notification Settings" description="Các kênh thông báo được bật trong hệ thống.">
              <NotificationsSection draft={draft} onChange={handleSectionChange} />
            </SectionCard>
          )}

          {activeSection === 'system' && (
            <SectionCard title="System Settings" description="Thiết lập hành vi hệ thống ở mức cấu hình demo.">
              <SystemSection draft={draft} onChange={handleSectionChange} />
            </SectionCard>
          )}

          <LastUpdatedCard config={saved ?? draft} />
        </div>
      </div>

      <Modal
        open={confirmReset}
        onClose={() => setConfirmReset(false)}
        title={t('admin.resetToDefaultConfirm')}
        description={t('admin.resetToDefaultDesc')}
        size="md"
        footer={
          <>
            <Button variant="ghost" onClick={() => setConfirmReset(false)}>
              {t('admin.resetConfirm')}
            </Button>
            <Button variant="danger" onClick={handleResetAll}>
              {t('admin.confirmReset')}
            </Button>
          </>
        }
      >
        <p className="text-sm text-neutral-700">
          {t('admin.resetToDefaultDesc')}
        </p>
      </Modal>
    </div>
  )
}

// ---------- Sections -------------------------------------------------------

function SectionCard({ title, description, children }) {
  return (
    <Card title={title} subtitle={description}>
      <div className="flex flex-col gap-4">{children}</div>
    </Card>
  )
}

function GeneralSection({ draft, errors, onChange }) {
  const e = errors.general ?? {}
  return (
    <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
      <Input
        label="Company Name"
        value={draft.general.companyName ?? ''}
        onChange={(ev) => onChange('general', 'companyName', ev.target.value)}
        error={e.companyName}
        required
        placeholder="VD: HR Management System"
      />
      <Input
        label="Company Email"
        type="email"
        value={draft.general.companyEmail ?? ''}
        onChange={(ev) => onChange('general', 'companyEmail', ev.target.value)}
        error={e.companyEmail}
        placeholder="hr@example.com"
      />
      <Input
        label="Company Phone"
        value={draft.general.companyPhone ?? ''}
        onChange={(ev) => onChange('general', 'companyPhone', ev.target.value)}
        placeholder="VD: 028 1234 5678"
      />
      <Input
        label="Address"
        value={draft.general.address ?? ''}
        onChange={(ev) => onChange('general', 'address', ev.target.value)}
        placeholder="Số nhà, đường, quận/huyện, tỉnh/thành"
      />
    </div>
  )
}

function LocalizationSection({ draft, errors, onChange }) {
  const e = errors.localization ?? {}
  return (
    <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
      <Select
        label="Language"
        required
        value={draft.localization.language}
        onChange={(ev) => onChange('localization', 'language', ev.target.value)}
        options={LANGUAGES}
        error={e.language}
      />
      <Select
        label="Timezone"
        required
        value={draft.localization.timezone}
        onChange={(ev) => onChange('localization', 'timezone', ev.target.value)}
        options={TIMEZONES}
        error={e.timezone}
      />
      <Select
        label="Date Format"
        required
        value={draft.localization.dateFormat}
        onChange={(ev) => onChange('localization', 'dateFormat', ev.target.value)}
        options={DATE_FORMATS}
        error={e.dateFormat}
      />
      <Select
        label="Currency"
        required
        value={draft.localization.currency}
        onChange={(ev) => onChange('localization', 'currency', ev.target.value)}
        options={CURRENCIES}
        error={e.currency}
      />
    </div>
  )
}

function AppearanceSection({ draft, onChange }) {
  return (
    <div className="flex flex-col gap-4">
      <Select
        label="Theme"
        required
        value={draft.appearance.theme}
        onChange={(ev) => onChange('appearance', 'theme', ev.target.value)}
        options={THEMES}
        helper="Tùy chọn Dark chỉ phục vụ demo. Hệ thống hiện tại đang dùng giao diện Light."
      />
      <Switch
        label="Compact Mode"
        description="Giảm padding/density để hiển thị nhiều thông tin hơn."
        checked={Boolean(draft.appearance.compactMode)}
        onChange={(v) => onChange('appearance', 'compactMode', v)}
      />
      <Switch
        label="Sidebar Collapsed"
        description="Mặc định thu gọn sidebar cho người dùng mới."
        checked={Boolean(draft.appearance.sidebarCollapsed)}
        onChange={(v) => onChange('appearance', 'sidebarCollapsed', v)}
      />
    </div>
  )
}

function NotificationsSection({ draft, onChange }) {
  return (
    <div className="flex flex-col gap-4">
      <Switch
        label="In-app Notifications"
        description="In-app notifications are displayed inside the HR Management System."
        checked={Boolean(draft.notifications.inAppEnabled)}
        onChange={(v) => onChange('notifications', 'inAppEnabled', v)}
      />
      <Switch
        label="Email Notifications"
        description="Email notifications are simulated in this frontend demo."
        checked={Boolean(draft.notifications.emailEnabled)}
        onChange={(v) => onChange('notifications', 'emailEnabled', v)}
      />
    </div>
  )
}

function SystemSection({ draft, onChange }) {
  return (
    <div className="flex flex-col gap-4">
      <Switch
        label="Allow Employee Registration"
        description="Cho phép tạo tài khoản nhân viên mới từ luồng đăng ký (frontend demo)."
        checked={Boolean(draft.system.allowEmployeeRegistration)}
        onChange={(v) => onChange('system', 'allowEmployeeRegistration', v)}
      />
      <Switch
        label="Maintenance Mode"
        description="Maintenance Mode chỉ là configuration mock. Không khóa hệ thống trong frontend demo."
        checked={Boolean(draft.system.maintenanceMode)}
        onChange={(v) => onChange('system', 'maintenanceMode', v)}
      />
    </div>
  )
}

// ---------- Current config summary -----------------------------------------

function CurrentConfigCard({ config }) {
  if (!config) return null
  const items = [
    { label: 'Language', value: LANGUAGES.find((x) => x.value === config.localization.language)?.label ?? config.localization.language },
    { label: 'Timezone', value: config.localization.timezone },
    { label: 'Currency', value: config.localization.currency },
    { label: 'Date format', value: config.localization.dateFormat },
    { label: 'Theme', value: config.appearance.theme },
    { label: 'In-app notifications', value: config.notifications.inAppEnabled ? 'Enabled' : 'Disabled' },
    { label: 'Email notifications', value: config.notifications.emailEnabled ? 'Enabled' : 'Disabled' },
    { label: 'Maintenance mode', value: config.system.maintenanceMode ? 'On' : 'Off' },
  ]
  return (
    <Card title="Current Configuration" subtitle="Trạng thái hiện tại đã được lưu.">
      <dl className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-4">
        {items.map((it) => (
          <div key={it.label} className="rounded-md bg-neutral-50 px-3 py-2">
            <dt className="text-[11px] uppercase tracking-wide text-neutral-500">{it.label}</dt>
            <dd className="mt-0.5 text-sm font-medium text-neutral-900">{it.value}</dd>
          </div>
        ))}
      </dl>
    </Card>
  )
}

function LastUpdatedCard({ config }) {
  if (!config) return null
  return (
    <Card padding>
      <div className="flex flex-wrap items-center justify-between gap-2 text-[13px] text-neutral-500">
        <span>
          Last updated:{' '}
          <span className="font-medium text-neutral-700">
            {formatDateTime(config.updatedAt)}
          </span>
        </span>
        <span>
          Updated by:{' '}
          <span className="font-medium text-neutral-700">{config.updatedBy}</span>
        </span>
      </div>
    </Card>
  )
}

// ---------- Helpers --------------------------------------------------------

function validate(draft, t) {
  const errs = {
    general: {},
    localization: {},
  }

  const general = draft.general ?? DEFAULT_SYSTEM_CONFIG.general
  if (!general.companyName || !general.companyName.trim()) {
    errs.general.companyName = t('validation.fieldRequired')
  }
  if (general.companyEmail && !EMAIL_RE.test(general.companyEmail.trim())) {
    errs.general.companyEmail = t('validation.emailInvalid')
  }

  const loc = draft.localization ?? DEFAULT_SYSTEM_CONFIG.localization
  if (!loc.language) errs.localization.language = t('validation.fieldRequired')
  if (!loc.timezone) errs.localization.timezone = t('validation.fieldRequired')
  if (!loc.dateFormat) errs.localization.dateFormat = t('validation.fieldRequired')
  if (!loc.currency) errs.localization.currency = t('validation.fieldRequired')

  return errs
}

function hasErrors(errs) {
  return Boolean(
    errs.general?.companyName ||
    errs.general?.companyEmail ||
    errs.localization?.language ||
    errs.localization?.timezone ||
    errs.localization?.dateFormat ||
    errs.localization?.currency,
  )
}

function sameShape(a, b) {
  if (a === b) return true
  if (!a || !b) return false
  return JSON.stringify(stableView(a)) === JSON.stringify(stableView(b))
}

function stableView(cfg) {
  // chỉ so sánh các section business, bỏ metadata
  return {
    general: cfg.general,
    localization: cfg.localization,
    appearance: cfg.appearance,
    notifications: cfg.notifications,
    system: cfg.system,
  }
}
