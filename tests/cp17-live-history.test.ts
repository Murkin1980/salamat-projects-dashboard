import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'
import { fileURLToPath } from 'node:url'
import jsdom from 'jsdom'
import { adaptGithubSource, type RepositorySnapshot } from '../src/adapters/github-source.js'
import {
  ProjectHistorySchema,
  ProjectStateSchema,
  compareHistoryEvents,
  historyEventCategory,
  parseProjectRegistry,
  type HistoryEvent,
  type ProjectHistory,
  type ProjectState,
} from '../src/contract/project-state.js'
import { ARENA_SESSION_INACTIVITY_THRESHOLD_HOURS } from '../src/monitoring/derived-state.js'
import {
  HISTORY_LIMITS,
  buildRepositoryHistory,
  type RepositoryHistoryEvidence,
  type StatusRevisionEvidence,
} from '../src/monitoring/history-derivation.js'
import {
  HISTORY_EVENT_CATEGORIES,
  defaultReportProject,
  filterHistoryEvents,
  getHistoryEvents,
  summarizeHistory,
} from '../src/monitoring/history-view.js'
import { orderByRecentActivity } from '../src/monitoring/portfolio-ordering.js'
import { parseHashRoute, reportHash, viewHash } from '../src/routing/hash-route.js'

/**
 * CP-17 — Live History & Reports.
 *
 * Covers the normalized history/event contract, the pure derivation from GitHub
 * and canonical-status evidence (ordering, provenance, no invented events,
 * UNKNOWN / UNAVAILABLE), the committed snapshot for all portfolio projects, and
 * the rendered History & Reports view and Project Detail history panel at
 * desktop (1440px) and mobile (390px), including the monitoring-only boundary.
 */

// --- Fixtures ----------------------------------------------------------------

const REPO = 'Murkin1980/fixture-project'
const GENERATED_AT = '2026-10-01T12:00:00Z'
const STATUS_URL = `https://github.com/${REPO}/blob/main/PROJECT_STATUS.md`
const sha = (n: number) => n.toString(16).padStart(40, '0')
const commitUrl = (value: string) => `https://github.com/${REPO}/commit/${value}`

function evidence(overrides: Partial<RepositoryHistoryEvidence> = {}): RepositoryHistoryEvidence {
  return { repo: REPO, commits: [], pullRequests: [], statusRevisions: [], ...overrides }
}

function revision(n: number, committedAt: string, labels: StatusRevisionEvidence['labels']): StatusRevisionEvidence {
  return { sha: sha(n), committedAt, url: commitUrl(sha(n)), labels }
}

const UNKNOWN_SESSION: ProjectState['session'] = {
  sessionState: 'UNKNOWN',
  sessionCheckpoint: null,
  sessionStartedAt: { status: 'UNAVAILABLE', reason: 'none' },
  sessionLastActivityAt: { status: 'UNAVAILABLE', reason: 'none' },
  sessionClosureStatus: 'UNKNOWN',
  sessionClosureEvidence: null,
  sessionStateEvidence: [],
  sessionStateReason: 'No Arena session evidence found in PROJECT_STATUS.md',
}

function known(history: ProjectHistory) {
  assert.equal(history.status, 'KNOWN')
  if (history.status !== 'KNOWN') throw new Error('history must be KNOWN')
  return history
}

/** Canonical status artifact, optionally carrying an Arena Session block. */
function statusContent(options: {
  status?: string
  checkpoint?: string
  session?: string
  started?: string
  activity?: string
  closure?: string
  closureUrl?: string
} = {}): string {
  const lines = [
    '# PROJECT STATUS',
    '',
    `Current checkpoint: \`${options.checkpoint ?? 'CP-17 — Fixture'}\``,
    `Status: \`${options.status ?? 'IN_PROGRESS'}\``,
    '',
  ]
  if (options.session) {
    lines.push('## Arena Session', `Session state: \`${options.session}\``)
    if (options.started) lines.push(`Session started: ${options.started}`)
    if (options.activity) lines.push(`Last session activity: ${options.activity}`)
    if (options.closure) lines.push(`Session closure: \`${options.closure}\``)
    if (options.closureUrl) lines.push(`Session closure evidence: ${options.closureUrl}`)
    lines.push('')
  }
  lines.push('Last updated: 2026-09-30', '')
  return lines.join('\n')
}

function adapt(content: string, historyEvidence?: RepositoryHistoryEvidence): ProjectState {
  const snapshot: RepositorySnapshot = {
    projectId: 'fixture-project',
    name: 'Fixture Project',
    summary: 'Fixture summary.',
    repo: REPO,
    defaultBranch: 'main',
    headSha: sha(1),
    headCommittedAt: '2026-09-30T08:15:00Z',
    retrievedAt: '2026-10-01',
    generatedAt: GENERATED_AT,
    snapshotSourceId: 'config/projects.github.json',
    artifacts: [{ path: 'PROJECT_STATUS.md', ref: 'main', sha: 'sha-status-001', htmlUrl: STATUS_URL, content }],
    historyEvidence,
  }
  return adaptGithubSource(snapshot)
}

// --- Contract ----------------------------------------------------------------

function sampleEvent(overrides: Partial<HistoryEvent> = {}): HistoryEvent {
  return {
    id: `COMMIT:${sha(1)}`,
    type: 'COMMIT',
    occurredAt: '2026-09-30T08:15:00Z',
    timeBasis: 'EVENT',
    summary: 'feat: example',
    from: null,
    to: null,
    source: 'COMMIT',
    sourceId: sha(1),
    evidenceUrl: commitUrl(sha(1)),
    ...overrides,
  }
}

function sampleHistory(events: HistoryEvent[]): unknown {
  return { status: 'KNOWN', limits: { ...HISTORY_LIMITS }, events, gaps: [] }
}

