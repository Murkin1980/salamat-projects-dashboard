/**
 * CP-19 Portfolio Coverage & Data Quality focused tests.
 *
 * Covers: the UNAVAILABLE triage-source resolution, fail-closed invariants in
 * `unavailableProjectState`, the CP-19 verify:snapshot additions, and the
 * portfolio coverage derivation.
 */
import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import { fileURLToPath } from 'node:url'
import { test } from 'node:test'
import {
  ARENA_SESSION_STATES,
  PROJECT_STATE_SCHEMA_VERSION,
  parseProjectRegistry,
  type ProjectState,
} from '../src/contract/project-state.js'
import { unavailableProjectState } from '../src/adapters/github-source.js'
import { classifyProject, summarizeCoverage } from '../src/monitoring/portfolio-coverage.js'

const repoUrl = (relative: string) => fileURLToPath(new URL(relative, import.meta.url))
async function readJson(relative: string): Promise<unknown> {
  return JSON.parse(await readFile(repoUrl(relative), 'utf8'))
}

// --- UNAVAILABLE triage source contract ------------------------------------

test('UNAVAILABLE triage source requires triageState null and never fabricates data', () => {
  const state = unavailableProjectState({
    projectId: 'sample-private',
    name: 'Sample Private Repo',
    summary: 'A repository whose canonical status source is unreadable.',
    repo: 'owner/sample-private',
    generatedAt: '2026-10-20T12:00:00Z',
    snapshotSourceId: 'config/projects.github.json',
    reason: 'Private repository: no canonical PROJECT_STATUS.md could be verified.',
  })

  // Schema round-trip must accept the state without adding fields.
  const parsed = parseProjectRegistry({
    schemaVersion: PROJECT_STATE_SCHEMA_VERSION,
    version: 1,
    updatedAt: '2026-10-20',
    projects: [state],
  })
  const roundTrip = parsed.projects[0] as ProjectState
  assert.equal(roundTrip.triageSource.status, 'UNAVAILABLE')
  assert.equal(roundTrip.triageState, null, 'UNAVAILABLE projects carry no triage state')
  assert.equal(roundTrip.blocker, null)
  assert.equal(roundTrip.nextAction, null)
  assert.equal(roundTrip.stage, null)
  assert.equal(roundTrip.checkpoint, null)
  assert.equal(roundTrip.activity.lastMeaningfulActivity.status, 'UNAVAILABLE')
  assert.equal(roundTrip.activity.statusUpdatedAt.status, 'UNAVAILABLE')
  assert.equal(roundTrip.history.status, 'UNAVAILABLE')
  assert.equal(roundTrip.session.sessionState, 'UNKNOWN')
  assert.equal(roundTrip.session.sessionClosureStatus, 'UNKNOWN')
  assert.equal(roundTrip.source.kind, 'REPOSITORY')
  assert.equal(roundTrip.evidenceLinks.length, 0)
  assert.equal(roundTrip.dependencies.length, 0)
  assert.equal(roundTrip.tools.length, 0)
  assert.equal(roundTrip.approvals.length, 0)
})

test('UNAVAILABLE session state is UNKNOWN and never CLOSED without evidence', () => {
  const state = unavailableProjectState({
    projectId: 'p', name: 'P', summary: 's', repo: 'o/p',
    generatedAt: '2026-10-20T12:00:00Z',
    snapshotSourceId: 'config/projects.github.json',
    reason: 'source unavailable',
  })
  assert.ok(ARENA_SESSION_STATES.includes(state.session.sessionState))
  assert.notEqual(state.session.sessionState, 'CLOSED')
  assert.equal(state.session.sessionClosureEvidence, null)
})

// --- Coverage classification derivation ------------------------------------

