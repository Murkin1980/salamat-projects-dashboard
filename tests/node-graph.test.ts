import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { test } from 'node:test'
import { fileURLToPath } from 'node:url'
import {
  filterNodeGraph,
  listNodeGraphProjects,
  NodeGraphRegistrySchema,
  parseNodeGraphRegistry,
  resolveActiveNodeGraph,
} from '../src/graph/node-graph.js'

const graphPath = fileURLToPath(new URL('../config/node-graphs.json', import.meta.url))
const registryInput = JSON.parse(readFileSync(graphPath, 'utf8'))
const projectRegistryPath = fileURLToPath(new URL('../config/projects.github.json', import.meta.url))
const projectRegistry = JSON.parse(readFileSync(projectRegistryPath, 'utf8')) as {
  projects: Array<{ id: string }>
}

function getGraph(graphId: string) {
  const graph = parseNodeGraphRegistry(registryInput).graphs.find((candidate) => candidate.id === graphId)
  assert.ok(graph, `graph is missing from the registry: ${graphId}`)
  return graph
}

test('Business Discovery graph manifest is strict and source-attributed', () => {
  const graph = getGraph('business-discovery')
  assert.equal(graph.projectId, 'business-discovery')
  assert.equal(graph.sourceState, 'CONFLICT')
  assert.equal(graph.nodes.length, 18)
  assert.equal(graph.edges.length, 17)
  assert.ok(graph.nodes.every((node) => node.sourceId && node.evidenceUrl.startsWith('https://github.com/')))
  assert.ok(graph.edges.every((edge) => edge.sourceId && edge.evidenceUrl.startsWith('https://github.com/')))
})

test('registry exposes at least five strictly valid graphs with attributed evidence', () => {
  const { graphs } = parseNodeGraphRegistry(registryInput)
  assert.ok(graphs.length >= 5, 'the Nodes view needs at least five graph entries')
  assert.equal(new Set(graphs.map((graph) => graph.id)).size, graphs.length)
  assert.equal(new Set(graphs.map((graph) => graph.projectId)).size, graphs.length)
  for (const graph of graphs) {
    assert.ok(graph.nodes.length > 0)
    assert.ok(graph.nodes.every((node) => node.sourceId.length > 0 && node.evidenceUrl.startsWith('https://github.com/')))
    assert.ok(graph.edges.every((edge) => edge.sourceId.length > 0 && edge.evidenceUrl.startsWith('https://github.com/')))
  }
})

test('every graph projectId resolves to an existing project id', () => {
  const projectIds = new Set(projectRegistry.projects.map((project) => project.id))
  const { graphs } = parseNodeGraphRegistry(registryInput)
  for (const graph of graphs) {
    assert.ok(projectIds.has(graph.projectId), `graph ${graph.id} references unknown project ${graph.projectId}`)
  }
})

test('the project switcher offers exposed graphs and nothing else', () => {
  const { graphs } = parseNodeGraphRegistry(registryInput)
  const options = listNodeGraphProjects(graphs)
  assert.deepEqual(options.map((option) => option.projectId), graphs.map((graph) => graph.projectId))
  assert.deepEqual(options.map((option) => option.graphId), graphs.map((graph) => graph.id))
  assert.deepEqual(options.map((option) => option.name), graphs.map((graph) => graph.name))
  assert.ok(options.every((option) => option.projectId.length > 0 && option.name.length > 0))
  assert.deepEqual(
    options.find((option) => option.projectId === 'ai-microtask-factory')?.sourceState,
    'UNKNOWN',
  )
})

test('switching the active project changes the resolved graph', () => {
  const { graphs } = parseNodeGraphRegistry(registryInput)
  const first = resolveActiveNodeGraph(graphs, 'murat-project-engineer')
  const second = resolveActiveNodeGraph(graphs, 'minibase-cloudflare')
  assert.ok(first)
  assert.ok(second)
  assert.equal(first.projectId, 'murat-project-engineer')
  assert.equal(second.projectId, 'minibase-cloudflare')
  assert.notEqual(first.id, second.id)
  assert.notDeepEqual(first.nodes.map((node) => node.id), second.nodes.map((node) => node.id))
})

test('a missing active graph resolves safely instead of failing', () => {
  const { graphs } = parseNodeGraphRegistry(registryInput)
  assert.equal(resolveActiveNodeGraph(graphs, 'project-without-graph'), null)
  assert.equal(resolveActiveNodeGraph(graphs, ''), null)
  assert.equal(resolveActiveNodeGraph([], 'business-discovery'), null)
})

test('manifest rejects dangling edges', () => {
  const invalid = structuredClone(registryInput)
  invalid.graphs[0].edges[0].target = 'invented-node'
  assert.equal(NodeGraphRegistrySchema.safeParse(invalid).success, false)
})

test('manifest rejects missing evidence', () => {
  const invalid = structuredClone(registryInput)
  delete invalid.graphs[0].nodes[0].sourceId
  assert.equal(NodeGraphRegistrySchema.safeParse(invalid).success, false)
})

test('filters remove hidden nodes and their edges deterministically', () => {
  const graph = parseNodeGraphRegistry(registryInput).graphs[0]
  const filtered = filterNodeGraph(graph, new Set(['SUBSYSTEM']), new Set(['uses']))
  assert.ok(filtered.nodes.every((node) => node.type === 'SUBSYSTEM'))
  assert.ok(filtered.edges.every((edge) => edge.type === 'uses'))
  assert.ok(filtered.edges.every((edge) => filtered.nodes.some((node) => node.id === edge.source)))
})
