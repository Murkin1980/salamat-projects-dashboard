import { z } from 'zod'

export const PROJECT_STATE_SCHEMA_VERSION = '1.2.0' as const

export const TriageStateSchema = z.enum([
  'ACTION_NOW',
  'BLOCKED',
  'READY',
  'IN_PROGRESS',
  'VALIDATION',
  'HOLD',
  'DONE',
])

const IsoDateSchema = z.string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, 'Expected an ISO date (YYYY-MM-DD)')
  .refine((value) => !Number.isNaN(Date.parse(`${value}T00:00:00Z`))
    && new Date(`${value}T00:00:00Z`).toISOString().slice(0, 10) === value, 'Expected a real calendar date')
/**
 * Second-precision UTC timestamps only, so a stored snapshot is byte-stable and
 * never depends on the machine's locale or on millisecond formatting.
 */
const IsoTimestampSchema = z.string()
  .regex(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}Z$/, 'Expected an ISO-8601 UTC timestamp (YYYY-MM-DDTHH:MM:SSZ)')
  .refine((value) => !Number.isNaN(Date.parse(value))
    && new Date(value).toISOString().replace(/\.\d{3}Z$/, 'Z') === value, 'Expected a real UTC timestamp')
const IdSchema = z.string().regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/)
const NonEmptyStringSchema = z.string().trim().min(1)

const TriageSourceSchema = z.discriminatedUnion('status', [
  z.object({ status: z.literal('KNOWN'), sourceId: NonEmptyStringSchema }).strict(),
  z.object({ status: z.literal('UNKNOWN'), reason: NonEmptyStringSchema }).strict(),
  z.object({
    status: z.literal('CONFLICT'),
    sourceIds: z.array(NonEmptyStringSchema).min(2),
    reason: NonEmptyStringSchema,
  }).strict(),
])

const SourceSchema = z.object({
  kind: z.enum(['FIXTURE', 'REPOSITORY', 'MPE', 'MANUAL']),
  id: NonEmptyStringSchema,
}).strict()

const EvidenceLinkSchema = z.object({
  label: NonEmptyStringSchema,
  url: z.url(),
  sourceId: NonEmptyStringSchema,
}).strict()

const DependencySchema = z.object({
  projectId: IdSchema,
  sourceId: NonEmptyStringSchema,
}).strict()

const ToolSchema = z.object({
  id: NonEmptyStringSchema,
  sourceId: NonEmptyStringSchema,
}).strict()

const ApprovalSchema = z.object({
  id: NonEmptyStringSchema,
  status: z.enum(['PENDING', 'GRANTED', 'REJECTED']),
  sourceId: NonEmptyStringSchema,
}).strict()

// --- Activity and Arena session evidence ------------------------------------

/**
 * Normalized evidence kinds an activity or session timestamp may be attributed to.
 *
 * `SNAPSHOT` is the dashboard's own snapshot generation. It is a valid source for
 * `snapshotGeneratedAt` only and is structurally rejected for every project or
 * session activity field: generating a snapshot is not project activity.
 */
export const ACTIVITY_EVIDENCE_SOURCES = [
  'COMMIT',
  'PULL_REQUEST',
  'WORKFLOW_RUN',
  'CHECK_RUN',
  'PROJECT_STATUS',
  'ROADMAP',
  'MANUAL',
  'FIXTURE',
  'SNAPSHOT',
] as const

export const ActivityEvidenceSourceSchema = z.enum(ACTIVITY_EVIDENCE_SOURCES)

/**
 * A timestamp is either attributable to a named evidence source or explicitly
 * unavailable. There is no third "assume now" option, and the dashboard never
 * substitutes the snapshot clock for missing project evidence.
 */
const EvidenceTimestampSchema = z.discriminatedUnion('status', [
  z.object({
    status: z.literal('KNOWN'),
    at: IsoTimestampSchema,
    source: ActivityEvidenceSourceSchema,
    sourceId: NonEmptyStringSchema,
    evidenceUrl: z.url().nullable(),
  }).strict(),
  z.object({
    status: z.literal('UNAVAILABLE'),
    reason: NonEmptyStringSchema,
  }).strict(),
])

