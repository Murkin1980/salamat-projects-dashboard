import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import test from 'node:test'
import { fileURLToPath } from 'node:url'
import {
  buildDiscoverySnapshot,
  identifyCrawler,
  parseDiscoverySnapshot,
} from '../src/discovery/discovery-analytics.js'
import { fetchDiscoverySnapshot } from '../src/hooks/use-discovery-analytics.js'

const runtimePath = fileURLToPath(new URL('../public/discovery-analytics.json', import.meta.url))

test('committed discovery snapshot is explicit and schema-valid', async () => {
  const payload = JSON.parse(await readFile(runtimePath, 'utf8'))
  const snapshot = parseDiscoverySnapshot(payload)
  assert.equal(snapshot.status, 'UNAVAILABLE')
  assert.equal(snapshot.source.hostname, 'house.salamat-mebel.kz')
  assert.equal(snapshot.source.detection, 'USER_AGENT')
})

test('crawler identification covers search and AI examples', () => {
  assert.equal(identifyCrawler('Mozilla/5.0 compatible Googlebot/2.1')?.id, 'googlebot')
  assert.equal(identifyCrawler('Mozilla/5.0 OAI-SearchBot/1.0')?.id, 'oai-searchbot')
  assert.equal(identifyCrawler('ClaudeBot/1.0')?.operator, 'Anthropic')
  assert.equal(identifyCrawler('ordinary-browser') ?? null, null)
})

test('analytics rows aggregate requests, last seen and top paths deterministically', () => {
  const snapshot = buildDiscoverySnapshot({
    rows: [
      {
        count: 4,
        dimensions: {
          datetimeHour: '2026-09-21T04:00:00Z',
          userAgent: 'Googlebot',
          clientRequestPath: '/stories/',
          clientRequestHTTPHost: 'house.salamat-mebel.kz',
        },
      },
      {
        count: 3,
        dimensions: {
          datetimeHour: '2026-09-21T05:00:00Z',
          userAgent: 'OAI-SearchBot',
          clientRequestPath: '/stories/why-business-discovery-appeared/',
          clientRequestHTTPHost: 'house.salamat-mebel.kz',
        },
      },
      {
        count: 2,
        dimensions: {
          datetimeHour: '2026-09-21T03:00:00Z',
          userAgent: 'GPTBot',
          clientRequestPath: '/stories/',
          clientRequestHTTPHost: 'house.salamat-mebel.kz',
        },
      },
    ],
    generatedAt: '2026-09-21T06:00:00Z',
    windowHours: 24,
    zone: 'salamat-mebel.kz',
    hostname: 'house.salamat-mebel.kz',
  })

  assert.equal(snapshot.status, 'OK')
  assert.equal(snapshot.totals.requests, 9)
  assert.equal(snapshot.totals.searchEngineRequests, 4)
  assert.equal(snapshot.totals.aiRequests, 5)
  assert.equal(snapshot.lastSeen.googlebot, '2026-09-21T04:00:00.000Z')
  assert.equal(snapshot.lastSeen.bingbot, null)
  assert.deepEqual(snapshot.topPaths[0], { path: '/stories/', requests: 6 })
  assert.equal(snapshot.crawlers[0]?.name, 'Googlebot')
})

test('runtime discovery fetch validates and returns snapshot', async () => {
  const payload = JSON.parse(await readFile(runtimePath, 'utf8'))
  const snapshot = await fetchDiscoverySnapshot(async () => new Response(JSON.stringify(payload)))
  assert.equal(snapshot.schemaVersion, '1.0.0')
})

test('runtime discovery fetch fails on HTTP and invalid schema', async () => {
  await assert.rejects(
    () => fetchDiscoverySnapshot(async () => new Response('', { status: 503 })),
    /HTTP 503/,
  )
  await assert.rejects(
    () => fetchDiscoverySnapshot(async () => new Response('{"status":"OK"}')),
  )
})
