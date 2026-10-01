/**
 * Deterministic derivation of portfolio activity and Arena session state.
 *
 * The dashboard is a periodic, read-only observer: every value in this module is
 * derived from normalized evidence, never from the snapshot clock, and never by
 * assuming that a commit, pull request, merge, validation result or status update
 * closed an Arena session.
 *
 * Derivation is pure and clock-injected so the documented states can be tested
 * deterministically.
 */
import {
  type ActivityEvidenceSource,
  type ArenaSession,
  type ArenaSessionClosureStatus,
  type ArenaSessionState,
  type EvidenceLink,
  type EvidenceTimestamp,
} from '../contract/project-state.js'

/** Evidence kinds that may describe project or session activity. */
export type ActivitySignalSource = Exclude<ActivityEvidenceSource, 'SNAPSHOT'>

/**
 * One attributable piece of evidence supplied by a source adapter before
 * normalization. `at` is an ISO-8601 UTC timestamp taken from the evidence
 * itself; a source must never synthesize it from its own clock.
 */
export interface ActivitySignal {
  at: string
  source: ActivitySignalSource
  sourceId: string
  evidenceUrl: string | null
}

/** Deterministic preference when two signals carry the same timestamp. */
const SOURCE_PRIORITY: Record<ActivitySignalSource, number> = {
  COMMIT: 0,
  PULL_REQUEST: 1,
  WORKFLOW_RUN: 2,
  CHECK_RUN: 3,
  PROJECT_STATUS: 4,
  ROADMAP: 5,
  MANUAL: 6,
  FIXTURE: 7,
}

function sortSignals(signals: readonly ActivitySignal[]): ActivitySignal[] {
  return [...signals].sort((left, right) => {
    const byTime = Date.parse(right.at) - Date.parse(left.at)
    if (byTime !== 0) return byTime
    const bySource = SOURCE_PRIORITY[left.source] - SOURCE_PRIORITY[right.source]
    if (bySource !== 0) return bySource
    return left.sourceId.localeCompare(right.sourceId)
  })
}

function toKnown(signal: ActivitySignal): EvidenceTimestamp {
  return {
    status: 'KNOWN',
    at: signal.at,
    source: signal.source,
    sourceId: signal.sourceId,
    evidenceUrl: signal.evidenceUrl,
  }
}

/** Normalizes one signal, or records the reason why no timestamp is available. */
export function toEvidenceTimestamp(
  signal: ActivitySignal | null,
  unavailableReason: string,
): EvidenceTimestamp {
  return signal ? toKnown(signal) : { status: 'UNAVAILABLE', reason: unavailableReason }
}

/**
 * The newest attributable evidence that the project itself changed. Commits, pull
 * requests, workflow/check activity and canonical status artifacts are all valid
 * activity evidence; snapshot generation is not accepted here.
 */
export function deriveLastMeaningfulActivity(signals: readonly ActivitySignal[]): EvidenceTimestamp {
  const [newest] = sortSignals(signals)
  return toEvidenceTimestamp(
    newest ?? null,
    'No attributable project activity evidence was readable from the configured sources',
  )
}

/**
 * When the canonical status artifact was itself last updated. Only canonical
 * status and supporting roadmap evidence can move this timestamp: a commit or a
 * pull request is activity, not an operational status update.
 */
export function deriveStatusUpdatedAt(signals: readonly ActivitySignal[]): EvidenceTimestamp {
  const statusSignals = signals.filter(
    (signal) => signal.source === 'PROJECT_STATUS' || signal.source === 'ROADMAP',
  )
  const [newest] = sortSignals(statusSignals)
  return toEvidenceTimestamp(
    newest ?? null,
    'No canonical status artifact carried an attributable "Last updated" value',
  )
}

export type ActivityFreshness = 'FRESH' | 'STALE' | 'UNKNOWN'

/**
 * Activity freshness relative to the project's configured stale threshold.
 * Missing activity stays `UNKNOWN`: the absence of evidence is not staleness.
 */
