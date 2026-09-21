import { writeFile } from 'node:fs/promises'
import { fileURLToPath } from 'node:url'
import path from 'node:path'
import {
  CRAWLER_DEFINITIONS,
  buildDiscoverySnapshot,
  unavailableDiscoverySnapshot,
  type CloudflareAnalyticsRow,
  type DiscoverySnapshot,
} from '../src/discovery/discovery-analytics.js'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const repoRoot = path.resolve(__dirname, '..')
const outputPath = path.join(repoRoot, 'public', 'discovery-analytics.json')
const apiBase = 'https://api.cloudflare.com/client/v4'
const graphqlUrl = `${apiBase}/graphql`

const zoneName = process.env.CLOUDFLARE_ZONE_NAME ?? 'salamat-mebel.kz'
const hostname = process.env.DISCOVERY_HOSTNAME ?? 'house.salamat-mebel.kz'
const requestedWindowHours = Math.min(
  168,
  Math.max(1, Number(process.env.DISCOVERY_WINDOW_HOURS ?? '168') || 168),
)

interface ZoneListResponse {
  success: boolean
  errors?: Array<{ message?: string }>
  result?: Array<{ id: string; name: string }>
}

interface GraphqlResponse {
  data?: {
    viewer?: {
      zones?: Array<{
        groups?: CloudflareAnalyticsRow[]
      }>
    }
  }
  errors?: Array<{ message?: string }>
}

function headers(token: string) {
  return {
    Authorization: `Bearer ${token}`,
    'Content-Type': 'application/json',
  }
}

async function resolveZoneId(token: string): Promise<string> {
  const response = await fetch(`${apiBase}/zones?name=${encodeURIComponent(zoneName)}`, {
    headers: headers(token),
  })
  if (!response.ok) throw new Error(`zone lookup HTTP ${response.status}`)
  const payload = await response.json() as ZoneListResponse
  const zoneId = payload.result?.[0]?.id
  if (!payload.success || !zoneId) {
    throw new Error(payload.errors?.[0]?.message ?? `zone ${zoneName} not found`)
  }
  return zoneId
}

function graphqlQuery(): string {
  const filters = CRAWLER_DEFINITIONS
    .map((crawler) => `{ userAgent_like: "%${crawler.userAgent.replaceAll('"', '\\"')}%" }`)
    .join('\n')

  return `
    query DiscoveryAnalytics($zoneTag: string!, $start: Time!, $end: Time!, $host: string!) {
      viewer {
        zones(filter: { zoneTag: $zoneTag }) {
          groups: httpRequestsAdaptiveGroups(
            limit: 10000
            orderBy: [count_DESC]
            filter: {
              datetime_geq: $start
              datetime_lt: $end
              requestSource: "eyeball"
              clientRequestHTTPHost: $host
              OR: [
                ${filters}
              ]
            }
          ) {
            count
            dimensions {
              datetimeHour
              userAgent
              clientRequestPath
              clientRequestHTTPHost
            }
          }
        }
      }
    }
  `
}

async function fetchRows(token: string, zoneId: string, windowHours: number): Promise<CloudflareAnalyticsRow[]> {
  const end = new Date()
  const start = new Date(end.getTime() - windowHours * 60 * 60 * 1000)
  const response = await fetch(graphqlUrl, {
    method: 'POST',
    headers: headers(token),
    body: JSON.stringify({
      query: graphqlQuery(),
      variables: {
        zoneTag: zoneId,
        start: start.toISOString(),
        end: end.toISOString(),
        host: hostname,
      },
    }),
  })
  if (!response.ok) throw new Error(`GraphQL HTTP ${response.status}`)
  const payload = await response.json() as GraphqlResponse
  if (payload.errors?.length) {
    throw new Error(payload.errors.map((error) => error.message ?? 'GraphQL error').join('; '))
  }
  return payload.data?.viewer?.zones?.[0]?.groups ?? []
}

async function queryWithWindowFallback(token: string, zoneId: string) {
  try {
    return {
      rows: await fetchRows(token, zoneId, requestedWindowHours),
      windowHours: requestedWindowHours,
    }
  } catch (error) {
    if (requestedWindowHours <= 24) throw error
    process.stderr.write(
      `sync-cloudflare-discovery: ${requestedWindowHours}h query failed; retrying 24h: ${error instanceof Error ? error.message : String(error)}\n`,
    )
    return {
      rows: await fetchRows(token, zoneId, 24),
      windowHours: 24,
    }
  }
}

async function writeSnapshot(snapshot: DiscoverySnapshot) {
  await writeFile(outputPath, `${JSON.stringify(snapshot, null, 2)}\n`, 'utf8')
}

async function main() {
  const token = process.env.CLOUDFLARE_API_TOKEN
  if (!token) {
    await writeSnapshot(unavailableDiscoverySnapshot('CLOUDFLARE_API_TOKEN is not configured.'))
    process.stderr.write('sync-cloudflare-discovery: token unavailable; wrote explicit UNAVAILABLE snapshot.\n')
    return
  }

  try {
    const zoneId = await resolveZoneId(token)
    const { rows, windowHours } = await queryWithWindowFallback(token, zoneId)
    const snapshot = buildDiscoverySnapshot({
      rows,
      generatedAt: new Date().toISOString(),
      windowHours,
      zone: zoneName,
      hostname,
    })
    await writeSnapshot(snapshot)
    process.stdout.write(
      `sync-cloudflare-discovery: ${snapshot.totals.requests} crawler requests across ${snapshot.crawlers.length} crawler identities (${windowHours}h).\n`,
    )
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    await writeSnapshot(unavailableDiscoverySnapshot(`Cloudflare analytics unavailable: ${message}`))
    process.stderr.write(`sync-cloudflare-discovery: ${message}; wrote explicit UNAVAILABLE snapshot.\n`)
  }
}

main().catch(async (error) => {
  const message = error instanceof Error ? error.message : String(error)
  await writeSnapshot(unavailableDiscoverySnapshot(`Discovery sync failed: ${message}`))
  process.stderr.write(`sync-cloudflare-discovery: fatal: ${message}\n`)
  process.exitCode = 1
})
