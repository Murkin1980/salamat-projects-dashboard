import assert from 'node:assert/strict'
import { test } from 'node:test'
import {
  ProjectStateSchema,
  type ProjectState,
} from '../src/contract/project-state.js'
import { adaptGithubSource, type RepositorySnapshot } from '../src/adapters/github-source.js'
import {
  deriveLastMeaningfulActivity,
  deriveStatusUpdatedAt,
  getActivityFreshness,
  toEvidenceTimestamp,
  type ActivitySignal,
} from '../src/monitoring/derived-state.js'

/**
 * Normalized project-activity contract.
 *
 * Activity must always be traceable to evidence. Missing evidence stays explicit
 * (`UNAVAILABLE`) and the dashboard snapshot generation timestamp is never a
 * substitute for project activity.
 */

const GENERATED_AT = '2026-10-01T12:00:00Z'
const SNAPSHOT_SOURCE_ID = 'config/projects.github.json'
const NOW = new Date('2026-10-01T12:00:00Z')

function signal(overrides: Partial<ActivitySignal> & { at: string }): ActivitySignal {
  return {
    source: 'COMMIT',
    sourceId: 'sha-fixture',
    evidenceUrl: null,
    ...overrides,
  }
}

function snapshot(overrides: Partial<RepositorySnapshot> = {}): RepositorySnapshot {
  return {
    projectId: 'fixture-project',
    name: 'Fixture Project',
    summary: 'Fixture summary.',
    repo: 'Murkin1980/fixture-project',
    defaultBranch: 'main',
    headSha: 'aaaa1111bbbb2222cccc3333dddd4444eeee5555',
    headCommittedAt: '2026-09-30T08:15:00Z',
    retrievedAt: '2026-10-01',
    generatedAt: GENERATED_AT,
    snapshotSourceId: SNAPSHOT_SOURCE_ID,
    artifacts: [],
    ...overrides,
  }
}

const STATUS_ARTIFACT = {
  path: 'PROJECT_STATUS.md',
  ref: 'main',
  sha: 'sha-status-001',
  htmlUrl: 'https://github.com/Murkin1980/fixture-project/blob/main/PROJECT_STATUS.md',
  content: `# PROJECT STATUS\n\nCurrent checkpoint: \`CP-14 — Fixture\`\nStatus: \`PASS\`\n\nLast updated: 2026-09-29\n`,
}

// --- Freshness -------------------------------------------------------------

test('fresh activity: the newest attributable evidence wins and is FRESH', () => {
  const activity = deriveLastMeaningfulActivity([
    signal({ at: '2026-09-29T00:00:00Z', source: 'PROJECT_STATUS', sourceId: 'sha-status-001:PROJECT_STATUS.md' }),
    signal({ at: '2026-09-30T08:15:00Z', source: 'COMMIT', sourceId: 'aaaa1111bbbb2222cccc3333dddd4444eeee5555' }),
  ])

  assert.equal(activity.status, 'KNOWN')
  if (activity.status !== 'KNOWN') return
  assert.equal(activity.at, '2026-09-30T08:15:00Z')
  assert.equal(activity.source, 'COMMIT')
  assert.equal(activity.sourceId, 'aaaa1111bbbb2222cccc3333dddd4444eeee5555')
  assert.equal(getActivityFreshness(activity, NOW, 7), 'FRESH')
})

test('stale activity: evidence older than the project threshold is STALE', () => {
  const activity = deriveLastMeaningfulActivity([
    signal({ at: '2026-08-01T00:00:00Z', source: 'PROJECT_STATUS', sourceId: 'sha-status-old:PROJECT_STATUS.md' }),
  ])

  assert.equal(activity.status, 'KNOWN')
  assert.equal(getActivityFreshness(activity, NOW, 7), 'STALE')
})

test('missing activity: no evidence yields UNAVAILABLE and UNKNOWN freshness, never a clock value', () => {
  const activity = deriveLastMeaningfulActivity([])

  assert.equal(activity.status, 'UNAVAILABLE')
  if (activity.status !== 'UNAVAILABLE') return
  assert.ok(activity.reason.length > 0, 'an unavailable timestamp must explain itself')
  assert.equal(getActivityFreshness(activity, NOW, 7), 'UNKNOWN')
})

test('unavailable source: the source reason is preserved instead of a fabricated timestamp', () => {
  const activity = toEvidenceTimestamp(
    null,
    'Repository Murkin1980/private-project is not readable with the configured credentials',
  )

  assert.deepEqual(activity, {
    status: 'UNAVAILABLE',
    reason: 'Repository Murkin1980/private-project is not readable with the configured credentials',
  })
})

