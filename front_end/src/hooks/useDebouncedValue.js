import { useEffect, useRef, useState } from 'react'

/**
 * useDebouncedValue - returns `value` only after it has been stable for `delay` ms.
 */
export default function useDebouncedValue(value, delay = 300) {
  const [debounced, setDebounced] = useState(value)
  const timerRef = useRef(null)

  useEffect(() => {
    if (timerRef.current) window.clearTimeout(timerRef.current)
    timerRef.current = window.setTimeout(() => setDebounced(value), delay)
    return () => {
      if (timerRef.current) window.clearTimeout(timerRef.current)
    }
  }, [value, delay])

  return debounced
}