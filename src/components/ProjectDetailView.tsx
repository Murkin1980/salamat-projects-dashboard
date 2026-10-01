// Default React import: see NodeView.tsx — required by the tsx test runner's
// classic JSX transform, tree-shaken by the automatic-runtime build.
import React from 'react'
import type { ReactNode } from 'react'
import {
  IconActivity,
  IconAlertTriangle,
  IconArrowLeft,
  IconCircleCheck,
  IconClock,
  IconExternalLink,
  IconFolderCode,
  IconGitBranch,
  IconHistory,
  IconHourglass,
  IconInfoCircle,
  IconLayoutDashboard,
  IconLock,
  IconPlayerPause,
  IconQuestionMark,
  IconRadar,
  IconRosetteDiscountCheck,
  IconTargetArrow,
} from '@tabler/icons-react'
import type {
  ArenaSessionClosureStatus,
  ArenaSessionState,
  ProjectState,
} from '../contract/project-state'
import type { ProjectHistory } from '../history/project-history'
import { getActivityFreshness } from '../monitoring/derived-state'
import { buildProjectDetailEvents, formatEventTimestamp } from '../monitoring/project-detail-events'
import { viewHash } from '../routing/hash-route'
import { SessionIndicator, StatusBadge } from './status-badges'

/**
 * Project Detail view (CP-16) — the complete read-only view of one project.
 *
 * It renders the same normalized `ProjectState` the portfolio cards render, so
 * the detail view can never disagree with the list, plus the project's own
 * committed history. Everything here is observation: there is no mutation, task
 * execution, session control or agent control anywhere in this view.
 */
export interface ProjectDetailViewProps {
  /** Project from the live snapshot, or `null` when the route names an unknown id. */
  project: ProjectState | null
  /** Project id requested by the route; kept for the explicit not-found state. */
  projectId: string
  /** Committed history for this project, or `null` when the manifest has none. */
  history: ProjectHistory | null
  onNavigate: (hash: string) => void
}

