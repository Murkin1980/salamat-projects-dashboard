import { parseProjectRegistry, type ProjectRegistry } from '../src/contract/project-state.js'

/**
 * Hostile-but-valid portfolio fixtures for UI resilience checks.
 *
 * Every fixture produced here is pushed through the REAL `parseProjectRegistry`
 * before it is returned, so a fixture can never reach a view by weakening the
 * domain contract. Values that the contract legitimately forbids (a `total` of
 * zero, an empty registry, an unknown triage state) are therefore NOT faked
 * here — those are recorded as contract-level impossibilities instead.
 */

/** A full 40-character commit SHA: the longest identifier the contract allows. */
export const LONG_SHA = 'f'.repeat(40)

/** An unbroken run of characters with no space, hyphen or slash to break on. */
export function unbroken(length: number, seed = 'A'): string {
  let out = ''
  while (out.length < length) out += seed
  return out.slice(0, length)
}

type RawProject = Record<string, never> & Record<string, unknown>

function clone<T>(value: T): T {
  return structuredClone(value)
}

/**
 * Extreme text: a 220-character unbroken name, 300-character mixed
 * Russian/Kazakh/English unbroken summary, 240-character unbroken blocker and
 * next action, a two-segment unbroken `owner/repo`, huge progress numbers, a
 * three-way source CONFLICT with unbroken reason, and 200-character evidence
 * labels/URLs.
 */
function extremeProject(base: RawProject): RawProject {
  const project = clone(base)
  project.id = 'extreme-hostile-fixture'
  project.name = unbroken(220, 'Unbrokenextremelylongprojectnamewithoutanyspacesorhyphens')
  project.summary = unbroken(300, 'Көлемдіорысшақазақшаағылшыншаараласмәтінwithoutspaces')
  project.repo = `${unbroken(60, 'o')}/${unbroken(90, 'r')}`
  project.stage = unbroken(180, 'S')
  project.checkpoint = unbroken(160, 'C')
  project.blocker = unbroken(240, 'B')
  project.nextAction = unbroken(240, 'N')
  project.progress = { completed: 999_999_998, total: 999_999_999 }
  project.triageState = null
  project.triageSource = {
    status: 'CONFLICT',
    sourceIds: [
      `${LONG_SHA}:PROJECT_STATUS.md`,
      `${LONG_SHA}:STATUS.md`,
      `${LONG_SHA}:README.md`,
    ],
    reason: unbroken(140, 'R'),
  }
  project.evidenceLinks = [
    { label: unbroken(120, 'E'), url: `https://example.test/${unbroken(180, 'p')}`, sourceId: LONG_SHA },
    { label: 'PROJECT_STATUS.md', url: 'https://example.test/x', sourceId: `${LONG_SHA}:PROJECT_STATUS.md` },
  ]
  return project
}

/** Every optional value missing, plus UNAVAILABLE activity — the sparsest legal project. */
function sparseProject(base: RawProject): RawProject {
  const project = clone(base)
  project.id = 'sparse-minimum-fixture'
  project.name = 'x'
  project.summary = 'y'
  project.repo = null
  project.stage = null
  project.checkpoint = null
  project.progress = null
  project.blocker = null
  project.nextAction = null
  project.evidenceLinks = []
  project.dependencies = []
  project.tools = []
  project.approvals = []
  project.triageState = null
  project.triageSource = { status: 'UNKNOWN', reason: 'no canonical status artifact' }
  project.session = {
    ...clone(project.session as object) as Record<string, unknown>,
    sessionState: 'UNKNOWN',
    sessionCheckpoint: null,
    sessionClosureStatus: 'UNKNOWN',
    sessionClosureEvidence: null,
    sessionStateReason: 'no session evidence',
  }
  project.activity = {
    lastMeaningfulActivity: { status: 'UNAVAILABLE', reason: 'no attributable activity' },
    statusUpdatedAt: { status: 'UNAVAILABLE', reason: 'no attributable status update' },
    snapshotGeneratedAt: (base.activity as Record<string, unknown>).snapshotGeneratedAt,
  }
  project.history = { status: 'UNAVAILABLE', reason: 'no attributable history' }
  return project
}