export const ProjectActivitySchema = z.object({
  /** Newest evidence that the project itself changed. Never the snapshot clock. */
  lastMeaningfulActivity: EvidenceTimestampSchema,
  /** When the canonical status artifact was itself last updated. */
  statusUpdatedAt: EvidenceTimestampSchema,
  /** When the dashboard produced the snapshot this state was read from. */
  snapshotGeneratedAt: z.object({
    at: IsoTimestampSchema,
    source: z.literal('SNAPSHOT'),
    sourceId: NonEmptyStringSchema,
  }).strict(),
}).strict()

export const ARENA_SESSION_STATES = [
  'NOT_ACTIVE',
  'ACTIVE',
  'WAITING_FOR_VALIDATION',
  'READY_TO_CLOSE',
  'CLOSED',
  'STALE_SESSION',
  'UNKNOWN',
] as const

export const ArenaSessionStateSchema = z.enum(ARENA_SESSION_STATES)

export const ArenaSessionClosureStatusSchema = z.enum(['CONFIRMED', 'NOT_CONFIRMED', 'UNKNOWN'])

/** Session states that describe an Arena session which has not been closed. */
export const OPEN_ARENA_SESSION_STATES = [
  'ACTIVE',
  'WAITING_FOR_VALIDATION',
  'READY_TO_CLOSE',
  'STALE_SESSION',
] as const

export const ArenaSessionSchema = z.object({
  sessionState: ArenaSessionStateSchema,
  /** Checkpoint the session is executing; null when no evidence names one. */
  sessionCheckpoint: NonEmptyStringSchema.nullable(),
  sessionStartedAt: EvidenceTimestampSchema,
  sessionLastActivityAt: EvidenceTimestampSchema,
  sessionClosureStatus: ArenaSessionClosureStatusSchema,
  /** Explicit closure evidence; required exactly when closure is confirmed. */
  sessionClosureEvidence: EvidenceLinkSchema.nullable(),
  /** Evidence the session state was derived from; empty only for `UNKNOWN`. */
  sessionStateEvidence: z.array(EvidenceLinkSchema),
  /** Human-readable provenance of the derived state. */
  sessionStateReason: NonEmptyStringSchema,
}).strict().superRefine((session, context) => {
  if (session.sessionState === 'CLOSED') {
    if (session.sessionClosureStatus !== 'CONFIRMED' || session.sessionClosureEvidence === null) {
      context.addIssue({
        code: 'custom',
        path: ['sessionState'],
        message: 'CLOSED requires confirmed closure status and explicit closure evidence',
      })
    }
  } else if ((OPEN_ARENA_SESSION_STATES as readonly string[]).includes(session.sessionState)) {
    if (session.sessionClosureStatus === 'CONFIRMED') {
      context.addIssue({
        code: 'custom',
        path: ['sessionClosureStatus'],
        message: 'an open session state cannot carry confirmed closure',
      })
    }
    if (session.sessionLastActivityAt.status !== 'KNOWN') {
      context.addIssue({
        code: 'custom',
        path: ['sessionLastActivityAt'],
        message: 'an open session state requires an attributable last session activity timestamp',
      })
    }
  } else if (session.sessionState === 'NOT_ACTIVE' && session.sessionClosureStatus === 'CONFIRMED') {
    context.addIssue({
      code: 'custom',
      path: ['sessionClosureStatus'],
      message: 'NOT_ACTIVE means no session is running and cannot carry confirmed closure',
    })
  }

  if (session.sessionState !== 'UNKNOWN' && session.sessionStateEvidence.length === 0) {
    context.addIssue({
      code: 'custom',
      path: ['sessionStateEvidence'],
      message: 'every determined session state must keep the evidence it was derived from',
    })
  }

  // Snapshot generation is the dashboard's own clock, never session evidence.
  for (const field of ['sessionStartedAt', 'sessionLastActivityAt'] as const) {
    const value = session[field]
    if (value.status === 'KNOWN' && value.source === 'SNAPSHOT') {
      context.addIssue({
        code: 'custom',
        path: [field],
        message: `${field} must not be attributed to the dashboard snapshot generation`,
      })
    }
  }
})


// --- Live history ------------------------------------------------------------

