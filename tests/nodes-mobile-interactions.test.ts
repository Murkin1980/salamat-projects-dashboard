import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'
import { fileURLToPath } from 'node:url'
import jsdom from 'jsdom'

/**
 * Behavioural checks for the dedicated mobile Nodes branch on a phone
 * viewport (390px), rendered into a real DOM via jsdom. The viewport is
 * controlled by a deterministic `matchMedia` stub — jsdom itself never
 * decides the branch.
 */

const registryInput = JSON.parse(
  readFileSync(fileURLToPath(new URL('../config/node-graphs.json', import.meta.url)), 'utf8'),
)

function installDom(width: number) {
  const dom = new jsdom.JSDOM('<!doctype html><html><body><main id="root"></main></body></html>', {
    url: 'https://nodes.local/',
    pretendToBeVisual: true,
  })
  const { window } = dom
  // Deterministic viewport: evaluate max-width media queries against `width`.
  ;(window as unknown as Record<string, unknown>).matchMedia = (query: string) => {
    const maxWidth = /\(\s*max-width:\s*(\d+(?:\.\d+)?)px\s*\)/.exec(query)
    return {
      matches: maxWidth ? width <= Number(maxWidth[1]) : false,
      media: query,
      addEventListener() {},
      removeEventListener() {},
    }
  }
  const globals = globalThis as Record<string, unknown>
  globals.window = window
  globals.document = window.document
  Object.defineProperty(globalThis, 'navigator', { value: window.navigator, configurable: true })
  globals.IS_REACT_ACT_ENVIRONMENT = true
  return dom
}

test('on a 390px viewport a node card tap updates the selected node detail', async () => {
  const dom = installDom(390)
  const { createElement, act } = await import('react')
  const { createRoot } = await import('react-dom/client')
  const { NodeView } = await import('../src/components/NodeView.js')
  const { parseNodeGraphRegistry } = await import('../src/graph/node-graph.js')
  const graph = parseNodeGraphRegistry(registryInput).graphs.find((candidate) => candidate.id === 'business-discovery')
  assert.ok(graph)

  const container = dom.window.document.getElementById('root')!
  const root = createRoot(container)
  await act(async () => { root.render(createElement(NodeView, { graph })) })

  assert.ok(container.querySelector('.nodes-mobile-view'), 'mobile structural branch must be mounted')
  assert.equal(container.querySelectorAll('.mobile-node-card').length, graph.nodes.length)
  assert.equal(container.querySelectorAll('.react-flow').length, 0, 'React Flow must not be mounted on mobile')

  // Existing auto-selection stays: the default node's detail card shows first,
  // after (not before) the node cards.
  const defaultSelected = graph.nodes.find((node) => node.id === 'auditor') ?? graph.nodes[0]
  assert.equal(
    container.querySelector('.mobile-detail-title strong')?.textContent,
    defaultSelected.label,
    'default selection must drive the first detail card',
  )

  // Tap a different card — the whole card is the tap target.
  const target = graph.nodes.find((node) => node.id !== defaultSelected.id)
  assert.ok(target)
  const targetCard = [...container.querySelectorAll('.mobile-node-card')]
    .find((card) => card.querySelector('strong')?.textContent === target.label)
  assert.ok(targetCard, `card for ${target.id} must exist`)
  await act(async () => {
    targetCard.dispatchEvent(new dom.window.MouseEvent('click', { bubbles: true, cancelable: true }))
  })

  assert.equal(
    container.querySelector('.mobile-detail-title strong')?.textContent,
    target.label,
    'detail card must follow the tapped node',
  )
  const detailCard = container.querySelector('.mobile-detail-card')
  assert.ok(detailCard)
  assert.ok(detailCard.textContent?.includes(target.detail), 'detail text must be shown')
  assert.ok(detailCard.textContent?.includes(target.status), 'status must be shown')
  assert.ok(detailCard.textContent?.includes('Связей'), 'relations count must be shown')
  assert.equal(detailCard.querySelector('a')?.getAttribute('href'), target.evidenceUrl, 'evidence link must be shown')
  assert.ok(targetCard.classList.contains('selected'), 'tapped card must be visibly selected')

  await act(async () => { root.unmount() })
})

test('on a 390px viewport project switching re-renders the mobile cards from the selected graph', async () => {
  const dom = installDom(390)
  const { createElement, act } = await import('react')
  const { createRoot } = await import('react-dom/client')
  const { NodesView } = await import('../src/components/NodesView.js')
  const { parseNodeGraphRegistry } = await import('../src/graph/node-graph.js')
  const graphs = parseNodeGraphRegistry(registryInput).graphs
  const [first, second] = graphs
  assert.ok(first && second)

  const container = dom.window.document.getElementById('root')!
  const root = createRoot(container)
  await act(async () => { root.render(createElement(NodesView, { graphs })) })

  const heading = () => container.querySelector('#nodes-heading')?.textContent
  const cardCount = () => container.querySelectorAll('.mobile-node-card').length
  assert.ok(container.querySelector('[role="tablist"]'), 'project selector must stay available on mobile')
  assert.equal(heading(), first.name)
  assert.equal(cardCount(), first.nodes.length, 'initial cards come from the first graph')

  const tabs = [...container.querySelectorAll('.nodes-project-tab')]
  assert.ok(tabs.length >= 2, 'registry offers multiple graphs')
  await act(async () => {
    tabs[1].dispatchEvent(new dom.window.MouseEvent('click', { bubbles: true, cancelable: true }))
  })

  assert.equal(heading(), second.name, 'switching must re-render the selected graph')
  assert.equal(cardCount(), second.nodes.length, 'cards must come from the newly selected graph')
  assert.ok(
    container.querySelector('.mobile-section-heading')?.textContent?.includes(`Узлы · ${second.nodes.length}`),
    'node section count follows the selected graph',
  )
  assert.equal(tabs[1].getAttribute('aria-selected'), 'true')
  assert.equal(tabs[0].getAttribute('aria-selected'), 'false')

  await act(async () => { root.unmount() })
})
