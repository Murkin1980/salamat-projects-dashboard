import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { test } from 'node:test'
import { fileURLToPath } from 'node:url'

const viewPath = fileURLToPath(new URL('../src/components/NodeView.tsx', import.meta.url))
const stylePath = fileURLToPath(new URL('../src/styles.css', import.meta.url))
const view = readFileSync(viewPath, 'utf8')
const css = readFileSync(stylePath, 'utf8')

/**
 * Regression guard for the mobile Nodes defect: `.graph-canvas` is hidden below
 * 760px, so whatever renders first inside `.nodes-workspace` after the legend is
 * what a phone user sees. The node list must therefore be a sibling that comes
 * *before* `.nodes-layout` (which holds the canvas and the inspector), otherwise
 * the nodes end up pushed below the inspector and out of the first viewport.
 */

function offsetOf(needle: string) {
  const index = view.indexOf(needle)
  assert.notEqual(index, -1, `marker is missing from NodeView.tsx: ${needle}`)
  return index
}

/** First top-level rule whose selector is exactly `selector`. */
function baseRule(selector: string) {
  const escaped = selector.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
  const match = css.match(new RegExp(`(^|\\n)\\s*${escaped}\\s*\\{([^}]*)\\}`))
  assert.ok(match, `base rule is missing from styles.css: ${selector}`)
  return match[2]
}

function mobileBlock() {
  const start = css.indexOf('@media (max-width: 760px) {')
  assert.notEqual(start, -1, 'the 760px mobile media query is missing')
  return css.slice(start, css.indexOf('\n}', start))
}

test('mobile node list renders above the canvas/inspector layout', () => {
  const legend = offsetOf('className="relationship-legend"')
  const nodeList = offsetOf('className="mobile-node-list"')
  const layout = offsetOf('className="nodes-layout"')
  const inspector = offsetOf('className="node-inspector"')
  const edgeList = offsetOf('className="mobile-edge-list"')

  assert.ok(legend < nodeList, 'node list must come after the relationship legend')
  assert.ok(nodeList < layout, 'node list must come before .nodes-layout so mobile shows nodes first')
  assert.ok(nodeList < inspector, 'node list must come before the inspector')
  assert.ok(layout < edgeList, 'relationship list stays after the layout/inspector')
  // The inspector and the canvas stay inside .nodes-layout; desktop order is untouched.
  assert.ok(layout < inspector, 'inspector stays inside .nodes-layout')
})

test('mobile keeps the node list visible and the desktop canvas hidden', () => {
  const mobile = mobileBlock()
  assert.match(mobile, /\.graph-canvas\s*\{\s*display:\s*none/, 'canvas stays hidden on mobile')
  assert.match(mobile, /\.mobile-node-list,\s*\.mobile-edge-list\s*\{[^}]*display:\s*grid/, 'lists become a grid on mobile')
  assert.match(mobile, /\.mobile-node-list,\s*\.mobile-edge-list\s*\{[^}]*min-width:\s*0/, 'lists must not blow out the viewport')
})

test('mobile node cards are full width, tappable and wrap long labels', () => {
  const mobile = mobileBlock()
  const cards = /(^|\n)\s*\.mobile-node-list button,\s*\.mobile-edge-list button\s*\{([^}]*)\}/.exec(mobile)
  assert.ok(cards, 'mobile card rule is missing')
  const rule = cards[2]
  assert.match(rule, /width:\s*100%/, 'cards fill the available width')
  assert.match(rule, /min-width:\s*0/, 'cards need min-width:0 to shrink instead of overflowing')
  assert.ok(!/\bwidth:\s*\d+px/.test(rule), 'cards must not use a fixed pixel width')
  const minHeight = Number(/min-height:\s*(\d+)px/.exec(rule)?.[1])
  assert.ok(minHeight >= 44, `tap target must be >= 44px, got ${minHeight}px`)
  assert.match(mobile, /\.mobile-node-list strong[^{]*\{[^}]*overflow-wrap:\s*anywhere/, 'long labels must wrap')
  assert.match(
    mobile,
    /\.mobile-node-list button\.selected\s*\{[^}]*background:[^}]*box-shadow:\s*inset 3px 0 0/,
    'the selected card must be explicitly visible',
  )
})

test('desktop node canvas and hidden mobile lists are unchanged', () => {
  assert.match(baseRule('.mobile-node-list'), /display:\s*none/, 'mobile list stays hidden on desktop')
  assert.match(baseRule('.mobile-edge-list'), /display:\s*none/, 'mobile edge list stays hidden on desktop')
  assert.match(baseRule('.nodes-layout'), /grid-template-columns:\s*minmax\(0,\s*1fr\)\s+280px/, 'desktop two-column layout is unchanged')
  assert.match(baseRule('.graph-canvas'), /height:\s*690px/, 'desktop canvas height is unchanged')
  assert.match(baseRule('.nodes-workspace'), /overflow:\s*hidden/, 'workspace keeps clipping overflow')
})
