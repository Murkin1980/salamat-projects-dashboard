// Default React import: see NodeView.tsx — required by the tsx test runner's
// classic JSX transform, tree-shaken by the automatic-runtime build.
import React, { useMemo, useState } from 'react'
import {
  IconActivity,
  IconFlag3,
  IconGitCommit,
  IconGitPullRequest,
  IconHistory,
  IconLock,
  IconQuestionMark,
  IconRadar,
  IconReportAnalytics,
} from '@tabler/icons-react'
import {
  historyEventCategory,
  type HistoryEventCategory,
  type ProjectState,
} from '../contract/project-state'
import {
  HISTORY_CATEGORY_LABELS,
  HISTORY_EVENT_CATEGORIES,
  defaultReportProject,
  filterHistoryEvents,
  getHistoryEvents,
  summarizeHistory,
} from '../monitoring/history-view'
import { formatEventTimestamp } from '../monitoring/project-detail-events'
import { projectDetailHash, reportHash } from '../routing/hash-route'
import { HistoryEventBody, HistoryGaps } from './history-parts'

const categoryIcon = {
  COMMITS: IconGitCommit,
  PULL_REQUESTS: IconGitPullRequest,
  STATUS: IconFlag3,
  SESSION: IconRadar,
} satisfies Record<HistoryEventCategory, typeof IconHistory>

export interface ReportViewProps {
  /** Portfolio projects in the dashboard's deterministic activity order. */
  projects: readonly ProjectState[]
  /** Project named by the `#/reports/<id>` route; `null` selects the default project. */
  selectedProjectId: string | null
  onNavigate: (hash: string) => void
}

/**
 * History & Reports (CP-17): the live, evidence-backed history of one selected
 * project, read from the same normalized `ProjectState` the cards and the Project
 * Detail view render. Read-only: the selector and the filters only change what is
 * displayed, never any project or session.
 */
