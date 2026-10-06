// Default React import: see NodeView.tsx — required by the tsx test runner's
// classic JSX transform, tree-shaken by the automatic-runtime build.
import React from 'react'
import { IconArrowRight, IconExternalLink } from '@tabler/icons-react'
import { historyEventCategory, type HistoryEvent, type ProjectHistory } from '../contract/project-state'
import { HISTORY_EVENT_LABELS } from '../monitoring/history-view'
import { formatEventTimestamp } from '../monitoring/project-detail-events'

/** Plain-language note on what an event timestamp means when it is not the evidence's own time. */
const TIME_BASIS_NOTE: Record<HistoryEvent['timeBasis'], string | null> = {
  EVENT: null,
  SESSION_LAST_ACTIVITY: 'Время закрытия/перехода источник не объявляет — событие датировано последней активностью сессии.',
  INACTIVITY_THRESHOLD: 'Момент пересечения порога бездействия: последняя активность сессии + порог. Не время snapshot.',
}

/** Short, readable form of an evidence id (full commit SHA → 7 characters). */
function shortSourceId(event: HistoryEvent): string {
  return /^[0-9a-f]{40}$/.test(event.sourceId) ? event.sourceId.slice(0, 7) : event.sourceId
}

/**
 * One history event with its full provenance: what happened, when, from which
 * evidence source / id, and a link to that evidence. Shared by History & Reports
 * and the Project Detail history panel so both render an event identically.
 */
export function HistoryEventBody({ event }: { event: HistoryEvent }) {
  const note = TIME_BASIS_NOTE[event.timeBasis]
  return (
    <>
      <div className="history-event-heading">
        <span data-category={historyEventCategory(event.type)}>{HISTORY_EVENT_LABELS[event.type]}</span>
        <time dateTime={event.occurredAt}>{formatEventTimestamp(event.occurredAt)} UTC</time>
      </div>
      {(event.from !== null || event.to !== null) && (
        <div className="history-transition">
          <strong>{event.from ?? 'нет блокера'}</strong><IconArrowRight size={16}/><strong>{event.to ?? 'нет блокера'}</strong>
        </div>
      )}
      <p>{event.summary}</p>
      {note && <p className="history-time-note">{note}</p>}
      <p className="history-provenance" title={event.sourceId}>
        <span>{event.source}</span> · <code>{shortSourceId(event)}</code>
        {/* The 7-character form is deliberate on wide screens, but a `title` is
            unreachable by touch: on phones the full evidence id is real text. */}
        {shortSourceId(event) !== event.sourceId && <span className="touch-hint"> · {event.sourceId}</span>}
      </p>
      <a href={event.evidenceUrl} target="_blank" rel="noreferrer"><IconExternalLink size={13}/> Evidence</a>
    </>
  )
}

/** Explicit evidence gaps of a project's history; renders nothing when there are none. */
export function HistoryGaps({ history }: { history: ProjectHistory }) {
  if (history.status !== 'KNOWN' || history.gaps.length === 0) return null
  return (
    <ul className="history-gaps" aria-label="Пробелы в evidence">
      {history.gaps.map((gap) => (
        <li key={`${gap.area}:${gap.reason}`}>
          <span className="detail-event-gap">UNAVAILABLE · {gap.area}</span>
          <span>{gap.reason}</span>
        </li>
      ))}
    </ul>
  )
}
