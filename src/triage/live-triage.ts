import { getFreshness, type ProjectState, type TriageState } from '../contract/project-state.js'

export type AttentionKind = 'SOURCE_CONFLICT' | 'SOURCE_UNKNOWN' | 'BLOCKER' | 'APPROVAL_PENDING' | 'STALE' | 'ACTION_NOW' | 'VALIDATION'

export interface AttentionSignal { kind: AttentionKind; label: string; sourceId: string }
export interface LiveProjectState { project: ProjectState; effectiveTriageState: TriageState | null; attention: AttentionSignal[] }

export function deriveLiveProjectState(project: ProjectState, now: Date): LiveProjectState {
  const attention: AttentionSignal[] = []
  const attributedSource = project.triageSource.status === 'KNOWN' ? project.triageSource.sourceId : project.source.id

  if (project.triageSource.status === 'CONFLICT') {
    attention.push({ kind: 'SOURCE_CONFLICT', label: project.triageSource.reason, sourceId: project.triageSource.sourceIds.join(', ') })
  } else if (project.triageSource.status === 'UNKNOWN') {
    attention.push({ kind: 'SOURCE_UNKNOWN', label: project.triageSource.reason, sourceId: project.source.id })
  }
  if (project.blocker) attention.push({ kind: 'BLOCKER', label: project.blocker, sourceId: attributedSource })
  for (const approval of project.approvals) {
    if (approval.status === 'PENDING') attention.push({ kind: 'APPROVAL_PENDING', label: `Ожидается решение: ${approval.id}`, sourceId: approval.sourceId })
  }
  if (getFreshness(project, now) === 'STALE') {
    attention.push({ kind: 'STALE', label: `Нет подтверждённого обновления ${project.staleAfterDays}+ дней`, sourceId: project.source.id })
  }
  if (project.triageState === 'ACTION_NOW') {
    attention.push({ kind: 'ACTION_NOW', label: project.nextAction ?? 'Требуется действие владельца', sourceId: attributedSource })
  } else if (project.triageState === 'VALIDATION') {
    attention.push({ kind: 'VALIDATION', label: project.nextAction ?? 'Требуется завершить валидацию', sourceId: attributedSource })
  }

  let effectiveTriageState = project.triageState
  if (project.triageSource.status !== 'KNOWN') effectiveTriageState = null
  else if (project.blocker) effectiveTriageState = 'BLOCKED'
  else if (project.approvals.some((approval) => approval.status === 'PENDING')) effectiveTriageState = 'ACTION_NOW'

  return { project, effectiveTriageState, attention }
}