test('history contract: a valid history parses and every project state requires one', () => {
  assert.equal(ProjectHistorySchema.safeParse(sampleHistory([sampleEvent()])).success, true)
  assert.equal(ProjectHistorySchema.safeParse({ status: 'UNAVAILABLE', reason: 'not collected' }).success, true)
  assert.equal(ProjectHistorySchema.safeParse({ status: 'UNAVAILABLE' }).success, false, 'an unavailable history must state its reason')

  const project = adapt(statusContent(), evidence({ commits: [{ sha: sha(1), committedAt: '2026-09-30T08:15:00Z', message: 'x', url: commitUrl(sha(1)) }] }))
  assert.equal(ProjectStateSchema.safeParse(project).success, true)
  const { history: _history, ...withoutHistory } = project
  assert.equal(ProjectStateSchema.safeParse(withoutHistory).success, false, 'history is a required, explicit field')
})

test('history contract: provenance is mandatory and consistent with the event type', () => {
  const parse = (event: Partial<HistoryEvent>) => ProjectHistorySchema.safeParse(sampleHistory([sampleEvent(event)])).success
  assert.equal(parse({ evidenceUrl: 'not-a-url' }), false, 'an event needs a real evidence URL')
  assert.equal(parse({ sourceId: '' , id: 'COMMIT:'}), false, 'an event needs a source id')
  assert.equal(parse({ source: 'PULL_REQUEST' }), false, 'a commit event cannot claim pull request provenance')
  assert.equal(parse({ id: 'something-else' }), false, 'the event id is derived from type and source id')
  assert.equal(parse({ occurredAt: '2026-09-30' }), false, 'timestamps are second-precision UTC')
})

test('history contract: transitions must change a value, and only status events carry from/to', () => {
  const transition = (overrides: Partial<HistoryEvent>) => sampleEvent({
    type: 'CHECKPOINT_MOVED', id: `CHECKPOINT_MOVED:${sha(2)}`, sourceId: sha(2), source: 'PROJECT_STATUS',
    from: 'CP-16', to: 'CP-17', ...overrides,
  })
  const parse = (event: HistoryEvent) => ProjectHistorySchema.safeParse(sampleHistory([event])).success
  assert.equal(parse(transition({})), true)
  assert.equal(parse(transition({ to: 'CP-16' })), false, 'no-change transition')
  assert.equal(parse(transition({ from: null })), false, 'checkpoint transition needs both values')
  assert.equal(parse(sampleEvent({ from: 'a', to: 'b' })), false, 'a commit is not a transition')
})

test('history contract: session events never use the snapshot clock or a commit as provenance', () => {
  const session = (overrides: Partial<HistoryEvent>) => sampleEvent({
    type: 'SESSION_STALE', id: `SESSION_STALE:s`, sourceId: 's', source: 'PROJECT_STATUS',
    timeBasis: 'INACTIVITY_THRESHOLD', ...overrides,
  })
  const parse = (event: HistoryEvent) => ProjectHistorySchema.safeParse(sampleHistory([event])).success
  assert.equal(parse(session({})), true)
  assert.equal(parse(session({ source: 'COMMIT' })), false, 'a commit is not session evidence')
  assert.equal(parse(session({ timeBasis: 'EVENT' })), false, 'stale detection must declare its threshold basis')
  assert.equal(parse(sampleEvent({ timeBasis: 'INACTIVITY_THRESHOLD' })), false, 'only stale detection uses the threshold basis')
  assert.equal(
    ProjectHistorySchema.safeParse(sampleHistory([session({ source: 'SNAPSHOT' as never })])).success,
    false,
    'the snapshot is not an event source',
  )
})

test('history contract: ordering is newest-first and duplicates are rejected', () => {
  const older = sampleEvent({ id: `COMMIT:${sha(2)}`, sourceId: sha(2), occurredAt: '2026-09-29T08:00:00Z', evidenceUrl: commitUrl(sha(2)) })
  const newer = sampleEvent()
  assert.equal(ProjectHistorySchema.safeParse(sampleHistory([newer, older])).success, true)
  assert.equal(ProjectHistorySchema.safeParse(sampleHistory([older, newer])).success, false, 'oldest-first input is rejected')
  assert.equal(ProjectHistorySchema.safeParse(sampleHistory([newer, newer])).success, false, 'duplicate event ids are rejected')
})

// --- Derivation: actual history, ordering, provenance -------------------------

const RICH_EVIDENCE = evidence({
  commits: [
    { sha: sha(10), committedAt: '2026-09-30T10:00:00Z', message: 'feat: newest\n\nlong body', url: commitUrl(sha(10)) },
    { sha: sha(11), committedAt: '2026-09-29T10:00:00Z', message: 'fix: older', url: commitUrl(sha(11)) },
    { sha: sha(12), committedAt: '2026-09-29T10:00:00Z', message: 'chore: same-second sibling', url: commitUrl(sha(12)) },
    { sha: sha(13), committedAt: '2026-09-28T10:00:00Z', message: 'Merge pull request #5', url: commitUrl(sha(13)) },
  ],
  pullRequests: [
    { number: 5, title: 'Merged work', url: `https://github.com/${REPO}/pull/5`, createdAt: '2026-09-28T08:00:00Z', mergedAt: '2026-09-28T10:00:00Z', closedAt: '2026-09-28T10:00:00Z', mergeCommitSha: sha(13) },
    { number: 6, title: 'Abandoned work', url: `https://github.com/${REPO}/pull/6`, createdAt: '2026-09-27T08:00:00Z', mergedAt: null, closedAt: '2026-09-27T12:00:00Z', mergeCommitSha: null },
    { number: 7, title: 'Still open', url: `https://github.com/${REPO}/pull/7`, createdAt: '2026-09-30T09:00:00Z', mergedAt: null, closedAt: null, mergeCommitSha: null },
  ],
  statusRevisions: [
    revision(20, '2026-09-30T09:30:00Z', { checkpoint: 'CP-17 — Fixture', status: 'IN_PROGRESS', blocker: null }),
    revision(21, '2026-09-26T09:30:00Z', { checkpoint: 'CP-16 — Fixture', status: 'PASS', blocker: 'Waiting for credentials' }),
    revision(22, '2026-09-25T09:30:00Z', { checkpoint: 'CP-16 — Fixture', status: 'VALIDATION', blocker: null }),
  ],
})

