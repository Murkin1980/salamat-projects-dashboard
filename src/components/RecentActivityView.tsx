import React, { useMemo, useState } from 'react'
import {
  IconActivity,
  IconExternalLink,
  IconLock,
  IconQuestionMark,
} from '@tabler/icons-react'
import { HISTORY_EVENT_TYPES, HistoryEventTypeSchema, historyEventCategory, type HistoryEvent, type ProjectState } from '../contract/project-state'
import {
  getPortfolioActivity,
  projectsWithoutHistory,
  RECENT_ACTIVITY_LIMIT,
} from '../monitoring/recent-activity'
import { HISTORY_EVENT_LABELS } from '../monitoring/history-view'
import { projectDetailHash, viewHash } from '../routing/hash-route'
import { HistoryEventBody } from './history-parts'

export function RecentActivityView({
  projects,
  onNavigate,
  compact = false,
}: {
  compact?: boolean
  projects: readonly ProjectState[]
  onNavigate: (hash: string) => void
}) {
  const [projectId, setProjectId] = useState('ALL')
  const [eventType, setEventType] = useState<HistoryEvent['type'] | null>(null)
  const limit = compact ? 3 : RECENT_ACTIVITY_LIMIT
  const events = useMemo(
    () => getPortfolioActivity(projects, projectId === 'ALL' ? null : projectId, limit, eventType),
    [projectId, projects, limit, eventType],
  )
  const unavailable = useMemo(() => projectsWithoutHistory(projects), [projects])

  return (
    <section className={compact ? 'activity-workspace activity-compact' : 'activity-workspace'} aria-labelledby="activity-heading">
      <header className="reports-heading">
        <div>
          <h2 id="activity-heading">Что изменилось недавно</h2>
        </div>
        {compact
          ? <a className="activity-all" href={viewHash('activity')}>Открыть ленту</a>
          : <span className="read-only-badge"><IconLock size={15}/> READ ONLY</span>}
      </header>

      <div className="activity-controls">
        <label className="report-project-select">
          <span>Проект</span>
          <select aria-label="Фильтр проекта" value={projectId} onChange={(event) => setProjectId(event.target.value)}>
            <option value="ALL">Все проекты</option>
            {projects.map((project) => <option key={project.id} value={project.id}>{project.name}</option>)}
          </select>
        </label>
        <label className="report-project-select">
          <span>Тип события</span>
          <select value={eventType ?? ''} onChange={(event) => {
            setEventType(HistoryEventTypeSchema.safeParse(event.target.value).data ?? null)
          }}>
            <option value="">Все типы</option>
            {HISTORY_EVENT_TYPES.map((type) => <option key={type} value={type}>{HISTORY_EVENT_LABELS[type]}</option>)}
          </select>
        </label>
      </div>

      {unavailable.length > 0 && projectId === 'ALL' && (
        <p className="activity-coverage" role="status">
          <IconQuestionMark size={16}/> История недоступна для {unavailable.length} из {projects.length} проектов.
        </p>
      )}

      {events.length === 0 ? (
        <div className="empty-state"><IconActivity size={26}/><p>Нет подтверждённых событий по выбранным фильтрам.</p></div>
      ) : (
        <ol className="activity-feed">
          {events.map(({ project, event }) => (
            <li key={`${project.id}:${event.id}`} data-category={historyEventCategory(event.type)}>
              <div className="activity-project">
                <a href={projectDetailHash(project.id)} onClick={(click) => {
                  if (click.metaKey || click.ctrlKey || click.shiftKey || click.altKey) return
                  click.preventDefault()
                  onNavigate(projectDetailHash(project.id))
                }}>{project.name}</a>
                {!compact && project.checkpoint && <span>{project.checkpoint}</span>}
              </div>
              <article><HistoryEventBody event={event} compact={compact}/></article>
            </li>
          ))}
        </ol>
      )}

      {!compact && <p className="activity-boundary"><IconExternalLink size={14}/> До {limit} последних событий из текущего снимка GitHub.</p>}
    </section>
  )
}