test('classifyProject uses current/stale/unknown/unavailable/fixture categories correctly', () => {
  // Snapshot gen time fixed for deterministic staleness.
  const genAt = '2026-10-20T12:00:00Z'
  function mk(overrides: Partial<ProjectState>): ProjectState {
    return {
      schemaVersion: PROJECT_STATE_SCHEMA_VERSION,
      id: 'x',
      name: 'X',
      summary: 'x',
      repo: 'o/x',
      triageState: 'READY',
      triageSource: { status: 'KNOWN', sourceId: 'sha:PROJECT_STATUS.md' },
      stage: null,
      checkpoint: null,
      progress: null,
      lastUpdated: '2026-10-19',
      activity: {
        lastMeaningfulActivity: {
          status: 'KNOWN', at: '2026-10-19T12:00:00Z', source: 'COMMIT',
          sourceId: 'abc', evidenceUrl: 'https://github.com/o/x/commit/abc',
        },
        statusUpdatedAt: { status: 'UNAVAILABLE', reason: 'no' },
        snapshotGeneratedAt: { at: genAt, source: 'SNAPSHOT', sourceId: 'snap' },
      },
      session: {
        sessionState: 'UNKNOWN', sessionCheckpoint: null,
        sessionStartedAt: { status: 'UNAVAILABLE', reason: 'no' },
        sessionLastActivityAt: { status: 'UNAVAILABLE', reason: 'no' },
        sessionClosureStatus: 'UNKNOWN', sessionClosureEvidence: null,
        sessionStateEvidence: [], sessionStateReason: 'no',
      },
      history: { status: 'UNAVAILABLE', reason: 'no' },
      blocker: null, nextAction: null, evidenceLinks: [],
      dependencies: [], tools: [], approvals: [],
      source: { kind: 'REPOSITORY', id: 'o/x' }, staleAfterDays: 7,
      ...overrides,
    }
  }

  // CURRENT (activity within threshold)
  assert.equal(classifyProject(mk({})).classification, 'CURRENT')

  // STALE (activity older than threshold)
  assert.equal(
    classifyProject(mk({
      activity: {
        lastMeaningfulActivity: {
          status: 'KNOWN', at: '2026-10-01T12:00:00Z', source: 'COMMIT',
          sourceId: 'old', evidenceUrl: 'https://github.com/o/x/commit/old',
        },
        statusUpdatedAt: { status: 'UNAVAILABLE', reason: 'no' },
        snapshotGeneratedAt: { at: genAt, source: 'SNAPSHOT', sourceId: 'snap' },
      },
      lastUpdated: '2026-10-01',
    })).classification,
    'STALE',
  )

  // UNKNOWN
  assert.equal(
    classifyProject(mk({ triageState: null, triageSource: { status: 'UNKNOWN', reason: 'no label' } })).classification,
    'UNKNOWN',
  )

  // CONFLICT is reported as UNKNOWN bucket
  assert.equal(
    classifyProject(mk({
      triageState: null,
      triageSource: { status: 'CONFLICT', sourceIds: ['a', 'b'], reason: 'conflict' },
    })).classification,
    'UNKNOWN',
  )

  // UNAVAILABLE
  assert.equal(
    classifyProject(mk({
      triageState: null,
      triageSource: { status: 'UNAVAILABLE', reason: 'private' },
      activity: {
        lastMeaningfulActivity: { status: 'UNAVAILABLE', reason: 'private' },
        statusUpdatedAt: { status: 'UNAVAILABLE', reason: 'private' },
        snapshotGeneratedAt: { at: genAt, source: 'SNAPSHOT', sourceId: 'snap' },
      },
    })).classification,
    'UNAVAILABLE',
  )

  // FIXTURE
  assert.equal(
    classifyProject(mk({ repo: null, source: { kind: 'FIXTURE', id: 'fixture' } })).classification,
    'FIXTURE',
  )
})

test('summarizeCoverage counts match the committed snapshot', async () => {
  const registry = parseProjectRegistry(await readJson('../config/projects.github.json'))
  const { summary } = summarizeCoverage(registry)
  assert.equal(summary.total, 15)
  assert.equal(summary.current + summary.stale + summary.unknown + summary.unavailable + summary.fixture, 15)
  assert.equal(summary.sessionKnown + summary.sessionUnknown, 15)
  assert.equal(summary.historyKnown + summary.historyUnavailable, 15)
  // The salamat-projects-dashboard project has live history & confirmed session closure.
  assert.ok(summary.historyKnown >= 1, 'at least one repository has known history')
  assert.ok(summary.sessionKnown >= 1, 'at least one repository has a known session state')
})

