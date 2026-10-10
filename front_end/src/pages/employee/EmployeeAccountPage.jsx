import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import {
  ChevronRight,
  Eye,
  EyeOff,
  KeyRound,
  LogOut,
  ShieldCheck,
  User,
} from 'lucide-react'

import PageHeader from '../../components/common/PageHeader'
import Card from '../../components/common/Card'
import Button from '../../components/common/Button'
import EmptyState from '../../components/common/EmptyState'
import Loading from '../../components/common/Loading'
import { useToast } from '../../components/common/useToast'
import { useAuth } from '../../contexts/useAuth'
import { useI18n } from '../../i18n/useI18n'

import { ROLES } from '../../contexts/roles'
import { ERROR_CODES } from '../../services/authService'

const ROLE_LABEL = {
  [ROLES.ADMIN]: 'Quản trị viên',
  [ROLES.EMPLOYEE]: 'Nhân viên',
}

const PASSWORD_MIN_LENGTH = 6

export default function EmployeeAccountPage() {
  const navigate = useNavigate()
  const toast = useToast()
  const { user, logout, changePassword } = useAuth()
  const { t } = useI18n()

  const [pwForm, setPwForm] = useState({
    current: '',
    next: '',
    confirm: '',
  })
  const [showPw, setShowPw] = useState({
    current: false,
    next: false,
    confirm: false,
  })
  const [pwErrors, setPwErrors] = useState({})
  const [submitting, setSubmitting] = useState(false)

  if (!user) {
    return (
      <div className="flex h-40 items-center justify-center rounded-lg border border-dashed border-neutral-300 bg-white">
        <Loading size="md" label={t('employeeAccount.loading')} />
      </div>
    )
  }

  const roleLabel = ROLE_LABEL[user.role] ?? user.role ?? t('profile.notProvided')
  const userId = user.id ?? t('profile.notProvided')

  const updatePw = (field, value) => setPwForm((prev) => ({ ...prev, [field]: value }))
  const togglePw = (field) => setShowPw((prev) => ({ ...prev, [field]: !prev[field] }))

  const handleSubmitChangePassword = async () => {
    const errors = {}
    if (!pwForm.current) errors.current = t('employeeAccount.enterCurrentPassword')
    if (!pwForm.next) errors.next = t('employeeAccount.enterNewPassword')
    else if (pwForm.next.length < PASSWORD_MIN_LENGTH) {
      errors.next = t('employeeAccount.newPasswordMinChars', { n: PASSWORD_MIN_LENGTH })
    }
    if (!pwForm.confirm) errors.confirm = t('employeeAccount.confirmNewPassword')
    else if (pwForm.next && pwForm.confirm !== pwForm.next) {
      errors.confirm = t('employeeAccount.passwordsMustMatch')
    }
    setPwErrors(errors)
    if (Object.keys(errors).length) return

    setSubmitting(true)
    try {
      await changePassword(pwForm.current, pwForm.next)
      toast.success(t('profile.saveSuccess'))
      setPwForm({ current: '', next: '', confirm: '' })
    } catch (err) {
      const code = err?.code
      if (code === ERROR_CODES.WRONG_CURRENT) {
        setPwErrors({ current: t('employeeAccount.currentPasswordWrong') })
      } else if (code === ERROR_CODES.PASSWORD_TOO_SHORT) {
        setPwErrors({ next: err.message })
      } else {
        toast.error(err?.message || t('employeeAccount.cannotChangePassword'))
      }
    } finally {
      setSubmitting(false)
    }
  }

  const handleCancelPw = () => {
    setPwForm({ current: '', next: '', confirm: '' })
    setPwErrors({})
  }

  const handleLogout = () => {
    logout()
    navigate('/login', { replace: true })
  }

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title={t('employeeAccount.accountSettings')}
        subtitle={t('employeeAccount.accountSettingsDesc')}
        icon={User}
      />

      {/* Account Information */}
      <Card title={t('employeeAccount.accountInfo')} subtitle={t('employeeAccount.accountInfoDesc')}>
        <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
          <Field label={t('employeeAccount.userId')} value={userId} />
          <Field label={t('employeeAccount.email')} value={user.email || t('profile.notProvided')} note={t('employeeAccount.emailIsAccount')} />
          <Field label={t('employeeAccount.role')} value={roleLabel} note={t('employeeAccount.roleIsManaged')} />
          <Field
            label={t('employeeAccount.accountStatus')}
            value={t('employeeAccount.active')}
            note={t('employeeAccount.statusManaged')}
          />
        </div>
      </Card>

      {/* Quick links */}
      <Card title={t('employeeAccount.quickLinks')}>
        <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
          <Link
            to="/employee/profile"
            className="group flex items-center justify-between gap-3 rounded-md border border-neutral-200 bg-white px-3 py-2 hover:border-brand-300 hover:bg-brand-50"
          >
            <div className="flex items-center gap-2">
              <User className="h-4 w-4 text-neutral-500 group-hover:text-brand-700" aria-hidden="true" />
              <div className="flex flex-col">
                <span className="text-sm font-medium text-neutral-900">{t('employeeAccount.myProfileLink')}</span>
                <span className="text-xs text-neutral-500">{t('employeeAccount.myProfileDesc')}</span>
              </div>
            </div>
            <ChevronRight className="h-4 w-4 text-neutral-400 group-hover:text-brand-700" aria-hidden="true" />
          </Link>
          <Link
            to="/employee/notifications"
            className="group flex items-center justify-between gap-3 rounded-md border border-neutral-200 bg-white px-3 py-2 hover:border-brand-300 hover:bg-brand-50"
          >
            <div className="flex items-center gap-2">
              <ShieldCheck className="h-4 w-4 text-neutral-500 group-hover:text-brand-700" aria-hidden="true" />
              <div className="flex flex-col">
                <span className="text-sm font-medium text-neutral-900">{t('employeeAccount.notificationSettings')}</span>
                <span className="text-xs text-neutral-500">{t('employeeAccount.goToNotifications')}</span>
              </div>
            </div>
            <ChevronRight className="h-4 w-4 text-neutral-400 group-hover:text-brand-700" aria-hidden="true" />
          </Link>
        </div>
      </Card>

      {/* Change Password */}
      <Card title={t('employeeAccount.changePassword')} subtitle={t('employeeAccount.changePasswordDesc')}>
        <form
          onSubmit={(e) => {
            e.preventDefault()
            handleSubmitChangePassword()
          }}
          className="flex flex-col gap-3"
        >
          <PasswordField
            label={t('employeeAccount.currentPassword')}
            value={pwForm.current}
            onChange={(v) => updatePw('current', v)}
            visible={showPw.current}
            onToggle={() => togglePw('current')}
            error={pwErrors.current}
            required
            autoComplete="current-password"
          />
          <PasswordField
            label={t('employeeAccount.newPassword')}
            value={pwForm.next}
            onChange={(v) => updatePw('next', v)}
            visible={showPw.next}
            onToggle={() => togglePw('next')}
            error={pwErrors.next}
            helper={t('employeeAccount.newPasswordMinChars', { n: PASSWORD_MIN_LENGTH })}
            required
            autoComplete="new-password"
          />
          <PasswordField
            label={t('employeeAccount.confirmPassword')}
            value={pwForm.confirm}
            onChange={(v) => updatePw('confirm', v)}
            visible={showPw.confirm}
            onToggle={() => togglePw('confirm')}
            error={pwErrors.confirm}
            required
            autoComplete="new-password"
          />
          <div className="flex flex-wrap justify-end gap-2">
            <Button variant="secondary" onClick={handleCancelPw} disabled={submitting} type="button">
              {t('common.cancel')}
            </Button>
            <Button
              variant="primary"
              type="submit"
              icon={KeyRound}
              loading={submitting}
            >
              {t('employeeAccount.changePassword')}
            </Button>
          </div>
        </form>
      </Card>

      {/* Session / Logout */}
      <Card title={t('employeeAccount.session')} subtitle={t('employeeAccount.sessionDesc')}>
        <div className="flex flex-col items-start justify-between gap-3 sm:flex-row sm:items-center">
          <p className="text-sm text-neutral-700">
            {t('employeeAccount.loggedInAs', { n: user.email })}.
          </p>
          <Button variant="danger" icon={LogOut} onClick={handleLogout}>
            {t('employeeAccount.logout')}
          </Button>
        </div>
      </Card>

      {/* Error state example: không lấy được currentUser */}
      {!user?.email && (
        <EmptyState
          title={t('employeeAccount.cannotLoadAccount')}
          description={t('employeeAccount.tryAgainOrLogin')}
          actionLabel={t('employeeAccount.retry')}
          onAction={() => window.location.reload()}
        />
      )}
    </div>
  )
}

