import type { ProjectState } from '../contract/project-state.js'
import { PROJECT_STATE_SCHEMA_VERSION } from '../contract/project-state.js'
import {
  deriveArenaSession,
  deriveLastMeaningfulActivity,
  deriveStatusUpdatedAt,
  type ActivitySignal,
  type ArenaSessionEvidence,
  type CheckpointWorkState,
  type DeclaredSessionState,
} from '../monitoring/derived-state.js'
import {
  buildRepositoryHistory,
  unavailableHistory,
  type RepositoryHistoryEvidence,
  type StatusRevisionLabels,
} from '../monitoring/history-derivation.js'

// --- Input types -----------------------------------------------------------

export interface RepositoryArtifact {
  path: string
  ref: string
  sha: string
  htmlUrl: string
  content: string
}

export interface AlternateStatus {
  branch: string
  artifact: RepositoryArtifact
}

export interface RepositorySnapshot {
  projectId: string
  name: string
  summary: string
  repo: string
  defaultBranch: string
  headSha: string
  /** Required ISO timestamp from the repository HEAD commit; never a sync clock. */
  headCommittedAt: string
  retrievedAt: string
  /** Snapshot generation timestamp (ISO-8601 UTC). Never project activity. */
  generatedAt: string
  /** Identity of the generated snapshot, e.g. the canonical cache path. */
  snapshotSourceId: string
  artifacts: RepositoryArtifact[]
  alternateStatus?: AlternateStatus
  /**
   * Recent commits, pull request lifecycle and status-artifact revisions read by
   * the synchronization. Absent evidence normalizes to an explicit `UNAVAILABLE`
   * history, never to an empty-looking one.
   */
  historyEvidence?: RepositoryHistoryEvidence
}

// --- Status mapping --------------------------------------------------------

const STATUS_TO_TRIAGE: Record<string, ProjectState['triageState']> = {
  PASS: 'DONE',
  READY: 'READY',
  IN_PROGRESS: 'IN_PROGRESS',
  BLOCKED: 'BLOCKED',
  VALIDATION: 'VALIDATION',
  HOLD: 'HOLD',
  DONE: 'DONE',
}

/** Canonical `Status:` labels that mean the checkpoint work itself is complete. */
const STATUSES_WITH_COMPLETE_WORK = new Set(['PASS', 'DONE'])

function mapCheckpointWorkState(raw: string | null): CheckpointWorkState | null {
  if (!raw) return null
  const normalized = raw.toUpperCase().replace(/\s+/g, '_')
  if (STATUSES_WITH_COMPLETE_WORK.has(normalized)) return 'COMPLETE'
  if (normalized === 'VALIDATION') return 'VALIDATING'
  if (normalized in STATUS_TO_TRIAGE) return 'IN_PROGRESS'
  return null
}

// --- Parsing helpers -------------------------------------------------------

function findArtifact(
  artifacts: RepositoryArtifact[],
  names: readonly string[],
): RepositoryArtifact | undefined {
  for (const name of names) {
    const match = artifacts.find((a) => a.path === name)
    if (match) return match
  }
  return undefined
}

interface ParsedLabels {
  checkpoint: string | null
  status: string | null
  nextAction: string | null
  blocker: string | null
  lastUpdated: string | null
}

function parseLabels(content: string): ParsedLabels {
  const result: ParsedLabels = {
    checkpoint: null,
    status: null,
    nextAction: null,
    blocker: null,
    lastUpdated: null,
  }

  const checkpointMatch = content.match(
    /Current checkpoint:\s*`([^`]+)`/i,
  )
  if (checkpointMatch) result.checkpoint = checkpointMatch[1].trim()

  const statusMatch = content.match(/Status:\s*`([^`]+)`/i)
  if (statusMatch) result.status = statusMatch[1].trim()

  const nextMatch = content.match(/Next\s*\n`([^`]+)`/i)
  if (nextMatch) result.nextAction = nextMatch[1].trim()

  const blockerMatch = content.match(/Blocker\s*\n`([^`]+)`/i)
  if (blockerMatch) result.blocker = blockerMatch[1].trim()

  const updatedMatch = content.match(/Last updated:\s*(.+)/i)
  if (updatedMatch) result.lastUpdated = updatedMatch[1].trim()

  return result
}

/**
 * Canonical labels of one revision of a status artifact, read with the same
 * parser as the current state so the newest revision can never disagree with it.
 */
export function readStatusRevisionLabels(content: string): StatusRevisionLabels {
  const labels = parseLabels(content)
  return {
    checkpoint: labels.checkpoint,
    status: labels.status,
    blocker: normalizeNullableText(labels.blocker),
  }
}

