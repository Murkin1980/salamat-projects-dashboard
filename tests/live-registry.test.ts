import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import { test } from 'node:test'
import { fileURLToPath } from 'node:url'
import { fetchLiveRegistry } from '../src/hooks/use-live-registry.js'

const runtimePath = fileURLToPath(new URL('../public/project-state.json', import.meta.url))

test('live registry fetch validates and returns the runtime snapshot', async () => {
  const payload = JSON.parse(await readFile(runtimePath, 'utf8'))
  const registry = await fetchLiveRegistry(async () => new Response(JSON.stringify(payload)))
  assert.equal(registry.projects.length, 10)
})

test('live registry fetch fails explicitly on HTTP error', async () => {
  await assert.rejects(
    () => fetchLiveRegistry(async () => new Response('', { status: 503 })),
    /HTTP 503/,
  )
})

test('live registry fetch fails closed on invalid schema', async () => {
  await assert.rejects(
    () => fetchLiveRegistry(async () => new Response('{"projects":[]}')),
  )
})
