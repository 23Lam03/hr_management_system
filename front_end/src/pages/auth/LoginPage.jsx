import { useState } from 'react'
import { Link, Navigate, useLocation, useNavigate } from 'react-router-dom'
import {
  LogIn,
  Mail,
  Lock,
  Eye,
  EyeOff,
  ShieldAlert,
  User,
} from 'lucide-react'

import Button from '../../components/common/Button'
import Input from '../../components/common/Input'
import { useAuth } from '../../contexts/useAuth'
import { ROLES } from '../../contexts/roles'
import { getDemoAccounts } from '../../services/authService'
import { homeForRole } from '../../routes/routeGuards'
import { useI18n } from '../../i18n/useI18n'

const DEMO_ACCOUNTS = getDemoAccounts()

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

/**
 * LoginPage - responsive, Tailwind v4.
 * - Validation client-side (email format, password bắt buộc).
 * - Show/hide password.
 * - Demo accounts quick-fill (CHỈ điền form, KHÔNG tự login).
 * - Logic auth nằm trong authService + AuthContext.
 */
export default function LoginPage() {
  const { t } = useI18n()
  const navigate = useNavigate()
  const location = useLocation()
  const { login, isAuthenticated, initializing, role } = useAuth()

  const ROLE_LABEL = {
    [ROLES.ADMIN]: t('roles.admin'),
    [ROLES.EMPLOYEE]: t('roles.employee'),
  }

  const [form, setForm] = useState({ email: '', password: '' })
  const [errors, setErrors] = useState({})
  const [submitError, setSubmitError] = useState('')
  const [loading, setLoading] = useState(false)
  const [showPassword, setShowPassword] = useState(false)

  // Nếu đã đăng nhập mà vào /login -> đẩy về home theo role
  if (!initializing && isAuthenticated) {
    const target = homeForRole(role) || '/login'
    return <Navigate to={target} replace />
  }

  const handleChange = (field) => (event) => {
    const value = event.target.value
    setForm((prev) => ({ ...prev, [field]: value }))
    setErrors((prev) => ({ ...prev, [field]: undefined }))
    if (submitError) setSubmitError('')
  }

  const validate = () => {
    const next = {}
    if (!form.email.trim()) {
      next.email = t('validation.emailRequired')
    } else if (!EMAIL_PATTERN.test(form.email.trim())) {
      next.email = t('validation.emailInvalid')
    }
    if (!form.password) {
      next.password = t('validation.passwordRequired')
    } else if (form.password.length < 6) {
      next.password = t('validation.passwordMin')
    }
    return next
  }

  const handleSubmit = async (event) => {
    event.preventDefault()
    const next = validate()
    if (Object.keys(next).length > 0) {
      setErrors(next)
      return
    }

    setLoading(true)
    setSubmitError('')
    try {
      const loggedIn = await login(form.email.trim(), form.password)
      // Sau khi đăng nhập: ưu tiên home theo role. KHÔNG trust `state.from`
      // vì user chưa xác thực có thể nhập URL không thuộc khu vực của họ.
      // State đã được cập nhật trong `login`; để LoginPage tự redirect
      // qua nhánh `isAuthenticated` ở trên - tránh race với ProtectedRoute.
      // KHÔNG gọi navigate() thủ công ở đây.
      void loggedIn
    } catch (err) {
      setSubmitError(err?.message || t('auth.login.genericError'))
    } finally {
      setLoading(false)
    }
  }

  const fillDemo = (account) => {
    setForm({ email: account.email, password: account.password })
    setErrors({})
    setSubmitError('')
  }

  return (
    <div className="flex flex-col gap-6">
      <header className="flex flex-col items-center gap-2 text-center">
        <span className="inline-flex h-11 w-11 items-center justify-center rounded-md bg-brand-600 text-white text-sm font-bold tracking-wide">
          {t('common.appName')}
        </span>
        <h1 className="mt-2 text-[22px] font-semibold text-neutral-900">{t('auth.login.title')}</h1>
        <p className="text-[13px] text-neutral-500">
          {t('auth.login.subtitle')}
        </p>
      </header>

      <form className="flex flex-col gap-4" onSubmit={handleSubmit} noValidate>
        <Input
          label={t('auth.login.emailLabel')}
          name="email"
          type="email"
          autoComplete="email"
          required
          value={form.email}
          onChange={handleChange('email')}
          placeholder={t('auth.login.emailPlaceholder')}
          leftIcon={Mail}
          error={errors.email}
          disabled={loading}
        />

        <div className="flex flex-col gap-1.5 w-full">
          <label
            htmlFor="login-password"
            className="text-[13px] font-medium text-neutral-900"
          >
            {t('auth.login.passwordLabel')}
            <span className="text-danger-500 ml-0.5">*</span>
          </label>
          <div className="relative flex items-center">
            <Lock
              className="pointer-events-none absolute left-3 h-4 w-4 text-neutral-400"
              aria-hidden="true"
            />
            <input
              id="login-password"
              name="password"
              type={showPassword ? 'text' : 'password'}
              autoComplete="current-password"
              value={form.password}
              onChange={handleChange('password')}
              placeholder={t('auth.login.passwordPlaceholder')}
              disabled={loading}
              aria-invalid={Boolean(errors.password)}
              className={
                'h-10 w-full rounded-md border bg-white pl-9 pr-10 text-sm text-neutral-700 placeholder:text-neutral-400 transition ' +
                'focus:outline-none focus:ring-2 focus:ring-offset-0 ' +
                (errors.password
                  ? 'border-danger-500 focus:ring-danger-500/20'
                  : 'border-neutral-200 hover:border-neutral-300 focus:border-brand-600 focus:ring-brand-600/20') +
                (loading ? ' bg-neutral-50 cursor-not-allowed' : '')
              }
            />
            <button
              type="button"
              onClick={() => setShowPassword((p) => !p)}
              aria-label={showPassword ? t('common.hidePassword') : t('common.showPassword')}
              aria-pressed={showPassword}
              className="absolute right-2 inline-flex h-7 w-7 items-center justify-center rounded-md text-neutral-400 hover:bg-neutral-100 hover:text-neutral-700"
            >
              {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
            </button>
          </div>
          {errors.password && (
            <p className="text-xs text-danger-600">{errors.password}</p>
          )}
        </div>

        {submitError && (
          <div
            role="alert"
            className="flex items-start gap-2 rounded-md border border-danger-500/40 bg-danger-50 px-3 py-2 text-sm text-danger-600"
          >
            <ShieldAlert className="mt-0.5 h-4 w-4 flex-shrink-0" aria-hidden="true" />
            <span>{submitError}</span>
          </div>
        )}

        <Button
          type="submit"
          variant="primary"
          size="lg"
          fullWidth
          icon={LogIn}
          iconPosition="right"
          loading={loading}
        >
          {loading ? t('auth.login.submitting') : t('auth.login.submit')}
        </Button>

        <Link
          to="/auth/forgot-password"
          className="self-center text-sm font-medium text-brand-600 hover:underline"
        >
          {t('auth.login.forgotPassword')}
        </Link>

        <p className="text-center text-sm text-neutral-600">
          {t('auth.login.noAccountPrompt')}{' '}
          <Link to="/register" className="font-medium text-brand-600 hover:underline">
            {t('auth.login.registerLink')}
          </Link>
        </p>
      </form>

      {/* Khu vực tài khoản demo (chỉ điền nhanh, KHÔNG tự đăng nhập) */}
      {DEMO_ACCOUNTS.length > 0 && (
      <section
        aria-label={t('auth.login.demoAccountsTitle')}
        className="rounded-lg border border-dashed border-neutral-300 bg-neutral-50 p-4"
      >
        <header className="mb-3 flex items-center gap-2">
          <span className="inline-flex h-7 w-7 items-center justify-center rounded-md bg-brand-50 text-brand-600">
            <User className="h-3.5 w-3.5" />
          </span>
          <div>
            <p className="text-sm font-semibold text-neutral-900">{t('auth.login.demoAccountsTitle')}</p>
            <p className="text-xs text-neutral-500">
              {t('auth.login.demoAccountsHint')}
            </p>
          </div>
        </header>
        <ul className="grid grid-cols-1 gap-2 sm:grid-cols-2">
          {DEMO_ACCOUNTS.map((acc) => (
            <li key={acc.email}>
              <button
                type="button"
                onClick={() => fillDemo(acc)}
                className="group flex w-full items-start gap-3 rounded-md border border-neutral-200 bg-white p-3 text-left transition hover:border-brand-300 hover:bg-brand-50/40"
              >
                <span className="inline-flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-md bg-brand-50 text-brand-600 text-xs font-semibold">
                  {ROLE_LABEL[acc.role]?.charAt(0) ?? '?'}
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-sm font-medium text-neutral-900">
                    {ROLE_LABEL[acc.role] ?? acc.role}
                  </span>
                  <span className="block truncate text-xs text-neutral-500">
                    {acc.email}
                  </span>
                </span>
              </button>
            </li>
          ))}
        </ul>
        <p className="mt-3 text-xs text-neutral-500">
          {t('auth.login.demoNotice')}
        </p>
      </section>
      )}
    </div>
  )
}