/**
 * Optional canonical Arena session block of a project-status artifact.
 *
 * ```text
 * ## Arena Session
 * Session state: `ACTIVE`
 * Session checkpoint: `CP-14 — Portfolio Activity & Arena Session State Contract`
 * Session started: 2026-10-01T09:12:00Z
 * Last session activity: 2026-10-01T14:32:00Z
 * Session closure: `NOT_CONFIRMED`
 * Session closure evidence: https://github.com/owner/repo/pull/12
 * ```
 *
 * The block is optional. An absent or unreadable block yields no session
 * evidence, which normalizes to `UNKNOWN` — never to `CLOSED`.
 */
export interface ParsedSessionLabels {
  declaredSessionState: DeclaredSessionState | null
  /** Raw `Session state` value when it is not a recognized declaration. */
  unrecognizedSessionState: string | null
  checkpoint: string | null
  startedAt: string | null
  lastActivityAt: string | null
  closureStatus: 'CONFIRMED' | 'NOT_CONFIRMED' | null
  unrecognizedClosureStatus: string | null
  closureEvidenceUrl: string | null
}

const DECLARED_SESSION_STATES: DeclaredSessionState[] = [
  'NOT_ACTIVE',
  'ACTIVE',
  'WAITING_FOR_VALIDATION',
  'CLOSED',
]

function parseSessionLabels(content: string): ParsedSessionLabels {
  const result: ParsedSessionLabels = {
    declaredSessionState: null,
    unrecognizedSessionState: null,
    checkpoint: null,
    startedAt: null,
    lastActivityAt: null,
    closureStatus: null,
    unrecognizedClosureStatus: null,
    closureEvidenceUrl: null,
  }

  const stateMatch = content.match(/^Session state:\s*`?([A-Za-z_]+)`?/im)
  if (stateMatch) {
    const raw = stateMatch[1].toUpperCase()
    const declared = DECLARED_SESSION_STATES.find((state) => state === raw)
    if (declared) result.declaredSessionState = declared
    else result.unrecognizedSessionState = stateMatch[1]
  }

  const checkpointMatch = content.match(/^Session checkpoint:\s*`([^`]+)`/im)
  if (checkpointMatch) result.checkpoint = checkpointMatch[1].trim()

  const startedMatch = content.match(/^Session started:\s*(\S+)/im)
  if (startedMatch) result.startedAt = normalizeIsoTimestamp(startedMatch[1])

  const activityMatch = content.match(/^(?:Last session activity|Session last activity):\s*(\S+)/im)
  if (activityMatch) result.lastActivityAt = normalizeIsoTimestamp(activityMatch[1])

  const closureMatch = content.match(/^Session closure:(?!\s*evidence)\s*`?([A-Za-z_]+)`?/im)
  if (closureMatch) {
    const raw = closureMatch[1].toUpperCase()
    if (raw === 'CONFIRMED' || raw === 'NOT_CONFIRMED') result.closureStatus = raw
    else result.unrecognizedClosureStatus = closureMatch[1]
  }

  const closureEvidenceMatch = content.match(/^Session closure evidence:\s*(\S+)/im)
  if (closureEvidenceMatch && /^https?:\/\//i.test(closureEvidenceMatch[1])) {
    result.closureEvidenceUrl = closureEvidenceMatch[1]
  }

  return result
}

/** Truncates an ISO timestamp to the contract's second-precision UTC format. */
function normalizeIsoTimestamp(raw: string): string | null {
  const parsed = Date.parse(raw)
  if (Number.isNaN(parsed)) return null
  return new Date(parsed).toISOString().replace(/\.\d{3}Z$/, 'Z')
}

function normalizeNullableText(value: string | null): string | null {
  if (!value) return null
  return /^(none|no blocker)[.!]?$/i.test(value.trim()) ? null : value.trim()
}

function mapStatus(raw: string | null): ProjectState['triageState'] {
  if (!raw) return null
  const upper = raw.toUpperCase().replace(/\s+/g, '_')
  return STATUS_TO_TRIAGE[upper] ?? null
}

function toIsoDate(raw: string | null, fallback: string): string {
  const fallbackMatch = fallback.match(/(\d{4}-\d{2}-\d{2})/)
  const match = raw?.match(/(\d{4}-\d{2}-\d{2})/)
  if (match) return match[1]
  if (fallbackMatch) return fallbackMatch[1]
  throw new Error(`No attributable ISO date in status artifact or HEAD commit: ${fallback}`)
}

function buildEvidenceUrl(artifact: RepositoryArtifact, repo: string): string {
  if (artifact.htmlUrl) return artifact.htmlUrl
  return `https://github.com/${repo}/blob/${artifact.ref}/${artifact.path}`
}

/** A declared calendar date has no time component; midnight UTC is explicit. */
function dateToTimestamp(isoDate: string): string | null {
  return normalizeIsoTimestamp(`${isoDate}T00:00:00Z`)
}

// --- Main adapter ----------------------------------------------------------

