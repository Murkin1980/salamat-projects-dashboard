import {
  CRAWLER_DEFINITIONS,
  buildDiscoverySnapshot,
  unavailableDiscoverySnapshot,
  type CloudflareAnalyticsRow,
  type DiscoverySnapshot,
} from './discovery-analytics.js'

export const DISCOVERY_ZONE = 'salamat-mebel.kz'
export const DISCOVERY_HOSTNAME = 'house.salamat-mebel.kz'
export const DISCOVERY_WINDOW_HOURS = 24

type CloudflareZoneResponse = {
  success?: boolean
  result?: Array<{ id?: string; name?: string }>
  errors?: Array<{ message?: string }>
}

type CloudflareGraphqlResponse = {
  data?: {
    viewer?: {
      zones?: Array<{
        httpRequestsAdaptiveGroups?: CloudflareAnalyticsRow[]
      }>
    }
  }
  errors?: Array<{ message?: string }>
}

function escapeGraphql(value: string) {
  return JSON.stringify(value)
}

export function buildDiscoveryQuery(input: {
  zoneId: string
  start: string
  end: string
  hostname?: string
}) {
  const userAgentFilters = CRAWLER_DEFINITIONS
    .map((crawler) => '{ userAgent_like: ' + escapeGraphql('%' + crawler.userAgent + '%') + ' }')
    .join('\n')

  return [
    '{',
    '  viewer {',
    '    zones(filter: { zoneTag: ' + escapeGraphql(input.zoneId) + ' }) {',
    '      httpRequestsAdaptiveGroups(',
    '        filter: {',
    '          datetime_geq: ' + escapeGraphql(input.start),
    '          datetime_leq: ' + escapeGraphql(input.end),
    '          requestSource: "eyeball"',
    '          clientRequestHTTPHost: ' + escapeGraphql(input.hostname ?? DISCOVERY_HOSTNAME),
    '          edgeResponseStatus_geq: 200',
    '          edgeResponseStatus_lt: 400',
    '          OR: [',
    '            ' + userAgentFilters,
    '          ]',
    '        }',
    '        limit: 5000',
    '        orderBy: [count_DESC]',
    '      ) {',
    '        count',
    '        dimensions {',
    '          datetimeHour',
    '          userAgent',
    '          clientRequestPath',
    '          clientRequestHTTPHost',
    '        }',
    '      }',
    '    }',
    '  }',
    '}',
  ].join('\n')
}

async function cloudflareJson<T>(
  url: string,
  token: string,
  init: RequestInit = {},
  fetcher: typeof fetch = fetch,
): Promise<T> {
  const response = await fetcher(url, {
    ...init,
    headers: {
      authorization: 'Bearer ' + token,
      'content-type': 'application/json',
      ...(init.headers ?? {}),
    },
  })
  if (!response.ok) {
    throw new Error('Cloudflare HTTP ' + response.status)
  }
  return await response.json() as T
}

export async function resolveCloudflareZoneId(input: {
  token: string
  zone?: string
  explicitZoneId?: string
  fetcher?: typeof fetch
}): Promise<string> {
  if (input.explicitZoneId?.trim()) return input.explicitZoneId.trim()

  const zone = input.zone ?? DISCOVERY_ZONE
  const url = 'https://api.cloudflare.com/client/v4/zones?name=' + encodeURIComponent(zone) + '&status=active'
  const payload = await cloudflareJson<CloudflareZoneResponse>(
    url,
    input.token,
    {},
    input.fetcher ?? fetch,
  )
  const zoneId = payload.result?.find((candidate) => candidate.name === zone)?.id
  if (!zoneId) {
    const message = payload.errors?.map((error) => error.message).filter(Boolean).join('; ')
    throw new Error(message ? 'Cloudflare zone lookup failed: ' + message : 'Cloudflare zone not found: ' + zone)
  }
  return zoneId
}

export async function fetchCloudflareDiscovery(input: {
  token: string
  explicitZoneId?: string
  now?: Date
  fetcher?: typeof fetch
}): Promise<DiscoverySnapshot> {
  const now = input.now ?? new Date()
  const end = now.toISOString()
  const start = new Date(now.getTime() - DISCOVERY_WINDOW_HOURS * 60 * 60 * 1000).toISOString()
  const fetcher = input.fetcher ?? fetch

  try {
    const zoneId = await resolveCloudflareZoneId({
      token: input.token,
      explicitZoneId: input.explicitZoneId,
      fetcher,
    })
    const query = buildDiscoveryQuery({
      zoneId,
      start,
      end,
      hostname: DISCOVERY_HOSTNAME,
    })

    const payload = await cloudflareJson<CloudflareGraphqlResponse>(
      'https://api.cloudflare.com/client/v4/graphql',
      input.token,
      {
        method: 'POST',
        body: JSON.stringify({ query }),
      },
      fetcher,
    )

    if (payload.errors?.length) {
      throw new Error('Cloudflare GraphQL: ' + payload.errors.map((error) => error.message ?? 'unknown error').join('; '))
    }

    const rows = payload.data?.viewer?.zones?.[0]?.httpRequestsAdaptiveGroups
    if (!Array.isArray(rows)) throw new Error('Cloudflare GraphQL returned no analytics rows array')

    return buildDiscoverySnapshot({
      rows,
      generatedAt: end,
      windowHours: DISCOVERY_WINDOW_HOURS,
      zone: DISCOVERY_ZONE,
      hostname: DISCOVERY_HOSTNAME,
    })
  } catch (cause) {
    const message = cause instanceof Error ? cause.message : 'Unknown Cloudflare analytics error'
    return unavailableDiscoverySnapshot(message, DISCOVERY_WINDOW_HOURS)
  }
}
