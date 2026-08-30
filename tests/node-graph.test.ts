import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { test } from 'node:test'
import { fileURLToPath } from 'node:url'
import { filterNodeGraph, NodeGraphRegistrySchema, parseNodeGraphRegistry } from '../src/graph/node-graph.js'

const graphPath = fileURLToPath(new URL('../config/node-graphs.json', import.meta.url))
const registryInput = JSON.parse(readFileSync(graphPath, 'utf8'))

test('Business Discovery graph manifest is strict and source-attributed', () => {
  const registry = parseNodeGraphRegistry(registryInput)
  const graph = registry.graphs[0]
  assert.equal(graph.id, 'business-discovery')
  assert.equal(graph.sourceState, 'CONFLICT')
  assert.ok(graph.nodes.every((node) => node.sourceId && node.evidenceUrl.startsWith('https://github.com/')))
  assert.ok(graph.edges.every((edge) => edge.sourceId && edge.evidenceUrl.startsWith('https://github.com/')))
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
