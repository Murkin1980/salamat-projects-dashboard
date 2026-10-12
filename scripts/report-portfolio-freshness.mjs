// Read-only freshness and source coverage diagnostic for the existing portfolio pipeline.
// No network, secrets or modifications to published project data.
import { readFileSync } from 'node:fs'

const sources = JSON.parse(readFileSync('config/source-repositories.json', 'utf8'))
const registry = JSON.parse(readFileSync('public/project-state.json', 'utf8'))
const date = new Date()
const DAY = 86_400_000
const thresholdDays = 7
const synced = new Set(sources.sources.map((s) => s.projectId))
const gaps = new Set((sources.gaps ?? []).map((s) => s.projectId))
const problems = []

for (const project of registry.projects) {
  const mode = synced.has(project.id) ? 'SYNCED' : gaps.has(project.id) ? 'GAP' : 'UNTRACKED'
  const updated = project.lastUpdated
  const timestamp = updated ? Date.parse(updated + 'T00:00:00Z') : NaN
  const age = Number.isFinite(timestamp) ? Math.max(0, Math.floor((date.getTime() - timestamp) / DAY)) : null
  const stale = age === null || age > thresholdDays
  if (mode !== 'SYNCED' || stale) {
    problems.push({ id: project.id, mode, lastUpdated: updated ?? 'UNKNOWN', ageDays: age, stale })
  }
}

const summary = {
  snapshotUpdatedAt: registry.updatedAt,
  total: registry.projects.length,
  sourceBacked: registry.projects.filter((p) => synced.has(p.id)).length,
  gaps: registry.projects.filter((p) => gaps.has(p.id)).length,
  untracked: registry.projects.filter((p) => !synced.has(p.id) && !gaps.has(p.id)).length,
  staleProjects: registry.projects.filter((p) => {
    if (!p.lastUpdated) return true
    const t = Date.parse(p.lastUpdated + 'T00:00:00Z')
    return !Number.isFinite(t) || date.getTime() - t > thresholdDays * DAY
  }).length,
}
console.log('Portfolio source coverage:', JSON.stringify(summary))
for (const item of problems) console.log('Portfolio freshness issue:', JSON.stringify(item))
if (problems.length) {
  console.log('::warning::Portfolio deploy passed, but project freshness/coverage is incomplete. See Portfolio freshness issue lines; do not treat deployment time as status freshness.')
}
