import { useEffect, useState } from 'react'

/**
 * Minimal dependency-free `window.matchMedia` subscription hook.
 *
 * It exists to make the Nodes view's responsive rendering decision explicit:
 * at `(max-width: 760px)` the view mounts a dedicated mobile list branch,
 * above it the desktop React Flow canvas. The branch is chosen in JavaScript,
 * so the React Flow canvas is never even mounted on phones — the mobile
 * presentation does not depend on the canvas being hidden via CSS.
 *
 * Environments without `matchMedia` (SSR, bare Node tests without a stub)
 * resolve to `false`, keeping the canonical desktop branch as the default.
 */
export function useMediaQuery(query: string): boolean {
  const [matches, setMatches] = useState(() => (
    typeof window !== 'undefined' && typeof window.matchMedia === 'function'
      ? window.matchMedia(query).matches
      : false
  ))

  useEffect(() => {
    if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') return
    const mediaQueryList = window.matchMedia(query)
    const handleChange = (event: MediaQueryListEvent) => setMatches(event.matches)
    // Re-sync in case the query list changed between render and effect.
    setMatches(mediaQueryList.matches)
    mediaQueryList.addEventListener('change', handleChange)
    return () => mediaQueryList.removeEventListener('change', handleChange)
  }, [query])

  return matches
}
