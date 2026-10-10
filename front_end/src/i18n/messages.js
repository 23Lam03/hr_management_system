import vi from './vi'
import en from './en'

export const SUPPORTED_LOCALES = ['vi', 'en']
export const DEFAULT_LOCALE = 'vi'

/**
 * Flatten an object with nested namespaces into dot-paths.
 *   { common: { hello: 'Xin chào' } } -> { 'common.hello': 'Xin chào' }
 */
function flatten(obj, prefix = '') {
  const out = {}
  for (const [k, v] of Object.entries(obj)) {
    const path = prefix ? `${prefix}.${k}` : k
    if (v && typeof v === 'object' && !Array.isArray(v)) {
      Object.assign(out, flatten(v, path))
    } else {
      out[path] = v
    }
  }
  return out
}

export const messages = Object.freeze({
  vi: flatten(vi),
  en: flatten(en),
})

export function getMessages(locale) {
  return messages[locale] ?? messages[DEFAULT_LOCALE]
}