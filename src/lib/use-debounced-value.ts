import { useState, useEffect } from "react"

/**
 * Returns a debounced copy of `value` that only updates after `delayMs`
 * milliseconds have elapsed without a new value arriving. Useful for
 * suppressing rapid-fire query triggers while the user is typing.
 */
export function useDebouncedValue<T>(value: T, delayMs = 300): T {
  const [debounced, setDebounced] = useState(value)

  useEffect(() => {
    const id = setTimeout(() => setDebounced(value), delayMs)
    return () => clearTimeout(id)
  }, [value, delayMs])

  return debounced
}
