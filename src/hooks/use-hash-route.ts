import { useCallback, useEffect, useState } from 'react'
import { parseHashRoute, type DashboardRoute } from '../routing/hash-route.js'

export interface HashRoute {
  /** Route parsed from the current location hash. */
  route: DashboardRoute
  /** Navigates to a route hash, adding a browser history entry. */
  navigate: (hash: string) => void
}

/**
 * Minimal dependency-free hash routing hook.
 *
 * The route is read from `location.hash` on mount, so a deep link survives a
 * direct navigation or a refresh, and `hashchange` / `popstate` keep the route in
 * sync with the browser Back and Forward buttons. `navigate` also updates React
 * state immediately so a click is reflected in the same render instead of
 * waiting for the asynchronous hash event.
 */
export function useHashRoute(): HashRoute {
  const [route, setRoute] = useState<DashboardRoute>(() =>
    parseHashRoute(typeof window === 'undefined' ? '' : window.location.hash),
  )

  useEffect(() => {
    if (typeof window === 'undefined') return
    const onChange = () => {
      setRoute((prev) => parseHashRoute(window.location.hash, prev.view))
    }
    window.addEventListener('hashchange', onChange)
    window.addEventListener('popstate', onChange)
    return () => {
      window.removeEventListener('hashchange', onChange)
      window.removeEventListener('popstate', onChange)
    }
  }, [])

  const navigate = useCallback((next: string) => {
    setRoute((prev) => parseHashRoute(next, prev.view))
    if (typeof window !== 'undefined' && window.location.hash !== next) {
      window.location.hash = next
    }
  }, [])

  return { route, navigate }
}
