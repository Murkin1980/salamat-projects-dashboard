import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'
import { fileURLToPath } from 'node:url'
import { createElement } from 'react'
import { renderToString } from 'react-dom/server'
import { NodeView } from '../src/components/NodeView.js'
import { NodesView } from '../src/components/NodesView.js'
import { parseNodeGraphRegistry } from '../src/graph/node-graph.js'

/**
 * Deterministic viewport harness for the Nodes responsive split.
 *
 * `NodeView` chooses its structural branch through `window.matchMedia`
 * (`(max-width: 760px)`), so this harness installs a stub `window.matchMedia`
 * that evaluates max-width queries against a fixed viewport width and then
 * renders the real components. It proves that below/at the threshold the
 * dedicated mobile branch (node/relationship cards) is mounted WITHOUT any
 * React Flow markup, and that above it the desktop React Flow branch is
 * mounted without the mobile structure. No pixel geometry is involved: the
 * assertion is purely about which structural branch exists in the tree.
 */

const registryInput = JSON.parse(
  readFileSync(fileURLToPath(new URL('../config/node-graphs.json', import.meta.url)), 'utf8'),
)
const graphs = parseNodeGraphRegistry(registryInput).graphs
const graph = graphs.find((candidate) => candidate.id === 'business-discovery')
assert.ok(graph, 'business-discovery graph must exist in the registry')

function installViewport(width: number) {
  const matchMedia = (query: string) => {
    const maxWidth = /\(\s*max-width:\s*(\d+(?:\.\d+)?)px\s*\)/.exec(query)
    return {
      matches: maxWidth ? width <= Number(maxWidth[1]) : false,
      media: query,
      addEventListener() {},
      removeEventListener() {},
    }
  }
  ;(globalThis as Record<string, unknown>).window = { matchMedia }
}

/** React SSR interleaves `<!-- -->` between static and dynamic text nodes. */
function render(element: ReturnType<typeof createElement>) {
  return renderToString(element).replaceAll('<!-- -->', '')
}

function assertMobileBranch(html: string) {
  assert.ok(html.includes('nodes-mobile-view'), 'mobile structural wrapper must be mounted')
  assert.ok(html.includes(`Узлы · ${graph.nodes.length}`), 'node section heading with count must render')
  assert.ok(html.includes(`Связи · ${graph.edges.length}`), 'relationship section heading with count must render')
  assert.equal(html.includes('react-flow'), false, 'React Flow canvas must not be mounted on the mobile branch')
  assert.equal(html.includes('graph-canvas'), false, 'desktop canvas wrapper must be absent on the mobile branch')
  assert.equal(html.includes('node-inspector'), false, 'desktop inspector must be absent on the mobile branch')
  assert.equal(html.includes('nodes-desktop-view'), false, 'desktop wrapper must be absent on the mobile branch')
}

for (const width of [360, 390, 760]) {
  test(`at ${width}px the mobile branch renders every node card without React Flow`, () => {
    installViewport(width)
    const html = render(createElement(NodeView, { graph }))
    assertMobileBranch(html)
    for (const node of graph.nodes) {
      assert.ok(html.includes(node.label), `node card must be present for ${node.id}`)
      assert.ok(
        html.includes(`mobile-node-status status-${node.status.toLowerCase()}`),
        `status badge must be present for ${node.id}`,
      )
    }
  })
}

test('at 1440px the desktop branch keeps the React Flow canvas and inspector', () => {
  installViewport(1440)
  const html = render(createElement(NodeView, { graph }))
  assert.ok(html.includes('nodes-desktop-view'), 'desktop structural wrapper must be mounted')
  assert.ok(html.includes('graph-canvas'), 'React Flow canvas wrapper must render')
  assert.ok(html.includes('react-flow'), 'React Flow must be mounted on the desktop branch')
  assert.ok(html.includes('node-inspector'), 'desktop inspector must render')
  assert.equal(html.includes('nodes-mobile-view'), false, 'mobile wrapper must be absent on the desktop branch')
  assert.equal(html.includes('Узлы ·'), false, 'mobile node section must be absent on the desktop branch')
})

test('both branches consume the same graph data', () => {
  installViewport(390)
  const mobile = render(createElement(NodeView, { graph }))
  installViewport(1440)
  const desktop = render(createElement(NodeView, { graph }))
  assert.ok(mobile.includes(graph.name), 'mobile branch shows the same graph heading')
  assert.ok(desktop.includes(graph.name), 'desktop branch shows the same graph heading')
  for (const node of graph.nodes) {
    assert.ok(mobile.includes(node.label), `mobile branch must list ${node.id}`)
    assert.ok(desktop.includes(node.label), `desktop canvas must render ${node.id}`)
  }
  for (const edge of graph.edges.slice(0, 3)) {
    const source = graph.nodes.find((node) => node.id === edge.source)
    const target = graph.nodes.find((node) => node.id === edge.target)
    assert.ok(source && target)
    const direction = `${source.label} → ${target.label}`
    assert.ok(mobile.includes(direction), `mobile relationship cards must show ${edge.id}`)
  }
})

test('at 390px the full Nodes surface keeps the project selector next to the mobile branch', () => {
  installViewport(390)
  const html = render(createElement(NodesView, { graphs }))
  assert.ok(html.includes('role="tablist"'), 'project selector stays available on mobile')
  assert.ok(html.includes('nodes-mobile-view'), 'mobile branch renders inside the Nodes surface')
  assert.equal(html.includes('react-flow'), false, 'React Flow is never mounted on the mobile surface')
})

test('at 1440px the full Nodes surface keeps the project selector next to the desktop branch', () => {
  installViewport(1440)
  const html = render(createElement(NodesView, { graphs }))
  assert.ok(html.includes('role="tablist"'), 'project selector stays available on desktop')
  assert.ok(html.includes('nodes-desktop-view'), 'desktop branch renders inside the Nodes surface')
  assert.equal(html.includes('nodes-mobile-view'), false, 'mobile branch is absent on the desktop surface')
})