export function ProjectDetailView({ project, projectId, history, onNavigate }: ProjectDetailViewProps) {
  if (!project) {
    return (
      <section className="project-detail">
        <DetailReturn onNavigate={onNavigate}/>
        <div className="empty-state">
          <IconQuestionMark size={26}/>
          <p>Проект <code>{projectId}</code> отсутствует в текущем snapshot портфеля.</p>
          <p>Ссылка ведёт на проект, которого нет в нормализованном состоянии. Данные не подставлены.</p>
        </div>
      </section>
    )
  }

  const events = buildProjectDetailEvents(project)
  const historyEvents = history ? [...history.events].reverse() : []

  return (
    <section className="project-detail" aria-label={`Проект ${project.name}`}>
      <DetailReturn onNavigate={onNavigate}/>

      <header className="detail-head">
        <div className="project-icon detail-icon"><IconFolderCode size={26}/></div>
        <div className="detail-head-body">
          <p className="eyebrow">Карточка проекта · только чтение</p>
          <h2>{project.name}</h2>
          <p>{project.summary}</p>
        </div>
        <div className="detail-head-badges">
          <StatusBadge state={project.triageState} resolution={project.triageSource.status}/>
          <SessionIndicator session={project.session}/>
          <span className="read-only-badge"><IconLock size={15}/> READ ONLY</span>
        </div>
      </header>

      <div className="detail-grid">
        <article className="detail-panel" aria-label="Состояние проекта">
          <h3><IconTargetArrow size={17}/> Состояние проекта</h3>
          <dl className="detail-fields">
            <DetailRow label="Операционный статус">
              <StatusBadge state={project.triageState} resolution={project.triageSource.status}/>
            </DetailRow>
            <DetailRow label="Репозиторий">
              {project.repo
                ? <span className="meta-repo"><IconGitBranch size={15}/> {project.repo}</span>
                : <span className="meta-unknown">Не привязан к репозиторию</span>}
            </DetailRow>
            <DetailRow label="Текущий этап">
              {project.stage ?? <span className="meta-unknown">Не определено источником</span>}
            </DetailRow>
            <DetailRow label="Checkpoint">
              {project.checkpoint ?? <span className="meta-unknown">Не определено источником</span>}
            </DetailRow>
            <DetailRow label="Прогресс">
              {project.progress
                ? `${project.progress.completed} из ${project.progress.total}`
                : <span className="meta-unknown">Не определено источником</span>}
            </DetailRow>
            <DetailRow label="Блокер">
              {project.blocker
                ? <span className="meta-blocker">{project.blocker}</span>
                : <span className="meta-unknown">Нет зафиксированного блокера</span>}
            </DetailRow>
            <DetailRow label="Следующее действие">
              {project.nextAction ?? <span className="meta-unknown">Не определено источником</span>}
            </DetailRow>
            <DetailRow label="Последнее обновление">
              {formatEventTimestamp(`${project.lastUpdated}T00:00:00Z`)}
            </DetailRow>
            <DetailRow label="Источник состояния">
              {project.triageSource.status === 'KNOWN' ? (
                <>
                  <span>{project.triageSource.sourceId}</span>
                  <small className="detail-hint">{project.source.kind} · {project.source.id}</small>
                </>
              ) : (
                <>
                  <span className="meta-unknown">{project.triageSource.reason}</span>
                  <small className="detail-hint">
                    {project.triageSource.status === 'CONFLICT'
                      ? `${project.triageSource.sourceIds.join(' vs ')} · ${project.source.kind} (${project.source.id})`
                      : `${project.source.kind} · ${project.source.id}`}
                  </small>
                </>
              )}
            </DetailRow>
          </dl>
        </article>

        <article className="detail-panel" aria-label="Активность проекта">
          <h3><IconActivity size={17}/> Активность</h3>
          <ActivityFreshness project={project}/>
          <dl className="detail-fields">
            <DetailRow label="Последняя значимая активность">
              <ActivityValue timestamp={project.activity.lastMeaningfulActivity}/>
            </DetailRow>
            <DetailRow label="Канонический статус обновлён">
              <ActivityValue timestamp={project.activity.statusUpdatedAt}/>
            </DetailRow>
            <DetailRow label="Snapshot сформирован">
              <span>{formatEventTimestamp(project.activity.snapshotGeneratedAt.at)}</span>
              <small className="detail-hint">Snapshot — собственные часы дашборда, не активность проекта.</small>
            </DetailRow>
          </dl>
        </article>

        <article className="detail-panel detail-session-panel" aria-label="Сессия Arena">
          <h3><IconRadar size={17}/> Сессия Arena</h3>
          <SessionPanel project={project}/>
        </article>

        <article className="detail-panel" aria-label="Evidence">
          <h3><IconExternalLink size={17}/> Evidence</h3>
          {project.evidenceLinks.length > 0
            ? <div className="evidence-links">
                {project.evidenceLinks.map((link) => (
                  <a key={link.url} href={link.url} target="_blank" rel="noreferrer" title={link.sourceId}>
                    <IconExternalLink size={14}/> {link.label}
                  </a>
                ))}
              </div>
            : <p className="meta-unknown">Источник не приложил evidence-ссылок.</p>}
        </article>

        <article className="detail-panel" aria-label="Недавние события">
          <h3><IconHistory size={17}/> Недавние события</h3>
          <ol className="detail-events">
            {events.map((event) => (
              <li key={event.kind}>
                <div className="detail-event-head">
                  <strong>{event.label}</strong>
                  {event.at
                    ? <time dateTime={event.at}>{formatEventTimestamp(event.at)}</time>
                    : <span className="detail-event-gap">UNAVAILABLE</span>}
                </div>
                <small>{event.at ? `${event.source} · ${event.sourceId}` : event.sourceId}</small>
                {event.evidenceUrl && (
                  <a href={event.evidenceUrl} target="_blank" rel="noreferrer"><IconExternalLink size={13}/> Evidence</a>
                )}
              </li>
            ))}
          </ol>
        </article>

        <article className="detail-panel" aria-label="История проекта">
          <h3><IconHistory size={17}/> История проекта</h3>
          {historyEvents.length > 0
            ? <ol className="detail-history">
                {historyEvents.map((event) => (
                  <li key={event.id}>
                    <div className="detail-event-head">
                      <strong>{event.type === 'CHECKPOINT_MOVED' ? 'Checkpoint' : event.type === 'STATE_CHANGED' ? 'State' : 'Blocker'}</strong>
                      <time dateTime={event.occurredAt}>
                        {new Intl.DateTimeFormat('ru-RU', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' }).format(new Date(event.occurredAt))}
                      </time>
                    </div>
                    <p>{event.from ?? 'Нет blocker'} → {event.to ?? 'Нет blocker'}</p>
                    <p>{event.summary}</p>
                    <a href={event.evidenceUrl} target="_blank" rel="noreferrer"><IconExternalLink size={13}/> Commit {event.sourceId.slice(0, 7)}</a>
                  </li>
                ))}
              </ol>
            : <p className="meta-unknown">По этому проекту нет зафиксированной истории в манифесте project-history.json.</p>}
        </article>
      </div>
    </section>
  )
}

/** Return navigation back to the two list views a project is opened from. */
function DetailReturn({ onNavigate }: { onNavigate: (hash: string) => void }) {
  return (
    <nav className="detail-return" aria-label="Возврат к списку проектов">
      <button type="button" onClick={() => onNavigate(viewHash('portfolio'))}>
        <IconArrowLeft size={16}/> Портфель
      </button>
      <button type="button" onClick={() => onNavigate(viewHash('triage'))}>
        <IconLayoutDashboard size={16}/> Триаж
      </button>
    </nav>
  )
}

function DetailRow({ label, children }: { label: string; children: ReactNode }) {
  return <div className="detail-row"><dt>{label}</dt><dd>{children}</dd></div>
}

function ActivityValue({ timestamp }: { timestamp: ProjectState['activity']['lastMeaningfulActivity'] }) {
  if (timestamp.status === 'UNAVAILABLE') {
    return <span className="meta-unknown">UNAVAILABLE — {timestamp.reason}</span>
  }
  return (
    <>
      <span>{formatEventTimestamp(timestamp.at)}</span>
      <small className="detail-hint">{timestamp.source} · {timestamp.sourceId}</small>
    </>
  )
}

/**
 * Freshness derived from the snapshot's own generation time — the same reference
 * clock the portfolio cards use, so the detail view and the cards can never
 * disagree about what "recent" means.
 */
function ActivityFreshness({ project }: { project: ProjectState }) {
  const now = new Date(project.activity.snapshotGeneratedAt.at)
  const freshness = getActivityFreshness(project.activity.lastMeaningfulActivity, now, project.staleAfterDays)
  const label = freshness === 'FRESH' ? 'СВЕЖАЯ' : freshness === 'STALE' ? 'УСТАРЕЛА' : 'НЕИЗВЕСТНО'
  return (
    <div className="project-activity">
      <span className={`freshness-chip freshness-${freshness.toLowerCase()}`}>{label}</span>
      <span className="activity-when">Порог устаревания: {project.staleAfterDays} дн.</span>
    </div>
  )
}

/** Arena session state labels for the detail view, including the settled states. */
const sessionStateMeta: Record<ArenaSessionState, { label: string; className: string; Icon: typeof IconClock }> = {
  NOT_ACTIVE: { label: 'Нет активной сессии', className: 'session-detail-settled', Icon: IconPlayerPause },
  ACTIVE: { label: 'Активна', className: 'session-detail-active', Icon: IconActivity },
  WAITING_FOR_VALIDATION: { label: 'Ожидает валидации', className: 'session-detail-waiting', Icon: IconHourglass },
  READY_TO_CLOSE: { label: 'Готова к закрытию', className: 'session-detail-ready', Icon: IconCircleCheck },
  CLOSED: { label: 'Закрыта', className: 'session-detail-closed', Icon: IconRosetteDiscountCheck },
  STALE_SESSION: { label: 'Устарела', className: 'session-detail-stale', Icon: IconAlertTriangle },
  UNKNOWN: { label: 'Неизвестно', className: 'session-detail-unknown', Icon: IconQuestionMark },
}

const closureStatusMeta: Record<ArenaSessionClosureStatus, { label: string; className: string }> = {
  CONFIRMED: { label: 'Подтверждено', className: 'closure-confirmed' },
  NOT_CONFIRMED: { label: 'Не подтверждено', className: 'closure-not-confirmed' },
  UNKNOWN: { label: 'Неизвестно', className: 'closure-unknown' },
}

/**
 * Project completion and session closure are different facts. `DONE` never
 * implies `CLOSED`, and `CLOSED` never implies `DONE`; when the evidence cannot
 * decide, the view states `UNKNOWN` instead of guessing.
 */
function sessionClosureNote(project: ProjectState): string {
  const { session } = project
  const projectStatus = project.triageState
    ?? (project.triageSource.status === 'CONFLICT' ? 'SOURCE CONFLICT' : 'STATUS UNKNOWN')

  if (session.sessionState === 'CLOSED' && project.triageState !== 'DONE') {
    return `Сессия Arena закрыта (CLOSED), но операционный статус проекта — ${projectStatus}. CLOSED сам по себе не означает DONE.`
  }
  if (project.triageState === 'DONE' && session.sessionState !== 'CLOSED') {
    return `Проект DONE, но сессия Arena не подтверждена закрытой (${session.sessionState}). DONE не означает CLOSED.`
  }
  if (session.sessionClosureStatus === 'UNKNOWN') {
    return 'Закрытие сессии не может быть проверено по доступным источникам: UNKNOWN.'
  }
  if (session.sessionState === 'STALE_SESSION') {
    return 'Сессия остаётся открытой дольше порога бездействия (STALE_SESSION): закрытие не подтверждено evidence. Статус проекта и статус сессии остаются разными значениями.'
  }
  if (session.sessionState === 'READY_TO_CLOSE') {
    return 'Работа по checkpoint завершена, но закрытие сессии ожидает подтверждения (READY_TO_CLOSE — не подтверждено evidence). Статус проекта и статус сессии остаются разными значениями.'
  }
  if (session.sessionClosureStatus === 'NOT_CONFIRMED') {
    return `Закрытие сессии не подтверждено evidence (${session.sessionState}). Статус проекта и статус сессии остаются разными значениями.`
  }
  return 'Закрытие сессии подтверждено evidence. Операционный статус проекта оценивается отдельно.'
}

function SessionPanel({ project }: { project: ProjectState }) {
  const session = project.session
  const state = sessionStateMeta[session.sessionState]
  const closure = closureStatusMeta[session.sessionClosureStatus]
  const StateIcon = state.Icon

  return (
    <>
      <p className="detail-note">
        <IconInfoCircle size={16}/>
        <span>
          <strong>Статус проекта и закрытие сессии — разные факты.</strong> DONE не означает CLOSED,
          а CLOSED не означает DONE. Дашборд только наблюдает состояние сессии по evidence и никогда
          не открывает и не закрывает её.
        </span>
      </p>
      <p className="detail-note-line">{sessionClosureNote(project)}</p>
      <dl className="detail-fields">
        <DetailRow label="Состояние сессии">
          <span className={`session-detail-badge ${state.className}`}><StateIcon size={14}/> {session.sessionState}</span>
          <small className="detail-hint">{state.label} — {session.sessionStateReason}</small>
        </DetailRow>
        <DetailRow label="Закрытие сессии">
          <span className={`closure-badge ${closure.className}`}>{closure.label}</span>
        </DetailRow>
        <DetailRow label="Checkpoint сессии">
          {session.sessionCheckpoint ?? <span className="meta-unknown">Не зафиксирован источником</span>}
        </DetailRow>
        <DetailRow label="Сессия начата">
          <ActivityValue timestamp={session.sessionStartedAt}/>
        </DetailRow>
        <DetailRow label="Последняя активность сессии">
          <ActivityValue timestamp={session.sessionLastActivityAt}/>
        </DetailRow>
        <DetailRow label="Подтверждение закрытия">
          {session.sessionClosureEvidence
            ? <a className="detail-evidence-link" href={session.sessionClosureEvidence.url} target="_blank" rel="noreferrer">
                <IconExternalLink size={14}/> {session.sessionClosureEvidence.label}
              </a>
            : <span className="meta-unknown">Отсутствует — закрытие не подтверждено</span>}
        </DetailRow>
        <DetailRow label="Evidence состояния сессии">
          {session.sessionStateEvidence.length > 0
            ? <span className="detail-evidence-list">
                {session.sessionStateEvidence.map((link) => (
                  <a key={link.url} href={link.url} target="_blank" rel="noreferrer" title={link.sourceId}>
                    <IconExternalLink size={13}/> {link.label}
                  </a>
                ))}
              </span>
            : <span className="meta-unknown">Нет evidence для состояния сессии</span>}
        </DetailRow>
      </dl>
    </>
  )
}
