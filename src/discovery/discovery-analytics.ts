import { z } from 'zod'

export const CRAWLER_DEFINITIONS = [
  { id: 'googlebot', name: 'Googlebot', operator: 'Google', category: 'SEARCH_ENGINE', userAgent: 'Googlebot' },
  { id: 'bingbot', name: 'Bingbot', operator: 'Microsoft', category: 'SEARCH_ENGINE', userAgent: 'bingbot' },
  { id: 'gptbot', name: 'GPTBot', operator: 'OpenAI', category: 'AI_CRAWLER', userAgent: 'GPTBot' },
  { id: 'oai-searchbot', name: 'OAI-SearchBot', operator: 'OpenAI', category: 'AI_SEARCH', userAgent: 'OAI-SearchBot' },
  { id: 'chatgpt-user', name: 'ChatGPT-User', operator: 'OpenAI', category: 'AI_ASSISTANT', userAgent: 'ChatGPT-User' },
  { id: 'claudebot', name: 'ClaudeBot', operator: 'Anthropic', category: 'AI_CRAWLER', userAgent: 'ClaudeBot' },
  { id: 'claude-searchbot', name: 'Claude-SearchBot', operator: 'Anthropic', category: 'AI_SEARCH', userAgent: 'Claude-SearchBot' },
  { id: 'claude-user', name: 'Claude-User', operator: 'Anthropic', category: 'AI_ASSISTANT', userAgent: 'Claude-User' },
  { id: 'perplexitybot', name: 'PerplexityBot', operator: 'Perplexity', category: 'AI_SEARCH', userAgent: 'PerplexityBot' },
  { id: 'perplexity-user', name: 'Perplexity-User', operator: 'Perplexity', category: 'AI_ASSISTANT', userAgent: 'Perplexity-User' },
  { id: 'google-cloudvertexbot', name: 'Google-CloudVertexBot', operator: 'Google', category: 'AI_CRAWLER', userAgent: 'Google-CloudVertexBot' },
  { id: 'bytespider', name: 'Bytespider', operator: 'ByteDance', category: 'AI_CRAWLER', userAgent: 'Bytespider' },
  { id: 'ccbot', name: 'CCBot', operator: 'Common Crawl', category: 'AI_CRAWLER', userAgent: 'CCBot' },
  { id: 'meta-externalagent', name: 'Meta-ExternalAgent', operator: 'Meta', category: 'AI_CRAWLER', userAgent: 'meta-externalagent' },
  { id: 'meta-externalfetcher', name: 'Meta-ExternalFetcher', operator: 'Meta', category: 'AI_ASSISTANT', userAgent: 'meta-externalfetcher' },
  { id: 'applebot', name: 'Applebot', operator: 'Apple', category: 'AI_SEARCH', userAgent: 'Applebot' },
  { id: 'amazonbot', name: 'Amazonbot', operator: 'Amazon', category: 'AI_CRAWLER', userAgent: 'Amazonbot' },
  { id: 'duckassistbot', name: 'DuckAssistBot', operator: 'DuckDuckGo', category: 'AI_ASSISTANT', userAgent: 'DuckAssistBot' },
  { id: 'mistralai-user', name: 'MistralAI-User', operator: 'Mistral', category: 'AI_ASSISTANT', userAgent: 'MistralAI-User' },
] as const

export type CrawlerDefinition = (typeof CRAWLER_DEFINITIONS)[number]
export type CrawlerCategory = CrawlerDefinition['category']

const isoDateTime = z.string().datetime({ offset: true })

export const crawlerActivitySchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1),
  operator: z.string().min(1),
  category: z.enum(['SEARCH_ENGINE', 'AI_CRAWLER', 'AI_SEARCH', 'AI_ASSISTANT']),
  userAgent: z.string().min(1),
  requests: z.number().int().nonnegative(),
  lastSeenAt: isoDateTime.nullable(),
})

export const discoverySnapshotSchema = z.object({
  schemaVersion: z.literal('1.0.0'),
  status: z.enum(['OK', 'UNAVAILABLE']),
  generatedAt: isoDateTime.nullable(),
  windowHours: z.number().int().positive().max(168),
  source: z.object({
    kind: z.literal('CLOUDFLARE_GRAPHQL'),
    zone: z.string().min(1),
    hostname: z.string().min(1),
    detection: z.literal('USER_AGENT'),
    qualityNote: z.string().min(1),
  }),
  totals: z.object({
    requests: z.number().int().nonnegative(),
    searchEngineRequests: z.number().int().nonnegative(),
    aiRequests: z.number().int().nonnegative(),
  }),
  lastSeen: z.object({
    googlebot: isoDateTime.nullable(),
    bingbot: isoDateTime.nullable(),
  }),
  crawlers: z.array(crawlerActivitySchema),
  topPaths: z.array(z.object({
    path: z.string().min(1),
    requests: z.number().int().nonnegative(),
  })),
  message: z.string().nullable(),
})

