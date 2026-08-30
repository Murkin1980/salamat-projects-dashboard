import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { test } from 'node:test'
import { fileURLToPath } from 'node:url'
import { HistoryRegistrySchema, parseHistoryRegistry, summarizeHistory } from '../src/history/project-history.js'

const historyPath = fileURLToPath(new URL('../config/project-history.json', import.meta.url))
const registryInput = JSON.parse(readFileSync(historyPath, 'utf8'))

test('history manifest is chronological and source-attributed', () => {
  const history = parseHistoryRegistry(registryInput).projects[0]
  assert.ok(history.events.every((event) => event.sourceId.length === 40))
  assert.ok(history.events.every((event) => event.evidenceUrl.includes(`/commit/${event.sourceId}`)))
  assert.deepEqual(summarizeHistory(history), { checkpointMoves: 7, stateChanges: 1, blockerChanges: 0 })
})

test('history rejects duplicate events', () => {
  const invalid = structuredClone(registryInput)
  invalid.projects[0].events[1].id = invalid.projects[0].events[0].id
  assert.equal(HistoryRegistrySchema.safeParse(invalid).success, false)
})

test('history rejects reverse chronology', () => {
  const invalid = structuredClone(registryInput)
  invalid.projects[0].events[1].occurredAt = '2026-08-25T20:30:47+05:00'
  assert.equal(HistoryRegistrySchema.safeParse(invalid).success, false)
})

test('history rejects transitions without a change', () => {
  const invalid = structuredClone(registryInput)
  invalid.projects[0].events[0].to = invalid.projects[0].events[0].from
  assert.equal(HistoryRegistrySchema.safeParse(invalid).success, false)
})