test('live history reflects commits, PR lifecycle and status transitions from evidence', () => {
  const history = known(buildRepositoryHistory(RICH_EVIDENCE, UNKNOWN_SESSION))
  const byType = (type: string) => history.events.filter((event) => event.type === type)

  assert.equal(byType('COMMIT').length, 3, 'the merge commit is represented once, by its pull request')
  assert.equal(byType('PULL_REQUEST_OPENED').length, 3)
  assert.equal(byType('PULL_REQUEST_MERGED').length, 1)
  assert.equal(byType('PULL_REQUEST_CLOSED').length, 1, 'only the abandoned PR is closed without merge')
  assert.equal(byType('PULL_REQUEST_CLOSED')[0].sourceId, `${REPO}#6`)
  assert.ok(!history.events.some((event) => event.type === 'PULL_REQUEST_MERGED' && event.sourceId === `${REPO}#7`), 'an open PR is never reported merged')

  const [checkpoint] = byType('CHECKPOINT_MOVED')
  assert.deepEqual([checkpoint.from, checkpoint.to, checkpoint.sourceId, checkpoint.occurredAt], ['CP-16 — Fixture', 'CP-17 — Fixture', sha(20), '2026-09-30T09:30:00Z'])
  const states = byType('STATE_CHANGED')
  assert.deepEqual(states.map((event) => [event.from, event.to, event.sourceId]), [
    ['PASS', 'IN_PROGRESS', sha(20)],
    ['VALIDATION', 'PASS', sha(21)],
  ])
  const blockers = byType('BLOCKER_CHANGED')
  assert.deepEqual(blockers.map((event) => [event.from, event.to, event.summary]), [
    ['Waiting for credentials', null, 'Blocker cleared'],
    [null, 'Waiting for credentials', 'Blocker recorded'],
  ])
  assert.deepEqual(history.limits, HISTORY_LIMITS)
  assert.equal(ProjectHistorySchema.safeParse(history).success, true)
})

test('live history ordering is deterministic and independent of input order', () => {
  const reversed = evidence({
    commits: [...RICH_EVIDENCE.commits].reverse(),
    pullRequests: [...RICH_EVIDENCE.pullRequests].reverse(),
    statusRevisions: [...(RICH_EVIDENCE.statusRevisions ?? [])].reverse(),
  })
  const forward = buildRepositoryHistory(RICH_EVIDENCE, UNKNOWN_SESSION)
  const backward = buildRepositoryHistory(reversed, UNKNOWN_SESSION)
  assert.deepEqual(forward, backward, 'the same evidence always yields the same history')
  assert.deepEqual(buildRepositoryHistory(RICH_EVIDENCE, UNKNOWN_SESSION), forward, 'and is repeatable')

  const events = known(forward).events
  for (let index = 1; index < events.length; index += 1) {
    assert.ok(compareHistoryEvents(events[index - 1], events[index]) < 0, 'strictly ordered newest first with tie-breaks')
  }
  // Two commits in the same second keep a stable, id-based order.
  const siblings = events.filter((event) => event.occurredAt === '2026-09-29T10:00:00Z')
  assert.deepEqual(siblings.map((event) => event.sourceId), [sha(11), sha(12)])
})

test('every event keeps source, sourceId, timestamp and a concrete evidence reference', () => {
  const history = known(buildRepositoryHistory(RICH_EVIDENCE, UNKNOWN_SESSION))
  assert.ok(history.events.length > 0)
  for (const event of history.events) {
    assert.ok(event.source && event.sourceId, `${event.id} must name its source`)
    assert.match(event.occurredAt, /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}Z$/)
    assert.ok(event.evidenceUrl.startsWith('https://github.com/'), `${event.id} must link to GitHub evidence`)
    assert.equal(event.id, `${event.type}:${event.sourceId}`)
  }
  const commit = history.events.find((event) => event.type === 'COMMIT' && event.sourceId === sha(10))!
  assert.equal(commit.summary, 'feat: newest', 'only the first commit-message line is kept')
  assert.equal(commit.evidenceUrl, commitUrl(sha(10)))
})

// --- Derivation: no invented events, UNKNOWN / UNAVAILABLE --------------------

test('no evidence yields no events — nothing is invented and the gaps are explicit', () => {
  const history = known(buildRepositoryHistory(evidence({ statusRevisions: null }), UNKNOWN_SESSION))
  assert.deepEqual(history.events, [])
  assert.deepEqual(history.gaps.map((gap) => gap.area).sort(), ['SESSION', 'STATUS_TRANSITIONS'])
  assert.ok(history.gaps.every((gap) => gap.reason.length > 0))
})

test('a single status revision is only a baseline: it proves no transition', () => {
  const history = known(buildRepositoryHistory(
    evidence({ statusRevisions: [revision(20, '2026-09-30T09:30:00Z', { checkpoint: 'CP-17', status: 'READY', blocker: null })] }),
    UNKNOWN_SESSION,
  ))
  assert.deepEqual(history.events, [])
  assert.ok(!history.gaps.some((gap) => gap.area === 'STATUS_TRANSITIONS'), 'zero transitions in the window is evidenced, not a gap')
})

test('an unreadable status revision is a gap and never a guessed transition', () => {
  const history = known(buildRepositoryHistory(
    evidence({ statusRevisions: [
      revision(20, '2026-09-30T09:30:00Z', { checkpoint: 'CP-17', status: 'READY', blocker: null }),
      revision(21, '2026-09-29T09:30:00Z', null),
      revision(22, '2026-09-28T09:30:00Z', { checkpoint: 'CP-15', status: 'PASS', blocker: null }),
    ] }),
    UNKNOWN_SESSION,
  ))
  assert.deepEqual(history.events, [], 'a change across an unreadable revision cannot be attributed to any commit')
  assert.ok(history.gaps.some((gap) => gap.area === 'STATUS_TRANSITIONS' && /could not be read/.test(gap.reason)))
})

test('an unreadable timestamp is dropped and recorded as a gap, never replaced by "now"', () => {
  const history = known(buildRepositoryHistory(
    evidence({ commits: [{ sha: sha(1), committedAt: 'not-a-date', message: 'x', url: commitUrl(sha(1)) }], statusRevisions: null }),
    UNKNOWN_SESSION,
  ))
  assert.deepEqual(history.events, [])
  assert.ok(history.gaps.some((gap) => gap.area === 'COMMITS'))
})