export type DiscoverySnapshot = z.infer<typeof discoverySnapshotSchema>
export type CrawlerActivity = z.infer<typeof crawlerActivitySchema>

export interface CloudflareAnalyticsRow {
  count: number
  dimensions: {
    datetimeHour: string
    userAgent: string
    clientRequestPath: string
    clientRequestHTTPHost: string
  }
}

export function parseDiscoverySnapshot(input: unknown): DiscoverySnapshot {
  return discoverySnapshotSchema.parse(input)
}

export function identifyCrawler(userAgent: string): CrawlerDefinition | null {
  const normalized = userAgent.toLowerCase()
  const ordered = [...CRAWLER_DEFINITIONS].sort((a, b) => b.userAgent.length - a.userAgent.length)
  return ordered.find((definition) => normalized.includes(definition.userAgent.toLowerCase())) ?? null
}

export function buildDiscoverySnapshot(input: {
  rows: CloudflareAnalyticsRow[]
  generatedAt: string
  windowHours: number
  zone: string
  hostname: string
}): DiscoverySnapshot {
  const crawlerMap = new Map<string, CrawlerActivity>()
  const pathCounts = new Map<string, number>()

  for (const row of input.rows) {
    const definition = identifyCrawler(row.dimensions.userAgent)
    if (!definition) continue
    const count = Number.isFinite(row.count) && row.count > 0 ? Math.floor(row.count) : 0
    const existing = crawlerMap.get(definition.id)
    const timestamp = new Date(row.dimensions.datetimeHour).toISOString()
    const lastSeenAt = existing?.lastSeenAt && existing.lastSeenAt > timestamp ? existing.lastSeenAt : timestamp

    crawlerMap.set(definition.id, {
      id: definition.id,
      name: definition.name,
      operator: definition.operator,
      category: definition.category,
      userAgent: definition.userAgent,
      requests: (existing?.requests ?? 0) + count,
      lastSeenAt,
    })

    const path = row.dimensions.clientRequestPath || '/'
    pathCounts.set(path, (pathCounts.get(path) ?? 0) + count)
  }

  const crawlers = Array.from(crawlerMap.values()).sort((a, b) =>
    b.requests - a.requests || a.name.localeCompare(b.name),
  )
  const requests = crawlers.reduce((sum, crawler) => sum + crawler.requests, 0)
  const searchEngineRequests = crawlers
    .filter((crawler) => crawler.category === 'SEARCH_ENGINE')
    .reduce((sum, crawler) => sum + crawler.requests, 0)
  const googlebot = crawlerMap.get('googlebot')?.lastSeenAt ?? null
  const bingbot = crawlerMap.get('bingbot')?.lastSeenAt ?? null

  return parseDiscoverySnapshot({
    schemaVersion: '1.0.0',
    status: 'OK',
    generatedAt: input.generatedAt,
    windowHours: input.windowHours,
    source: {
      kind: 'CLOUDFLARE_GRAPHQL',
      zone: input.zone,
      hostname: input.hostname,
      detection: 'USER_AGENT',
      qualityNote: 'Cloudflare User-Agent matching. Self-identifying crawlers can be spoofed; this is observed traffic, not cryptographic bot verification.',
    },
    totals: {
      requests,
      searchEngineRequests,
      aiRequests: requests - searchEngineRequests,
    },
    lastSeen: { googlebot, bingbot },
    crawlers,
    topPaths: Array.from(pathCounts.entries())
      .map(([path, count]) => ({ path, requests: count }))
      .sort((a, b) => b.requests - a.requests || a.path.localeCompare(b.path))
      .slice(0, 10),
    message: null,
  })
}

export function unavailableDiscoverySnapshot(message: string, windowHours = 24): DiscoverySnapshot {
  return parseDiscoverySnapshot({
    schemaVersion: '1.0.0',
    status: 'UNAVAILABLE',
    generatedAt: null,
    windowHours,
    source: {
      kind: 'CLOUDFLARE_GRAPHQL',
      zone: 'salamat-mebel.kz',
      hostname: 'house.salamat-mebel.kz',
      detection: 'USER_AGENT',
      qualityNote: 'No analytics snapshot is available yet.',
    },
    totals: { requests: 0, searchEngineRequests: 0, aiRequests: 0 },
    lastSeen: { googlebot: null, bingbot: null },
    crawlers: [],
    topPaths: [],
    message,
  })
}
