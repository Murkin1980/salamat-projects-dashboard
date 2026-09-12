// The default React import keeps this module renderable under the tsx test
// runner, which transforms JSX with the classic `React.createElement`
// runtime; the Vite production build uses the automatic JSX runtime and
// tree-shakes the import away.
import React, { useMemo, useState } from 'react'
import {
  Background,
  Controls,
  Handle,
  MarkerType,
  MiniMap,
  Position,
  ReactFlow,
  type Edge,
  type Node,
  type NodeProps,
} from '@xyflow/react'
import {
  IconAlertTriangle,
  IconArrowsSplit,
  IconCheck,
  IconCircleCheck,
  IconClock,
  IconExternalLink,
  IconRelationOneToMany,
  IconRoute,
  IconX,
} from '@tabler/icons-react'
import {
  filterNodeGraph,
  type GraphEdgeType,
  type GraphNodeData,
  type GraphNodeType,
  type NodeGraph,
} from '../graph/node-graph'
import { edgePresentation } from '../graph/edge-presentation'
import { useMediaQuery } from '../hooks/use-media-query'
import { MobileNodesView } from './MobileNodesView'
import { allEdgeTypes, allNodeTypes, nodeTypeMeta } from './node-type-meta'

/**
 * Viewport threshold for the dedicated mobile Nodes branch. At or below this
 * width `NodeView` mounts `MobileNodesView` and never mounts React Flow;
 * above it the desktop canvas/inspector branch renders. The decision is made
 * in JavaScript (matchMedia), not via CSS display toggling, so the mobile
 * presentation is structurally independent of the React Flow canvas.
 */
export const NODES_MOBILE_MEDIA_QUERY = '(max-width: 760px)'

function BlueprintNode({ data, selected }: NodeProps<Node<GraphNodeData>>) {
  const { Icon, label } = nodeTypeMeta[data.type]
  const StatusIcon = data.status === 'PASS' ? IconCheck : data.status === 'CONFLICT' ? IconAlertTriangle : data.status === 'FUTURE' ? IconClock : IconRoute
  return (
    <div className={`blueprint-node node-${data.type.toLowerCase()} status-${data.status.toLowerCase()} ${selected ? 'is-selected' : ''}`}>
      <Handle type="target" position={Position.Left} isConnectable={false}/>
      <div className="node-heading"><Icon size={18}/><span>{label}</span></div>
      <strong>{data.label}</strong>
      <p>{data.detail}</p>
      <small><StatusIcon size={13}/>{data.status}</small>
      <Handle type="source" position={Position.Right} isConnectable={false}/>
    </div>
  )
}

const nodeTypes = { blueprint: BlueprintNode }

