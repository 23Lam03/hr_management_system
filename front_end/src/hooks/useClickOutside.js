import { useEffect, useRef } from 'react'

/**
 * useClickOutside - invokes `handler` when a mousedown / touchstart happens
 * outside the referenced element.
 */
export function useClickOutside(handler, active = true) {
  const ref = useRef(null)

  useEffect(() => {
    if (!active) return undefined
    const listener = (event) => {
      const el = ref.current
      if (!el || el.contains(event.target)) return
      handler(event)
    }
    document.addEventListener('mousedown', listener)
    document.addEventListener('touchstart', listener)
    return () => {
      document.removeEventListener('mousedown', listener)
      document.removeEventListener('touchstart', listener)
    }
  }, [handler, active])

  return ref
}