// --- Snapshot verification invariants ---------------------------------------

test('generated artifacts carry no credential material (CP-19 hardening)', async () => {
  const secretPatterns = [
    /\bgh[pousr]_[A-Za-z0-9]{16,}\b/,
    /\bgithub_pat_[A-Za-z0-9_]{20,}\b/,
    /Bearer\s+[A-Za-z0-9._\-]{16,}/i,
    /\bAKIA[0-9A-Z]{16}\b/,
    /-----BEGIN (?:RSA |EC |OPENSSH |DSA |PGP )?PRIVATE KEY-----/,
    /(GH_TOKEN|GITHUB_TOKEN|CLOUDFLARE_API_TOKEN|CLOUDFLARE_ACCOUNT_ID)["']?\s*[=:]\s*["']?[A-Za-z0-9._\-]{8,}/i,
  ]
  for (const rel of ['../config/projects.github.json', '../public/project-state.json']) {
    const content = await readFile(repoUrl(rel), 'utf8')
    for (const pattern of secretPatterns) {
      assert.ok(!pattern.test(content), `${rel} must not contain credential-shaped material`)
    }
  }
})

test('committed cache and runtime snapshot are byte-identical', async () => {
  const cache = await readFile(repoUrl('../config/projects.github.json'), 'utf8')
  const runtime = await readFile(repoUrl('../public/project-state.json'), 'utf8')
  assert.equal(cache, runtime)
})

test('every REPOSITORY project is either a synchronized source or an explicit gap', async () => {
  const sources = (await readJson('../config/source-repositories.json')) as {
    sources: Array<{ projectId: string }>
    gaps?: Array<{ projectId: string }>
  }
  const registry = parseProjectRegistry(await readJson('../config/projects.github.json'))
  const sourceIds = new Set(sources.sources.map((s) => s.projectId))
  const gapIds = new Set((sources.gaps ?? []).map((g) => g.projectId))
  for (const project of registry.projects) {
    if (project.source.kind !== 'REPOSITORY') continue
    assert.ok(
      sourceIds.has(project.id) || gapIds.has(project.id),
      `${project.id} is REPOSITORY but missing from source-repositories sources/gaps`,
    )
  }
})

test('UNAVAILABLE projects carry no fabricated operational data', async () => {
  const registry = parseProjectRegistry(await readJson('../config/projects.github.json'))
  for (const project of registry.projects) {
    if (project.triageSource.status !== 'UNAVAILABLE') continue
    assert.equal(project.triageState, null, `${project.id}: triageState must be null for UNAVAILABLE`)
    assert.equal(project.blocker, null, `${project.id}: blocker must be null for UNAVAILABLE`)
    assert.equal(project.nextAction, null, `${project.id}: nextAction must be null for UNAVAILABLE`)
    assert.equal(
      project.activity.lastMeaningfulActivity.status,
      'UNAVAILABLE',
      `${project.id}: lastMeaningfulActivity must be UNAVAILABLE`,
    )
    assert.equal(project.history.status, 'UNAVAILABLE', `${project.id}: history must be UNAVAILABLE`)
  }
})

test('private-repository gaps that previously had fabricated KNOWN states are now explicit UNAVAILABLE', async () => {
  const registry = parseProjectRegistry(await readJson('../config/projects.github.json'))
  for (const id of ['murat-house', 'murat-ai-orchestrator']) {
    const project = registry.projects.find((p) => p.id === id)
    assert.ok(project, `${id} must be in the snapshot`)
    assert.equal(
      project!.triageSource.status,
      'UNAVAILABLE',
      `${id}: fabricated KNOWN state replaced with UNAVAILABLE (CP-19 #4)`,
    )
    assert.equal(project!.triageState, null)
  }
})
