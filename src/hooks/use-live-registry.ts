import { useCallback, useEffect, useRef, useState } from 'react'
import { parseProjectRegistry, type ProjectRegistry } from '../contract/project-state.js'

export type RefreshState = 'IDLE' | 'REFRESHING' | 'ERROR'

export async function fetchLiveRegistry(
  fetcher: typeof fetch = fetch,
  signal?: AbortSignal,
): Promise<ProjectRegistry> {
  const response = await fetcher(`/project-state.json?t=${Date.now()}`, { cache: 'no-store', signal })
  if (!response.ok) throw new Error(`HTTP ${response.status}`)
  return parseProjectRegistry(await response.json())
}

export function useLiveRegistry(initialRegistry: ProjectRegistry, refreshMs = 60_000) {
  const [registry, setRegistry] = useState(initialRegistry)
  const [refreshState, setRefreshState] = useState<RefreshState>('IDLE')
  const [error, setError] = useState<string | null>(null)
  const [lastSuccessAt, setLastSuccessAt] = useState<Date | null>(null)
  const inFlight = useRef<AbortController | null>(null)

  const refresh = useCallback(async () => {
    inFlight.current?.abort()
    const controller = new AbortController()
    inFlight.current = controller
    setRefreshState('REFRESHING')
    try {
      setRegistry(await fetchLiveRegistry(fetch, controller.signal))
      setLastSuccessAt(new Date())
      setError(null)
      setRefreshState('IDLE')
    } catch (cause) {
      if (controller.signal.aborted) return
      setError(cause instanceof Error ? cause.message : 'Неизвестная ошибка')
      setRefreshState('ERROR')
    }
  }, [])

  useEffect(() => {
    void refresh()
    const interval = window.setInterval(() => void refresh(), refreshMs)
    return () => { window.clearInterval(interval); inFlight.current?.abort() }
  }, [refresh, refreshMs])

  return { registry, refresh, refreshState, error, lastSuccessAt }
}