test('a project without collected evidence gets an explicit UNAVAILABLE history', () => {
  const project = adapt(statusContent())
  assert.equal(project.history.status, 'UNAVAILABLE')
  if (project.history.status === 'UNAVAILABLE') assert.ok(project.history.reason.length > 0)
})

test('a commit, a merge or a PASS status never manufactures a session event', () => {
  // Merged PR + PASS status + fresh commit, but no Arena session block at all.
  const project = adapt(statusContent({ status: 'PASS' }), RICH_EVIDENCE)
  assert.equal(project.session.sessionState, 'UNKNOWN')
  const history = known(project.history)
  assert.ok(!history.events.some((event) => historyEventCategory(event.type) === 'SESSION'), 'no session event without session evidence')
  assert.ok(history.gaps.some((gap) => gap.area === 'SESSION'), 'the unknown session is an explicit gap')
})

// --- Derivation: Arena session lifecycle --------------------------------------

function sessionEvents(project: ProjectState) {
  return known(project.history).events.filter((event) => historyEventCategory(event.type) === 'SESSION')
}

test('session lifecycle: started, activity and ready-to-close come only from explicit session evidence', () => {
  const project = adapt(
    statusContent({ status: 'PASS', session: 'ACTIVE', started: '2026-10-01T08:00:00Z', activity: '2026-10-01T11:30:00Z', closure: 'NOT_CONFIRMED' }),
    evidence(),
  )
  assert.equal(project.session.sessionState, 'READY_TO_CLOSE')
  const events = sessionEvents(project)
  assert.deepEqual(
    events.map((event) => [event.type, event.occurredAt, event.timeBasis]),
    [
      ['SESSION_ACTIVITY', '2026-10-01T11:30:00Z', 'EVENT'],
      ['SESSION_READY_TO_CLOSE', '2026-10-01T11:30:00Z', 'SESSION_LAST_ACTIVITY'],
      ['SESSION_STARTED', '2026-10-01T08:00:00Z', 'EVENT'],
    ],
  )
  assert.ok(events.every((event) => event.source === 'PROJECT_STATUS' && event.sourceId === 'sha-status-001:PROJECT_STATUS.md'))
  assert.ok(events.every((event) => event.evidenceUrl === STATUS_URL))
  assert.ok(!events.some((event) => event.type === 'SESSION_CLOSED'), 'ready-to-close is not closure')
})

test('session lifecycle: waiting for validation', () => {
  const project = adapt(
    statusContent({ status: 'VALIDATION', session: 'WAITING_FOR_VALIDATION', started: '2026-10-01T08:00:00Z', activity: '2026-10-01T11:00:00Z', closure: 'NOT_CONFIRMED' }),
    evidence(),
  )
  assert.equal(project.session.sessionState, 'WAITING_FOR_VALIDATION')
  assert.ok(sessionEvents(project).some((event) => event.type === 'SESSION_WAITING_FOR_VALIDATION' && event.occurredAt === '2026-10-01T11:00:00Z'))
})

test('session lifecycle: explicit closure needs closure evidence and links to it', () => {
  const closed = adapt(
    statusContent({
      status: 'PASS', session: 'CLOSED', started: '2026-10-01T08:00:00Z', activity: '2026-10-01T11:00:00Z',
      closure: 'CONFIRMED', closureUrl: `https://github.com/${REPO}/pull/14`,
    }),
    evidence(),
  )
  assert.equal(closed.session.sessionState, 'CLOSED')
  const closedEvent = sessionEvents(closed).find((event) => event.type === 'SESSION_CLOSED')!
  assert.equal(closedEvent.evidenceUrl, `https://github.com/${REPO}/pull/14`, 'the closure event links to the closure evidence')
  assert.equal(closedEvent.timeBasis, 'SESSION_LAST_ACTIVITY', 'the closure time is not declared and is labelled as such')

  // CLOSED declared without evidence never becomes a closure event.
  const unproven = adapt(
    statusContent({ status: 'PASS', session: 'CLOSED', started: '2026-10-01T08:00:00Z', activity: '2026-10-01T11:00:00Z', closure: 'CONFIRMED' }),
    evidence(),
  )
  assert.notEqual(unproven.session.sessionState, 'CLOSED')
  assert.ok(!sessionEvents(unproven).some((event) => event.type === 'SESSION_CLOSED'))
})

test('session lifecycle: stale detection is placed at last activity + threshold, never at the snapshot time', () => {
  const lastActivity = '2026-09-28T06:00:00Z'
  const project = adapt(
    statusContent({ status: 'IN_PROGRESS', session: 'ACTIVE', started: '2026-09-27T06:00:00Z', activity: lastActivity, closure: 'NOT_CONFIRMED' }),
    evidence(),
  )
  assert.equal(project.session.sessionState, 'STALE_SESSION')
  const stale = sessionEvents(project).find((event) => event.type === 'SESSION_STALE')!
  assert.equal(stale.occurredAt, new Date(Date.parse(lastActivity) + ARENA_SESSION_INACTIVITY_THRESHOLD_HOURS * 3_600_000).toISOString().replace('.000Z', 'Z'))
  assert.equal(stale.timeBasis, 'INACTIVITY_THRESHOLD')
  assert.notEqual(stale.occurredAt, project.activity.snapshotGeneratedAt.at, 'the snapshot clock is not session evidence')
})

test('session lifecycle: an active, unchanged session adds no state event beyond what is declared', () => {
  const project = adapt(
    statusContent({ status: 'IN_PROGRESS', session: 'ACTIVE', started: '2026-10-01T10:00:00Z', activity: '2026-10-01T11:00:00Z', closure: 'NOT_CONFIRMED' }),
    evidence(),
  )
  assert.equal(project.session.sessionState, 'ACTIVE')
  assert.deepEqual(sessionEvents(project).map((event) => event.type), ['SESSION_ACTIVITY', 'SESSION_STARTED'], 'newest first; no state event for a plain active session')
})

