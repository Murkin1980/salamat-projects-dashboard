import { useCallback, useMemo, useRef, useState, type KeyboardEvent } from 'react'
import { IconAlertTriangle, IconRoute } from '@tabler/icons-react'
import {
  listNodeGraphProjects,
  resolveActiveNodeGraph,
  type NodeGraph,
} from '../graph/node-graph'
import { NodeView } from './NodeView'

const PANEL_ID = 'nodes-graph-panel'
const PROJECT_LABEL_ID = 'nodes-project-label'

function tabId(graphId: string) {
  return `nodes-project-tab-${graphId}`
}

/**
 * Multi-project Nodes surface. The switcher is built strictly from graph entries
 * that exist in `config/node-graphs.json`; projects without graph data are never
 * offered. The view stays read-only: switching only changes the rendered graph.
 */
export function NodesView({ graphs }: { graphs: readonly NodeGraph[] }) {
  const options = useMemo(() => listNodeGraphProjects(graphs), [graphs])
  const [activeProjectId, setActiveProjectId] = useState(() => options[0]?.projectId ?? '')
  const activeGraph = useMemo(
    () => resolveActiveNodeGraph(graphs, activeProjectId),
    [graphs, activeProjectId],
  )
  const tabRefs = useRef<Array<HTMLButtonElement | null>>([])
  const activeIndex = options.findIndex((option) => option.projectId === activeProjectId)

  const activateTab = useCallback((index: number) => {
    const option = options[index]
    if (!option) return
    setActiveProjectId(option.projectId)
    tabRefs.current[index]?.focus()
  }, [options])

  // WAI-ARIA tabs keyboard model: arrows move and activate, Home/End jump to the edges.
  function handleTabKeyDown(event: KeyboardEvent<HTMLDivElement>) {
    if (!options.length) return
    const current = activeIndex >= 0 ? activeIndex : 0
    const last = options.length - 1
    let nextIndex: number | null = null
    if (event.key === 'ArrowRight') nextIndex = current === last ? 0 : current + 1
    else if (event.key === 'ArrowLeft') nextIndex = current === 0 ? last : current - 1
    else if (event.key === 'Home') nextIndex = 0
    else if (event.key === 'End') nextIndex = last
    if (nextIndex === null) return
    event.preventDefault()
    activateTab(nextIndex)
  }

  if (!options.length) {
    return (
      <section className="nodes-empty-state" aria-labelledby="nodes-empty-heading">
        <IconRoute size={26}/>
        <h2 id="nodes-empty-heading">Графы не найдены</h2>
        <p>В <code>config/node-graphs.json</code> нет ни одной записи графа, поэтому переключать нечего и выдумывать проекты нельзя.</p>
      </section>
    )
  }

  return (
    <div className="nodes-view">
      <div className="nodes-project-switcher">
        <span className="nodes-project-label" id={PROJECT_LABEL_ID}>Активный проект</span>
        <div
          className="nodes-project-tabs"
          role="tablist"
          aria-labelledby={PROJECT_LABEL_ID}
          aria-orientation="horizontal"
          onKeyDown={handleTabKeyDown}
        >
          {options.map((option, index) => {
            const isActive = option.projectId === activeProjectId
            return (
              <button
                key={option.graphId}
                ref={(element) => { tabRefs.current[index] = element }}
                id={tabId(option.graphId)}
                type="button"
                role="tab"
                aria-selected={isActive}
                aria-controls={PANEL_ID}
                tabIndex={isActive ? 0 : -1}
                className={`nodes-project-tab${isActive ? ' active' : ''}${option.sourceState !== 'KNOWN' ? ' has-warning' : ''}`}
                onClick={() => setActiveProjectId(option.projectId)}
              >
                <strong>{option.name}</strong>
                <small>{option.projectId} · SOURCE {option.sourceState}</small>
              </button>
            )
          })}
        </div>
      </div>

      <div
        id={PANEL_ID}
        role="tabpanel"
        tabIndex={-1}
        aria-labelledby={activeGraph ? tabId(activeGraph.id) : undefined}
        className="nodes-panel"
      >
        {activeGraph
          ? <NodeView key={activeGraph.id} graph={activeGraph}/>
          : (
            <section className="nodes-empty-state" aria-labelledby="nodes-empty-heading">
              <IconAlertTriangle size={26}/>
              <h2 id="nodes-empty-heading">Для этого проекта граф ещё не подготовлен</h2>
              <p>Запись графа для <code>{activeProjectId || 'выбранного проекта'}</code> отсутствует в <code>config/node-graphs.json</code>. Данные о состоянии не выдумываются — выберите проект из списка выше.</p>
            </section>
          )}
      </div>
    </div>
  )
}
