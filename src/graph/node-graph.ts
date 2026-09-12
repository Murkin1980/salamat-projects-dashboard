import { z } from 'zod'

export const GraphNodeTypeSchema = z.enum(['PROJECT', 'SUBSYSTEM', 'EVIDENCE', 'BRANCH', 'STAGE', 'FUTURE'])
export const GraphStatusSchema = z.enum(['PASS', 'CONFLICT', 'IN_PROGRESS', 'FUTURE', 'NEUTRAL'])
export const GraphEdgeTypeSchema = z.enum(['uses', 'depends_on', 'evidence_for', 'reports_to', 'diverged_from'])

const EvidenceFields = {
  sourceId: z.string().trim().min(1),
  evidenceUrl: z.url(),
}

export const GraphNodeSchema = z.object({
  id: z.string().regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/),
  label: z.string().trim().min(1),
  type: GraphNodeTypeSchema,
  status: GraphStatusSchema,
  detail: z.string().trim().min(1),
  x: z.number().finite(),
  y: z.number().finite(),
  ...EvidenceFields,
}).strict()

export const GraphEdgeSchema = z.object({
  id: z.string().regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/),
  source: z.string().trim().min(1),
  target: z.string().trim().min(1),
  type: GraphEdgeTypeSchema,
  ...EvidenceFields,
}).strict()

export const NodeGraphSchema = z.object({
  id: z.string().regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/),
  projectId: z.string().regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/),
  name: z.string().trim().min(1),
  description: z.string().trim().min(1),
  sourceState: z.enum(['KNOWN', 'UNKNOWN', 'CONFLICT']),
  nodes: z.array(GraphNodeSchema).min(1),
  edges: z.array(GraphEdgeSchema),
}).strict().superRefine((graph, context) => {
  const nodeIds = new Set<string>()
  graph.nodes.forEach((node, index) => {
    if (nodeIds.has(node.id)) context.addIssue({ code: 'custom', path: ['nodes', index, 'id'], message: 'Node ids must be unique' })
    nodeIds.add(node.id)
  })
  const edgeIds = new Set<string>()
  graph.edges.forEach((edge, index) => {
    if (edgeIds.has(edge.id)) context.addIssue({ code: 'custom', path: ['edges', index, 'id'], message: 'Edge ids must be unique' })
    edgeIds.add(edge.id)
    if (!nodeIds.has(edge.source)) context.addIssue({ code: 'custom', path: ['edges', index, 'source'], message: 'Edge source must reference an existing node' })
    if (!nodeIds.has(edge.target)) context.addIssue({ code: 'custom', path: ['edges', index, 'target'], message: 'Edge target must reference an existing node' })
    if (edge.source === edge.target) context.addIssue({ code: 'custom', path: ['edges', index], message: 'Self-referencing edges are not allowed' })
  })
})

export const NodeGraphRegistrySchema = z.object({
  version: z.number().int().positive(),
  graphs: z.array(NodeGraphSchema).min(1),
}).strict()

export type GraphNodeType = z.infer<typeof GraphNodeTypeSchema>
export type GraphEdgeType = z.infer<typeof GraphEdgeTypeSchema>
export type GraphNodeData = z.infer<typeof GraphNodeSchema>
export type GraphEdgeData = z.infer<typeof GraphEdgeSchema>
export type NodeGraph = z.infer<typeof NodeGraphSchema>

export interface NodeGraphProjectOption {
  graphId: string
  projectId: string
  name: string
  sourceState: NodeGraph['sourceState']
}

export function parseNodeGraphRegistry(input: unknown) {
  return NodeGraphRegistrySchema.parse(input)
}

/**
 * Selector options are derived from the parsed registry only: a project without a
 * graph entry never appears in the Nodes switcher.
 */
export function listNodeGraphProjects(graphs: readonly NodeGraph[]): NodeGraphProjectOption[] {
  return graphs.map((graph) => ({
    graphId: graph.id,
    projectId: graph.projectId,
    name: graph.name,
    sourceState: graph.sourceState,
  }))
}

/**
 * Resolves the graph for the active project id. Unknown or empty selections return
 * `null` so the view can render an explicit empty state instead of failing.
 */
export function resolveActiveNodeGraph(
  graphs: readonly NodeGraph[],
  activeProjectId: string,
): NodeGraph | null {
  return graphs.find((graph) => graph.projectId === activeProjectId) ?? null
}

export function filterNodeGraph(
  graph: NodeGraph,
  nodeTypes: ReadonlySet<GraphNodeType>,
  edgeTypes: ReadonlySet<GraphEdgeType>,
): NodeGraph {
  const nodes = graph.nodes.filter((node) => nodeTypes.has(node.type))
  const visibleNodeIds = new Set(nodes.map((node) => node.id))
  const edges = graph.edges.filter((edge) => edgeTypes.has(edge.type)
    && visibleNodeIds.has(edge.source)
    && visibleNodeIds.has(edge.target))
  return { ...graph, nodes, edges }
}
