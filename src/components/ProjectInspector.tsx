import { IconX } from '@tabler/icons-react'
import { getFreshness, type ProjectState } from '../contract/project-state'
import type { AttentionSignal } from '../triage/live-triage'
import { StatusBadge } from './StatusBadge'
import { Badge, Button, EvidencePanel, Inspector, InspectorFacts, InspectorSection, MachineId, SourceProgress, type BadgeTone } from './ui'

export interface ProjectInspectorProps {
  project: ProjectState | null
  attention: AttentionSignal[]
  canContinue: boolean
  continueTitle: string
  onOpenTaskPacket: (project: ProjectState) => void
  onClose?: () => void
}

const signalTone: Record<AttentionSignal['kind'], BadgeTone> = {
  SOURCE_CONFLICT: 'critical',
  SOURCE_UNKNOWN: 'muted',
  BLOCKER: 'critical',
  APPROVAL_PENDING: 'attention',
  STALE: 'attention',
  ACTION_NOW: 'attention',
  VALIDATION: 'attention',
}

export function ProjectInspector({
  project,
  attention,
  canContinue,
  continueTitle,
  onOpenTaskPacket,
  onClose,
}: ProjectInspectorProps) {
  if (!project) {
    return (
      <Inspector eyebrow="Inspector" title="Проект не выбран">
        <p className="fs-inspector__value fs-inspector__value--muted">
          Выберите проект в списке, чтобы увидеть статус, checkpoint, evidence и blockers.
        </p>
      </Inspector>
    )
  }

  const freshness = getFreshness(project, new Date())
  const sourceResolution = project.triageSource.status
  const attributedSourceId = sourceResolution === 'KNOWN' ? project.triageSource.sourceId : project.source.id
  const connectionCount = project.dependencies.length + project.tools.length

  return (
    <Inspector
      eyebrow={`${project.source.kind} · inspector`}
      title={project.name}
      subtitle={project.repo ?? project.summary}
      action={
        onClose && (
          <Button variant="ghost" onClick={onClose} aria-label="Закрыть инспектор" className="inspector-dock-close">
            <IconX size={18} />
            Закрыть
          </Button>
        )
      }
      footer={
        <Button variant="primary" block disabled={!canContinue} title={continueTitle} onClick={() => onOpenTaskPacket(project)}>
          {canContinue ? 'Continue — Task Packet' : 'Continue недоступен'}
        </Button>
      }
    >
      <InspectorSection title="Status">
        <div className="fs-inspector__row">
          <StatusBadge state={project.triageState} resolution={sourceResolution} />
          <Badge tone={sourceResolution === 'CONFLICT' ? 'critical' : sourceResolution === 'UNKNOWN' ? 'muted' : 'outline'}>
            SOURCE {sourceResolution}
          </Badge>
          <Badge tone={freshness === 'STALE' ? 'attention' : 'positive'}>{freshness}</Badge>
        </div>
        <InspectorFacts
          items={[
            { label: 'Repo', value: project.repo ? <MachineId value={project.repo} /> : '—' },
            { label: 'Source', value: <MachineId value={project.source.id} cut={16} /> },
            { label: 'Updated', value: new Intl.DateTimeFormat('ru-RU').format(new Date(`${project.lastUpdated}T00:00:00`)) },
            { label: 'Stale after', value: `${project.staleAfterDays} дн.` },
          ]}
        />
      </InspectorSection>

      <InspectorSection title="Current checkpoint">
        <p className={`fs-inspector__value ${project.checkpoint ? '' : 'fs-inspector__value--muted'}`}>
          {project.checkpoint ?? 'Источник не публикует checkpoint'}
        </p>
        <SourceProgress progress={project.progress} tone="active" label="Progress" />
        {!project.progress && (
          <p className="fs-inspector__value fs-inspector__value--muted" style={{ fontSize: 'var(--fs-text-meta)' }}>
            Источник не публикует числовой progress — прогресс-бар не выводится.
          </p>
        )}
      </InspectorSection>

      <InspectorSection title="Next action">
        <p className={`fs-inspector__value ${project.nextAction ? '' : 'fs-inspector__value--muted'}`}>
          {project.nextAction ?? 'Источник не публикует следующее действие'}
        </p>
      </InspectorSection>

      <InspectorSection title="Evidence">
        <EvidencePanel
          items={project.evidenceLinks}
          emptyLabel="Подтверждённого evidence от источника нет."
        />
      </InspectorSection>

      <InspectorSection title="Connections">
        {connectionCount === 0 ? (
          <p className="fs-inspector__value fs-inspector__value--muted">Подтверждённых связей нет.</p>
        ) : (
          <div className="fs-inspector__facts">
            {project.dependencies.map((dependency) => (
              <div key={`dep:${dependency.projectId}`} className="fs-inspector__fact">
                <dt>Зависимость</dt>
                <dd>
                  <MachineId value={dependency.projectId} />
                </dd>
              </div>
            ))}
            {project.tools.map((tool) => (
              <div key={`tool:${tool.id}`} className="fs-inspector__fact">
                <dt>Инструмент</dt>
                <dd>
                  <MachineId value={tool.id} />
                </dd>
              </div>
            ))}
          </div>
        )}
      </InspectorSection>

      <InspectorSection title="Risks / blockers">
        {project.blocker ? (
          <div className="fs-inspector__risk">
            <Badge tone="critical">BLOCKER</Badge>
            <p className="fs-inspector__value">{project.blocker}</p>
          </div>
        ) : (
          <p className="fs-inspector__value fs-inspector__value--muted">Активного блокера нет.</p>
        )}

        {attention.length > 0 && (
          <div className="fs-inspector__signals">
            {attention.map((signal) => (
              <div key={`${signal.kind}:${signal.sourceId}`} className="fs-inspector__signal">
                <Badge tone={signalTone[signal.kind]}>{signal.kind.replaceAll('_', ' ')}</Badge>
                <p className="fs-inspector__value">{signal.label}</p>
                <MachineId value={signal.sourceId} cut={22} />
              </div>
            ))}
          </div>
        )}

        {project.approvals.length > 0 && (
          <div className="fs-inspector__signals">
            {project.approvals.map((approval) => (
              <div key={`approval:${approval.id}`} className="fs-inspector__signal">
                <Badge tone={approval.status === 'PENDING' ? 'attention' : approval.status === 'GRANTED' ? 'positive' : 'critical'}>
                  APPROVAL {approval.status}
                </Badge>
                <MachineId value={approval.id} />
              </div>
            ))}
          </div>
        )}

        <MachineId value={attributedSourceId} cut={28} />
      </InspectorSection>
    </Inspector>
  )
}