test('session history never mixes with project status transitions', () => {
  const project = adapt(
    statusContent({ status: 'PASS', session: 'CLOSED', started: '2026-10-01T08:00:00Z', activity: '2026-10-01T11:00:00Z', closure: 'CONFIRMED', closureUrl: `https://github.com/${REPO}/pull/14` }),
    RICH_EVIDENCE,
  )
  const events = known(project.history).events
  for (const event of events) {
    const category = historyEventCategory(event.type)
    if (category === 'SESSION') assert.equal(event.source, 'PROJECT_STATUS')
    if (event.type === 'STATE_CHANGED') assert.ok(!event.to?.startsWith('SESSION_') && !['CLOSED', 'ACTIVE'].includes(event.to ?? ''))
  }
})

test('the newest status revision is consistent with the current normalized state', () => {
  const project = adapt(statusContent({ checkpoint: 'CP-17 — Fixture' }), RICH_EVIDENCE)
  const newestMove = known(project.history).events.find((event) => event.type === 'CHECKPOINT_MOVED')!
  assert.equal(newestMove.to, project.checkpoint)
})

// --- View helpers ------------------------------------------------------------

test('filters and summary are computed from the very same events', () => {
  const history = known(buildRepositoryHistory(RICH_EVIDENCE, UNKNOWN_SESSION))
  const summary = summarizeHistory(history.events)
  assert.deepEqual(summary, {
    commits: 3, pullRequestsOpened: 3, pullRequestsMerged: 1, pullRequestsClosed: 1,
    checkpointMoves: 1, stateChanges: 2, blockerChanges: 2, sessionEvents: 0,
  })

  const commitsOnly = filterHistoryEvents(history.events, new Set(['COMMITS']))
  assert.equal(commitsOnly.length, summary.commits)
  assert.ok(commitsOnly.every((event) => event.type === 'COMMIT'))
  const none = filterHistoryEvents(history.events, new Set())
  assert.equal(none.length, 0)
  const all = filterHistoryEvents(history.events, new Set(HISTORY_EVENT_CATEGORIES))
  assert.deepEqual(all, history.events, 'all categories restore the full, ordered list')
  // Filtering preserves the deterministic order.
  const mixed = filterHistoryEvents(history.events, new Set(['PULL_REQUESTS', 'STATUS']))
  for (let index = 1; index < mixed.length; index += 1) assert.ok(compareHistoryEvents(mixed[index - 1], mixed[index]) < 0)
})

// --- Routing -----------------------------------------------------------------

test('report routes carry the selected project and survive a refresh', () => {
  assert.deepEqual(parseHashRoute('#/reports/business-discovery'), { view: 'reports', projectId: null, reportProjectId: 'business-discovery' })
  assert.deepEqual(parseHashRoute(reportHash('murat-house'), 'portfolio'), { view: 'reports', projectId: null, reportProjectId: 'murat-house' })
  assert.deepEqual(parseHashRoute(viewHash('reports')), { view: 'reports', projectId: null })
  // A malformed project id never selects a project; the report view still opens.
  assert.deepEqual(parseHashRoute('#/reports/Not_Valid'), { view: 'reports', projectId: null })
})

// --- Committed snapshot: all portfolio projects ------------------------------

const snapshotText = readFileSync(fileURLToPath(new URL('../public/project-state.json', import.meta.url)), 'utf8')
const registry = parseProjectRegistry(JSON.parse(snapshotText))

test('every portfolio project carries an explicit history: KNOWN with provenance or UNAVAILABLE with a reason', () => {
  assert.equal(registry.projects.length, 15)
  let known = 0
  for (const project of registry.projects) {
    if (project.history.status === 'UNAVAILABLE') {
      assert.ok(project.history.reason.trim().length > 0, `${project.id}: an unavailable history needs a reason`)
      continue
    }
    known += 1
    const seen = new Set<string>()
    project.history.events.forEach((event, index) => {
      assert.ok(!seen.has(event.id), `${project.id}: duplicate ${event.id}`)
      seen.add(event.id)
      assert.ok(event.evidenceUrl.startsWith('https://'), `${project.id}: ${event.id} needs an evidence link`)
      assert.ok(event.sourceId.length > 0)
      if (index > 0) assert.ok(compareHistoryEvents(project.history.events[index - 1], event) < 0, `${project.id}: deterministic ordering`)
      // The dashboard's own snapshot is never an event source.
      assert.ok(['COMMIT', 'PULL_REQUEST', 'PROJECT_STATUS'].includes(event.source), `${project.id}: ${event.id} has an evidence source`)
    })
    if (project.history.events.length === 0) {
      assert.ok(project.history.gaps.length > 0, `${project.id}: an empty window must explain itself`)
    }
  }
  assert.ok(known >= 2, 'the readable repositories carry live history')
})

test('snapshot: live history is current — it reaches past the old August-only manifest', () => {
  const dashboard = registry.projects.find((project) => project.id === 'salamat-projects-dashboard')!
  const events = getHistoryEvents(dashboard)
  assert.ok(events.length > 0)
  assert.ok(events[0].occurredAt >= '2026-10-01T00:00:00Z', 'the newest event is from the current checkpoints, not August')
  assert.ok(events.some((event) => event.type === 'PULL_REQUEST_MERGED'))
  assert.ok(events.some((event) => event.type === 'CHECKPOINT_MOVED'))
})

test('snapshot: history agrees with the normalized project state', () => {
  for (const project of registry.projects) {
    const events = getHistoryEvents(project)
    const move = events.find((event) => event.type === 'CHECKPOINT_MOVED')
    if (move && project.checkpoint) assert.equal(move.to, project.checkpoint, `${project.id}: newest checkpoint move matches the current checkpoint`)

    const closedEvent = events.find((event) => event.type === 'SESSION_CLOSED')
    if (project.session.sessionState === 'CLOSED') {
      assert.ok(closedEvent, `${project.id}: a CLOSED session carries its closure event`)
      assert.equal(closedEvent.evidenceUrl, project.session.sessionClosureEvidence?.url)
    } else {
      assert.equal(closedEvent, undefined, `${project.id}: no closure event without a CLOSED session`)
    }
    if (project.session.sessionState === 'UNKNOWN') {
      assert.ok(!events.some((event) => historyEventCategory(event.type) === 'SESSION'), `${project.id}: an UNKNOWN session has no session events`)
      if (project.history.status === 'KNOWN') assert.ok(project.history.gaps.some((gap) => gap.area === 'SESSION'), `${project.id}: the UNKNOWN session is an explicit gap`)
    }
    if (project.session.sessionStartedAt.status === 'KNOWN' && project.history.status === 'KNOWN') {
      const started = events.find((event) => event.type === 'SESSION_STARTED')
      assert.equal(started?.occurredAt, project.session.sessionStartedAt.at)
    }
  }
})