test('statusUpdatedAt only considers canonical status and roadmap evidence', () => {
  const withStatus = deriveStatusUpdatedAt([
    signal({ at: '2026-09-29T00:00:00Z', source: 'PROJECT_STATUS', sourceId: 'sha-status:PROJECT_STATUS.md' }),
    signal({ at: '2026-09-28T00:00:00Z', source: 'ROADMAP', sourceId: 'sha-roadmap:ROADMAP.md' }),
  ])
  assert.equal(withStatus.status, 'KNOWN')
  if (withStatus.status === 'KNOWN') {
    assert.equal(withStatus.source, 'PROJECT_STATUS')
    assert.equal(withStatus.at, '2026-09-29T00:00:00Z')
  }

  const withoutStatus = deriveStatusUpdatedAt([
    signal({ at: '2026-09-30T08:15:00Z', source: 'COMMIT', sourceId: 'commit-sha' }),
  ])
  assert.equal(withoutStatus.status, 'UNAVAILABLE', 'a commit does not update the operational status')
})

test('equal timestamps resolve deterministically regardless of evidence order', () => {
  const roadmap = signal({ at: '2026-09-30T00:00:00Z', source: 'ROADMAP', sourceId: 'sha-roadmap:ROADMAP.md' })
  const commit = signal({ at: '2026-09-30T00:00:00Z', source: 'COMMIT', sourceId: 'sha-commit' })

  const first = deriveLastMeaningfulActivity([roadmap, commit])
  const second = deriveLastMeaningfulActivity([commit, roadmap])

  assert.deepEqual(first, second)
  assert.equal(first.status === 'KNOWN' ? first.source : null, 'COMMIT')
})

// --- Snapshot time is never activity ---------------------------------------

test('snapshot generation time is never used as project activity', () => {
  const project = adaptGithubSource(snapshot({ artifacts: [] }))

  assert.deepEqual(project.activity.snapshotGeneratedAt, {
    at: GENERATED_AT,
    source: 'SNAPSHOT',
    sourceId: SNAPSHOT_SOURCE_ID,
  })
  assert.equal(project.activity.lastMeaningfulActivity.status, 'KNOWN')
  if (project.activity.lastMeaningfulActivity.status === 'KNOWN') {
    assert.equal(
      project.activity.lastMeaningfulActivity.at,
      '2026-09-30T08:15:00Z',
      'activity must come from the commit, not from the snapshot clock',
    )
    assert.equal(project.activity.lastMeaningfulActivity.source, 'COMMIT')
  }
  assert.equal(project.activity.statusUpdatedAt.status, 'UNAVAILABLE')

  const parsed = ProjectStateSchema.safeParse(project)
  assert.equal(parsed.success, true)
})

test('schema rejects an activity timestamp attributed to the snapshot generation', () => {
  const project = adaptGithubSource(snapshot({ artifacts: [STATUS_ARTIFACT] }))
  const forged = structuredClone(project) as ProjectState
  forged.activity.lastMeaningfulActivity = {
    status: 'KNOWN',
    at: GENERATED_AT,
    source: 'SNAPSHOT',
    sourceId: SNAPSHOT_SOURCE_ID,
    evidenceUrl: null,
  }

  assert.equal(ProjectStateSchema.safeParse(forged).success, false)
})

test('adapter records the canonical status artifact as both activity and status evidence', () => {
  const project = adaptGithubSource(snapshot({ artifacts: [STATUS_ARTIFACT] }))

  assert.equal(project.activity.statusUpdatedAt.status, 'KNOWN')
  if (project.activity.statusUpdatedAt.status === 'KNOWN') {
    assert.equal(project.activity.statusUpdatedAt.at, '2026-09-29T00:00:00Z')
    assert.equal(project.activity.statusUpdatedAt.source, 'PROJECT_STATUS')
    assert.equal(project.activity.statusUpdatedAt.sourceId, 'sha-status-001:PROJECT_STATUS.md')
    assert.equal(
      project.activity.statusUpdatedAt.evidenceUrl,
      'https://github.com/Murkin1980/fixture-project/blob/main/PROJECT_STATUS.md',
    )
  }

  // The later commit remains the newest meaningful activity.
  assert.equal(
    project.activity.lastMeaningfulActivity.status === 'KNOWN'
      ? project.activity.lastMeaningfulActivity.source
      : null,
    'COMMIT',
  )
})

test('a commit is activity evidence but does not update the operational status', () => {
  const project = adaptGithubSource(snapshot({ artifacts: [] }))

  assert.equal(project.triageState, null)
  assert.equal(project.triageSource.status, 'UNKNOWN')
  assert.equal(project.lastUpdated, '2026-09-30', 'freshness still falls back to the HEAD commit date')
  assert.equal(project.activity.statusUpdatedAt.status, 'UNAVAILABLE')
})
