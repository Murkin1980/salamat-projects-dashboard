import assert from 'node:assert/strict'
import { test } from 'node:test'
import {
  ArenaSessionSchema,
  ProjectStateSchema,
  type ArenaSession,
  type EvidenceLink,
  type ProjectState,
} from '../src/contract/project-state.js'
import { adaptGithubSource, type RepositorySnapshot } from '../src/adapters/github-source.js'
import {
  ARENA_SESSION_INACTIVITY_THRESHOLD_HOURS,
  deriveArenaSession,
  type ActivitySignal,
  type ArenaSessionEvidence,
} from '../src/monitoring/derived-state.js'

/**
 * Normalized Arena execution-session contract.
 *
 * The dashboard observes session state only. It never starts, continues, retries
 * or closes a session, and it never derives closure from a merge, a commit, a
 * validation result or a project-status update.
 */

const NOW = new Date('2026-10-01T12:00:00Z')
const GENERATED_AT = '2026-10-01T12:00:00Z'
const SNAPSHOT_SOURCE_ID = 'config/projects.github.json'

const STATUS_REF: EvidenceLink = {
  label: 'PROJECT_STATUS.md',
  url: 'https://github.com/Murkin1980/fixture-project/blob/main/PROJECT_STATUS.md',
  sourceId: 'sha-status-001:PROJECT_STATUS.md',
}

function signal(overrides: Partial<ActivitySignal> & { at: string }): ActivitySignal {
  return { source: 'COMMIT', sourceId: `sha-commit-${overrides.at}`, evidenceUrl: null, ...overrides }
}

function evidence(overrides: Partial<ArenaSessionEvidence> = {}): ArenaSessionEvidence {
  return {
    checkpoint: 'CP-14 — Fixture Checkpoint',
    declaredSessionState: null,
    sessionStartedAt: null,
    sessionLastActivityAt: null,
    closureStatus: null,
    closureEvidence: null,
    checkpointWorkState: null,
    checkpointStatusLabel: null,
    projectActivity: null,
    evidence: [STATUS_REF],
    unavailableReason: 'No Arena session evidence found in PROJECT_STATUS.md',
    ...overrides,
  }
}