test('snapshot: the default report project is deterministic and has real events', () => {
  const ordered = orderByRecentActivity(registry.projects)
  const selected = defaultReportProject(ordered)!
  assert.ok(getHistoryEvents(selected).length > 0)
  assert.equal(defaultReportProject(orderByRecentActivity([...registry.projects].reverse()))!.id, selected.id)
})

// --- DOM: History & Reports at desktop and mobile ------------------------------

type Registry = { projects: Array<Record<string, unknown>> }

function installDom(width: number, snapshot: string, hash = '') {
  const dom = new jsdom.JSDOM('<!doctype html><html><body><div id="root"></div></body></html>', {
    url: `https://dashboard.local/${hash}`,
    pretendToBeVisual: true,
  })
  const { window } = dom
  ;(window as unknown as Record<string, unknown>).matchMedia = (query: string) => {
    const maxWidth = /\(\s*max-width:\s*(\d+(?:\.\d+)?)px\s*\)/.exec(query)
    return {
      matches: maxWidth ? width <= Number(maxWidth[1]) : false,
      media: query,
      addEventListener() {},
      removeEventListener() {},
    }
  }
  const globals = globalThis as Record<string, unknown>
  globals.window = window
  globals.document = window.document
  Object.defineProperty(globalThis, 'navigator', { value: window.navigator, configurable: true })
  globals.fetch = async () => new Response(snapshot, { status: 200, headers: { 'content-type': 'application/json' } })
  globals.IS_REACT_ACT_ENVIRONMENT = true
  return dom
}

async function renderDashboard(width: number, hash = '', mutate?: (registry: Registry) => void) {
  const parsed: Registry = JSON.parse(snapshotText)
  mutate?.(parsed)
  const dom = installDom(width, JSON.stringify(parsed), hash)
  const { createElement, act } = await import('react')
  const { createRoot } = await import('react-dom/client')
  const { App } = await import('../src/components/DashboardApp.js')

  const container = dom.window.document.getElementById('root')!
  const root = createRoot(container)
  await act(async () => { root.render(createElement(App)) })

  return {
    container,
    window: dom.window,
    act,
    cleanup: async () => {
      await act(async () => { root.unmount() })
      dom.window.close()
    },
  }
}

function buttonByText(container: Element, text: string) {
  return [...container.querySelectorAll('button')].find((button) => button.textContent?.includes(text))
}

async function selectProject(
  container: Element,
  window: jsdom.DOMWindow,
  act: (callback: () => Promise<void>) => Promise<void>,
  projectId: string,
) {
  const select = container.querySelector<HTMLSelectElement>('.report-project-select select')!
  await act(async () => {
    select.value = projectId
    select.dispatchEvent(new window.Event('change', { bubbles: true }))
  })
}

const projectsById = new Map(registry.projects.map((project) => [project.id, project]))

