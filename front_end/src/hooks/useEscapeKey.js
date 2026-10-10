import { useEffect } from 'react'

/**
 * useEscapeKey - invokes `handler` when Escape is pressed.
 */
export function useEscapeKey(handler, active = true) {
  useEffect(() => {
    if (!active) return undefined
    const listener = (event) => {
      if (event.key === 'Escape') handler(event)
    }
    document.addEventListener('keydown', listener)
    return () => document.removeEventListener('keydown', listener)
  }, [handler, active])
}