export function adaptGithubSource(snapshot: RepositorySnapshot): ProjectState {
  const {
    projectId,
    name,
    summary,
    repo,
    headSha,
    headCommittedAt,
    generatedAt,
    snapshotSourceId,
    artifacts,
    alternateStatus,
    historyEvidence,
  } = snapshot

  const primaryNames = ['PROJECT_STATUS.md', 'STATUS.md'] as const
  const primary = findArtifact(artifacts, primaryNames)
  const roadmap = artifacts.find((artifact) => artifact.path === 'ROADMAP.md' || artifact.path.endsWith('/ROADMAP.md'))

  const primaryLabels = primary ? parseLabels(primary.content) : null
  // ROADMAP is supporting: only consulted when a primary status artifact exists
  const roadmapLabels = primary && roadmap ? parseLabels(roadmap.content) : null

  // Priority: primary artifact labels win; roadmap only fills gaps
  const checkpoint =
    primaryLabels?.checkpoint ?? roadmapLabels?.checkpoint ?? null
  const rawStatus = primaryLabels?.status ?? roadmapLabels?.status ?? null
  const nextAction =
    primaryLabels?.nextAction ?? roadmapLabels?.nextAction ?? null
  const blocker = normalizeNullableText(
    primaryLabels?.blocker ?? roadmapLabels?.blocker ?? null,
  )
  const parsedDate =
    primaryLabels?.lastUpdated ?? roadmapLabels?.lastUpdated ?? null

  const triageState = mapStatus(rawStatus)
  const lastUpdated = toIsoDate(parsedDate, headCommittedAt)

  // --- Activity evidence ----------------------------------------------------

  const artifactSignal = (
    artifact: RepositoryArtifact | undefined,
    source: 'PROJECT_STATUS' | 'ROADMAP',
  ): ActivitySignal | null => {
    if (!artifact) return null
    const declared = parseLabels(artifact.content).lastUpdated
    const declaredDate = declared?.match(/(\d{4}-\d{2}-\d{2})/)?.[1] ?? null
    const at = declaredDate ? dateToTimestamp(declaredDate) : null
    if (!at) return null
    return {
      at,
      source,
      sourceId: `${artifact.sha}:${artifact.path}`,
      evidenceUrl: buildEvidenceUrl(artifact, repo),
    }
  }

  const activitySignals: ActivitySignal[] = [
    {
      at: normalizeIsoTimestamp(headCommittedAt) ?? headCommittedAt,
      source: 'COMMIT',
      sourceId: headSha,
      evidenceUrl: `https://github.com/${repo}/commit/${headSha}`,
    },
  ]
  const statusSignals: ActivitySignal[] = []
  const primarySignal = artifactSignal(primary, 'PROJECT_STATUS')
  if (primarySignal) { activitySignals.push(primarySignal); statusSignals.push(primarySignal) }
  const roadmapSignal = artifactSignal(roadmap, 'ROADMAP')
  if (roadmapSignal) activitySignals.push(roadmapSignal)

  const activity: ProjectState['activity'] = {
    lastMeaningfulActivity: deriveLastMeaningfulActivity(activitySignals),
    statusUpdatedAt: deriveStatusUpdatedAt(statusSignals),
    snapshotGeneratedAt: { at: generatedAt, source: 'SNAPSHOT', sourceId: snapshotSourceId },
  }

  // --- Arena session evidence ----------------------------------------------

  const sessionLabels = primary ? parseSessionLabels(primary.content) : null
  const primaryRef = primary
    ? { label: primary.path, url: buildEvidenceUrl(primary, repo), sourceId: `${primary.sha}:${primary.path}` }
    : null
  const sessionEvidenceRefs = primaryRef ? [primaryRef] : []

  let unavailableReason: string
  if (!primary) {
    unavailableReason = 'No canonical PROJECT_STATUS.md or STATUS.md artifact was readable, so no Arena session evidence could be attributed'
  } else if (sessionLabels?.unrecognizedSessionState ?? sessionLabels?.unrecognizedClosureStatus) {
    const unrecognized = sessionLabels.unrecognizedSessionState ?? sessionLabels.unrecognizedClosureStatus
    unavailableReason = `Unrecognized Arena session declaration "${unrecognized}" in ${primary.path}`
  } else {
    unavailableReason = `No Arena session evidence found in ${primary.path}`
  }

  const sessionTimestamp = (at: string | null | undefined): ActivitySignal | null =>
    at && primaryRef
      ? { at, source: 'PROJECT_STATUS', sourceId: primaryRef.sourceId, evidenceUrl: primaryRef.url }
      : null

  const sessionEvidence: ArenaSessionEvidence = {
    checkpoint: sessionLabels?.checkpoint ?? checkpoint,
    declaredSessionState: sessionLabels?.declaredSessionState ?? null,
    sessionStartedAt: sessionTimestamp(sessionLabels?.startedAt),
    sessionLastActivityAt: sessionTimestamp(sessionLabels?.lastActivityAt),
    closureStatus: sessionLabels?.closureStatus ?? null,
    // A closure reference is only carried when the artifact actually declares
    // a confirmed closure; a bare link must never look like closure evidence.
    closureEvidence: sessionLabels?.closureStatus === 'CONFIRMED' && sessionLabels.closureEvidenceUrl && primaryRef
      ? { label: `${primaryRef.label} (session closure)`, url: sessionLabels.closureEvidenceUrl, sourceId: primaryRef.sourceId }
      : null,
    checkpointWorkState: mapCheckpointWorkState(rawStatus),
    checkpointStatusLabel: rawStatus,
    // The snapshot clock is structurally excluded from session activity.
    projectActivity:
      activity.lastMeaningfulActivity.status === 'KNOWN'
      && activity.lastMeaningfulActivity.source !== 'SNAPSHOT'
        ? {
            at: activity.lastMeaningfulActivity.at,
            source: activity.lastMeaningfulActivity.source,
            sourceId: activity.lastMeaningfulActivity.sourceId,
            evidenceUrl: activity.lastMeaningfulActivity.evidenceUrl,
          }
        : null,
    evidence: sessionEvidenceRefs,
    unavailableReason,
  }

  const session = deriveArenaSession(sessionEvidence, { now: new Date(generatedAt) })

  // --- Live history ---------------------------------------------------------

  const history: ProjectState['history'] = historyEvidence
    ? buildRepositoryHistory(historyEvidence, session)
    : unavailableHistory('The synchronization did not collect commit, pull request, status or session history evidence for this repository')

  // --- Conflict detection --------------------------------------------------

  let triageSource: ProjectState['triageSource']

  if (alternateStatus) {
    const altLabels = parseLabels(alternateStatus.artifact.content)
    const altTriage = mapStatus(altLabels.status)
    const rawStatusesDiffer = (altLabels.status ?? '').trim().toUpperCase()
      !== (rawStatus ?? '').trim().toUpperCase()
    const statusDocumentsDiffer = alternateStatus.artifact.content.trim()
      !== (primary?.content.trim() ?? '')

    if (altTriage !== triageState || rawStatusesDiffer || statusDocumentsDiffer) {
      const primarySourceId = primary
        ? `${primary.sha}:${primary.path}`
        : 'missing-primary'
      const altSourceId = `${alternateStatus.artifact.sha}:${alternateStatus.artifact.path}`
      const reason = rawStatusesDiffer || altTriage !== triageState
        ? `Default branch status "${rawStatus ?? 'missing'}" differs from ${alternateStatus.branch} status "${altLabels.status ?? 'missing'}"`
        : `Status documents differ between ${snapshot.defaultBranch} and ${alternateStatus.branch}`
      triageSource = {
        status: 'CONFLICT',
        sourceIds: [primarySourceId, altSourceId],
        reason,
      }
    } else {
      triageSource = {
        status: 'KNOWN',
        sourceId: primary
          ? `${primary.sha}:${primary.path}`
          : 'no-status-artifact',
      }
    }
  } else if (triageState === null) {
    triageSource = {
      status: 'UNKNOWN',
      reason: primary
        ? rawStatus === null
          ? `No canonical Status label found in ${primary.path}`
          : `Unrecognized status value "${rawStatus}"`
        : 'No status artifact found in repository',
    }
  } else {
    triageSource = {
      status: 'KNOWN',
      sourceId: primary
        ? `${primary.sha}:${primary.path}`
        : 'no-status-artifact',
    }
  }

  // When CONFLICT or UNKNOWN, triageState must be null per contract
  const effectiveTriageState =
    triageSource.status === 'CONFLICT' || triageSource.status === 'UNKNOWN'
      ? null
      : triageState

  // --- Evidence links ------------------------------------------------------

  const evidenceLinks: ProjectState['evidenceLinks'] = []
  for (const artifact of artifacts) {
    evidenceLinks.push({
      label: artifact.path,
      url: buildEvidenceUrl(artifact, repo),
      sourceId: `${artifact.sha}:${artifact.path}`,
    })
  }

  // --- Assemble ProjectState ------------------------------------------------

  return {
    schemaVersion: PROJECT_STATE_SCHEMA_VERSION,
    id: projectId,
    name,
    summary,
    repo,
    triageState: effectiveTriageState,
    triageSource,
    stage: null,
    checkpoint,
    progress: null,
    lastUpdated,
    activity,
    session,
    history,
    blocker,
    nextAction,
    evidenceLinks,
    dependencies: [],
    tools: [],
    approvals: [],
    source: { kind: 'REPOSITORY', id: repo },
    staleAfterDays: 7,
  }
}
