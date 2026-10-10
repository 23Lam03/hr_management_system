import { Globe } from 'lucide-react'

import { useI18n } from '../../i18n/useI18n'

const LABEL = {
  vi: 'VI',
  en: 'EN',
}

const FULL = {
  vi: 'Tiếng Việt',
  en: 'English',
}

/**
 * LanguageSwitcher - toggles between supported locales.
 * Persists choice in localStorage and updates <html lang="...">.
 */
export default function LanguageSwitcher() {
  const { locale, setLocale } = useI18n()
  return (
    <button
      type="button"
      onClick={() => setLocale(locale === 'vi' ? 'en' : 'vi')}
      className="inline-flex items-center gap-1.5 rounded-md border border-neutral-200 px-2.5 py-1 text-xs font-medium text-neutral-700 transition hover:border-brand-300 hover:bg-brand-50 hover:text-brand-700"
      title={FULL[locale]}
    >
      <Globe className="h-3.5 w-3.5" aria-hidden="true" />
      <span aria-label={`Language: ${FULL[locale]}`}>{LABEL[locale]}</span>
    </button>
  )
}