for (const [label, width] of [['desktop 1440px', 1440], ['mobile 390px', 390]] as const) {
  test(`History & Reports renders the live history of the default project (${label})`, async (t) => {
    const { container, act, cleanup } = await renderDashboard(width)
    t.after(cleanup)
    await act(async () => { buttonByText(container, 'Reports')!.click() })

    const workspace = container.querySelector('.reports-workspace')!
    assert.ok(workspace, 'the reports view renders')
    const selected = defaultReportProject(orderByRecentActivity(registry.projects))!
    assert.equal(workspace.querySelector('h2')?.textContent, selected.name)
    assert.equal(container.querySelectorAll('.history-timeline li').length, getHistoryEvents(selected).length, 'every event renders')
    assert.ok(container.querySelector('.report-metrics'), 'the report summary renders')
    assert.equal(container.querySelectorAll('.report-metrics article').length, 6)
    assert.ok(workspace.textContent?.includes('часы дашборда'), 'the snapshot clock is labelled as the dashboard clock')
    // The static August-only manifest is gone.
    assert.ok(!container.textContent?.includes('project-history.json'))
  })

  test(`every one of the 15 projects can be selected and inspected in Reports (${label})`, async (t) => {
    const { container, window, act, cleanup } = await renderDashboard(width, '#/reports')
    t.after(cleanup)

    const options = [...container.querySelectorAll<HTMLOptionElement>('.report-project-select option')]
    assert.equal(options.length, 15, 'the selector lists the whole portfolio')
    assert.deepEqual(options.map((option) => option.value).sort(), registry.projects.map((project) => project.id).sort())

    for (const option of options) {
      await selectProject(container, window, act, option.value)
      const project = projectsById.get(option.value)!
      assert.equal(window.location.hash, reportHash(option.value), 'the selection is reflected in the URL')
      assert.equal(container.querySelector('.reports-workspace h2')?.textContent, project.name)

      if (project.history.status === 'UNAVAILABLE') {
        const note = container.querySelector('.history-unavailable')
        assert.ok(note, `${project.name}: an unavailable history is stated explicitly`)
        assert.ok(note.textContent?.includes('UNAVAILABLE'))
        assert.ok(note.textContent?.includes(project.history.reason), 'the recorded reason is shown')
        assert.equal(container.querySelectorAll('.history-timeline li').length, 0, 'no event is fabricated')
        assert.equal(container.querySelectorAll('.history-filters').length, 0)
      } else {
        assert.equal(container.querySelectorAll('.history-timeline li').length, project.history.events.length)
        assert.equal(container.querySelector('.history-unavailable'), null)
        for (const gap of project.history.gaps) {
          assert.ok(container.querySelector('.history-gaps')?.textContent?.includes(gap.reason), `${project.name}: gap "${gap.area}" is visible`)
        }
      }
    }
  })

  test(`every rendered event shows its provenance and a concrete evidence link (${label})`, async (t) => {
    const { container, cleanup } = await renderDashboard(width, '#/reports/salamat-projects-dashboard')
    t.after(cleanup)

    const items = [...container.querySelectorAll('.history-timeline li')]
    assert.ok(items.length > 0)
    const dashboard = registry.projects.find((project) => project.id === 'salamat-projects-dashboard')!
    getHistoryEvents(dashboard).forEach((event, index) => {
      const item = items[index]
      assert.ok(item.querySelector('time')?.getAttribute('datetime') === event.occurredAt, 'timestamp rendered from evidence')
      assert.ok(item.querySelector('.history-provenance')?.textContent?.includes(event.source), 'source is shown')
      assert.equal(item.querySelector('.history-provenance')?.getAttribute('title'), event.sourceId, 'full sourceId is kept')
      assert.equal(item.querySelector('a')?.getAttribute('href'), event.evidenceUrl, 'evidence link is the event evidence')
    })
    // Session lifecycle evidence is visible when attributable, with its time basis stated.
    assert.ok(container.querySelector('[data-category="SESSION"]'), 'attributable session events are visible')
    assert.ok(container.textContent?.includes('закрытия/перехода источник не объявляет'), 'an undeclared closure time is disclosed')
  })

  test(`filters narrow the timeline and reset restores it (${label})`, async (t) => {
    const { container, act, cleanup } = await renderDashboard(width, '#/reports/salamat-projects-dashboard')
    t.after(cleanup)
    const dashboard = registry.projects.find((project) => project.id === 'salamat-projects-dashboard')!
    const events = getHistoryEvents(dashboard)
    const total = events.length
    const count = (types: string[]) => events.filter((event) => types.includes(event.type)).length

    const filterButtons = [...container.querySelectorAll<HTMLButtonElement>('.history-filters button')]
    assert.deepEqual(filterButtons.map((button) => button.textContent?.trim()), ['Коммиты', 'Pull requests', 'Статус проекта', 'Сессия', 'Сбросить'])
    assert.ok(filterButtons.slice(0, 4).every((button) => button.getAttribute('aria-pressed') === 'true'))

    await act(async () => { buttonByText(container, 'Коммиты')!.click() })
    assert.equal(container.querySelectorAll('.history-timeline li').length, total - count(['COMMIT']), 'hiding commits removes only commits')
    assert.equal(buttonByText(container, 'Коммиты')!.getAttribute('aria-pressed'), 'false')

    await act(async () => { buttonByText(container, 'Сессия')!.click() })
    assert.equal(container.querySelector('[data-category="SESSION"]'), null, 'hiding the session category hides session events')

    await act(async () => { buttonByText(container, 'Сбросить')!.click() })
    assert.equal(container.querySelectorAll('.history-timeline li').length, total, 'reset restores every event')

    for (const label of ['Коммиты', 'Pull requests', 'Статус проекта', 'Сессия']) {
      await act(async () => { buttonByText(container, label)!.click() })
    }
    assert.equal(container.querySelectorAll('.history-timeline li').length, 0)
    assert.ok(container.textContent?.includes('Нет событий по текущим фильтрам'), 'an empty filter result is explicit')
  })

  test(`report metrics match the rendered events and keep explicit zeros (${label})`, async (t) => {
    const { container, cleanup } = await renderDashboard(width, '#/reports/salamat-projects-dashboard')
    t.after(cleanup)
    const dashboard = registry.projects.find((project) => project.id === 'salamat-projects-dashboard')!
    const summary = summarizeHistory(getHistoryEvents(dashboard))
    const cards = [...container.querySelectorAll('.report-metrics article')].map((card) => card.querySelector('strong')?.textContent)
    assert.deepEqual(cards, [
      String(summary.commits),
      `${summary.pullRequestsOpened} / ${summary.pullRequestsMerged} / ${summary.pullRequestsClosed}`,
      String(summary.checkpointMoves),
      String(summary.stateChanges),
      String(summary.blockerChanges),
      String(summary.sessionEvents),
    ])
    if (summary.blockerChanges === 0) {
      assert.ok(container.querySelector('.metric-zero')?.textContent?.includes('Нет подтверждённых изменений'), 'zero blocker changes is an explicit evidenced zero')
    }
  })

  test(`History & Reports stays consistent with Project Detail (${label})`, async (t) => {
    const { container, window, act, cleanup } = await renderDashboard(width, '#/project/salamat-projects-dashboard')
    t.after(cleanup)
    const dashboard = registry.projects.find((project) => project.id === 'salamat-projects-dashboard')!
    const events = getHistoryEvents(dashboard)

    // Detail shows the newest events of the very same list, in the very same order.
    const detailItems = [...container.querySelectorAll('.detail-history li')]
    assert.equal(detailItems.length, Math.min(events.length, 10))
    detailItems.forEach((item, index) => {
      assert.equal(item.querySelector('time')?.getAttribute('datetime'), events[index].occurredAt)
      assert.equal(item.querySelector('a')?.getAttribute('href'), events[index].evidenceUrl)
    })
    // The same operational and session state sits next to the history in both views.
    assert.ok(container.querySelector('.project-detail')?.textContent?.includes(dashboard.session.sessionState))
    const link = container.querySelector<HTMLAnchorElement>('.detail-report-link')!
    assert.equal(link.getAttribute('href'), reportHash('salamat-projects-dashboard'))

    await act(async () => { link.click() })
    assert.equal(window.location.hash, reportHash('salamat-projects-dashboard'))
    assert.equal(container.querySelector('.project-detail'), null, 'the detail view is replaced by the report')
    const reportItems = [...container.querySelectorAll('.history-timeline li')]
    assert.equal(reportItems.length, events.length)
    detailItems.forEach((_, index) => {
      assert.equal(
        reportItems[index].querySelector('time')?.getAttribute('datetime'),
        events[index].occurredAt,
        'report and detail agree on the order of the newest events',
      )
    })
    // …and back to the project, which still shows the same state.
    await act(async () => { container.querySelector<HTMLElement>('.report-detail-link')!.click() })
    assert.ok(container.querySelector('.project-detail'))
  })

  test(`a project without history is explicit in Project Detail and Reports (${label})`, async (t) => {
    const { container: detail, cleanup: cleanupDetail } = await renderDashboard(width, '#/project/murat-house')
    t.after(cleanupDetail)
    assert.ok(detail.textContent?.includes('История недоступна (UNAVAILABLE)'))
    assert.equal(detail.querySelectorAll('.detail-history li').length, 0)

    const { container: report, cleanup: cleanupReport } = await renderDashboard(width, '#/reports/murat-house')
    t.after(cleanupReport)
    assert.ok(report.querySelector('.history-unavailable'))
    assert.ok(report.textContent?.includes('События не придуманы'))
  })

  test(`an unknown project id in a report link states the gap (${label})`, async (t) => {
    const { container, cleanup } = await renderDashboard(width, '#/reports/project-that-does-not-exist')
    t.after(cleanup)
    assert.ok(container.textContent?.includes('отсутствует в текущем snapshot портфеля'))
    assert.equal(container.querySelectorAll('.history-timeline li').length, 0, 'no history is fabricated for an unknown project')
  })

  test(`History & Reports is monitoring-only: no execution or session controls (${label})`, async (t) => {
    const { container, cleanup } = await renderDashboard(width, '#/reports/salamat-projects-dashboard')
    t.after(cleanup)
    const workspace = container.querySelector('.reports-workspace')!
    const forbiddenLabel = /continu|task packet|codex|arena|json|execut|run task|model|prompt|agent|runner|send to|start|stop|close|закрыть|запуст|остановить/i

    // Only the four category filters and reset may be buttons.
    assert.deepEqual(
      [...workspace.querySelectorAll('button')].map((button) => button.textContent?.trim()),
      ['Коммиты', 'Pull requests', 'Статус проекта', 'Сессия', 'Сбросить'],
    )
    for (const button of workspace.querySelectorAll('button')) {
      assert.ok(!forbiddenLabel.test(button.textContent ?? ''), `"${button.textContent}" must not look like a control`)
    }
    // The only form control is the read-only project selector.
    assert.equal(workspace.querySelectorAll('input, textarea, form').length, 0)
    assert.equal(workspace.querySelectorAll('select').length, 1)
    for (const link of workspace.querySelectorAll('a')) {
      const href = link.getAttribute('href') ?? ''
      assert.ok(href.startsWith('https://') || href.startsWith('#/'), `report links must be evidence or routes, got "${href}"`)
      assert.equal(link.getAttribute('rel'), 'noreferrer')
    }
    const chrome = (workspace.textContent ?? '')
    for (const term of ['Continue', 'Task Packet', 'Send to Arena', 'Codex', 'Run task', 'Raw JSON', 'Copy JSON']) {
      assert.ok(!chrome.includes(term), `"${term}" must not appear in the reports view`)
    }
  })
}

