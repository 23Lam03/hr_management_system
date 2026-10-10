import { useNavigate } from 'react-router-dom'
import { Home, ArrowLeft } from 'lucide-react'

import Button from '../../components/common/Button'
import { useI18n } from '../../i18n/useI18n'

export default function NotFoundPage() {
  const { t } = useI18n()
  const navigate = useNavigate()

  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-3 bg-neutral-50 p-6 text-center">
      <span className="text-[72px] font-bold leading-none text-brand-200">404</span>
      <h1 className="text-[22px] font-semibold text-neutral-900">{t('shared.notFound.headline')}</h1>
      <p className="max-w-md text-sm text-neutral-500">
        {t('shared.notFound.description')}
      </p>
      <div className="mt-3 flex flex-wrap justify-center gap-3">
        <Button
          variant="primary"
          icon={Home}
          onClick={() => navigate('/admin', { replace: true })}
        >
          {t('shared.notFound.backToAdmin')}
        </Button>
        <Button
          variant="secondary"
          icon={ArrowLeft}
          onClick={() => window.history.back()}
        >
          {t('shared.notFound.goBack')}
        </Button>
      </div>
    </div>
  )
}