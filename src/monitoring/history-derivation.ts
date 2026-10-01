/**
 * Deterministic derivation of the live project history (CP-17).
 *
 * The history is a pure function of evidence the existing synchronization read
 * from GitHub: recent commits, pull request lifecycle changes, revisions of the
 * canonical status artifact, and the Arena session block of that artifact.
 *
 * Rules that must never be weakened:
 * - an event exists only because a concrete piece of evidence exists; nothing is
 *   manufactured from a snapshot, a merge, or the absence of evidence;
 * - the snapshot clock is never an event time;
 * - a commit, merge or status update is never turned into a session event —
 *   session events come only from the explicit session evidence;
 * - evidence that cannot be read or attributed is recorded as an explicit gap.
 */
import type {
  ArenaSession,
  HistoryEvent,
  ProjectHistory,
} from '../contract/project-state.js'
import { compareHistoryEvents } from '../contract/project-state.js'
import { ARENA_SESSION_INACTIVITY_THRESHOLD_HOURS } from './derived-state.js'

/** Size of the recent window collected per evidence source. */
export const HISTORY_LIMITS = {
  commits: 15,
  pullRequests: 10,
  statusRevisions: 10,
} as const

export interface CommitEvidence {
  sha: string
  committedAt: string
  /** Full commit message; only its first line is kept as the event summary. */
  message: string
  url: string
}

export interface PullRequestEvidence {
  number: number
  title: string
  url: string
  createdAt: string
  mergedAt: string | null
  closedAt: string | null
  mergeCommitSha: string | null
}

/** Canonical status labels of one revision of the status artifact. */
export interface StatusRevisionLabels {
  checkpoint: string | null
  /** Raw canonical `Status:` label. */
  status: string | null
  /** Blocker text; `null` when the artifact declares none. */
  blocker: string | null
}

export interface StatusRevisionEvidence {
  /** Commit that produced this revision of the status artifact. */
  sha: string
  committedAt: string
  url: string
  /** `null` when the artifact could not be read at this revision. */
  labels: StatusRevisionLabels | null
}

export interface RepositoryHistoryEvidence {
  repo: string
  commits: readonly CommitEvidence[]
  pullRequests: readonly PullRequestEvidence[]
  /** Newest first; `null` when the repository has no canonical status artifact. */
  statusRevisions: readonly StatusRevisionEvidence[] | null
}

type HistoryGap = Extract<ProjectHistory, { status: 'KNOWN' }>['gaps'][number]

const SUMMARY_MAX_LENGTH = 140

/** Second-precision UTC, the contract's only timestamp format; `null` when unreadable. */
function normalizeTimestamp(raw: string | null | undefined): string | null {
  if (!raw) return null
  const parsed = Date.parse(raw)
  if (Number.isNaN(parsed)) return null
  return new Date(parsed).toISOString().replace(/\.\d{3}Z$/, 'Z')
}

function firstLine(text: string): string {
  const line = text.split(/\r?\n/, 1)[0].trim()
  if (line.length === 0) return '(empty message)'
  return line.length > SUMMARY_MAX_LENGTH ? `${line.slice(0, SUMMARY_MAX_LENGTH - 1)}…` : line
}

function event(fields: Omit<HistoryEvent, 'id'>): HistoryEvent {
  return { id: `${fields.type}:${fields.sourceId}`, ...fields }
}

// --- GitHub evidence ---------------------------------------------------------

function deriveCommitEvents(
  evidence: RepositoryHistoryEvidence,
  gaps: HistoryGap[],
): HistoryEvent[] {
  // A merge commit that a collected pull request already accounts for is the same
  // fact as that PR's merge event; it is represented once, by the PR evidence.
  const accountedMerges = new Set(
    evidence.pullRequests
      .filter((pull) => pull.mergedAt !== null && pull.mergeCommitSha !== null)
      .map((pull) => pull.mergeCommitSha as string),
  )
  const events: HistoryEvent[] = []
  let unreadable = 0
  for (const commit of evidence.commits) {
    if (accountedMerges.has(commit.sha)) continue
    const occurredAt = normalizeTimestamp(commit.committedAt)
    if (!occurredAt) { unreadable += 1; continue }
    events.push(event({
      type: 'COMMIT',
      occurredAt,
      timeBasis: 'EVENT',
      summary: firstLine(commit.message),
      from: null,
      to: null,
      source: 'COMMIT',
      sourceId: commit.sha,
      evidenceUrl: commit.url,
    }))
  }
  if (unreadable > 0) {
    gaps.push({ area: 'COMMITS', reason: `${unreadable} commit(s) carried no readable timestamp and were not recorded` })
  }
  return events
}

