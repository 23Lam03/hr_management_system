import { createContext } from 'react'

/**
 * I18nContext - exposes locale state and translation helpers.
 *   locale: 'vi' | 'en'
 *   setLocale(locale): switch and persist
 *   t('common.hello'): resolve key from current locale; falls back to EN, then key
 *   t('common.greeting', { name: 'An' }) -> 'Xin chào An'
 */
export const I18nContext = createContext(null)