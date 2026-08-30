import { useMemo, useState } from 'react'
import {
  Background,
  Controls,
  Handle,
  MiniMap,
  Position,
  ReactFlow,
  type Edge,
  type Node,
  type NodeProps,
} from '@xyflow/react'
import '@xyflow/react/dist/style.css'
import {
  IconAlertTriangle,
  IconArrowsSplit,
  IconBox,
  IconCheck,
  IconClock,
  IconExternalLink,
  IconFileCheck,
  IconFolderCode,
  IconGitBranch,
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

const nodeTypeMeta = {
  PROJECT: { label: 'Проект', Icon: IconFolderCode },
  SUBSYSTEM: { label: 'Подсистема', Icon: IconBox },
  EVIDENCE: { label: 'Evidence', Icon: IconFileCheck },
  BRANCH: { label: 'Ветка', Icon: IconGitBranch },
  STAGE: { label: 'Этап', Icon: IconRoute },
  FUTURE: { label: 'Будущее', Icon: IconClock },
} satisfies Record<GraphNodeType, { label: string; Icon: typeof IconBox }>

const allNodeTypes = Object.keys(nodeTypeMeta) as GraphNodeType[]
const allEdgeTypes: GraphEdgeType[] = ['uses', 'depends_on', 'evidence_for', 'reports_to', 'diverged_from']

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
  const [selectedId, setSelectedId] = useState('auditor')
  const [visibleTypes, setVisibleTypes] = useState<Set<GraphNodeType>>(() => new Set(allNodeTypes))
  const [relationship, setRelationship] = useState<GraphEdgeType | 'ALL'>('ALL')

  const filtered = useMemo(() => filterNodeGraph(
    graph,
    visibleTypes,
    new Set(relationship === 'ALL' ? allEdgeTypes : [relationship]),
  ), [graph, relationship, visibleTypes])

  const nodes = useMemo<Node<GraphNodeData>[]>(() => filtered.nodes.map((node) => ({
    id: node.id,
    type: 'blueprint',
    position: { x: node.x, y: node.y },
    data: node,
    draggable: false,
    connectable: false,
  })), [filtered.nodes])

  const edges = useMemo<Edge[]>(() => filtered.edges.map((edge) => ({
    id: edge.id,
    source: edge.source,
    target: edge.target,
    label: edge.type.replaceAll('_', ' '),
    type: 'smoothstep',
    className: `graph-edge edge-${edge.type}`,
  })), [filtered.edges])

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

  return (
    <section className="nodes-workspace" aria-labelledby="nodes-heading">
      <header className="nodes-toolbar">
        <div>
          <p className="eyebrow">Read-only architecture map</p>
          <h2 id="nodes-heading">{graph.name}</h2>
          <p>{graph.description}</p>
        </div>
        <span className="graph-source-state"><IconAlertTriangle size={16}/> SOURCE {graph.sourceState}</span>
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

      <div className="nodes-layout">
        <div className="graph-canvas" aria-label="Интерактивная карта узлов Business Discovery">
          {nodes.length ? (
            <ReactFlow
              nodes={nodes}
              edges={edges}
              nodeTypes={nodeTypes}
              onNodeClick={(_, node) => setSelectedId(node.id)}
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

        <aside className="node-inspector" aria-label="Инспектор узла">
          {selectedNode ? (
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
          ) : <div className="inspector-empty"><IconX size={20}/>Выберите узел</div>}
        </aside>
      </div>

      <div className="mobile-node-list" aria-label="Список узлов">
        {filtered.nodes.map((node) => {
          const Icon = nodeTypeMeta[node.type].Icon
          return <button type="button" key={node.id} onClick={() => setSelectedId(node.id)} className={selectedId === node.id ? 'selected' : ''}><Icon size={19}/><span><strong>{node.label}</strong><small>{nodeTypeMeta[node.type].label} · {node.status}</small></span></button>
        })}
      </div>
    </section>
  )
}
