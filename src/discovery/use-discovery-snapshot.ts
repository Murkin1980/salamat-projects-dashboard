import { useCallback, useEffect, useRef, useState } from 'react'
import {
  parseDiscoverySnapshot,
  unavailableDiscoverySnapshot,
  type DiscoverySnapshot,
} from './discovery-analytics.js'

export type DiscoveryRefreshState = 'IDLE' | 'REFRESHING' | 'ERROR'

export async function fetchDiscoverySnapshot(
  fetcher: typeof fetch = fetch,
  signal?: AbortSignal,
): Promise<DiscoverySnapshot> {
  const response = await fetcher('/discovery-state.json?t=' + Date.now(), {
    cache: 'no-store',
    signal,
  })
  if (!response.ok) throw new Error('HTTP ' + response.status)
  return parseDiscoverySnapshot(await response.json())
}

export function useDiscoverySnapshot(refreshMs = 5 * 60_000) {
  const [snapshot, setSnapshot] = useState<DiscoverySnapshot>(() =>
    unavailableDiscoverySnapshot('Discovery snapshot загружается…'),
  )
  const [refreshState, setRefreshState] = useState<DiscoveryRefreshState>('IDLE')
  const [error, setError] = useState<string | null>(null)
  const inFlight = useRef<AbortController | null>(null)

  const refresh = useCallback(async () => {
    inFlight.current?.abort()
    const controller = new AbortController()
    inFlight.current = controller
    setRefreshState('REFRESHING')
    try {
      setSnapshot(await fetchDiscoverySnapshot(fetch, controller.signal))
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
    return () => {
      window.clearInterval(interval)
      inFlight.current?.abort()
    }
  }, [refresh, refreshMs])

  return { snapshot, refresh, refreshState, error }
}