export function ReportView({ projects, selectedProjectId, onNavigate }: ReportViewProps) {
  const [visible, setVisible] = useState<Set<HistoryEventCategory>>(() => new Set(HISTORY_EVENT_CATEGORIES))
  const requested = selectedProjectId === null ? null : projects.find((project) => project.id === selectedProjectId) ?? null
  const project = selectedProjectId === null ? defaultReportProject(projects) : requested
  const allEvents = useMemo(() => (project ? getHistoryEvents(project) : []), [project])
  const events = useMemo(() => filterHistoryEvents(allEvents, visible), [allEvents, visible])
  const summary = useMemo(() => summarizeHistory(allEvents), [allEvents])

  function toggle(category: HistoryEventCategory) {
    setVisible((current) => {
      const next = new Set(current)
      if (next.has(category)) next.delete(category)
      else next.add(category)
      return next
    })
  }

  const selector = (
    <label className="report-project-select">
      <span>Проект</span>
      <select
        aria-label="Проект отчёта"
        value={project?.id ?? ''}
        onChange={(event) => onNavigate(reportHash(event.target.value))}
      >
        {requested === null && selectedProjectId !== null && <option value="">— выберите проект —</option>}
        {projects.map((candidate) => {
          const count = getHistoryEvents(candidate).length
          return (
            <option key={candidate.id} value={candidate.id}>
              {candidate.name} — {candidate.history.status === 'KNOWN' ? `${count} событий` : 'история недоступна'}
            </option>
          )
        })}
      </select>
    </label>
  )

  if (!project) {
    return (
      <section className="reports-workspace" aria-labelledby="reports-heading">
        <header className="reports-heading">
          <div>
            <p className="eyebrow">Live history</p>
            <h2 id="reports-heading">{selectedProjectId === null ? 'Проекты отсутствуют' : 'Проект не найден'}</h2>
            <p>{selectedProjectId === null
              ? 'В snapshot нет проектов, поэтому историю показывать не из чего.'
              : <>Проект <code>{selectedProjectId}</code> отсутствует в текущем snapshot портфеля. Данные не подставлены.</>}
            </p>
          </div>
          <span className="read-only-badge"><IconLock size={15}/> READ ONLY</span>
        </header>
        {selectedProjectId !== null && <div className="report-controls">{selector}</div>}
        {selectedProjectId !== null && <div className="empty-state"><IconQuestionMark size={26}/><p>Выберите проект из списка.</p></div>}
      </section>
    )
  }

  const history = project.history
  const snapshotAt = project.activity.snapshotGeneratedAt.at

  return (
    <section className="reports-workspace" aria-labelledby="reports-heading">
      <header className="reports-heading">
        <div>
          <p className="eyebrow">Live history · GitHub / project evidence</p>
          <h2 id="reports-heading">{project.name}</h2>
          <p>
            Только подтверждённые события: коммиты, жизненный цикл PR, переходы канонического статуса и
            события сессии Arena. Статус проекта и статус сессии — разные факты.
          </p>
        </div>
        <div className="reports-heading-actions">
          <span className="read-only-badge"><IconLock size={15}/> READ ONLY</span>
          <a className="report-detail-link" href={projectDetailHash(project.id)} rel="noreferrer" onClick={(event) => {
            if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return
            event.preventDefault()
            onNavigate(projectDetailHash(project.id))
          }}>Карточка проекта</a>
        </div>
      </header>

      <div className="report-controls">
        {selector}
        <p className="report-window">
          {history.status === 'KNOWN'
            ? <>Окно: последние {history.limits.commits} коммитов, {history.limits.pullRequests} PR, {history.limits.statusRevisions} ревизий статуса. </>
            : null}
          Snapshot сформирован {formatEventTimestamp(snapshotAt)} UTC — это часы дашборда, а не активность проекта.
        </p>
      </div>

      {history.status === 'UNAVAILABLE' ? (
        <div className="empty-state history-unavailable" role="status">
          <IconQuestionMark size={26}/>
          <p><strong>История недоступна (UNAVAILABLE).</strong></p>
          <p>{history.reason}</p>
          <p>События не придуманы: дашборд не показывает историю без evidence.</p>
        </div>
      ) : (
        <>
          <div className="report-metrics" aria-label="Сводка событий">
            <article><IconGitCommit size={19}/><span>Коммиты</span><strong>{summary.commits}</strong></article>
            <article><IconGitPullRequest size={19}/><span>PR открыт / влит / закрыт</span><strong>{summary.pullRequestsOpened} / {summary.pullRequestsMerged} / {summary.pullRequestsClosed}</strong></article>
            <article><IconFlag3 size={19}/><span>Checkpoint moves</span><strong>{summary.checkpointMoves}</strong></article>
            <article><IconActivity size={19}/><span>State changes</span><strong>{summary.stateChanges}</strong></article>
            <article className={summary.blockerChanges === 0 ? 'metric-zero' : ''}><IconLock size={19}/><span>Blocker changes</span><strong>{summary.blockerChanges}</strong><small>{summary.blockerChanges === 0 ? 'Нет подтверждённых изменений в окне' : 'Подтверждено evidence'}</small></article>
            <article className={summary.sessionEvents === 0 ? 'metric-zero' : ''}><IconRadar size={19}/><span>События сессии</span><strong>{summary.sessionEvents}</strong><small>{summary.sessionEvents === 0 ? 'Нет атрибутируемых событий сессии' : 'Из блока сессии статуса'}</small></article>
          </div>

          <HistoryGaps history={history}/>

          <div className="history-filters" aria-label="Фильтры истории">
            {HISTORY_EVENT_CATEGORIES.map((category) => {
              const Icon = categoryIcon[category]
              const active = visible.has(category)
              return (
                <button key={category} type="button" aria-pressed={active} className={active ? 'active' : ''} onClick={() => toggle(category)}>
                  <Icon size={15}/>{HISTORY_CATEGORY_LABELS[category]}
                </button>
              )
            })}
            <button type="button" className="history-reset" onClick={() => setVisible(new Set(HISTORY_EVENT_CATEGORIES))}>Сбросить</button>
          </div>

          {events.length > 0 ? (
            <ol className="history-timeline">
              {events.map((event) => {
                const category = historyEventCategory(event.type)
                const Icon = categoryIcon[category]
                return (
                  <li key={event.id}>
                    <div className={`history-icon event-${category.toLowerCase()}`}><Icon size={18}/></div>
                    <article><HistoryEventBody event={event}/></article>
                  </li>
                )
              })}
            </ol>
          ) : (
            <div className="empty-state">
              <IconReportAnalytics size={26}/>
              <p>{allEvents.length === 0
                ? 'В окне нет событий с evidence. История не дополнена.'
                : 'Нет событий по текущим фильтрам.'}</p>
            </div>
          )}
        </>
      )}
    </section>
  )
}