test('portfolio navigation reaches Triage, Portfolio, Attention, Reports and Project Detail and back', async (t) => {
  const { container, act, cleanup } = await renderDashboard(390)
  t.after(cleanup)
  for (const nav of ['Triage', 'Portfolio', 'Attention', 'Reports']) {
    await act(async () => { buttonByText(container, nav)!.click() })
    assert.ok(buttonByText(container, nav)!.classList.contains('active'), `${nav} becomes the active view`)
  }
  assert.ok(container.querySelector('.reports-workspace'))
  await act(async () => { buttonByText(container, 'Portfolio')!.click() })
  await act(async () => { container.querySelector<HTMLElement>('.project-card-open')!.click() })
  assert.ok(container.querySelector('.project-detail'))
  assert.ok(container.querySelector('.detail-report-link'), 'every project detail links to its report')
  await act(async () => { buttonByText(container, 'Портфель')!.click() })
  assert.ok(container.querySelectorAll('.project-card').length > 0)
})

test('session lifecycle events render with project status and session state kept apart', async (t) => {
  const stale = 'sha-status-001:PROJECT_STATUS.md'
  const { container, cleanup } = await renderDashboard(1440, '#/reports/murat-house', (parsed) => {
    const project = parsed.projects.find((candidate) => candidate.id === 'murat-house')!
    project.history = {
      status: 'KNOWN',
      limits: { ...HISTORY_LIMITS },
      gaps: [],
      events: [{
        id: `SESSION_STALE:${stale}`, type: 'SESSION_STALE', occurredAt: '2026-09-26T10:00:00Z', timeBasis: 'INACTIVITY_THRESHOLD',
        summary: 'Open Arena session passed the 24h inactivity threshold without closure evidence', from: null, to: null,
        source: 'PROJECT_STATUS', sourceId: stale, evidenceUrl: 'https://github.com/Murkin1980/murat-house/blob/main/PROJECT_STATUS.md',
      }],
    }
  })
  t.after(cleanup)
  const item = container.querySelector('.history-timeline li')!
  assert.ok(item.textContent?.includes('Сессия устарела'))
  assert.ok(item.textContent?.includes('последняя активность сессии + порог'), 'the threshold basis is disclosed')
  assert.equal(item.querySelector('[data-category]')?.getAttribute('data-category'), 'SESSION')
  // Session events never read as a project status change.
  assert.ok(!item.querySelector('.history-transition'))
})

// --- Responsive CSS contract (390px has no horizontal page overflow) -----------

test('responsive styles keep long evidence inside the page at 390px', () => {
  const css = readFileSync(fileURLToPath(new URL('../src/styles.css', import.meta.url)), 'utf8')
  assert.match(css, /\.history-filters\s*\{[^}]*overflow-x:\s*auto/, 'wide filter chips scroll inside their own container')
  assert.match(css, /\.history-timeline article\s*\{[^}]*overflow-wrap:\s*anywhere/, 'long sha / url text wraps instead of widening the page')
  assert.match(css, /\.report-project-select select\s*\{[^}]*min-width:\s*0/, 'the selector shrinks to the viewport')
  assert.match(css, /\.detail-row dd\s*\{[^}]*overflow-wrap:\s*anywhere/, 'long sha:path evidence ids wrap inside Project Detail fields')
  const mobile = css.slice(css.lastIndexOf('@media (max-width: 760px)'))
  assert.match(mobile, /\.report-metrics\s*\{\s*grid-template-columns:\s*1fr/, 'metrics stack in a single column on a phone')
})
