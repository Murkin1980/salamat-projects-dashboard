import React, { useMemo, useState } from 'react'
import {
  IconActivity,
  IconExternalLink,
  IconLock,
  IconQuestionMark,
} from '@tabler/icons-react'
import { historyEventCategory, type ProjectState } from '../contract/project-state'
import {
  getPortfolioActivity,
  projectsWithoutHistory,
  RECENT_ACTIVITY_LIMIT,
} from '../monitoring/recent-activity'
import { projectDetailHash } from '../routing/hash-route'
import { HistoryEventBody } from './history-parts'

export function RecentActivityView({
  projects,
  onNavigate,
}: {
  projects: readonly ProjectState[]
  onNavigate: (hash: string) => void
}) {
  const [projectId, setProjectId] = useState('ALL')
  const events = useMemo(
    () => getPortfolioActivity(projects, projectId === 'ALL' ? null : projectId),
    [projectId, projects],
  )
  const unavailable = useMemo(() => projectsWithoutHistory(projects), [projects])

  return (
    <section className="activity-workspace" aria-labelledby="activity-heading">
      <header className="reports-heading">
        <div>
          <p className="eyebrow">Portfolio activity · latest snapshot</p>
          <h2 id="activity-heading">Что изменилось недавно</h2>
          <p>Единая лента подтверждённых событий всех проектов. Порядок определяется временем evidence, а не временем открытия страницы.</p>
        </div>
        <span className="read-only-badge"><IconLock size={15}/> READ ONLY</span>
      </header>

      <div className="activity-controls">
        <label className="report-project-select">
          <span>Проект</span>
          <select aria-label="Фильтр проекта" value={projectId} onChange={(event) => setProjectId(event.target.value)}>
            <option value="ALL">Все проекты</option>
            {projects.map((project) => <option key={project.id} value={project.id}>{project.name}</option>)}
          </select>
        </label>
        <p>Показаны последние {RECENT_ACTIVITY_LIMIT} событий из текущего snapshot.</p>
      </div>

      {unavailable.length > 0 && projectId === 'ALL' && (
        <p className="activity-coverage" role="status">
          <IconQuestionMark size={16}/> История недоступна для {unavailable.length} из {projects.length} проектов; события для них не придуманы.
        </p>
      )}

      {events.length === 0 ? (
        <div className="empty-state"><IconActivity size={26}/><p>Для выбранного проекта нет событий с evidence.</p></div>
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
                <span>{project.checkpoint ?? 'Checkpoint не указан'}</span>
              </div>
              <article><HistoryEventBody event={event}/></article>
            </li>
          ))}
        </ol>
      )}

      <p className="activity-boundary"><IconExternalLink size={14}/> Ссылки Evidence ведут к исходным GitHub-данным. Лента ничего не запускает и не изменяет.</p>
    </section>
  )
}
