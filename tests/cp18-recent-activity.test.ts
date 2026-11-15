import assert from 'node:assert/strict'
import test from 'node:test'
import registryJson from '../config/projects.github.json' with { type: 'json' }
import { parseProjectRegistry } from '../src/contract/project-state.js'
import {
  getPortfolioActivity,
  projectsWithoutHistory,
  RECENT_ACTIVITY_LIMIT,
} from '../src/monitoring/recent-activity.js'
import { parseHashRoute, viewHash } from '../src/routing/hash-route.js'

const registry = parseProjectRegistry(registryJson)

test('activity route is shareable and survives refresh parsing', () => {
  assert.equal(viewHash('activity'), '#/activity')
  assert.deepEqual(parseHashRoute('#/activity'), { view: 'activity', projectId: null })
})

test('portfolio activity is newest-first, bounded and source-backed', () => {
  const events = getPortfolioActivity(registry.projects)
  assert.ok(events.length > 0)
  assert.ok(events.length <= RECENT_ACTIVITY_LIMIT)

  for (const [index, item] of events.entries()) {
    assert.ok(item.event.evidenceUrl.startsWith('https://'))
    assert.ok(item.project.history.status === 'KNOWN')
    if (index > 0) {
      assert.ok(
        Date.parse(events[index - 1].event.occurredAt) >= Date.parse(item.event.occurredAt),
        'the cross-project feed must be newest first',
      )
    }
  }
})

test('project filter returns only that project and never fills unavailable history', () => {
  const project = registry.projects.find((candidate) => candidate.history.status === 'KNOWN' && candidate.history.events.length > 0)
  assert.ok(project)
  assert.ok(getPortfolioActivity(registry.projects, project.id).every((item) => item.project.id === project.id))

  for (const unavailable of projectsWithoutHistory(registry.projects)) {
    assert.deepEqual(getPortfolioActivity(registry.projects, unavailable.id), [])
  }
})

test('zero and negative limits return no events', () => {
  assert.deepEqual(getPortfolioActivity(registry.projects, null, 0), [])
  assert.deepEqual(getPortfolioActivity(registry.projects, null, -1), [])
})

test('event type and project filters intersect before the recent limit is applied', () => {
  const all = getPortfolioActivity(registry.projects, null, Infinity)
  const target = all.find(({ event }) => event.type !== all[0].event.type)
  assert.ok(target)

  const expected = all.filter(({ project, event }) =>
    project.id === target.project.id && event.type === target.event.type)
  assert.deepEqual(getPortfolioActivity(registry.projects, target.project.id, 1, target.event.type), expected.slice(0, 1))
  assert.deepEqual(getPortfolioActivity(registry.projects, 'unknown-project', 3, target.event.type), [])
})

test('invalid event timestamps are rejected at the snapshot boundary', () => {
  const snapshot = structuredClone(registryJson)
  const project = snapshot.projects.find((candidate) => candidate.history.events?.length)
  assert.ok(project?.history.events?.[0])
  project.history.events[0].occurredAt = 'invalid-date'
  assert.throws(() => parseProjectRegistry(snapshot), /occurredAt/)
})
