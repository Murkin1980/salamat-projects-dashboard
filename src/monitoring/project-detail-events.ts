/**
 * Deterministic derivation of the recent-activity event list shown on the
 * Project Detail view (CP-16).
 *
 * Every event is an evidence timestamp that already exists in the normalized
 * snapshot: project activity, the canonical status update, the Arena session
 * start / last activity and the dashboard's own snapshot generation. Nothing is
 * synthesized here. A missing timestamp stays an explicit gap carrying its
 * recorded reason, and snapshot generation is always labelled as such because
 * generating a snapshot is not project activity.
 */
import type { EvidenceTimestamp, ProjectState } from '../contract/project-state.js'

export type ProjectDetailEventKind =
  | 'PROJECT_ACTIVITY'
  | 'STATUS_UPDATED'
  | 'SESSION_STARTED'
  | 'SESSION_ACTIVITY'
  | 'SNAPSHOT_GENERATED'

export interface ProjectDetailEvent {
  kind: ProjectDetailEventKind
  /** Short label rendered in the event list. */
  label: string
  /** ISO-8601 UTC timestamp, or `null` when no attributable timestamp exists. */
  at: string | null
  /** Evidence source kind, or `UNAVAILABLE` when the timestamp is missing. */
  source: string
  /** Evidence reference: the source id, or the recorded reason when unavailable. */
  sourceId: string
  evidenceUrl: string | null
}

const EVENT_LABELS: Record<ProjectDetailEventKind, string> = {
  PROJECT_ACTIVITY: 'Значимая активность проекта',
  STATUS_UPDATED: 'Канонический статус обновлён',
  SESSION_STARTED: 'Сессия Arena начата',
  SESSION_ACTIVITY: 'Активность сессии Arena',
  SNAPSHOT_GENERATED: 'Сформирован snapshot дашборда',
}

/**
 * Deterministic tie-break for events sharing a timestamp, and stable order for
 * events without one. Lower wins, so the list never depends on input order.
 */
const KIND_ORDER: Record<ProjectDetailEventKind, number> = {
  PROJECT_ACTIVITY: 0,
  SESSION_ACTIVITY: 1,
  SESSION_STARTED: 2,
  STATUS_UPDATED: 3,
  SNAPSHOT_GENERATED: 4,
}

function fromEvidenceTimestamp(
  kind: ProjectDetailEventKind,
  timestamp: EvidenceTimestamp,
): ProjectDetailEvent {
  const label = EVENT_LABELS[kind]
  if (timestamp.status === 'KNOWN') {
    return {
      kind,
      label,
      at: timestamp.at,
      source: timestamp.source,
      sourceId: timestamp.sourceId,
      evidenceUrl: timestamp.evidenceUrl,
    }
  }
  return {
    kind,
    label,
    at: null,
    source: 'UNAVAILABLE',
    sourceId: timestamp.reason,
    evidenceUrl: null,
  }
}

/**
 * Builds the project's recent-activity events, newest attributable timestamp
 * first. Events without an attributable timestamp keep their recorded reason and
 * are listed last, so a gap is visible instead of silently disappearing.
 */
export function buildProjectDetailEvents(project: ProjectState): ProjectDetailEvent[] {
  const snapshot = project.activity.snapshotGeneratedAt
  const events: ProjectDetailEvent[] = [
    fromEvidenceTimestamp('PROJECT_ACTIVITY', project.activity.lastMeaningfulActivity),
    fromEvidenceTimestamp('STATUS_UPDATED', project.activity.statusUpdatedAt),
    fromEvidenceTimestamp('SESSION_STARTED', project.session.sessionStartedAt),
    fromEvidenceTimestamp('SESSION_ACTIVITY', project.session.sessionLastActivityAt),
    {
      kind: 'SNAPSHOT_GENERATED',
      label: EVENT_LABELS.SNAPSHOT_GENERATED,
      at: snapshot.at,
      source: snapshot.source,
      sourceId: snapshot.sourceId,
      evidenceUrl: null,
    },
  ]

  return events.sort((left, right) => {
    // Attributable events first, newest first.
    if (left.at !== null && right.at !== null) {
      const byTime = Date.parse(right.at) - Date.parse(left.at)
      if (byTime !== 0) return byTime
    } else if (left.at !== right.at) {
      return left.at === null ? 1 : -1
    }
    return KIND_ORDER[left.kind] - KIND_ORDER[right.kind]
  })
}

/** Shared timestamp formatting for activity and session evidence. */
export function formatEventTimestamp(at: string): string {
  return new Intl.DateTimeFormat('ru-RU', {
    dateStyle: 'medium',
    timeStyle: 'short',
    timeZone: 'UTC',
  }).format(new Date(at))
}