/**
 * Normalized history/event contract (CP-17).
 *
 * Every event is attributable to concrete evidence: a commit, a pull request
 * lifecycle change, a canonical status-artifact revision or the Arena session
 * block of the canonical status artifact. Events are collected by the existing
 * synchronization, never authored in the dashboard, and never derived from the
 * snapshot clock.
 */
export const HISTORY_EVENT_TYPES = [
  'COMMIT',
  'PULL_REQUEST_OPENED',
  'PULL_REQUEST_MERGED',
  'PULL_REQUEST_CLOSED',
  'CHECKPOINT_MOVED',
  'STATE_CHANGED',
  'BLOCKER_CHANGED',
  'SESSION_STARTED',
  'SESSION_ACTIVITY',
  'SESSION_WAITING_FOR_VALIDATION',
  'SESSION_READY_TO_CLOSE',
  'SESSION_CLOSED',
  'SESSION_STALE',
] as const

export const HistoryEventTypeSchema = z.enum(HISTORY_EVENT_TYPES)

export const HISTORY_EVENT_CATEGORIES = ['COMMITS', 'PULL_REQUESTS', 'STATUS', 'SESSION'] as const
export type HistoryEventCategory = (typeof HISTORY_EVENT_CATEGORIES)[number]

/** Project status transitions and Arena session lifecycle are separate categories. */
export function historyEventCategory(type: (typeof HISTORY_EVENT_TYPES)[number]): HistoryEventCategory {
  if (type === 'COMMIT') return 'COMMITS'
  if (type.startsWith('PULL_REQUEST_')) return 'PULL_REQUESTS'
  if (type.startsWith('SESSION_')) return 'SESSION'
  return 'STATUS'
}

/**
 * What the event timestamp means.
 * - `EVENT`: the evidence itself carries the time (commit, PR, status revision, declared session start).
 * - `SESSION_LAST_ACTIVITY`: the session state is evidenced as of the last session activity; the
 *   state-change time itself is not declared by any source.
 * - `INACTIVITY_THRESHOLD`: stale-session detection, placed where the last session activity plus the
 *   inactivity threshold falls — derived from evidence, never from the snapshot clock.
 */
export const HISTORY_TIME_BASES = ['EVENT', 'SESSION_LAST_ACTIVITY', 'INACTIVITY_THRESHOLD'] as const

const HISTORY_EVENT_SOURCES = ['COMMIT', 'PULL_REQUEST', 'PROJECT_STATUS'] as const

export const HistoryEventSchema = z.object({
  /** Deterministic: `<type>:<sourceId>`. */
  id: NonEmptyStringSchema,
  type: HistoryEventTypeSchema,
  occurredAt: IsoTimestampSchema,
  timeBasis: z.enum(HISTORY_TIME_BASES),
  summary: NonEmptyStringSchema,
  from: NonEmptyStringSchema.nullable(),
  to: NonEmptyStringSchema.nullable(),
  source: z.enum(HISTORY_EVENT_SOURCES),
  sourceId: NonEmptyStringSchema,
  /** Every event keeps a concrete evidence reference. */
  evidenceUrl: z.url(),
}).strict().superRefine((event, context) => {
  const category = historyEventCategory(event.type)
  const expectedSource = category === 'COMMITS' ? 'COMMIT' : category === 'PULL_REQUESTS' ? 'PULL_REQUEST' : 'PROJECT_STATUS'
  if (event.source !== expectedSource) {
    context.addIssue({ code: 'custom', path: ['source'], message: `${event.type} must be attributed to ${expectedSource} evidence` })
  }
  if (event.id !== `${event.type}:${event.sourceId}`) {
    context.addIssue({ code: 'custom', path: ['id'], message: 'event id must be <type>:<sourceId>' })
  }
  if (event.type === 'CHECKPOINT_MOVED' || event.type === 'STATE_CHANGED') {
    if (event.from === null || event.to === null) {
      context.addIssue({ code: 'custom', path: ['from'], message: 'checkpoint and state transitions require from and to values' })
    }
  }
  if ((event.type === 'CHECKPOINT_MOVED' || event.type === 'STATE_CHANGED' || event.type === 'BLOCKER_CHANGED') && event.from === event.to) {
    context.addIssue({ code: 'custom', path: ['to'], message: 'a transition must change the value' })
  }
  if (category !== 'STATUS' && (event.from !== null || event.to !== null)) {
    context.addIssue({ code: 'custom', path: ['from'], message: 'only status transitions carry from/to values' })
  }
  const expectedBasis = event.type === 'SESSION_STALE'
    ? 'INACTIVITY_THRESHOLD'
    : event.type === 'SESSION_WAITING_FOR_VALIDATION' || event.type === 'SESSION_READY_TO_CLOSE' || event.type === 'SESSION_CLOSED'
      ? 'SESSION_LAST_ACTIVITY'
      : 'EVENT'
  if (event.timeBasis !== expectedBasis) {
    context.addIssue({ code: 'custom', path: ['timeBasis'], message: `${event.type} must use the ${expectedBasis} time basis` })
  }
})

