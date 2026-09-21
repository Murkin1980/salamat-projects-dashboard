import { useCallback, useEffect, useRef, useState } from 'react'
import {
  parseDiscoverySnapshot,
  type DiscoverySnapshot,
} from '../discovery/discovery-analytics.js'

export type DiscoveryRefreshState = 'IDLE' | 'REFRESHING' | 'ERROR'

export async function fetchDiscoverySnapshot(
  fetcher: typeof fetch = fetch,
  signal?: AbortSignal,
): Promise<DiscoverySnapshot> {
  const response = await fetcher(`/discovery-analytics.json?t=${Date.now()}`, {
    cache: 'no-store',
    signal,
  })
  if (!response.ok) throw new Error(`HTTP ${response.status}`)
  return parseDiscoverySnapshot(await response.json())
}

export function useDiscoverySnapshot(
  initialSnapshot: DiscoverySnapshot,
  refreshMs = 300_000,
) {
  const [snapshot, setSnapshot] = useState(initialSnapshot)
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

  return { snapshot, refreshState, error }
}