function statusArtifact(content: string) {
  return {
    path: 'PROJECT_STATUS.md',
    ref: 'main',
    sha: 'sha-status-001',
    htmlUrl: 'https://github.com/Murkin1980/fixture-project/blob/main/PROJECT_STATUS.md',
    content,
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

/** A minimal full project so the cross-field session rules can be validated. */
function projectWithSession(session: ArenaSession): ProjectState {
  return {
    schemaVersion: '1.2.0',
    id: 'fixture-project',
    name: 'Fixture Project',
    summary: 'Fixture summary.',
    repo: 'Murkin1980/fixture-project',
    triageState: 'IN_PROGRESS',
    triageSource: { status: 'KNOWN', sourceId: 'sha-status-001:PROJECT_STATUS.md' },
    stage: null,
    checkpoint: 'CP-14 — Fixture Checkpoint',
    progress: null,
    lastUpdated: '2026-09-30',
    activity: {
      lastMeaningfulActivity: {
        status: 'KNOWN',
        at: '2026-09-30T08:15:00Z',
        source: 'COMMIT',
        sourceId: 'aaaa1111bbbb2222cccc3333dddd4444eeee5555',
        evidenceUrl: null,
      },
      statusUpdatedAt: { status: 'UNAVAILABLE', reason: 'fixture' },
      snapshotGeneratedAt: { at: GENERATED_AT, source: 'SNAPSHOT', sourceId: SNAPSHOT_SOURCE_ID },
    },
    session,
    history: { status: 'UNAVAILABLE', reason: 'fixture' },
    blocker: null,
    nextAction: null,
    evidenceLinks: [STATUS_REF],
    dependencies: [],
    tools: [],
    approvals: [],
    source: { kind: 'REPOSITORY', id: 'Murkin1980/fixture-project' },
    staleAfterDays: 7,
  }
}

const SESSION_STATUS_BLOCK = `# PROJECT STATUS

Current checkpoint: \`CP-14 — Fixture Checkpoint\`
Status: \`%STATUS%\`

## Arena Session
Session state: \`%SESSION%\`
Session checkpoint: \`CP-14 — Fixture Checkpoint\`
Session started: 2026-09-30T06:00:00Z
Last session activity: %ACTIVITY%
Session closure: \`%CLOSURE%\`

Last updated: 2026-09-30
`

function sessionArtifact(options: {
  status?: string
  session: string
  closure: string
  activity: string
}): string {
  return SESSION_STATUS_BLOCK
    .replace('%STATUS%', options.status ?? 'IN_PROGRESS')
    .replace('%SESSION%', options.session)
    .replace('%ACTIVITY%', options.activity)
    .replace('%CLOSURE%', options.closure)
}

// --- The seven canonical states --------------------------------------------

test('NOT_ACTIVE: explicit evidence that no Arena session is running', () => {
  const derived = deriveArenaSession(
    evidence({ declaredSessionState: 'NOT_ACTIVE' }),
    { now: NOW },
  )

  assert.equal(derived.sessionState, 'NOT_ACTIVE')
  assert.equal(derived.sessionClosureStatus, 'UNKNOWN')
  assert.equal(ArenaSessionSchema.safeParse(derived).success, true)
})

test('ACTIVE: an evidenced session is still working on the checkpoint', () => {
  const derived = deriveArenaSession(
    evidence({
      declaredSessionState: 'ACTIVE',
      sessionLastActivityAt: signal({ at: '2026-10-01T11:00:00Z', source: 'PROJECT_STATUS', sourceId: STATUS_REF.sourceId, evidenceUrl: STATUS_REF.url }),
      checkpointWorkState: 'IN_PROGRESS',
      checkpointStatusLabel: 'IN_PROGRESS',
    }),
    { now: NOW },
  )

  assert.equal(derived.sessionState, 'ACTIVE')
  assert.equal(derived.sessionClosureStatus, 'NOT_CONFIRMED')
  assert.equal(ArenaSessionSchema.safeParse(derived).success, true)
})

test('WAITING_FOR_VALIDATION: implementation finished, validation still pending', () => {
  const derived = deriveArenaSession(
    evidence({
      declaredSessionState: 'ACTIVE',
      sessionLastActivityAt: signal({ at: '2026-10-01T11:30:00Z', source: 'PROJECT_STATUS', sourceId: STATUS_REF.sourceId }),
      checkpointWorkState: 'VALIDATING',
      checkpointStatusLabel: 'VALIDATION',
    }),
    { now: NOW },
  )

  assert.equal(derived.sessionState, 'WAITING_FOR_VALIDATION')
  assert.equal(derived.sessionClosureStatus, 'NOT_CONFIRMED')
  assert.ok(derived.sessionStateReason.includes('validation'))
  assert.equal(ArenaSessionSchema.safeParse(derived).success, true)
})

test('READY_TO_CLOSE: merged checkpoint work without explicit closure evidence', () => {
  const derived = deriveArenaSession(
    evidence({
      declaredSessionState: 'ACTIVE',
      sessionLastActivityAt: signal({ at: '2026-10-01T10:00:00Z', source: 'PROJECT_STATUS', sourceId: STATUS_REF.sourceId }),
      checkpointWorkState: 'COMPLETE',
      checkpointStatusLabel: 'PASS',
    }),
    { now: NOW },
  )

  assert.equal(derived.sessionState, 'READY_TO_CLOSE')
  assert.equal(derived.sessionClosureStatus, 'NOT_CONFIRMED')
  assert.equal(derived.sessionClosureEvidence, null)
  assert.ok(derived.sessionStateReason.includes('PASS'), 'the deciding status label must stay traceable')
  assert.equal(ArenaSessionSchema.safeParse(derived).success, true)
})

test('READY_TO_CLOSE end-to-end: PROJECT_STATUS.md documents merged work and no session closure', () => {
  const project = adaptGithubSource(snapshot({
    artifacts: [statusArtifact(sessionArtifact({
      status: 'PASS',
      session: 'ACTIVE',
      closure: 'NOT_CONFIRMED',
      activity: '2026-10-01T09:30:00Z',
    }))],
  }))

  assert.equal(project.triageState, 'DONE')
  assert.equal(project.session.sessionState, 'READY_TO_CLOSE')
  assert.equal(project.session.sessionCheckpoint, 'CP-14 — Fixture Checkpoint')
  assert.equal(project.session.sessionClosureStatus, 'NOT_CONFIRMED')
  assert.equal(project.session.sessionClosureEvidence, null)
  assert.equal(project.session.sessionLastActivityAt.status, 'KNOWN')
  if (project.session.sessionLastActivityAt.status === 'KNOWN') {
    assert.equal(project.session.sessionLastActivityAt.at, '2026-10-01T09:30:00Z')
    assert.equal(project.session.sessionLastActivityAt.source, 'PROJECT_STATUS')
  }
  assert.deepEqual(project.session.sessionStateEvidence, [STATUS_REF])
  assert.equal(ProjectStateSchema.safeParse(project).success, true)
})

test('CLOSED: only explicit closure evidence closes an Arena session', () => {
  const closureEvidence: EvidenceLink = {
    label: 'PROJECT_STATUS.md (session closure)',
    url: 'https://github.com/Murkin1980/fixture-project/pull/14',
    sourceId: 'sha-status-001:PROJECT_STATUS.md',
  }
  const derived = deriveArenaSession(
    evidence({
      declaredSessionState: 'CLOSED',
      sessionLastActivityAt: signal({ at: '2026-10-01T11:00:00Z', source: 'PROJECT_STATUS', sourceId: STATUS_REF.sourceId }),
      closureStatus: 'CONFIRMED',
      closureEvidence,
      checkpointWorkState: 'COMPLETE',
      checkpointStatusLabel: 'PASS',
    }),
    { now: NOW },
  )

  assert.equal(derived.sessionState, 'CLOSED')
  assert.equal(derived.sessionClosureStatus, 'CONFIRMED')
  assert.deepEqual(derived.sessionClosureEvidence, closureEvidence)
  assert.equal(projectWithSession(derived).session.sessionState, 'CLOSED')
  assert.equal(ProjectStateSchema.safeParse(projectWithSession(derived)).success, true)
})

test('CLOSED end-to-end: a canonical session closure declared in PROJECT_STATUS.md', () => {
  const project = adaptGithubSource(snapshot({
    artifacts: [statusArtifact(sessionArtifact({
      status: 'PASS',
      session: 'CLOSED',
      closure: 'CONFIRMED',
      activity: '2026-10-01T09:30:00Z',
    }).replace(
      'Session closure: `CONFIRMED`',
      'Session closure: `CONFIRMED`\nSession closure evidence: https://github.com/Murkin1980/fixture-project/pull/14',
    ))],
  }))

  assert.equal(project.session.sessionState, 'CLOSED')
  assert.equal(project.session.sessionClosureStatus, 'CONFIRMED')
  assert.equal(
    project.session.sessionClosureEvidence?.url,
    'https://github.com/Murkin1980/fixture-project/pull/14',
  )
  assert.equal(ProjectStateSchema.safeParse(project).success, true)
})

test('STALE_SESSION: an open session with no activity beyond the inactivity threshold', () => {
  const staleActivity = signal({ at: '2026-09-29T12:00:00Z', source: 'COMMIT', sourceId: 'sha-commit-old' })
  const derived = deriveArenaSession(
    evidence({
      declaredSessionState: 'ACTIVE',
      checkpointWorkState: 'IN_PROGRESS',
      projectActivity: staleActivity,
    }),
    { now: NOW },
  )

  assert.equal(derived.sessionState, 'STALE_SESSION')
  assert.equal(derived.sessionClosureStatus, 'NOT_CONFIRMED')
  assert.ok(derived.sessionStateReason.includes(`${ARENA_SESSION_INACTIVITY_THRESHOLD_HOURS}h inactivity threshold`))
  assert.equal(ArenaSessionSchema.safeParse(derived).success, true)
  assert.equal(ProjectStateSchema.safeParse(projectWithSession(derived)).success, true)
})

test('STALE_SESSION end-to-end: an open session left behind older than the threshold', () => {
  const project = adaptGithubSource(snapshot({
    headCommittedAt: '2026-09-28T07:00:00Z',
    artifacts: [statusArtifact(sessionArtifact({
      status: 'IN_PROGRESS',
      session: 'ACTIVE',
      closure: 'NOT_CONFIRMED',
      activity: '2026-09-28T07:00:00Z',
    }))],
  }))

  assert.equal(project.session.sessionState, 'STALE_SESSION')
  assert.equal(ProjectStateSchema.safeParse(project).success, true)
})

test('staleness threshold boundary is deterministic and exclusive below the threshold', () => {
  const justUnder = new Date(Date.parse(NOW.toISOString()) - (ARENA_SESSION_INACTIVITY_THRESHOLD_HOURS * 3_600_000 - 60_000))
  const exactlyAt = new Date(Date.parse(NOW.toISOString()) - ARENA_SESSION_INACTIVITY_THRESHOLD_HOURS * 3_600_000)

  const fresh = deriveArenaSession(
    evidence({
      declaredSessionState: 'ACTIVE',
      checkpointWorkState: 'IN_PROGRESS',
      sessionLastActivityAt: signal({ at: justUnder.toISOString().replace(/\.\d{3}Z$/, 'Z'), source: 'PROJECT_STATUS', sourceId: STATUS_REF.sourceId }),
    }),
    { now: NOW },
  )
  assert.equal(fresh.sessionState, 'ACTIVE')

  const stale = deriveArenaSession(
    evidence({
      declaredSessionState: 'ACTIVE',
      checkpointWorkState: 'IN_PROGRESS',
      sessionLastActivityAt: signal({ at: exactlyAt.toISOString().replace(/\.\d{3}Z$/, 'Z'), source: 'PROJECT_STATUS', sourceId: STATUS_REF.sourceId }),
    }),
    { now: NOW },
  )
  assert.equal(stale.sessionState, 'STALE_SESSION')
})

test('UNKNOWN: insufficient evidence is never resolved into a session state', () => {
  const derived = deriveArenaSession(
    evidence({ unavailableReason: 'No Arena session evidence found in PROJECT_STATUS.md' }),
    { now: NOW },
  )

  assert.equal(derived.sessionState, 'UNKNOWN')
  assert.equal(derived.sessionClosureStatus, 'UNKNOWN')
  assert.equal(derived.sessionStateReason, 'No Arena session evidence found in PROJECT_STATUS.md')
  assert.deepEqual(derived.sessionStateEvidence, [STATUS_REF])
  assert.equal(ArenaSessionSchema.safeParse(derived).success, true)
})

test('UNKNOWN: project activity alone is never session activity', () => {
  const derived = deriveArenaSession(
    evidence({ projectActivity: signal({ at: '2026-10-01T11:00:00Z' }) }),
    { now: NOW },
  )

  assert.equal(derived.sessionState, 'UNKNOWN')
  assert.equal(
    derived.sessionLastActivityAt.status,
    'UNAVAILABLE',
    'without session evidence a commit cannot become session activity',
  )
  assert.equal(ArenaSessionSchema.safeParse(derived).success, true)
})

test('UNKNOWN: a session is evidenced but no activity timestamp can be attributed', () => {
  const derived = deriveArenaSession(
    evidence({ declaredSessionState: 'ACTIVE', checkpointWorkState: 'IN_PROGRESS' }),
    { now: NOW },
  )

  assert.equal(derived.sessionState, 'UNKNOWN')
  assert.equal(derived.sessionLastActivityAt.status, 'UNAVAILABLE')
  assert.equal(ArenaSessionSchema.safeParse(derived).success, true)
})

// --- The three forbidden closure inferences --------------------------------

test('merge != CLOSED: merged checkpoint evidence with no session evidence is UNKNOWN', () => {
  const project = adaptGithubSource(snapshot({
    artifacts: [statusArtifact(`# PROJECT STATUS

Current checkpoint: \`CP-14 — Fixture Checkpoint\`
Status: \`PASS\`

## Evidence
- pull request #14 merged into main;
- checkpoint results verified.

Last updated: 2026-09-30
`)],
  }))

  assert.equal(project.triageState, 'DONE')
  assert.equal(project.activity.statusUpdatedAt.status, 'KNOWN')
  assert.notEqual(project.session.sessionState, 'CLOSED')
  assert.equal(project.session.sessionState, 'UNKNOWN')
  assert.equal(project.session.sessionClosureStatus, 'UNKNOWN')
})

test('commit != CLOSED: fresh commit activity without session evidence is UNKNOWN', () => {
  const project = adaptGithubSource(snapshot({ artifacts: [] }))

  assert.equal(project.activity.lastMeaningfulActivity.status, 'KNOWN')
  assert.notEqual(project.session.sessionState, 'CLOSED')
  assert.equal(project.session.sessionState, 'UNKNOWN')
  assert.equal(
    project.session.sessionLastActivityAt.status,
    'UNAVAILABLE',
    'a commit is project activity, not Arena session activity',
  )
})

test('PROJECT_STATUS update != CLOSED: a refreshed status artifact is not closure', () => {
  const project = adaptGithubSource(snapshot({
    artifacts: [statusArtifact(`# PROJECT STATUS

Current checkpoint: \`CP-14 — Fixture Checkpoint\`
Status: \`VALIDATION\`

Last updated: 2026-10-01
`)],
  }))

  assert.equal(project.activity.statusUpdatedAt.status, 'KNOWN')
  assert.notEqual(project.session.sessionState, 'CLOSED')
  assert.equal(project.session.sessionState, 'UNKNOWN')
})

test('a declared session closure without closure evidence is not CLOSED', () => {
  const derived = deriveArenaSession(
    evidence({
      declaredSessionState: 'CLOSED',
      closureStatus: null,
      closureEvidence: null,
      checkpointWorkState: 'COMPLETE',
      checkpointStatusLabel: 'PASS',
      sessionLastActivityAt: signal({ at: '2026-10-01T10:00:00Z', source: 'PROJECT_STATUS', sourceId: STATUS_REF.sourceId }),
    }),
    { now: NOW },
  )

  assert.equal(derived.sessionState, 'READY_TO_CLOSE')
  assert.equal(derived.sessionClosureStatus, 'NOT_CONFIRMED')
  assert.equal(ArenaSessionSchema.safeParse(derived).success, true)
})

test('an unrecognized session declaration is reported, never guessed', () => {
  const project = adaptGithubSource(snapshot({
    artifacts: [statusArtifact(`# PROJECT STATUS

Current checkpoint: \`CP-14 — Fixture Checkpoint\`
Status: \`IN_PROGRESS\`

## Arena Session
Session state: \`RUNNING\`

Last updated: 2026-09-30
`)],
  }))

  assert.equal(project.session.sessionState, 'UNKNOWN')
  assert.ok(project.session.sessionStateReason.includes('RUNNING'))
})

test('closure declarations tolerate trailing notes, and a bare link is not closure', () => {
  const withNote = adaptGithubSource(snapshot({
    artifacts: [statusArtifact(`# PROJECT STATUS

Current checkpoint: \`CP-14 — Fixture Checkpoint\`
Status: \`PASS\`

## Arena Session
Session state: \`CLOSED\`
Session closure: \`CONFIRMED\` — PR #14 merged
Session closure evidence: https://github.com/Murkin1980/fixture-project/pull/14

Last updated: 2026-10-01
`)],
  }))
  assert.equal(withNote.session.sessionState, 'CLOSED')
  assert.equal(withNote.session.sessionClosureStatus, 'CONFIRMED')

  const linkOnly = adaptGithubSource(snapshot({
    artifacts: [statusArtifact(`# PROJECT STATUS

Current checkpoint: \`CP-14 — Fixture Checkpoint\`
Status: \`IN_PROGRESS\`

## Arena Session
Session state: \`ACTIVE\`
Last session activity: 2026-10-01T09:30:00Z
Session closure evidence: https://github.com/Murkin1980/fixture-project/pull/14

Last updated: 2026-10-01
`)],
  }))
  assert.equal(linkOnly.session.sessionState, 'ACTIVE')
  assert.equal(linkOnly.session.sessionClosureStatus, 'NOT_CONFIRMED')
  assert.equal(
    linkOnly.session.sessionClosureEvidence,
    null,
    'a closure link without a confirmed closure declaration is not closure evidence',
  )
})

// --- Contract enforcement ---------------------------------------------------

test('the session contract rejects closure that is not evidenced', () => {
  const derived = deriveArenaSession(
    evidence({
      declaredSessionState: 'ACTIVE',
      checkpointWorkState: 'COMPLETE',
      checkpointStatusLabel: 'PASS',
      sessionLastActivityAt: signal({ at: '2026-10-01T10:00:00Z', source: 'PROJECT_STATUS', sourceId: STATUS_REF.sourceId }),
    }),
    { now: NOW },
  )

  const forged = structuredClone(derived)
  forged.sessionState = 'CLOSED'
  assert.equal(ArenaSessionSchema.safeParse(forged).success, false, 'CLOSED without closure evidence must fail')
  assert.equal(ProjectStateSchema.safeParse(projectWithSession(forged)).success, false)

  const openWithClosure = structuredClone(derived)
  openWithClosure.sessionClosureStatus = 'CONFIRMED'
  assert.equal(
    ArenaSessionSchema.safeParse(openWithClosure).success,
    false,
    'an open session state cannot claim confirmed closure',
  )
  assert.equal(ProjectStateSchema.safeParse(projectWithSession(openWithClosure)).success, false)
})

test('the session contract rejects an open state without attributable activity', () => {
  const forged: ArenaSession = {
    ...deriveArenaSession(evidence({ declaredSessionState: 'NOT_ACTIVE' }), { now: NOW }),
    sessionState: 'ACTIVE',
    sessionClosureStatus: 'NOT_CONFIRMED',
    sessionLastActivityAt: { status: 'UNAVAILABLE', reason: 'nothing attributable' },
  }

  assert.equal(ProjectStateSchema.safeParse(projectWithSession(forged)).success, false)
})

test('the session contract rejects a determined state without evidence and snapshot-sourced session timestamps', () => {
  const derived = deriveArenaSession(
    evidence({
      declaredSessionState: 'ACTIVE',
      checkpointWorkState: 'IN_PROGRESS',
      sessionLastActivityAt: signal({ at: '2026-10-01T11:00:00Z', source: 'PROJECT_STATUS', sourceId: STATUS_REF.sourceId }),
    }),
    { now: NOW },
  )

  const withoutEvidence = structuredClone(derived)
  withoutEvidence.sessionStateEvidence = []
  assert.equal(ProjectStateSchema.safeParse(projectWithSession(withoutEvidence)).success, false)

  const snapshotSourced = structuredClone(derived)
  snapshotSourced.sessionLastActivityAt = {
    status: 'KNOWN',
    at: GENERATED_AT,
    source: 'SNAPSHOT',
    sourceId: SNAPSHOT_SOURCE_ID,
    evidenceUrl: null,
  }
  assert.equal(ProjectStateSchema.safeParse(projectWithSession(snapshotSourced)).success, false)
})

test('the dashboard exposes no session-control surface for these states', async () => {
  const module = await import('../src/monitoring/derived-state.js')
  const exported = Object.keys(module)
  for (const forbidden of ['startArena', 'stopArena', 'closeSession', 'continueSession', 'retryCheckpoint']) {
    assert.ok(!exported.includes(forbidden), `${forbidden} must not exist in the monitoring contract`)
  }
})
