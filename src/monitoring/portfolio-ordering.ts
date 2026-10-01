/**
 * Deterministic portfolio ordering and Arena-session visibility (CP-15).
 *
 * The dashboard is a periodic, read-only observer. Every value here is derived
 * from the latest scheduled/manual snapshot; no realtime or browser-side Arena
 * monitoring is added. The functions are pure and clock-free so the first screen
 * (and the tests) are reproducible: given the same snapshot, the order and the
 * visible indicators never change.
 */
import type {
  ArenaSessionState,
  ProjectState,
  TriageState,
} from '../contract/project-state.js'

/** Arena session states that warrant a compact, visible indicator on a card. */
export const SESSION_INDICATOR_STATES: readonly ArenaSessionState[] = [
  'ACTIVE',
  'WAITING_FOR_VALIDATION',
  'READY_TO_CLOSE',
  'STALE_SESSION',
  'UNKNOWN',
] as const

export function shouldShowSessionIndicator(state: ArenaSessionState): boolean {
  return (SESSION_INDICATOR_STATES as readonly ArenaSessionState[]).includes(state)
}

/**
 * Deterministic tie-break priority for equal activity timestamps. Lower wins.
 * A source absent from this map is treated as least preferred so the comparison
 * stays total and never depends on JavaScript object key order. `SNAPSHOT` is
 * listed only so the map is exhaustive; activity derivation rejects it.
 */
const ACTIVITY_SOURCE_TIEBREAK_PRIORITY: Record<string, number> = {
  COMMIT: 0,
  PULL_REQUEST: 1,
  WORKFLOW_RUN: 2,
  CHECK_RUN: 3,
  PROJECT_STATUS: 4,
  ROADMAP: 5,
  MANUAL: 6,
  FIXTURE: 7,
  SNAPSHOT: 8,
}

/**
 * Orders two projects by recent meaningful activity: the more recent project
 * comes first. Projects whose activity is unattributable (`UNAVAILABLE`) sort
 * after all attributable ones because they cannot be "recent".
 *
 * Ties resolve deterministically — equal time -> evidence-source priority ->
 * `sourceId` -> project `id` — so the ordering is stable and explainable, never
 * depending on input order.
 */
export function compareByRecentActivity(a: ProjectState, b: ProjectState): number {
  const aActivity = a.activity.lastMeaningfulActivity
  const bActivity = b.activity.lastMeaningfulActivity

  // Both KNOWN: most recent first, with deterministic tie-breakers.
  if (aActivity.status === 'KNOWN' && bActivity.status === 'KNOWN') {
    const byTime = Date.parse(bActivity.at) - Date.parse(aActivity.at)
    if (byTime !== 0) return byTime
    const aPriority = ACTIVITY_SOURCE_TIEBREAK_PRIORITY[aActivity.source] ?? 99
    const bPriority = ACTIVITY_SOURCE_TIEBREAK_PRIORITY[bActivity.source] ?? 99
    if (aPriority !== bPriority) return aPriority - bPriority
    if (aActivity.sourceId !== bActivity.sourceId) {
      return aActivity.sourceId.localeCompare(bActivity.sourceId)
    }
    return a.id.localeCompare(b.id)
  }

  // Exactly one KNOWN: the attributable project sorts first.
  if (aActivity.status === 'KNOWN' || bActivity.status === 'KNOWN') {
    return aActivity.status === 'KNOWN' ? -1 : 1
  }

  // Both UNAVAILABLE: stable, id-based order so the ordering is reproducible.
  return a.id.localeCompare(b.id)
}

/** Returns a new array ordered by recent meaningful activity (most recent first). */
export function orderByRecentActivity(projects: ProjectState[]): ProjectState[] {
  return [...projects].sort(compareByRecentActivity)
}

/**
 * Operational priority rank used by Triage and Attention: actionable states
 * first, resolved/quiet states later, unresolved (`null`) last.
 */
export function triageRank(state: TriageState | null): number {
  const ORDER: TriageState[] = [
    'ACTION_NOW',
    'BLOCKED',
    'READY',
    'IN_PROGRESS',
    'VALIDATION',
    'HOLD',
    'DONE',
  ]
  return state ? ORDER.indexOf(state) : ORDER.length
}

/**
 * Orders by operational priority first (authoritative), then by recent activity
 * as a secondary signal. Used by Triage and Attention so recency and session
 * state never hide an `ACTION_NOW` / `BLOCKED` project.
 */
export function compareByPriorityThenActivity(
  a: ProjectState,
  aTriage: TriageState | null,
  b: ProjectState,
  bTriage: TriageState | null,
): number {
  const byPriority = triageRank(aTriage) - triageRank(bTriage)
  if (byPriority !== 0) return byPriority
  return compareByRecentActivity(a, b)
}