export function getActivityFreshness(
  activity: EvidenceTimestamp,
  now: Date,
  staleAfterDays: number,
): ActivityFreshness {
  if (activity.status !== 'KNOWN') return 'UNKNOWN'
  const elapsedDays = Math.floor((now.getTime() - Date.parse(activity.at)) / 86_400_000)
  return elapsedDays >= staleAfterDays ? 'STALE' : 'FRESH'
}

// --- Arena session ----------------------------------------------------------

/**
 * A session that is still evidenced as open but has produced no attributable
 * evidence for this many hours is reported as `STALE_SESSION` instead of being
 * silently treated as active work.
 */
export const ARENA_SESSION_INACTIVITY_THRESHOLD_HOURS = 24

/** Explicit session declarations a canonical project-status artifact may carry. */
export type DeclaredSessionState = 'NOT_ACTIVE' | 'ACTIVE' | 'WAITING_FOR_VALIDATION' | 'CLOSED'

/** Completeness of the checkpoint work as recorded by canonical status evidence. */
export type CheckpointWorkState = 'COMPLETE' | 'VALIDATING' | 'IN_PROGRESS'

/**
 * Normalized session evidence handed to the derivation. Every field is optional
 * evidence: absent evidence yields `UNKNOWN`, never an assumed state.
 */
export interface ArenaSessionEvidence {
  checkpoint: string | null
  /** Explicit `Session state` declaration from the canonical status artifact. */
  declaredSessionState: DeclaredSessionState | null
  sessionStartedAt: ActivitySignal | null
  sessionLastActivityAt: ActivitySignal | null
  /** Explicit `Session closure` declaration; null when the artifact says nothing. */
  closureStatus: Extract<ArenaSessionClosureStatus, 'CONFIRMED' | 'NOT_CONFIRMED'> | null
  closureEvidence: EvidenceLink | null
  /** Checkpoint completeness read from the canonical `Status:` label. */
  checkpointWorkState: CheckpointWorkState | null
  /** Raw canonical status label, kept so the derived reason is traceable. */
  checkpointStatusLabel: string | null
  /**
   * Newest attributable project activity. Used as the session activity fallback
   * only when a session is explicitly evidenced; absent session evidence never
   * becomes activity.
   */
  projectActivity: ActivitySignal | null
  /** Evidence references the state was derived from. */
  evidence: EvidenceLink[]
  /** Recorded when no session evidence was readable at all. */
  unavailableReason: string
}

export interface DeriveArenaSessionOptions {
  /** Observation time; required so staleness is deterministic and testable. */
  now: Date
  inactivityThresholdHours?: number
}

function session(
  fields: Pick<ArenaSession, 'sessionCheckpoint' | 'sessionStartedAt' | 'sessionLastActivityAt' | 'sessionClosureEvidence' | 'sessionStateEvidence'>,
  sessionState: ArenaSessionState,
  sessionClosureStatus: ArenaSessionClosureStatus,
  sessionStateReason: string,
): ArenaSession {
  return { ...fields, sessionState, sessionClosureStatus, sessionStateReason }
}

/**
 * Derives the observed Arena session state.
 *
 * Rules that must never be weakened:
 * - a commit, merge, validation result or status update is not session closure;
 * - `CLOSED` requires explicit closure evidence;
 * - a session that looks open but has stopped producing evidence beyond the
 *   inactivity threshold is `STALE_SESSION`, not `ACTIVE`;
 * - insufficient evidence is `UNKNOWN`, never a guess.
 */
