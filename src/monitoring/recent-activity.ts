import {
  compareHistoryEvents,
  type HistoryEvent,
  type ProjectState,
} from '../contract/project-state.js'

export const RECENT_ACTIVITY_LIMIT = 20

export interface PortfolioActivityEvent {
  project: ProjectState
  event: HistoryEvent
}

/**
 * One deterministic cross-project timeline, derived only from the normalized
 * history already carried by the portfolio snapshot. No browser clock or
 * synthetic event participates in the result.
 */
export function getPortfolioActivity(
  projects: readonly ProjectState[],
  projectId: string | null = null,
  limit = RECENT_ACTIVITY_LIMIT,
): PortfolioActivityEvent[] {
  return projects
    .filter((project) => projectId === null || project.id === projectId)
    .flatMap((project) => project.history.status === 'KNOWN'
      ? project.history.events.map((event) => ({ project, event }))
      : [])
    .sort((left, right) => {
      const byEvent = compareHistoryEvents(left.event, right.event)
      if (byEvent !== 0) return byEvent
      return left.project.id.localeCompare(right.project.id)
    })
    .slice(0, Math.max(0, limit))
}

export function projectsWithoutHistory(projects: readonly ProjectState[]): ProjectState[] {
  return projects.filter((project) => project.history.status === 'UNAVAILABLE')
}
