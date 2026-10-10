import { useState } from 'react'
import { Link, Navigate, useLocation, useNavigate } from 'react-router-dom'
import {
  Eye,
  EyeOff,
  Lock,
  Mail,
  Phone,
  ShieldAlert,
  UserPlus,
  User as UserIcon,
} from 'lucide-react'

import Button from '../../components/common/Button'
import Input from '../../components/common/Input'
import { useAuth } from '../../contexts/useAuth'
import { ERROR_CODES, registerEmployee } from '../../services/authService'
import { getSystemConfig } from '../../services/systemConfigService'
import { useI18n } from '../../i18n/useI18n'

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
const PHONE_PATTERN = /^[0-9+\-\s()]{6,20}$/

/**
 * RegisterPage - đăng ký tài khoản Employee (mock).
 *
 * - Dùng cùng authentication architecture với LoginPage: gọi authService.
 * - Tự gán role = 'employee' trong service, không cho client chọn role.
 * - Tôn trọng systemConfig.system.allowEmployeeRegistration.
 * - Không tự động login. Sau khi đăng ký thành công → chuyển về /login.
 */
export default function RegisterPage() {
  const navigate = useNavigate()
  const location = useLocation()
  const { isAuthenticated, initializing, role } = useAuth()
  const { t } = useI18n()

  const config = getSystemConfig()
  const allowRegistration = config?.system?.allowEmployeeRegistration !== false

  const [form, setForm] = useState({
    name: '',
    email: '',
    phone: '',
    password: '',
    confirmPassword: '',
  })
  const [errors, setErrors] = useState({})
  const [submitError, setSubmitError] = useState('')
  const [loading, setLoading] = useState(false)
  const [success, setSuccess] = useState(false)
  const [showPassword, setShowPassword] = useState(false)

  // Nếu đã đăng nhập, đẩy thẳng về home của role
  if (!initializing && isAuthenticated) {
    const target = location.state?.from || (role === 'admin' ? '/admin' : '/employee')
    return <Navigate to={target} replace />
  }

  if (!allowRegistration) {
    return (
      <div className="flex flex-col gap-6">
        <header className="flex flex-col items-center gap-2 text-center">
          <span className="inline-flex h-11 w-11 items-center justify-center rounded-md bg-brand-600 text-white text-sm font-bold tracking-wide">
            HRM
          </span>
          <h1 className="mt-2 text-[22px] font-semibold text-neutral-900">{t('auth.register.title')}</h1>
        </header>
        <div
          role="alert"
          className="flex items-start gap-2 rounded-md border border-warning-500/40 bg-warning-50 px-3 py-2 text-sm text-warning-700"
        >
          <ShieldAlert className="mt-0.5 h-4 w-4 flex-shrink-0" aria-hidden="true" />
          <span>{t('auth.register.registrationUnavailable')}</span>
        </div>
        <p className="text-center text-sm text-neutral-600">
          {t('auth.register.alreadyHaveAccount')}{' '}
          <Link to="/login" className="font-medium text-brand-600 hover:underline">
            {t('auth.register.loginLink')}
          </Link>
        </p>
      </div>
    )
  }

  const handleChange = (field) => (event) => {
    const value = event.target.value
    setForm((prev) => ({ ...prev, [field]: value }))
    setErrors((prev) => ({ ...prev, [field]: undefined }))
    if (submitError) setSubmitError('')
  }

  const validate = () => {
    const next = {}
    if (!form.name.trim()) {
      next.name = t('validation.fieldRequired')
    }
    if (!form.email.trim()) {
      next.email = t('validation.emailRequired')
    } else if (!EMAIL_PATTERN.test(form.email.trim())) {
      next.email = t('validation.emailInvalid')
    }
    if (form.phone && !PHONE_PATTERN.test(form.phone.trim())) {
      next.phone = t('validation.invalidFormat')
    }
    if (!form.password) {
      next.password = t('validation.passwordRequired')
    } else if (form.password.length < 6) {
      next.password = t('validation.passwordMin')
    }
    if (!form.confirmPassword) {
      next.confirmPassword = t('validation.fieldRequired')
    } else if (form.confirmPassword !== form.password) {
      next.confirmPassword = t('validation.passwordMismatch')
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
      await registerEmployee({
        name: form.name.trim(),
        email: form.email.trim(),
        phone: form.phone.trim(),
        password: form.password,
        confirmPassword: form.confirmPassword,
      })
      setSuccess(true)
    } catch (err) {
      if (err?.code === ERROR_CODES.EMAIL_ALREADY_EXISTS) {
        setErrors({ email: t('auth.register.emailExists') })
      } else if (err?.code === ERROR_CODES.PASSWORD_MISMATCH) {
        setErrors({ confirmPassword: err.message })
      } else if (err?.code === ERROR_CODES.PASSWORD_TOO_SHORT) {
        setErrors({ password: err.message })
      } else {
        setSubmitError(err?.message || t('auth.register.unableToCreateAccount'))
      }
    } finally {
      setLoading(false)
    }
  }

  if (success) {
    return (
      <div className="flex flex-col gap-6">
        <header className="flex flex-col items-center gap-2 text-center">
          <span className="inline-flex h-11 w-11 items-center justify-center rounded-md bg-success-600 text-white">
            <UserIcon className="h-5 w-5" />
          </span>
          <h1 className="mt-2 text-[22px] font-semibold text-neutral-900">{t('auth.register.success')}</h1>
          <p className="text-[13px] text-neutral-500">
            {t('auth.register.successSubtitle')}
          </p>
        </header>
        <Button variant="primary" size="lg" fullWidth onClick={() => navigate('/login', { replace: true })}>
          {t('auth.register.successButton')}
        </Button>
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-6">
      <header className="flex flex-col items-center gap-2 text-center">
        <span className="inline-flex h-11 w-11 items-center justify-center rounded-md bg-brand-600 text-white text-sm font-bold tracking-wide">
          HRM
        </span>
        <h1 className="mt-2 text-[22px] font-semibold text-neutral-900">{t('auth.register.title')}</h1>
        <p className="text-[13px] text-neutral-500">
          {t('auth.register.subtitle')}
        </p>
      </header>

      <form className="flex flex-col gap-4" onSubmit={handleSubmit} noValidate>
        <Input
          label={t('auth.register.fullNameLabel')}
          name="name"
          autoComplete="name"
          required
          value={form.name}
          onChange={handleChange('name')}
          placeholder={t('auth.register.fullNamePlaceholder')}
          leftIcon={UserIcon}
          error={errors.name}
          disabled={loading}
        />

        <Input
          label={t('auth.register.emailLabel')}
          name="email"
          type="email"
          autoComplete="email"
          required
          value={form.email}
          onChange={handleChange('email')}
          placeholder={t('auth.register.emailPlaceholder')}
          leftIcon={Mail}
          error={errors.email}
          disabled={loading}
        />

        <Input
          label={t('auth.register.phoneLabel')}
          name="phone"
          autoComplete="tel"
          value={form.phone}
          onChange={handleChange('phone')}
          placeholder={t('auth.register.phonePlaceholder')}
          leftIcon={Phone}
          error={errors.phone}
          disabled={loading}
        />

        <div className="flex flex-col gap-1.5 w-full">
          <label
            htmlFor="register-password"
            className="text-[13px] font-medium text-neutral-900"
          >
            {t('auth.register.passwordLabel')}<span className="text-danger-500 ml-0.5">*</span>
          </label>
          <div className="relative flex items-center">
            <Lock
              className="pointer-events-none absolute left-3 h-4 w-4 text-neutral-400"
              aria-hidden="true"
            />
            <input
              id="register-password"
              name="password"
              type={showPassword ? 'text' : 'password'}
              autoComplete="new-password"
              value={form.password}
              onChange={handleChange('password')}
              placeholder={t('auth.register.passwordPlaceholder')}
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

        <div className="flex flex-col gap-1.5 w-full">
          <label
            htmlFor="register-confirm-password"
            className="text-[13px] font-medium text-neutral-900"
          >
            {t('auth.register.confirmPasswordLabel')}<span className="text-danger-500 ml-0.5">*</span>
          </label>
          <div className="relative flex items-center">
            <Lock
              className="pointer-events-none absolute left-3 h-4 w-4 text-neutral-400"
              aria-hidden="true"
            />
            <input
              id="register-confirm-password"
              name="confirmPassword"
              autoComplete="new-password"
              type={showPassword ? 'text' : 'password'}
              value={form.confirmPassword}
              onChange={handleChange('confirmPassword')}
              placeholder={t('auth.register.confirmPasswordPlaceholder')}
              disabled={loading}
              aria-invalid={Boolean(errors.confirmPassword)}
              className={
                'h-10 w-full rounded-md border bg-white pl-9 pr-3 text-sm text-neutral-700 placeholder:text-neutral-400 transition ' +
                'focus:outline-none focus:ring-2 focus:ring-offset-0 ' +
                (errors.confirmPassword
                  ? 'border-danger-500 focus:ring-danger-500/20'
                  : 'border-neutral-200 hover:border-neutral-300 focus:border-brand-600 focus:ring-brand-600/20') +
                (loading ? ' bg-neutral-50 cursor-not-allowed' : '')
              }
            />
          </div>
          {errors.confirmPassword && (
            <p className="text-xs text-danger-600">{errors.confirmPassword}</p>
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
          icon={UserPlus}
          iconPosition="right"
          loading={loading}
        >
          {loading ? t('auth.register.submitting') : t('auth.register.submit')}
        </Button>

        <p className="text-center text-sm text-neutral-600">
          {t('auth.register.haveAccountPrompt')}{' '}
          <Link to="/login" className="font-medium text-brand-600 hover:underline">
            {t('auth.register.loginLink')}
          </Link>
        </p>
      </form>
    </div>
  )
}