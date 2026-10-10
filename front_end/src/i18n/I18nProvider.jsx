import { useCallback, useEffect, useMemo, useState } from 'react'

import { I18nContext } from './i18nContext'
import { DEFAULT_LOCALE, SUPPORTED_LOCALES, getMessages } from './messages'

const STORAGE_KEY = 'hrm.locale.v1'

function readPersistedLocale() {
  if (typeof window === 'undefined') return null
  try {
    const v = window.localStorage.getItem(STORAGE_KEY)
    if (v && SUPPORTED_LOCALES.includes(v)) return v
  } catch {
    /* ignore */
  }
  return null
}

function persistLocale(locale) {
  if (typeof window === 'undefined') return
  try {
    window.localStorage.setItem(STORAGE_KEY, locale)
  } catch {
    /* ignore */
  }
}

export function I18nProvider({ children }) {
  const [locale, setLocaleState] = useState(() => readPersistedLocale() ?? DEFAULT_LOCALE)

  // Keep <html lang="..."> in sync.
  useEffect(() => {
    if (typeof document !== 'undefined') {
      document.documentElement.lang = locale
    }
  }, [locale])

  const setLocale = useCallback((next) => {
    if (!SUPPORTED_LOCALES.includes(next)) return
    setLocaleState(next)
    persistLocale(next)
  }, [])

  const messages = useMemo(() => getMessages(locale), [locale])
  const fallback = useMemo(() => getMessages(DEFAULT_LOCALE), [])

  /**
   * t(key, vars?) - translate. Falls back to EN, then to key when missing.
   * Vars replace {placeholder} tokens.
   */
  const t = useCallback(
    (key, vars) => {
      const raw = messages[key] ?? fallback[key] ?? key
      if (!vars || typeof vars !== 'object') return raw
      return String(raw).replace(/\{(\w+)\}/g, (_, name) =>
        name in vars ? String(vars[name]) : `{${name}}`,
      )
    },
    [messages, fallback],
  )

  const value = useMemo(
    () => ({
      locale,
      setLocale,
      t,
      supported: SUPPORTED_LOCALES,
    }),
    [locale, setLocale, t],
  )

  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>
}