export function deriveArenaSession(
  evidence: ArenaSessionEvidence,
  options: DeriveArenaSessionOptions,
): ArenaSession {
  const thresholdHours = options.inactivityThresholdHours ?? ARENA_SESSION_INACTIVITY_THRESHOLD_HOURS
  const sessionIsEvidenced = evidence.declaredSessionState !== null
    || evidence.closureStatus !== null
    || evidence.sessionStartedAt !== null
    || evidence.sessionLastActivityAt !== null
  // Project activity may stand in for session activity only when a session is
  // actually evidenced; without session evidence there is nothing to attribute.
  const fallbackActivity = sessionIsEvidenced && evidence.sessionLastActivityAt === null
    ? evidence.projectActivity
    : null
  const effectiveActivity = evidence.sessionLastActivityAt ?? fallbackActivity
  const fields = {
    sessionCheckpoint: evidence.checkpoint,
    sessionStartedAt: toEvidenceTimestamp(
      evidence.sessionStartedAt,
      'No attributable Arena session start timestamp was found',
    ),
    sessionLastActivityAt: toEvidenceTimestamp(
      effectiveActivity,
      'No attributable Arena session activity timestamp was found',
    ),
    sessionClosureEvidence: evidence.closureEvidence,
    sessionStateEvidence: evidence.evidence,
  }

  if (evidence.closureStatus === 'CONFIRMED' && evidence.closureEvidence) {
    return session(
      fields,
      'CLOSED',
      'CONFIRMED',
      `Explicit Arena session closure evidence: ${evidence.closureEvidence.label}`,
    )
  }

  if (evidence.declaredSessionState === 'NOT_ACTIVE') {
    return session(
      fields,
      'NOT_ACTIVE',
      'UNKNOWN',
      'Canonical project evidence declares that no Arena session is running',
    )
  }

  if (!sessionIsEvidenced) {
    return session(
      fields,
      'UNKNOWN',
      'UNKNOWN',
      evidence.unavailableReason,
    )
  }

  if (!effectiveActivity) {
    return session(
      fields,
      'UNKNOWN',
      evidence.closureStatus === 'NOT_CONFIRMED' ? 'NOT_CONFIRMED' : 'UNKNOWN',
      'Arena session evidence exists but no attributable session activity timestamp is available',
    )
  }

  const inactivityHours = (options.now.getTime() - Date.parse(effectiveActivity.at)) / 3_600_000
  const activityProvenance = evidence.sessionLastActivityAt
    ? `last session activity ${effectiveActivity.at} (${effectiveActivity.sourceId})`
    : `last attributable project activity ${effectiveActivity.at} (${effectiveActivity.sourceId})`

  if (inactivityHours >= thresholdHours) {
    return session(
      fields,
      'STALE_SESSION',
      'NOT_CONFIRMED',
      `Arena session is still evidenced as open, but ${activityProvenance} is older than the ${thresholdHours}h inactivity threshold`,
    )
  }

  const workCompleteReason = evidence.checkpointStatusLabel
    ? `canonical status "${evidence.checkpointStatusLabel}"`
    : 'canonical checkpoint completion evidence'

  if (evidence.declaredSessionState === 'CLOSED') {
    // Closure declared without evidence must never become CLOSED.
    if (evidence.checkpointWorkState === 'COMPLETE') {
      return session(
        fields,
        'READY_TO_CLOSE',
        'NOT_CONFIRMED',
        `Arena session closure is declared without closure evidence, and ${workCompleteReason} shows the checkpoint work is complete`,
      )
    }
    return session(
      fields,
      'ACTIVE',
      'NOT_CONFIRMED',
      'Arena session closure is declared without closure evidence, and the checkpoint work is not evidenced as complete',
    )
  }

  if (evidence.declaredSessionState === 'WAITING_FOR_VALIDATION' || evidence.checkpointWorkState === 'VALIDATING') {
    return session(
      fields,
      'WAITING_FOR_VALIDATION',
      'NOT_CONFIRMED',
      `Implementation work is evidenced as finished and validation is still pending per ${workCompleteReason}`,
    )
  }

  if (evidence.checkpointWorkState === 'COMPLETE') {
    return session(
      fields,
      'READY_TO_CLOSE',
      'NOT_CONFIRMED',
      `Checkpoint work is evidenced as complete per ${workCompleteReason}, and no explicit Arena session closure evidence exists`,
    )
  }

  return session(
    fields,
    'ACTIVE',
    'NOT_CONFIRMED',
    `An Arena session is evidenced as working: ${activityProvenance}`,
  )
}
