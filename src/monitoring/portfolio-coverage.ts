/**
 * CP-19 portfolio coverage and data-quality diagnostics.
 *
 * Pure derivation from the normalized ProjectRegistry so coverage counts and
 * source classifications visible in the UI match the snapshot verification
 * script byte-for-byte. Read-only: the UI never mutates project data.
 */
import {
  getFreshness,
  type ProjectRegistry,
  type ProjectState,
} from '../contract/project-state.js'

export type CoverageClassification = 'CURRENT' | 'STALE' | 'UNKNOWN' | 'UNAVAILABLE' | 'FIXTURE'
export type SessionCoverage = 'KNOWN' | 'UNKNOWN'
export type HistoryCoverage = 'KNOWN' | 'UNAVAILABLE'

export interface ProjectCoverage {
  project: ProjectState
  classification: CoverageClassification
  sessionCoverage: SessionCoverage
  historyCoverage: HistoryCoverage
  reason: string | null
}

export interface CoverageSummary {
  total: number
  current: number
  stale: number
  unknown: number
  unavailable: number
  fixture: number
  sessionKnown: number
  sessionUnknown: number
  historyKnown: number
  historyUnavailable: number
}

/**
 * Classify one project for CP-19 coverage reporting.
 *
 * - `CURRENT` / `STALE` come from KNOWN triage sources with attributable activity.
 * - `UNKNOWN` means the source is readable but has no canonical status label.
 * - `UNAVAILABLE` means the canonical source cannot be read (private repo, missing artifact, HTTP error).
 * - `FIXTURE` means the project is fixture-backed with no repository.
 */
export function classifyProject(project: ProjectState): ProjectCoverage {
  if (project.source.kind === 'FIXTURE') {
    return {
      project,
      classification: 'FIXTURE',
      sessionCoverage: 'UNKNOWN',
      historyCoverage: 'UNAVAILABLE',
      reason: 'Fixture-backed entry, no repository source.',
    }
  }

  const now = new Date(project.activity.snapshotGeneratedAt.at)
  const triageResolution = project.triageSource.status

  let classification: CoverageClassification
  let reason: string | null = null
  if (triageResolution === 'UNAVAILABLE') {
    classification = 'UNAVAILABLE'
    reason = project.triageSource.reason
  } else if (triageResolution === 'UNKNOWN' || triageResolution === 'CONFLICT') {
    classification = 'UNKNOWN'
    reason = project.triageSource.reason
  } else {
    const freshness = getFreshness(project, now)
    classification = freshness === 'STALE' ? 'STALE' : 'CURRENT'
  }

  const sessionCoverage: SessionCoverage = project.session.sessionState === 'UNKNOWN' ? 'UNKNOWN' : 'KNOWN'
  const historyCoverage: HistoryCoverage = project.history.status === 'KNOWN' ? 'KNOWN' : 'UNAVAILABLE'

  return { project, classification, sessionCoverage, historyCoverage, reason }
}

export function summarizeCoverage(registry: ProjectRegistry): {
  summary: CoverageSummary
  items: ProjectCoverage[]
} {
  const items = registry.projects.map(classifyProject)
  const count = (c: CoverageClassification) => items.filter((i) => i.classification === c).length
  const summary: CoverageSummary = {
    total: items.length,
    current: count('CURRENT'),
    stale: count('STALE'),
    unknown: count('UNKNOWN'),
    unavailable: count('UNAVAILABLE'),
    fixture: count('FIXTURE'),
    sessionKnown: items.filter((i) => i.sessionCoverage === 'KNOWN').length,
    sessionUnknown: items.filter((i) => i.sessionCoverage === 'UNKNOWN').length,
    historyKnown: items.filter((i) => i.historyCoverage === 'KNOWN').length,
    historyUnavailable: items.filter((i) => i.historyCoverage === 'UNAVAILABLE').length,
  }
  return { summary, items }
}
