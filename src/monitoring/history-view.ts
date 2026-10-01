/**
 * Presentation-side helpers for the live history (CP-17).
 *
 * History & Reports and the Project Detail history panel both read the project's
 * normalized `history` through these functions, so the two views can never show
 * a different event list, ordering or count for the same project.
 */
import {
  HISTORY_EVENT_CATEGORIES,
  historyEventCategory,
  type HistoryEvent,
  type HistoryEventCategory,
  type HistoryEventType,
  type ProjectState,
} from '../contract/project-state.js'

export { HISTORY_EVENT_CATEGORIES }

export const HISTORY_CATEGORY_LABELS: Record<HistoryEventCategory, string> = {
  COMMITS: 'Коммиты',
  PULL_REQUESTS: 'Pull requests',
  STATUS: 'Статус проекта',
  SESSION: 'Сессия',
}

export const HISTORY_EVENT_LABELS: Record<HistoryEventType, string> = {
  COMMIT: 'Коммит',
  PULL_REQUEST_OPENED: 'PR открыт',
  PULL_REQUEST_MERGED: 'PR влит',
  PULL_REQUEST_CLOSED: 'PR закрыт без merge',
  CHECKPOINT_MOVED: 'Checkpoint',
  STATE_CHANGED: 'Статус',
  BLOCKER_CHANGED: 'Блокер',
  SESSION_STARTED: 'Сессия Arena начата',
  SESSION_ACTIVITY: 'Активность сессии Arena',
  SESSION_WAITING_FOR_VALIDATION: 'Сессия ожидает валидации',
  SESSION_READY_TO_CLOSE: 'Сессия готова к закрытию',
  SESSION_CLOSED: 'Сессия закрыта (evidence)',
  SESSION_STALE: 'Сессия устарела',
}

/** Events of a project, newest first; empty when the history is unavailable. */
export function getHistoryEvents(project: ProjectState): readonly HistoryEvent[] {
  return project.history.status === 'KNOWN' ? project.history.events : []
}

/** Events limited to the selected categories, preserving the deterministic order. */
export function filterHistoryEvents(
  events: readonly HistoryEvent[],
  categories: ReadonlySet<HistoryEventCategory>,
): HistoryEvent[] {
  return events.filter((event) => categories.has(historyEventCategory(event.type)))
}

export interface HistorySummary {
  commits: number
  pullRequestsOpened: number
  pullRequestsMerged: number
  pullRequestsClosed: number
  checkpointMoves: number
  stateChanges: number
  blockerChanges: number
  sessionEvents: number
}

/** Counts come from the very same events that are rendered, never a second source. */
export function summarizeHistory(events: readonly HistoryEvent[]): HistorySummary {
  const count = (type: HistoryEventType) => events.filter((event) => event.type === type).length
  return {
    commits: count('COMMIT'),
    pullRequestsOpened: count('PULL_REQUEST_OPENED'),
    pullRequestsMerged: count('PULL_REQUEST_MERGED'),
    pullRequestsClosed: count('PULL_REQUEST_CLOSED'),
    checkpointMoves: count('CHECKPOINT_MOVED'),
    stateChanges: count('STATE_CHANGED'),
    blockerChanges: count('BLOCKER_CHANGED'),
    sessionEvents: events.filter((event) => historyEventCategory(event.type) === 'SESSION').length,
  }
}

/**
 * Project a report opens on when no project is selected: the first project, in the
 * given (portfolio) order, whose history actually has events. Falls back to the
 * first project so an unavailable history is still shown explicitly.
 */
export function defaultReportProject(projects: readonly ProjectState[]): ProjectState | null {
  return projects.find((project) => getHistoryEvents(project).length > 0) ?? projects[0] ?? null
}
