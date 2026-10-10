import { Link } from 'react-router-dom'

import Button from '../../components/common/Button'
import Input from '../../components/common/Input'
import { useI18n } from '../../i18n/useI18n'

export default function ForgotPasswordPage() {
  const { t } = useI18n()

  return (
    <div className="flex flex-col gap-5">
      <header className="text-center">
        <h1 className="text-[22px] font-semibold text-neutral-900">{t('auth.forgot.title')}</h1>
        <p className="mt-2 text-[13px] text-neutral-500">
          {t('auth.forgot.subtitle')}
        </p>
      </header>

      <form className="flex flex-col gap-4" onSubmit={(e) => e.preventDefault()}>
        <Input
          label={t('auth.forgot.emailLabel')}
          type="email"
          name="email"
          placeholder={t('auth.forgot.emailPlaceholder')}
          required
        />
        <Button type="submit" variant="primary" size="lg" fullWidth>
          {t('auth.forgot.submit')}
        </Button>
      </form>

      <Link
        to="/auth/login"
        className="self-center text-sm font-medium text-brand-600 hover:underline"
      >
        ← {t('auth.forgot.backToLogin')}
      </Link>
    </div>
  )
}