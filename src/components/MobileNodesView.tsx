// Default React import: see NodeView.tsx — required by the tsx test runner's
// classic JSX transform, tree-shaken by the automatic-runtime build.
import React, { type CSSProperties } from 'react'
import { IconExternalLink, IconRelationOneToMany } from '@tabler/icons-react'
import { edgePresentation } from '../graph/edge-presentation'
import type { NodeGraph } from '../graph/node-graph'
import { nodeTypeMeta } from './node-type-meta'

export interface MobileNodesViewProps {
  graph: NodeGraph
  /** Output of the single shared `filterNodeGraph` call owned by `NodeView`. */
  filtered: Pick<NodeGraph, 'nodes' | 'edges'>
  selectedId: string | null
  selectedEdgeId: string | null
  onSelectNode: (nodeId: string) => void
  onSelectEdge: (edgeId: string) => void
}

/**
 * Dedicated structural Nodes branch for viewports <= 760px.
 *
 * The React Flow canvas is never mounted here: nodes and relationships render
 * as plain tappable cards consuming exactly the same parsed graph, the same
 * shared `filtered` result and the same selection state as the desktop
 * branch. The branch itself is selected in `NodeView` via `matchMedia`, not
 * via CSS display toggling of one shared DOM tree.
 */
export function MobileNodesView({
  graph,
  filtered,
  selectedId,
  selectedEdgeId,
  onSelectNode,
  onSelectEdge,
}: MobileNodesViewProps) {
  const selectedNode = graph.nodes.find((node) => node.id === selectedId) ?? null
  const selectedEdge = graph.edges.find((edge) => edge.id === selectedEdgeId) ?? null
  const selectedEdgeSource = selectedEdge ? graph.nodes.find((node) => node.id === selectedEdge.source) ?? null : null
  const selectedEdgeTarget = selectedEdge ? graph.nodes.find((node) => node.id === selectedEdge.target) ?? null : null
  const selectedRelations = selectedNode
    ? graph.edges.filter((edge) => edge.source === selectedNode.id || edge.target === selectedNode.id)
    : []
  const nodeLabel = (nodeId: string) => graph.nodes.find((node) => node.id === nodeId)?.label ?? nodeId

  return (
    <div className="nodes-mobile-view">
      <section aria-labelledby="mobile-nodes-heading">
        <h3 className="mobile-section-heading" id="mobile-nodes-heading">Узлы · {filtered.nodes.length}</h3>
        {filtered.nodes.length ? (
          <div className="mobile-node-cards">
            {filtered.nodes.map((node) => {
              const { Icon, label } = nodeTypeMeta[node.type]
              const isSelected = selectedId === node.id
              return (
                <button
                  key={node.id}
                  type="button"
                  className={`mobile-node-card${isSelected ? ' selected' : ''}`}
                  aria-pressed={isSelected}
                  onClick={() => onSelectNode(node.id)}
                >
                  <span className="mobile-node-icon" aria-hidden="true"><Icon size={18}/></span>
                  <span className="mobile-node-card-body">
                    <strong>{node.label}</strong>
                    <small>{label}</small>
                    <span className="mobile-node-detail">{node.detail}</span>
                  </span>
                  <span className={`mobile-node-status status-${node.status.toLowerCase()}`}>{node.status}</span>
                </button>
              )
            })}
          </div>
        ) : <p className="mobile-empty-hint">Нет узлов по текущим фильтрам — сбросьте фильтры выше.</p>}
      </section>

      <section className="mobile-selected-detail" aria-label="Детали выбранного узла или связи">
        {selectedEdge && selectedEdgeSource && selectedEdgeTarget ? (
          <article
            className="mobile-detail-card"
            style={{ '--edge-color': edgePresentation[selectedEdge.type].color } as CSSProperties}
          >
            <header className="mobile-detail-head">
              <span className="mobile-detail-icon" aria-hidden="true"><IconRelationOneToMany size={20}/></span>
              <span className="mobile-detail-title">
                <small>Выбранная связь</small>
                <strong>{edgePresentation[selectedEdge.type].label}</strong>
              </span>
            </header>
            <div className="mobile-edge-direction">
              <div className="mobile-edge-endpoint mobile-edge-source"><small>ИСТОЧНИК</small><strong>{selectedEdgeSource.label}</strong></div>
              <div className="mobile-direction-arrow" aria-hidden="true">→</div>
              <div className="mobile-edge-endpoint mobile-edge-target"><small>ПОЛУЧАТЕЛЬ</small><strong>{selectedEdgeTarget.label}</strong></div>
            </div>
            <p>{edgePresentation[selectedEdge.type].description}</p>
            <a href={selectedEdge.evidenceUrl} target="_blank" rel="noreferrer">Открыть evidence связи <IconExternalLink size={14}/></a>
            <code>{selectedEdge.sourceId}</code>
          </article>
        ) : selectedNode ? (
          <article className="mobile-detail-card">
            <header className="mobile-detail-head">
              {(() => { const { Icon } = nodeTypeMeta[selectedNode.type]; return <span className="mobile-detail-icon" aria-hidden="true"><Icon size={20}/></span> })()}
              <span className="mobile-detail-title">
                <small>{nodeTypeMeta[selectedNode.type].label}</small>
                <strong>{selectedNode.label}</strong>
              </span>
              <span className={`mobile-node-status status-${selectedNode.status.toLowerCase()}`}>{selectedNode.status}</span>
            </header>
            <p>{selectedNode.detail}</p>
            <dl className="mobile-detail-meta">
              <div><dt>Связей</dt><dd>{selectedRelations.length}</dd></div>
              <div><dt>Режим</dt><dd>READ ONLY</dd></div>
            </dl>
            <a href={selectedNode.evidenceUrl} target="_blank" rel="noreferrer">Открыть evidence <IconExternalLink size={14}/></a>
            <code>{selectedNode.sourceId}</code>
          </article>
        ) : (
          <p className="mobile-empty-hint">Выберите узел из списка, чтобы увидеть детали и связи.</p>
        )}
      </section>

      <section aria-labelledby="mobile-edges-heading">
        <h3 className="mobile-section-heading" id="mobile-edges-heading">Связи · {filtered.edges.length}</h3>
        {filtered.edges.length ? (
          <div className="mobile-edge-cards">
            {filtered.edges.map((edge) => {
              const isSelected = selectedEdgeId === edge.id
              return (
                <button
                  key={edge.id}
                  type="button"
                  className={`mobile-edge-card${isSelected ? ' selected' : ''}`}
                  aria-pressed={isSelected}
                  onClick={() => onSelectEdge(edge.id)}
                  style={{ '--edge-color': edgePresentation[edge.type].color } as CSSProperties}
                >
                  <span className="mobile-edge-color" aria-hidden="true"/>
                  <span className="mobile-edge-card-body">
                    <strong>{nodeLabel(edge.source)} → {nodeLabel(edge.target)}</strong>
                    <small>{edgePresentation[edge.type].label}</small>
                  </span>
                </button>
              )
            })}
          </div>
        ) : <p className="mobile-empty-hint">Нет связей по текущим фильтрам.</p>}
      </section>
    </div>
  )
}