function Field({ label, value, note }) {
  return (
    <div className="flex flex-col gap-1.5">
      <span className="text-[13px] font-medium text-neutral-900">{label}</span>
      <div className="rounded-md border border-neutral-200 bg-neutral-50 px-3 py-2 text-sm text-neutral-700">
        {value || 'Not provided'}
      </div>
      {note && <p className="text-xs text-neutral-500">{note}</p>}
    </div>
  )
}

function PasswordField({ label, value, onChange, visible, onToggle, error, helper, required, autoComplete }) {
  return (
    <div className="flex flex-col gap-1.5">
      <label htmlFor={`pw-${label}`} className="text-[13px] font-medium text-neutral-900">
        {label}
        {required && <span className="text-danger-500"> *</span>}
      </label>
      <div className="relative">
        <input
          id={`pw-${label}`}
          type={visible ? 'text' : 'password'}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          autoComplete={autoComplete}
          aria-invalid={Boolean(error)}
          className="w-full rounded-md border border-neutral-200 bg-white px-3 py-2 pr-10 text-sm text-neutral-700 placeholder:text-neutral-400 focus:border-brand-600 focus:outline-none focus:ring-2 focus:ring-brand-600/20"
        />
        <button
          type="button"
          onClick={onToggle}
          aria-label={visible ? `Ẩn ${label}` : `Hiện ${label}`}
          className="absolute inset-y-0 right-2 my-auto inline-flex h-7 w-7 items-center justify-center rounded text-neutral-500 hover:bg-neutral-100"
        >
          {visible ? <EyeOff className="h-4 w-4" aria-hidden="true" /> : <Eye className="h-4 w-4" aria-hidden="true" />}
        </button>
      </div>
      {error && <p className="text-xs text-danger-600">{error}</p>}
      {!error && helper && <p className="text-xs text-neutral-500">{helper}</p>}
    </div>
  )
}