import assert from 'node:assert/strict'
import { test } from 'node:test'
import type { ProjectState } from '../src/contract/project-state.js'
import { deriveLiveProjectState } from '../src/triage/live-triage.js'

function project(overrides: Partial<ProjectState> = {}): ProjectState {
  return { schemaVersion: '1.0.0', id: 'example-project', name: 'Example', summary: 'Example project', repo: 'example/project', triageState: 'READY', triageSource: { status: 'KNOWN', sourceId: 'sha:PROJECT_STATUS.md' }, stage: null, checkpoint: 'CP-05', progress: null, lastUpdated: '2026-08-25', blocker: null, nextAction: 'Continue', evidenceLinks: [], dependencies: [], tools: [], approvals: [], source: { kind: 'REPOSITORY', id: 'example/project' }, staleAfterDays: 7, ...overrides }
}
const NOW = new Date('2026-08-27T12:00:00Z')

test('concrete blocker deterministically overrides READY', () => {
  const result = deriveLiveProjectState(project({ blocker: 'Waiting for API' }), NOW)
  assert.equal(result.effectiveTriageState, 'BLOCKED'); assert.equal(result.attention[0].kind, 'BLOCKER')
})
test('pending approval derives ACTION_NOW when no blocker exists', () => {
  const result = deriveLiveProjectState(project({ approvals: [{ id: 'deep-change', status: 'PENDING', sourceId: 'issue-12' }] }), NOW)
  assert.equal(result.effectiveTriageState, 'ACTION_NOW'); assert.equal(result.attention[0].kind, 'APPROVAL_PENDING')
})
test('blocker precedence is higher than pending approval', () => {
  const result = deriveLiveProjectState(project({ blocker: 'Environment unavailable', approvals: [{ id: 'release', status: 'PENDING', sourceId: 'issue-13' }] }), NOW)
  assert.equal(result.effectiveTriageState, 'BLOCKED')
})
test('source conflict remains unresolved and explainable', () => {
  const result = deriveLiveProjectState(project({ triageState: null, triageSource: { status: 'CONFLICT', sourceIds: ['sha-main', 'sha-branch'], reason: 'Branches differ' } }), NOW)
  assert.equal(result.effectiveTriageState, null); assert.equal(result.attention[0].kind, 'SOURCE_CONFLICT')
})
test('staleness uses injected clock and configured threshold', () => {
  assert.equal(deriveLiveProjectState(project(), NOW).attention.some((s) => s.kind === 'STALE'), false)
  assert.equal(deriveLiveProjectState(project({ lastUpdated: '2026-08-20' }), NOW).attention.some((s) => s.kind === 'STALE'), true)
})
test('validation is an explicit Attention signal', () => {
  assert.equal(deriveLiveProjectState(project({ triageState: 'VALIDATION' }), NOW).attention[0].kind, 'VALIDATION')
})
