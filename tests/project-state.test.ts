import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { test } from 'node:test'
import { fileURLToPath } from 'node:url'
import {
  getFreshness,
  parseProjectRegistry,
  ProjectRegistrySchema,
  type ProjectRegistry,
} from '../src/contract/project-state.js'

const fixturePath = fileURLToPath(new URL('../config/projects.json', import.meta.url))
const validRegistry = JSON.parse(readFileSync(fixturePath, 'utf8')) as unknown

function cloneRegistry(): ProjectRegistry {
  return structuredClone(parseProjectRegistry(validRegistry))
}

test('all ten normalized project fixtures pass deterministic validation', () => {
  const registry = parseProjectRegistry(validRegistry)
  assert.equal(registry.projects.length, 10)
})

test('invalid triage states fail', () => {
  const registry = cloneRegistry() as unknown as { projects: Array<{ triageState: string }> }
  registry.projects[0].triageState = 'UNKNOWN'
  assert.equal(ProjectRegistrySchema.safeParse(registry).success, false)
})

test('missing required fields fail', () => {
  const registry = cloneRegistry() as unknown as { projects: Array<Record<string, unknown>> }
  delete registry.projects[0].nextAction
  assert.equal(ProjectRegistrySchema.safeParse(registry).success, false)
})

test('invalid calendar dates fail', () => {
  const registry = cloneRegistry()
  registry.projects[0].lastUpdated = '2026-02-30'
  assert.equal(ProjectRegistrySchema.safeParse(registry).success, false)
})

test('invalid progress and duplicate ids fail', () => {
  const invalidProgress = cloneRegistry()
  invalidProgress.projects[0].progress = { completed: 2, total: 1 }
  assert.equal(ProjectRegistrySchema.safeParse(invalidProgress).success, false)

  const duplicate = cloneRegistry()
  duplicate.projects[1].id = duplicate.projects[0].id
  assert.equal(ProjectRegistrySchema.safeParse(duplicate).success, false)
})

test('BLOCKED requires a concrete blocker', () => {
  const registry = cloneRegistry()
  registry.projects[0].triageState = 'BLOCKED'
  registry.projects[0].blocker = null
  assert.equal(ProjectRegistrySchema.safeParse(registry).success, false)
})

test('unknown triage is explicit and does not add an eighth canonical state', () => {
  const registry = cloneRegistry()
  registry.projects[0].triageState = null
  registry.projects[0].triageSource = { status: 'UNKNOWN', reason: 'No attributable status artifact' }
  assert.equal(ProjectRegistrySchema.safeParse(registry).success, true)

  registry.projects[0].triageState = 'READY'
  assert.equal(ProjectRegistrySchema.safeParse(registry).success, false)
})

test('conflicting triage requires null state and at least two attributed sources', () => {
  const registry = cloneRegistry()
  registry.projects[0].triageState = null
  registry.projects[0].triageSource = {
    status: 'CONFLICT',
    sourceIds: ['project-status', 'roadmap'],
    reason: 'Source artifacts disagree',
  }
  assert.equal(ProjectRegistrySchema.safeParse(registry).success, true)

  registry.projects[0].triageSource.sourceIds = ['project-status']
  assert.equal(ProjectRegistrySchema.safeParse(registry).success, false)
})

test('freshness calculation is deterministic with an injected clock', () => {
  const project = cloneRegistry().projects[0]
  assert.equal(getFreshness(project, new Date('2026-09-01T00:00:00Z')), 'FRESH')
  assert.equal(getFreshness(project, new Date('2026-09-02T00:00:00Z')), 'STALE')
})
