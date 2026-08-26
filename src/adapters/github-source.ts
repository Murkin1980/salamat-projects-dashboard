import type { ProjectState } from '../contract/project-state.js'
import { PROJECT_STATE_SCHEMA_VERSION } from '../contract/project-state.js'

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
  repo: string
  defaultBranch: string
  headSha: string
  retrievedAt: string
  artifacts: RepositoryArtifact[]
  alternateStatus?: AlternateStatus
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

function mapStatus(raw: string | null): ProjectState['triageState'] {
  if (!raw) return null
  const upper = raw.toUpperCase().replace(/\s+/g, '_')
  return STATUS_TO_TRIAGE[upper] ?? null
}

function toIsoDate(raw: string | null, fallback: string): string {
  if (!raw) return fallback
  const match = raw.match(/(\d{4}-\d{2}-\d{2})/)
  return match ? match[1] : fallback
}

function buildEvidenceUrl(artifact: RepositoryArtifact, repo: string): string {
  if (artifact.htmlUrl) return artifact.htmlUrl
  return `https://github.com/${repo}/blob/${artifact.ref}/${artifact.path}`
}

// --- Main adapter ----------------------------------------------------------

export function adaptGithubSource(snapshot: RepositorySnapshot): ProjectState {
  const { projectId, repo, retrievedAt, artifacts, alternateStatus } = snapshot

  const primaryNames = ['PROJECT_STATUS.md', 'STATUS.md'] as const
  const primary = findArtifact(artifacts, primaryNames)
  const roadmap = findArtifact(artifacts, ['ROADMAP.md'])

  const primaryLabels = primary ? parseLabels(primary.content) : null
  // ROADMAP is supporting: only consulted when a primary status artifact exists
  const roadmapLabels = primary && roadmap ? parseLabels(roadmap.content) : null

  // Priority: primary artifact labels win; roadmap only fills gaps
  const checkpoint =
    primaryLabels?.checkpoint ?? roadmapLabels?.checkpoint ?? null
  const rawStatus = primaryLabels?.status ?? roadmapLabels?.status ?? null
  const nextAction =
    primaryLabels?.nextAction ?? roadmapLabels?.nextAction ?? null
  const blocker =
    primaryLabels?.blocker ?? roadmapLabels?.blocker ?? null
  const parsedDate =
    primaryLabels?.lastUpdated ?? roadmapLabels?.lastUpdated ?? null

  const triageState = mapStatus(rawStatus)
  const lastUpdated = toIsoDate(parsedDate, retrievedAt)

  // --- Conflict detection --------------------------------------------------

  let triageSource: ProjectState['triageSource']

  if (alternateStatus) {
    const altLabels = parseLabels(alternateStatus.artifact.content)
    const altTriage = mapStatus(altLabels.status)

    if (altTriage !== triageState) {
      const primarySourceId = primary
        ? `${primary.sha}:${primary.path}`
        : 'missing-primary'
      const altSourceId = `${alternateStatus.artifact.sha}:${alternateStatus.artifact.path}`
      triageSource = {
        status: 'CONFLICT',
        sourceIds: [primarySourceId, altSourceId],
        reason: `Default branch status "${rawStatus ?? 'missing'}" differs from ${alternateStatus.branch} status "${altLabels.status ?? 'missing'}"`,
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
        ? `Unrecognized status value "${rawStatus}"`
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
    name: projectId,
    summary: `Derived from ${repo}`,
    repo,
    triageState: effectiveTriageState,
    triageSource,
    stage: null,
    checkpoint,
    progress: null,
    lastUpdated,
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