/**
 * Deterministic ordering: newest first, then event type, then evidence id.
 * The result never depends on input order or on the machine's locale.
 */
export function compareHistoryEvents(
  left: Pick<z.infer<typeof HistoryEventSchema>, 'occurredAt' | 'type' | 'sourceId' | 'id'>,
  right: Pick<z.infer<typeof HistoryEventSchema>, 'occurredAt' | 'type' | 'sourceId' | 'id'>,
): number {
  const byTime = Date.parse(right.occurredAt) - Date.parse(left.occurredAt)
  if (byTime !== 0) return byTime
  const byType = HISTORY_EVENT_TYPES.indexOf(left.type) - HISTORY_EVENT_TYPES.indexOf(right.type)
  if (byType !== 0) return byType
  if (left.sourceId !== right.sourceId) return left.sourceId < right.sourceId ? -1 : 1
  return left.id < right.id ? -1 : left.id > right.id ? 1 : 0
}

export const HISTORY_GAP_AREAS = ['COMMITS', 'PULL_REQUESTS', 'STATUS_TRANSITIONS', 'SESSION'] as const

export const ProjectHistorySchema = z.discriminatedUnion('status', [
  z.object({
    status: z.literal('KNOWN'),
    /** Size of the recent window collected per evidence source. */
    limits: z.object({
      commits: z.number().int().positive(),
      pullRequests: z.number().int().positive(),
      statusRevisions: z.number().int().positive(),
    }).strict(),
    /** Newest first; see `compareHistoryEvents`. */
    events: z.array(HistoryEventSchema),
    /** Evidence that could not be read or attributed; an explicit gap is never silent. */
    gaps: z.array(z.object({
      area: z.enum(HISTORY_GAP_AREAS),
      reason: NonEmptyStringSchema,
    }).strict()),
  }).strict(),
  z.object({
    status: z.literal('UNAVAILABLE'),
    reason: NonEmptyStringSchema,
  }).strict(),
]).superRefine((history, context) => {
  if (history.status !== 'KNOWN') return
  const ids = new Set<string>()
  history.events.forEach((event, index) => {
    if (ids.has(event.id)) {
      context.addIssue({ code: 'custom', path: ['events', index, 'id'], message: 'history event ids must be unique' })
    }
    ids.add(event.id)
    const previous = history.events[index - 1]
    if (previous && compareHistoryEvents(previous, event) > 0) {
      context.addIssue({ code: 'custom', path: ['events', index], message: 'history events must be ordered newest first with deterministic tie-breaks' })
    }
  })
})

const ProjectStateBaseSchema = z.object({
  schemaVersion: z.literal(PROJECT_STATE_SCHEMA_VERSION),
  id: IdSchema,
  name: NonEmptyStringSchema,
  summary: NonEmptyStringSchema,
  repo: z.string().regex(/^[^/\s]+\/[^/\s]+$/).nullable(),
  triageState: TriageStateSchema.nullable(),
  triageSource: TriageSourceSchema,
  stage: NonEmptyStringSchema.nullable(),
  checkpoint: NonEmptyStringSchema.nullable(),
  progress: z.object({
    completed: z.number().int().nonnegative(),
    total: z.number().int().positive(),
  }).strict().nullable(),
  lastUpdated: IsoDateSchema,
  activity: ProjectActivitySchema,
  session: ArenaSessionSchema,
  /** Live history collected by the synchronization; `UNAVAILABLE` carries its reason. */
  history: ProjectHistorySchema,
  blocker: NonEmptyStringSchema.nullable(),
  nextAction: NonEmptyStringSchema.nullable(),
  evidenceLinks: z.array(EvidenceLinkSchema),
  dependencies: z.array(DependencySchema),
  tools: z.array(ToolSchema),
  approvals: z.array(ApprovalSchema),
  source: SourceSchema,
  staleAfterDays: z.number().int().positive(),
}).strict()