function derivePullRequestEvents(
  evidence: RepositoryHistoryEvidence,
  gaps: HistoryGap[],
): HistoryEvent[] {
  const events: HistoryEvent[] = []
  let unreadable = 0
  for (const pull of evidence.pullRequests) {
    const sourceId = `${evidence.repo}#${pull.number}`
    const title = `#${pull.number} ${firstLine(pull.title)}`
    const base = { from: null, to: null, source: 'PULL_REQUEST', sourceId, evidenceUrl: pull.url, timeBasis: 'EVENT' } as const
    const opened = normalizeTimestamp(pull.createdAt)
    if (opened) events.push(event({ ...base, type: 'PULL_REQUEST_OPENED', occurredAt: opened, summary: `Opened ${title}` }))
    else unreadable += 1

    if (pull.mergedAt !== null) {
      const merged = normalizeTimestamp(pull.mergedAt)
      if (merged) events.push(event({ ...base, type: 'PULL_REQUEST_MERGED', occurredAt: merged, summary: `Merged ${title}` }))
      else unreadable += 1
    } else if (pull.closedAt !== null) {
      const closed = normalizeTimestamp(pull.closedAt)
      if (closed) events.push(event({ ...base, type: 'PULL_REQUEST_CLOSED', occurredAt: closed, summary: `Closed without merge ${title}` }))
      else unreadable += 1
    }
  }
  if (unreadable > 0) {
    gaps.push({ area: 'PULL_REQUESTS', reason: `${unreadable} pull request lifecycle timestamp(s) were unreadable and were not recorded` })
  }
  return events
}

/**
 * Checkpoint, state and blocker transitions between consecutive revisions of the
 * canonical status artifact. The oldest collected revision is only a baseline: it
 * proves what the artifact said, not what changed in it.
 */
function deriveStatusEvents(
  revisions: readonly StatusRevisionEvidence[] | null,
  gaps: HistoryGap[],
): HistoryEvent[] {
  if (revisions === null) {
    gaps.push({
      area: 'STATUS_TRANSITIONS',
      reason: 'No canonical status artifact was readable, so checkpoint, state and blocker transitions cannot be derived',
    })
    return []
  }
  const ordered = [...revisions].sort((left, right) =>
    Date.parse(right.committedAt) - Date.parse(left.committedAt) || (left.sha < right.sha ? -1 : 1))
  if (ordered.length === 0) {
    gaps.push({ area: 'STATUS_TRANSITIONS', reason: 'The canonical status artifact has no readable revision history' })
    return []
  }
  const unreadableRevisions = ordered.filter((revision) => revision.labels === null).length
  if (unreadableRevisions > 0) {
    gaps.push({
      area: 'STATUS_TRANSITIONS',
      reason: `${unreadableRevisions} status revision(s) could not be read; transitions across them were not recorded`,
    })
  }

  const events: HistoryEvent[] = []
  for (let index = 0; index < ordered.length - 1; index += 1) {
    const newer = ordered[index]
    const older = ordered[index + 1]
    if (!newer.labels || !older.labels) continue
    const occurredAt = normalizeTimestamp(newer.committedAt)
    if (!occurredAt) continue
    const base = { occurredAt, timeBasis: 'EVENT', source: 'PROJECT_STATUS', sourceId: newer.sha, evidenceUrl: newer.url } as const

    const checkpointFrom = older.labels.checkpoint
    const checkpointTo = newer.labels.checkpoint
    if (checkpointFrom && checkpointTo && checkpointFrom !== checkpointTo) {
      events.push(event({
        ...base, type: 'CHECKPOINT_MOVED', from: checkpointFrom, to: checkpointTo,
        summary: `Checkpoint moved from ${checkpointFrom} to ${checkpointTo}`,
      }))
    }
    const statusFrom = older.labels.status?.toUpperCase() ?? null
    const statusTo = newer.labels.status?.toUpperCase() ?? null
    if (statusFrom && statusTo && statusFrom !== statusTo) {
      events.push(event({
        ...base, type: 'STATE_CHANGED', from: statusFrom, to: statusTo,
        summary: `Status changed from ${statusFrom} to ${statusTo}`,
      }))
    }
    if (older.labels.blocker !== newer.labels.blocker) {
      events.push(event({
        ...base, type: 'BLOCKER_CHANGED', from: older.labels.blocker, to: newer.labels.blocker,
        summary: newer.labels.blocker === null ? 'Blocker cleared' : older.labels.blocker === null ? 'Blocker recorded' : 'Blocker changed',
      }))
    }
  }
  return events
}

// --- Arena session lifecycle -------------------------------------------------

/**
 * Session lifecycle events come only from the explicit Arena session evidence of
 * the canonical status artifact. A commit, merge, validation result or status
 * update never produces one, and an unknown session produces no event — only an
 * explicit gap.
 */
