import { useMemo, useState } from 'react'
import { IconArrowRight, IconExternalLink, IconFlag3, IconHistory, IconLock, IconReportAnalytics } from '@tabler/icons-react'
import { summarizeHistory, type HistoryEventType, type ProjectHistory } from '../history/project-history'

const eventMeta = {
  CHECKPOINT_MOVED: { label: 'Checkpoint', Icon: IconFlag3 },
  STATE_CHANGED: { label: 'State', Icon: IconHistory },
  BLOCKER_CHANGED: { label: 'Blocker', Icon: IconLock },
} satisfies Record<HistoryEventType, { label: string; Icon: typeof IconHistory }>

const eventTypes = Object.keys(eventMeta) as HistoryEventType[]

export function ReportView({ history }: { history: ProjectHistory }) {
  const [visibleTypes, setVisibleTypes] = useState<Set<HistoryEventType>>(() => new Set(eventTypes))
  const summary = summarizeHistory(history)
  const events = useMemo(() => [...history.events].reverse().filter((event) => visibleTypes.has(event.type)), [history.events, visibleTypes])

  function toggleType(type: HistoryEventType) {
    setVisibleTypes((current) => {
      const next = new Set(current)
      if (next.has(type)) next.delete(type)
      else next.add(type)
      return next
    })
  }

  return (
    <section className="reports-workspace" aria-labelledby="reports-heading">
      <header className="reports-heading">
        <div>
          <p className="eyebrow">Git-backed transition report</p>
          <h2 id="reports-heading">{history.projectName}</h2>
          <p>Только подтверждённые изменения из истории PROJECT_STATUS.md.</p>
        </div>
        <span className="read-only-badge"><IconLock size={15}/> READ ONLY</span>
      </header>

      <div className="report-metrics" aria-label="Сводка изменений">
        <article><IconFlag3 size={19}/><span>Checkpoint moves</span><strong>{summary.checkpointMoves}</strong></article>
        <article><IconHistory size={19}/><span>State changes</span><strong>{summary.stateChanges}</strong></article>
        <article className={summary.blockerChanges === 0 ? 'metric-zero' : ''}><IconLock size={19}/><span>Blocker changes</span><strong>{summary.blockerChanges}</strong><small>{summary.blockerChanges === 0 ? 'Нет подтверждённых изменений' : 'Подтверждено evidence'}</small></article>
      </div>

      <div className="history-filters" aria-label="Фильтры истории">
        {eventTypes.map((type) => {
          const { Icon, label } = eventMeta[type]
          const active = visibleTypes.has(type)
          return <button key={type} type="button" aria-pressed={active} className={active ? 'active' : ''} onClick={() => toggleType(type)}><Icon size={15}/>{label}</button>
        })}
        <button type="button" className="history-reset" onClick={() => setVisibleTypes(new Set(eventTypes))}>Сбросить</button>
      </div>

      {events.length ? <ol className="history-timeline">
        {events.map((event) => {
          const { Icon, label } = eventMeta[event.type]
          return <li key={event.id}>
            <div className={`history-icon event-${event.type.toLowerCase()}`}><Icon size={18}/></div>
            <article>
              <div className="history-event-heading"><span>{label}</span><time dateTime={event.occurredAt}>{new Intl.DateTimeFormat('ru-RU', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' }).format(new Date(event.occurredAt))}</time></div>
              <div className="history-transition"><strong>{event.from ?? 'Нет blocker'}</strong><IconArrowRight size={16}/><strong>{event.to ?? 'Нет blocker'}</strong></div>
              <p>{event.summary}</p>
              <a href={event.evidenceUrl} target="_blank" rel="noreferrer"><IconExternalLink size={14}/> Commit {event.sourceId.slice(0, 7)}</a>
            </article>
          </li>
        })}
      </ol> : <div className="empty-state"><IconReportAnalytics size={26}/><p>Нет событий по текущим фильтрам.</p></div>}
    </section>
  )
}
