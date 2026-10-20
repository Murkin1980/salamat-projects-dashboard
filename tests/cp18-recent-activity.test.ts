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