export const ProjectStateSchema = ProjectStateBaseSchema.superRefine((project, context) => {
  const statusIsUnknown = project.triageSource.status === 'UNKNOWN' || project.triageSource.status === 'CONFLICT'

  if ((project.triageState === null) !== statusIsUnknown) {
    context.addIssue({
      code: 'custom',
      path: ['triageState'],
      message: 'triageState must be null exactly when triageSource is UNKNOWN or CONFLICT',
    })
  }
  if (project.triageState === 'BLOCKED' && project.blocker === null) {
    context.addIssue({ code: 'custom', path: ['blocker'], message: 'BLOCKED projects require a blocker' })
  }
  if (project.triageState === 'ACTION_NOW' && project.nextAction === null) {
    context.addIssue({ code: 'custom', path: ['nextAction'], message: 'ACTION_NOW projects require a next action' })
  }
  if (project.progress && project.progress.completed > project.progress.total) {
    context.addIssue({ code: 'custom', path: ['progress'], message: 'completed cannot exceed total' })
  }
  if (project.dependencies.some((dependency) => dependency.projectId === project.id)) {
    context.addIssue({ code: 'custom', path: ['dependencies'], message: 'A project cannot depend on itself' })
  }

  // Snapshot generation is never project or session evidence.
  for (const field of ['lastMeaningfulActivity', 'statusUpdatedAt'] as const) {
    const value = project.activity[field]
    if (value.status === 'KNOWN' && value.source === 'SNAPSHOT') {
      context.addIssue({
        code: 'custom',
        path: ['activity', field],
        message: `${field} must not be attributed to the dashboard snapshot generation`,
      })
    }
  }
})

export const ProjectRegistrySchema = z.object({
  schemaVersion: z.literal(PROJECT_STATE_SCHEMA_VERSION),
  version: z.number().int().positive(),
  updatedAt: IsoDateSchema,
  projects: z.array(ProjectStateSchema).min(1),
}).strict().superRefine((registry, context) => {
  const seen = new Set<string>()
  registry.projects.forEach((project, index) => {
    if (seen.has(project.id)) {
      context.addIssue({ code: 'custom', path: ['projects', index, 'id'], message: 'Project ids must be unique' })
    }
    seen.add(project.id)
  })
})

export type TriageState = z.infer<typeof TriageStateSchema>
export type EvidenceLink = z.infer<typeof EvidenceLinkSchema>
export type ActivityEvidenceSource = z.infer<typeof ActivityEvidenceSourceSchema>
export type EvidenceTimestamp = z.infer<typeof EvidenceTimestampSchema>
export type ProjectActivity = z.infer<typeof ProjectActivitySchema>
export type ArenaSessionState = z.infer<typeof ArenaSessionStateSchema>
export type ArenaSessionClosureStatus = z.infer<typeof ArenaSessionClosureStatusSchema>
export type ArenaSession = z.infer<typeof ArenaSessionSchema>
export type HistoryEvent = z.infer<typeof HistoryEventSchema>
export type HistoryEventType = z.infer<typeof HistoryEventTypeSchema>
export type ProjectHistory = z.infer<typeof ProjectHistorySchema>
export type ProjectState = z.infer<typeof ProjectStateSchema>
export type ProjectRegistry = z.infer<typeof ProjectRegistrySchema>
export type Freshness = 'FRESH' | 'STALE'

export function parseProjectRegistry(input: unknown): ProjectRegistry {
  return ProjectRegistrySchema.parse(input)
}

export function getFreshness(project: ProjectState, now: Date): Freshness {
  const lastUpdated = new Date(`${project.lastUpdated}T00:00:00Z`).getTime()
  const elapsedDays = Math.floor((now.getTime() - lastUpdated) / 86_400_000)
  return elapsedDays >= project.staleAfterDays ? 'STALE' : 'FRESH'
}
