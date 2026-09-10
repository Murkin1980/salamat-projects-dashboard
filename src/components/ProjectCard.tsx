import { IconClock, IconFolderCode } from '@tabler/icons-react'
import type { ProjectState, TriageState } from '../contract/project-state'
import type { AttentionSignal } from '../triage/live-triage'
import { StatusBadge } from './StatusBadge'
import { Badge, Card, MachineId, SourceProgress, type ProgressTone } from './ui'

export interface ProjectCardProps {
  /** ProjectState with the effective (live-derived) triage state applied. */
  project: ProjectState
  attention: AttentionSignal[]
  selected: boolean
  canContinue: boolean
  continueTitle: string
  onSelect: (projectId: string) => void
  onOpenTaskPacket: (project: ProjectState) => void
}

function progressTone(state: TriageState | null): ProgressTone {
  if (state === 'BLOCKED') return 'critical'
  if (state === 'READY' || state === 'DONE') return 'positive'
  if (state === 'VALIDATION') return 'attention'
  if (state === 'HOLD') return 'muted'
  return 'active'
}

function Metric({ label, value }: { label: string; value: number }) {
  return (
    <div className={`project-card__metric ${value === 0 ? 'is-zero' : ''}`}>
      <dt>{label}</dt>
      <dd>{value}</dd>
    </div>
  )
}

/**
 * ProjectCard — dense control-surface card.
 * Only fields published by the source are rendered; empty sources fall back to
 * an explicit "source does not publish X" line instead of an invented value.
 */
export function ProjectCard({
  project,
  attention,
  selected,
  canContinue,
  continueTitle,
  onSelect,
  onOpenTaskPacket,
}: ProjectCardProps) {
  const connectionCount = project.dependencies.length + project.tools.length
  const sourceId = project.triageSource.status === 'KNOWN' ? project.triageSource.sourceId : project.source.id

  function handleCardClick(event: React.MouseEvent<HTMLElement>) {
    if ((event.target as HTMLElement).closest('button, a')) return
    onSelect(project.id)
  }

  return (
    <Card as="article" className="project-card" selected={selected} interactive onClick={handleCardClick}>
      <div className="project-card-head">
        <div className="project-icon">
          <IconFolderCode size={18} />
        </div>
        <StatusBadge state={project.triageState} resolution={project.triageSource.status} />
      </div>

      <div className="project-body">
        <h2>
          <button type="button" className="project-card__title-button" onClick={() => onSelect(project.id)}>
            {project.name}
          </button>
        </h2>
        <p>{project.summary}</p>
      </div>

      <div className="project-card__checkpoint">
        <span className="fs-label">Current checkpoint</span>
        <span className={`project-card__checkpoint-value ${project.checkpoint ? '' : 'is-empty'}`}>
          {project.checkpoint ?? 'Источник не публикует checkpoint'}
        </span>
      </div>

      <SourceProgress progress={project.progress} tone={progressTone(project.triageState)} label="Progress" />

      <div className="project-card__next">
        <span className="fs-label">Next action</span>
        <p>{project.nextAction ?? 'Источник не публикует следующее действие'}</p>
      </div>

      {(project.blocker || attention.length > 0) && (
        <div className="project-card__flags">
          {project.blocker && (
            <Badge tone="critical">
              <span>BLOCKER</span>
            </Badge>
          )}
          {attention
            .filter((signal) => signal.kind !== 'BLOCKER')
            .map((signal) => (
              <Badge key={`${signal.kind}:${signal.sourceId}`} tone="attention" title={signal.sourceId}>
                {signal.kind.replaceAll('_', ' ')}
              </Badge>
            ))}
        </div>
      )}

      <dl className="project-card__metrics">
        <Metric label="Evidence" value={project.evidenceLinks.length} />
        <Metric label="Connections" value={connectionCount} />
        <Metric label="Signals" value={attention.length} />
      </dl>

      <div className="project-footer">
        <span>
          <IconClock size={14} />
          <MachineId value={sourceId} cut={18} /> · {new Intl.DateTimeFormat('ru-RU').format(new Date(`${project.lastUpdated}T00:00:00`))}
        </span>
        {canContinue ? (
          <button type="button" className="btn-continue-active" onClick={() => onOpenTaskPacket(project)} title={continueTitle}>
            Continue
          </button>
        ) : (
          <button type="button" disabled title={continueTitle}>
            Continue
          </button>
        )}
      </div>
    </Card>
  )
}