export function NodeView({ graph }: { graph: NodeGraph }) {
  const isMobile = useMediaQuery(NODES_MOBILE_MEDIA_QUERY)
  // Default selection stays graph-driven: the previous default node when it exists,
  // otherwise the project node, otherwise nothing (safe for graphs without it).
  const [selectedId, setSelectedId] = useState<string | null>(() => (
    graph.nodes.find((node) => node.id === 'auditor')?.id
    ?? graph.nodes.find((node) => node.type === 'PROJECT')?.id
    ?? null
  ))
  const [selectedEdgeId, setSelectedEdgeId] = useState<string | null>(null)
  const [visibleTypes, setVisibleTypes] = useState<Set<GraphNodeType>>(() => new Set(allNodeTypes))
  const [relationship, setRelationship] = useState<GraphEdgeType | 'ALL'>('ALL')

  // Single shared filtering pipeline: both the mobile list branch and the
  // desktop React Flow branch consume this exact result.
  const filtered = useMemo(() => filterNodeGraph(
    graph,
    visibleTypes,
    new Set(relationship === 'ALL' ? allEdgeTypes : [relationship]),
  ), [graph, relationship, visibleTypes])

  const selectedEdge = graph.edges.find((edge) => edge.id === selectedEdgeId) ?? null
  const selectedEdgeSource = selectedEdge ? graph.nodes.find((node) => node.id === selectedEdge.source) ?? null : null
  const selectedEdgeTarget = selectedEdge ? graph.nodes.find((node) => node.id === selectedEdge.target) ?? null : null

  const nodes = useMemo<Node<GraphNodeData>[]>(() => filtered.nodes.map((node) => {
    const endpointRole = selectedEdge?.source === node.id ? 'edge-source' : selectedEdge?.target === node.id ? 'edge-target' : ''
    return {
      id: node.id,
      type: 'blueprint',
      position: { x: node.x, y: node.y },
      data: node,
      className: endpointRole,
      draggable: false,
      connectable: false,
    }
  }), [filtered.nodes, selectedEdge])

  const edges = useMemo<Edge[]>(() => filtered.edges.map((edge) => {
    const presentation = edgePresentation[edge.type]
    const isSelected = selectedEdgeId === edge.id
    const isDimmed = selectedEdgeId !== null && !isSelected
    return {
      id: edge.id,
      source: edge.source,
      target: edge.target,
      label: presentation.label,
      type: 'smoothstep',
      className: `graph-edge edge-${edge.type} ${isSelected ? 'is-edge-selected' : ''}`,
      style: { stroke: presentation.color, strokeWidth: isSelected ? 4 : 2, opacity: isDimmed ? 0.14 : 1, strokeDasharray: presentation.dash },
      labelStyle: { fill: presentation.color, fontWeight: 800, opacity: isDimmed ? 0.18 : 1 },
      labelBgStyle: { fill: '#ffffff', fillOpacity: isDimmed ? 0.45 : 0.96 },
      markerEnd: { type: MarkerType.ArrowClosed, color: presentation.color, width: isSelected ? 24 : 18, height: isSelected ? 24 : 18 },
      zIndex: isSelected ? 20 : 0,
    }
  }), [filtered.edges, selectedEdgeId])

  const selectedNode = graph.nodes.find((node) => node.id === selectedId) ?? null
  const selectedRelations = selectedNode
    ? graph.edges.filter((edge) => edge.source === selectedNode.id || edge.target === selectedNode.id)
    : []

  function toggleType(type: GraphNodeType) {
    setVisibleTypes((current) => {
      const next = new Set(current)
      if (next.has(type)) next.delete(type)
      else next.add(type)
      return next
    })
  }

  // Shared selection handlers: identical semantics on both branches.
  const handleSelectNode = (nodeId: string) => { setSelectedId(nodeId); setSelectedEdgeId(null) }
  const handleSelectEdge = (edgeId: string) => { setSelectedEdgeId(edgeId); setSelectedId(null) }

  return (
    <section className="nodes-workspace" aria-labelledby="nodes-heading">
      <header className="nodes-toolbar">
        <div>
          <p className="eyebrow">Read-only architecture map</p>
          <h2 id="nodes-heading">{graph.name}</h2>
          <p>{graph.description}</p>
        </div>
        <span className={`graph-source-state state-${graph.sourceState.toLowerCase()}`}>
          {graph.sourceState === 'KNOWN' ? <IconCircleCheck size={16}/> : <IconAlertTriangle size={16}/>} SOURCE {graph.sourceState}
        </span>
      </header>

      <div className="graph-filters" aria-label="Фильтры графа">
        <div className="type-filters">
          {allNodeTypes.map((type) => {
            const { Icon, label } = nodeTypeMeta[type]
            const active = visibleTypes.has(type)
            return <button key={type} type="button" aria-pressed={active} className={active ? 'active' : ''} onClick={() => toggleType(type)}><Icon size={15}/>{label}</button>
          })}
        </div>
        <label>Связь
          <select value={relationship} onChange={(event) => setRelationship(event.target.value as GraphEdgeType | 'ALL')}>
            <option value="ALL">Все связи</option>
            {allEdgeTypes.map((type) => <option key={type} value={type}>{type.replaceAll('_', ' ')}</option>)}
          </select>
        </label>
        <button type="button" className="clear-filters" onClick={() => { setVisibleTypes(new Set(allNodeTypes)); setRelationship('ALL') }}>Сбросить</button>
      </div>

      <ul className="relationship-legend" aria-label="Легенда типов связей">
        {allEdgeTypes.map((type) => <li key={type}><span style={{ '--edge-color': edgePresentation[type].color } as React.CSSProperties}/><strong>{edgePresentation[type].label}</strong></li>)}
      </ul>

      {/*
        Explicit responsive rendering decision (matchMedia, not CSS display
        toggling): at <= 760px a dedicated mobile list branch renders and the
        React Flow canvas is never mounted; above 760px the desktop canvas +
        inspector renders and the mobile branch is absent from the DOM. Both
        branches consume the same `filtered` data and selection state.
      */}
      {isMobile ? (
        <MobileNodesView
          graph={graph}
          filtered={filtered}
          selectedId={selectedId}
          selectedEdgeId={selectedEdgeId}
          onSelectNode={handleSelectNode}
          onSelectEdge={handleSelectEdge}
        />
      ) : (
        <div className="nodes-desktop-view">
          <div className="nodes-layout">
            <div className="graph-canvas" aria-label={`Интерактивная карта узлов: ${graph.name}`}>
              {nodes.length ? (
                <ReactFlow
                  nodes={nodes}
                  edges={edges}
                  nodeTypes={nodeTypes}
                  onNodeClick={(_, node) => handleSelectNode(node.id)}
                  onEdgeClick={(_, edge) => handleSelectEdge(edge.id)}
                  onPaneClick={() => setSelectedEdgeId(null)}
                  nodesDraggable={false}
                  nodesConnectable={false}
                  elementsSelectable
                  fitView
                  fitViewOptions={{ padding: 0.18 }}
                  minZoom={0.35}
                  maxZoom={1.5}
                  proOptions={{ hideAttribution: true }}
                >
                  <Background gap={24} size={1}/>
                  <MiniMap pannable zoomable nodeColor={(node) => node.data.status === 'CONFLICT' ? '#d94949' : node.data.status === 'PASS' ? '#23966a' : '#77839a'}/>
                  <Controls showInteractive={false}/>
                </ReactFlow>
              ) : <div className="graph-empty"><IconArrowsSplit size={26}/><strong>Нет узлов по текущим фильтрам</strong><button type="button" onClick={() => setVisibleTypes(new Set(allNodeTypes))}>Показать все типы</button></div>}
            </div>

            <aside className="node-inspector" aria-label="Инспектор узла или связи">
              {selectedEdge && selectedEdgeSource && selectedEdgeTarget ? (
                <>
                  <div className="inspector-title edge-inspector-title">
                    <div className="inspector-icon" style={{ color: edgePresentation[selectedEdge.type].color, background: `${edgePresentation[selectedEdge.type].color}14` }}><IconRelationOneToMany size={22}/></div>
                    <div><span>Выбранная связь</span><h3>{edgePresentation[selectedEdge.type].label}</h3></div>
                  </div>
                  <div className="edge-direction" style={{ '--edge-color': edgePresentation[selectedEdge.type].color } as React.CSSProperties}>
                    <div className="edge-source-card"><small>ИСТОЧНИК</small><strong>{selectedEdgeSource.label}</strong><span>{selectedEdgeSource.detail}</span></div>
                    <div className="direction-arrow">→</div>
                    <div className="edge-target-card"><small>ПОЛУЧАТЕЛЬ</small><strong>{selectedEdgeTarget.label}</strong><span>{selectedEdgeTarget.detail}</span></div>
                  </div>
                  <p>{edgePresentation[selectedEdge.type].description}</p>
                  <div className="edge-type-key"><span style={{ background: edgePresentation[selectedEdge.type].color }}/>{selectedEdge.type.replaceAll('_', ' ')}</div>
                  <a href={selectedEdge.evidenceUrl} target="_blank" rel="noreferrer">Открыть evidence связи <IconExternalLink size={15}/></a>
                  <code>{selectedEdge.sourceId}</code>
                </>
              ) : selectedNode ? (
                <>
                  <div className="inspector-title">
                    <div className="inspector-icon">{(() => { const Icon = nodeTypeMeta[selectedNode.type].Icon; return <Icon size={22}/> })()}</div>
                    <div><span>{nodeTypeMeta[selectedNode.type].label}</span><h3>{selectedNode.label}</h3></div>
                  </div>
                  <div className={`inspector-status status-${selectedNode.status.toLowerCase()}`}>{selectedNode.status === 'CONFLICT' && <IconAlertTriangle size={15}/>} {selectedNode.status}</div>
                  <p>{selectedNode.detail}</p>
                  <dl>
                    <div><dt>Связей</dt><dd>{selectedRelations.length}</dd></div>
                    <div><dt>Режим</dt><dd>READ ONLY</dd></div>
                  </dl>
                  <div className="relation-list">
                    <strong>Связи</strong>
                    {selectedRelations.map((edge) => <span key={edge.id}>{edge.type.replaceAll('_', ' ')} · {edge.source === selectedNode.id ? graph.nodes.find((n) => n.id === edge.target)?.label : graph.nodes.find((n) => n.id === edge.source)?.label}</span>)}
                  </div>
                  <a href={selectedNode.evidenceUrl} target="_blank" rel="noreferrer">Открыть evidence <IconExternalLink size={15}/></a>
                  <code>{selectedNode.sourceId}</code>
                </>
              ) : <div className="inspector-empty"><IconX size={20}/>Выберите узел или связь</div>}
            </aside>
          </div>
        </div>
      )}
    </section>
  )
}