function deriveSessionEvents(session: ArenaSession, gaps: HistoryGap[]): HistoryEvent[] {
  if (session.sessionState === 'UNKNOWN') {
    gaps.push({ area: 'SESSION', reason: session.sessionStateReason })
    return []
  }
  if (session.sessionState === 'NOT_ACTIVE') return []

  const artifact = session.sessionStateEvidence[0]
  if (!artifact) return []

  const base = { from: null, to: null, source: 'PROJECT_STATUS', sourceId: artifact.sourceId } as const
  const events: HistoryEvent[] = []

  if (session.sessionStartedAt.status === 'KNOWN') {
    events.push(event({
      ...base,
      type: 'SESSION_STARTED',
      occurredAt: session.sessionStartedAt.at,
      timeBasis: 'EVENT',
      summary: `Arena session started${session.sessionCheckpoint ? ` for ${session.sessionCheckpoint}` : ''}`,
      evidenceUrl: artifact.url,
    }))
  }

  const lastActivity = session.sessionLastActivityAt
  if (lastActivity.status !== 'KNOWN') {
    if (session.sessionState === 'CLOSED') {
      gaps.push({
        area: 'SESSION',
        reason: 'Explicit session closure is evidenced, but no attributable session activity time exists to place it on the timeline',
      })
    }
    return events
  }

  // A declared session activity is its own event. Activity borrowed from project
  // evidence only dates the state below; it is not claimed as session activity.
  if (lastActivity.source === 'PROJECT_STATUS') {
    events.push(event({
      ...base,
      type: 'SESSION_ACTIVITY',
      occurredAt: lastActivity.at,
      timeBasis: 'EVENT',
      summary: 'Arena session activity observed',
      evidenceUrl: artifact.url,
    }))
  }

  switch (session.sessionState) {
    case 'WAITING_FOR_VALIDATION':
      events.push(event({
        ...base,
        type: 'SESSION_WAITING_FOR_VALIDATION',
        occurredAt: lastActivity.at,
        timeBasis: 'SESSION_LAST_ACTIVITY',
        summary: 'Arena session is waiting for validation',
        evidenceUrl: artifact.url,
      }))
      break
    case 'READY_TO_CLOSE':
      events.push(event({
        ...base,
        type: 'SESSION_READY_TO_CLOSE',
        occurredAt: lastActivity.at,
        timeBasis: 'SESSION_LAST_ACTIVITY',
        summary: 'Checkpoint work is complete; session closure is not confirmed',
        evidenceUrl: artifact.url,
      }))
      break
    case 'CLOSED':
      if (session.sessionClosureEvidence) {
        events.push(event({
          ...base,
          type: 'SESSION_CLOSED',
          occurredAt: lastActivity.at,
          timeBasis: 'SESSION_LAST_ACTIVITY',
          summary: 'Explicit Arena session closure evidenced; the closure time itself is not declared',
          evidenceUrl: session.sessionClosureEvidence.url,
        }))
      }
      break
    case 'STALE_SESSION': {
      const staleAt = normalizeTimestamp(new Date(
        Date.parse(lastActivity.at) + ARENA_SESSION_INACTIVITY_THRESHOLD_HOURS * 3_600_000,
      ).toISOString())
      if (staleAt) {
        events.push(event({
          ...base,
          type: 'SESSION_STALE',
          occurredAt: staleAt,
          timeBasis: 'INACTIVITY_THRESHOLD',
          summary: `Open Arena session passed the ${ARENA_SESSION_INACTIVITY_THRESHOLD_HOURS}h inactivity threshold without closure evidence`,
          evidenceUrl: artifact.url,
        }))
      }
      break
    }
    default:
      break
  }
  return events
}

// --- Assembly ----------------------------------------------------------------

/** History for a project whose repository evidence was read by the synchronization. */
export function buildRepositoryHistory(
  evidence: RepositoryHistoryEvidence,
  session: ArenaSession,
): ProjectHistory {
  const gaps: HistoryGap[] = []
  const events = [
    ...deriveCommitEvents(evidence, gaps),
    ...derivePullRequestEvents(evidence, gaps),
    ...deriveStatusEvents(evidence.statusRevisions, gaps),
    ...deriveSessionEvents(session, gaps),
  ].sort(compareHistoryEvents)

  return {
    status: 'KNOWN',
    limits: { ...HISTORY_LIMITS },
    events,
    gaps,
  }
}

/** Explicit gap: no history evidence was read, and none is invented. */
export function unavailableHistory(reason: string): ProjectHistory {
  return { status: 'UNAVAILABLE', reason }
}