/** Progress reported as zero — `total` must stay positive, so `0 of 1` is the legal zero. */
function zeroProgressProject(base: RawProject): RawProject {
  const project = clone(base)
  project.id = 'zero-progress-fixture'
  project.name = 'Zero progress fixture'
  project.progress = { completed: 0, total: 1 }
  return project
}

/**
 * Several warnings at once: a source-attributed ACTION_NOW project that also
 * carries a blocker, a pending approval and stale activity. `getFreshness` is
 * driven by `lastUpdated`, so an old date produces the STALE signal.
 */
function multiWarningProject(base: RawProject): RawProject {
  const project = clone(base)
  project.id = 'multi-warning-fixture'
  project.name = 'Multi warning fixture'
  project.triageState = 'ACTION_NOW'
  project.triageSource = { status: 'KNOWN', sourceId: `${LONG_SHA}:PROJECT_STATUS.md` }
  project.nextAction = unbroken(200, 'N')
  project.blocker = unbroken(200, 'B')
  project.approvals = [
    { id: unbroken(90, 'A'), status: 'PENDING', sourceId: `${LONG_SHA}:docs/approvals.md` },
  ]
  project.lastUpdated = '2020-01-01'
  project.staleAfterDays = 7
  return project
}

/** Long unbroken history summaries and full 40-character provenance ids. */
function longHistoryProject(base: RawProject): RawProject {
  const project = clone(base)
  project.id = 'long-history-fixture'
  project.name = 'Long history fixture'
  const history = clone(project.history as Record<string, unknown>)
  if (history.status === 'KNOWN') {
    const events = (history.events as Array<Record<string, unknown>>).slice(0, 4)
    history.events = events.map((event, index) => {
      const sourceId = `${LONG_SHA.slice(0, 39)}${index}`
      const next = clone(event)
      next.sourceId = sourceId
      next.id = `${event.type}:${sourceId}`
      next.summary = unbroken(160, 'H')
      if (event.type === 'CHECKPOINT_MOVED' || event.type === 'STATE_CHANGED' || event.type === 'BLOCKER_CHANGED') {
        next.from = unbroken(90, 'F')
        next.to = unbroken(90, 'T')
      }
      return next
    })
  }
  project.history = history
  return project
}

function registryWith(base: Record<string, unknown>, projects: Array<Record<string, unknown>>): ProjectRegistry {
  const raw = clone(base)
  raw.projects = projects
  // The real contract gates every fixture; a hostile value that is not allowed
  // by the domain is a contract finding, never something to work around here.
  return parseProjectRegistry(raw)
}

/** Five projects covering extreme text, sparse values, zero progress and stacked warnings. */
export function hostileRegistry(snapshot: unknown): ProjectRegistry {
  const base = parseProjectRegistry(clone(snapshot)) as unknown as Record<string, unknown>
  const seed = (base.projects as Array<Record<string, unknown>>)[0]
  return registryWith(base, [
    extremeProject(seed),
    sparseProject(seed),
    zeroProgressProject(seed),
    multiWarningProject(seed),
    longHistoryProject(seed),
  ])
}

/** A portfolio with exactly one project. */
export function singleProjectRegistry(snapshot: unknown): ProjectRegistry {
  const base = parseProjectRegistry(clone(snapshot)) as unknown as Record<string, unknown>
  return registryWith(base, (base.projects as Array<Record<string, unknown>>).slice(0, 1))
}

/** An unusually large result set built from a real project shape. */
export function bulkRegistry(snapshot: unknown, count = 60): ProjectRegistry {
  const base = parseProjectRegistry(clone(snapshot)) as unknown as Record<string, unknown>
  const seed = (base.projects as Array<Record<string, unknown>>)[0]
  return registryWith(
    base,
    Array.from({ length: count }, (_, index) => {
      const project = clone(seed)
      project.id = `bulk-project-${index}`
      project.name = `Bulk project number ${index}`
      return project
    }),
  )
}
