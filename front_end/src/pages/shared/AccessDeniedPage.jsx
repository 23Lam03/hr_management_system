import { Link, useLocation, useNavigate } from 'react-router-dom'
import { ShieldX, ArrowLeft, Home } from 'lucide-react'

import Button from '../../components/common/Button'
import { useAuth } from '../../contexts/useAuth'
import { ROLES } from '../../contexts/roles'
import { homeForRole } from '../../routes/routeGuards'
import { useI18n } from '../../i18n/useI18n'

export default function AccessDeniedPage() {
  const { t } = useI18n()
  const navigate = useNavigate()
  const { role } = useAuth()
  const location = useLocation()
  const attempted = location.state?.from || location.pathname
  const home = homeForRole(role)
  const expectedRole = role === ROLES.ADMIN ? t('roles.adminArea') : t('roles.employeeArea')

  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-4 bg-neutral-50 p-6 text-center">
      <span className="inline-flex h-16 w-16 items-center justify-center rounded-full bg-danger-50 text-danger-600">
        <ShieldX className="h-8 w-8" aria-hidden="true" />
      </span>
      <span className="text-xs font-semibold uppercase tracking-widest text-danger-600">
        {t('shared.accessDenied.title403')}
      </span>
      <h1 className="text-[22px] font-semibold text-neutral-900">
        {t('shared.accessDenied.headline')}
      </h1>
      <p className="max-w-md text-sm text-neutral-500">
        {t('shared.accessDenied.description', { path: attempted, expected: expectedRole })}
      </p>
      <div className="mt-2 flex flex-wrap justify-center gap-2">
        {home && home !== '/login' && (
          <Button variant="primary" icon={Home} onClick={() => navigate(home, { replace: true })}>
            {t('shared.accessDenied.backTo', { place: expectedRole })}
          </Button>
        )}
        <Button variant="secondary" icon={ArrowLeft} onClick={() => window.history.back()}>
          {t('shared.accessDenied.goBack')}
        </Button>
        <Link
          to="/login"
          className="inline-flex h-10 items-center justify-center rounded-md px-4 text-sm font-medium text-brand-600 hover:underline"
        >
          {t('shared.accessDenied.loginDifferent')}
        </Link>
      </div>
    </div>
  )
}