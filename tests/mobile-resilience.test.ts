import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'
import { fileURLToPath } from 'node:url'
import jsdom from 'jsdom'
import { createElement } from 'react'
import { parseProjectRegistry } from '../src/contract/project-state.js'
import {
  bulkRegistry,
  hostileRegistry,
  LONG_SHA,
  singleProjectRegistry,
  unbroken,
} from './hostile-portfolio.js'

/**
 * UI-skills experiment — mobile usability and hostile-data resilience.
 *
 * Every assertion here is pinned to a defect the experiment actually measured
 * (see `docs/UI_SKILLS_EXPERIMENT.md`): source-controlled text that had no
 * resilient wrapping and therefore widened the page, controls below the 44px
 * touch floor, header controls crammed into one mobile row, and provenance that
 * existed only in a hover tooltip.
 *
 * Two layers, because the defects live in two places:
 *   1. the shipped stylesheet, resolved through a small deterministic cascade
 *      (base rules plus every `max-width` block the viewport satisfies);
 *   2. the real components, rendered in jsdom against contract-valid hostile
 *      fixtures built by `tests/hostile-portfolio.ts`.
 */

const cssText = readFileSync(fileURLToPath(new URL('../src/styles.css', import.meta.url)), 'utf8')
const snapshot = JSON.parse(
  readFileSync(fileURLToPath(new URL('../public/project-state.json', import.meta.url)), 'utf8'),
)

// --- Layer 1: the shipped stylesheet ----------------------------------------

interface CssRule {
  selectors: string[]
  props: Record<string, string>
  maxWidth: number | null
}

/** Split a stylesheet into rules, tagging each with the media query it sits in. */
function parseRules(text: string, maxWidth: number | null = null): CssRule[] {
  const rules: CssRule[] = []
  let i = 0
  while (i < text.length) {
    while (i < text.length && /\s/.test(text[i])) i += 1
    if (i >= text.length) break
    if (text.startsWith('/*', i)) {
      const end = text.indexOf('*/', i + 2)
      i = end === -1 ? text.length : end + 2
      continue
    }
    const open = text.indexOf('{', i)
    if (open === -1) break
    const head = text.slice(i, open).trim()
    const close = matchBrace(text, open)
    const body = text.slice(open + 1, close)
    const media = /@media[^{]*max-width:\s*(\d+(?:\.\d+)?)px/.exec(head)
    if (media) {
      rules.push(...parseRules(body, Number(media[1])))
    } else if (!head.startsWith('@')) {
      const props: Record<string, string> = {}
      for (const part of body.split(';')) {
        const idx = part.indexOf(':')
        if (idx > 0) props[part.slice(0, idx).trim()] = part.slice(idx + 1).trim()
      }
      rules.push({ selectors: head.split(',').map((s) => s.trim()), props, maxWidth })
    }
    i = close + 1
  }
  return rules
}

function matchBrace(text: string, open: number) {
  let depth = 0
  for (let i = open; i < text.length; i += 1) {
    if (text[i] === '{') depth += 1
    else if (text[i] === '}' && --depth === 0) return i
  }
  return text.length
}

const stylesheet = parseRules(cssText)

/** Value a single selector resolves to at one viewport width, or `undefined`. */
function declaredAt(selector: string, property: string, width: number): string | undefined {
  let value: string | undefined
  for (const rule of stylesheet) {
    if (rule.maxWidth !== null && width > rule.maxWidth) continue
    if (rule.selectors.includes(selector) && rule.props[property] !== undefined) value = rule.props[property]
  }
  return value
}

// 1. Resilient wrapping. Each of these rendered source-controlled text and had
//    no wrapping, so a single unbroken token widened the whole page.
const wrappingSelectors = [
  '.page-header h1',
  '.project-body h2',
  '.project-body p',
  '.project-meta dd',
  '.attention-row strong',
  '.attention-row p',
  '.reports-heading h2',
  '.detail-head-body h2',
  '.detail-head-body p',
  '.experiment-row h2',
  '.experiment-row p',
  '.experiment-source',
  '.nodes-project-tab strong',
  '.nodes-project-tab small',
  '.sync-state span',
  '.discovery-source-card p',
  '.discovery-source-card small',
]

for (const selector of wrappingSelectors) {
  test(`source-controlled text wraps instead of widening the page: ${selector}`, () => {
    assert.equal(declaredAt(selector, 'overflow-wrap', 320), 'anywhere')
  })
}

// 2. Touch targets. Every control a phone user has to hit reaches 44px below
//    760px, and keeps its previous size above it so desktop is unchanged.
const touchSelectors: Array<[selector: string, desktopValue: string | undefined]> = [
  ['.nav-list button', undefined],
  ['.triage-tabs button', '36px'],
  ['.type-filters button', '36px'],
  ['.clear-filters', '36px'],
  ['.graph-filters select', '36px'],
  ['.history-filters button', '36px'],
  ['.search-box input', undefined],
  ['.evidence-links a', undefined],
  ['.detail-evidence-list a', undefined],
  ['.detail-evidence-link', undefined],
  ['.detail-events a', undefined],
  ['.detail-history a', undefined],
  ['.history-timeline a', undefined],
  ['.mobile-detail-card a', undefined],
  ['.experiment-links a', undefined],
  ['.experiment-source a', undefined],
  ['.sync-state button', undefined],
  ['.detail-report-link', '36px'],
]

for (const [selector, desktopValue] of touchSelectors) {
  test(`touch target reaches 44px on a phone and is untouched on desktop: ${selector}`, () => {
    assert.equal(declaredAt(selector, 'min-height', 320), '44px')
    assert.equal(declaredAt(selector, 'min-height', 390), '44px')
    assert.equal(declaredAt(selector, 'min-height', 1440), desktopValue, 'desktop must not change')
  })
}

test('the search field and report selector stop triggering iOS zoom-on-focus', () => {
  assert.equal(declaredAt('.search-box input', 'font-size', 320), '16px')
  assert.equal(declaredAt('.report-project-select select', 'font-size', 320), '16px')
  assert.equal(declaredAt('.search-box input', 'font-size', 1440), '14px', 'desktop must not change')
})

test('header actions stack instead of sharing one 292px row on a phone', () => {
  assert.equal(declaredAt('.header-actions', 'flex-direction', 320), 'column')
  assert.equal(declaredAt('.header-actions', 'flex-direction', 1440), undefined, 'desktop must not change')
})

test('primary navigation stays reachable after a long scroll on a phone', () => {
  assert.equal(declaredAt('.sidebar', 'position', 320), 'sticky')
})

test('tooltip-only content is real text on a phone and stays hidden on desktop', () => {
  assert.equal(declaredAt('.touch-hint', 'display', 320), 'inline')
  assert.equal(declaredAt('.touch-hint', 'display', 1440), 'none', 'desktop output must not change')
})

test('no phone text stays at the 8-9px sizes the audit flagged as unreadable', () => {
  const raised = [
    '.nodes-project-tab small',
    '.mobile-node-status',
    '.mobile-detail-title small',
    '.mobile-detail-meta dt',
    '.mobile-detail-card code',
    '.mobile-edge-endpoint small',
    '.session-indicator',
    '.freshness-chip',
    '.detail-event-gap',
    '.report-metrics small',
    '.discovery-table td small',
  ]
  for (const selector of raised) {
    assert.equal(declaredAt(selector, 'font-size', 320), '11px', `${selector} must reach 11px on a phone`)
  }
  // The deliberate 10px metadata scale is intentionally left alone.
  assert.equal(declaredAt('.status-badge', 'font-size', 320), '10px')
})

test('the page title shrinks on the narrowest phones only', () => {
  assert.equal(declaredAt('.page-header h1', 'font-size', 320), '24px')
  assert.equal(declaredAt('.page-header h1', 'font-size', 430), '32px')
  assert.equal(declaredAt('.page-header h1', 'font-size', 1440), '32px')
})

// --- Layer 2: the real components under hostile-but-valid data --------------

test('the hostile fixtures satisfy the real contract, so nothing was weakened to create them', () => {
  const hostile = hostileRegistry(snapshot)
  assert.equal(hostile.projects.length, 5)
  // A registry that fails the contract can never reach a view: re-parse it.
  assert.equal(parseProjectRegistry(JSON.parse(JSON.stringify(hostile))).projects.length, 5)
  // Values the contract legitimately forbids stay impossible rather than faked.
  assert.equal(singleProjectRegistry(snapshot).projects.length, 1)
  assert.equal(bulkRegistry(snapshot, 60).projects.length, 60)
})

function installDom(width: number, registry: unknown, hash = '') {
  const dom = new jsdom.JSDOM('<!doctype html><html><body><div id="root"></div></body></html>', {
    url: `https://dashboard.local/${hash}`,
    pretendToBeVisual: true,
  })
  const { window } = dom
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
  const body = JSON.stringify(registry)
  globals.fetch = async (input: unknown) => {
    const url = String((input as Request).url ?? input)
    const payload = url.includes('discovery-analytics')
      ? readFileSync(fileURLToPath(new URL('../public/discovery-analytics.json', import.meta.url)), 'utf8')
      : body
    return new Response(payload, { status: 200, headers: { 'content-type': 'application/json' } })
  }
  globals.IS_REACT_ACT_ENVIRONMENT = true
  return dom
}

async function render(width: number, registry: unknown, hash = '') {
  const dom = installDom(width, registry, hash)
  const { act } = await import('react')
  const { createRoot } = await import('react-dom/client')
  const { App } = await import('../src/components/DashboardApp.js')
  const container = dom.window.document.getElementById('root')!
  const root = createRoot(container)
  await act(async () => { root.render(createElement(App)) })
  return {
    container,
    act,
    cleanup: async () => {
      await act(async () => { root.unmount() })
      dom.window.close()
    },
  }
}

function cards(container: Element) {
  return [...container.querySelectorAll('.project-card')]
}

test('extreme unbroken text is rendered whole, never dropped, invented or crashed', async (t) => {
  const registry = hostileRegistry(snapshot)
  const extreme = registry.projects.find((project) => project.id === 'extreme-hostile-fixture')!
  const { container, cleanup } = await render(320, registry, '#/portfolio')
  t.after(cleanup)

  const card = cards(container).find((node) => node.querySelector('h2')?.textContent === extreme.name)
  assert.ok(card, 'the extreme project still renders a card at 320px')
  // Nothing is silently truncated: the full unbroken values reach the DOM.
  assert.ok(card!.querySelector('h2')!.textContent!.includes(unbroken(220, 'Unbrokenextremelylongprojectnamewithoutanyspacesorhyphens').slice(0, 60)))
  assert.ok(container.textContent!.includes(unbroken(240, 'B').slice(0, 60)), 'the unbroken blocker is rendered')
  assert.ok(container.textContent!.includes(unbroken(180, 'S').slice(0, 60)), 'the unbroken stage is rendered')
  assert.ok(container.textContent!.includes(unbroken(240, 'N').slice(0, 60)), 'the unbroken next action is rendered')
  // Huge numbers survive without being reformatted into something unreadable.
  assert.ok(container.textContent!.includes('999999998 из 999999999'), 'large progress values render verbatim')
})

test('a project with every optional value missing states the gap instead of inventing data', async (t) => {
  const { container, cleanup } = await render(320, hostileRegistry(snapshot), '#/portfolio')
  t.after(cleanup)

  const card = cards(container).find((node) => node.querySelector('h2')?.textContent === 'x')
  assert.ok(card, 'the sparse project renders')
  const text = card!.textContent!
  assert.ok(text.includes('Не привязан к репозиторию'), 'a missing repo is stated, not guessed')
  assert.ok(text.includes('Не определено источником'), 'a missing stage/next action is stated')
  assert.equal(text.includes('undefined'), false, 'no raw undefined reaches the UI')
  assert.equal(text.includes('null'), false, 'no raw null reaches the UI')
})

test('zero progress renders as a real zero rather than disappearing', async (t) => {
  const { container, cleanup } = await render(320, hostileRegistry(snapshot), '#/portfolio')
  t.after(cleanup)

  const card = cards(container).find((node) => node.querySelector('h2')?.textContent === 'Zero progress fixture')
  assert.ok(card, 'the zero-progress project renders a card')
  assert.ok(card!.textContent!.includes('0 из 1'), 'a zero count is shown, not treated as absent')
})

test('several simultaneous warnings all stay visible on one card', async (t) => {
  const { container, act, cleanup } = await render(320, hostileRegistry(snapshot))
  t.after(cleanup)

  const attention = [...container.querySelectorAll('button')].find((b) => b.textContent?.includes('Attention'))!
  await act(async () => { attention.click() })
  const row = [...container.querySelectorAll('.attention-row')]
    .find((node) => node.textContent?.includes('Multi warning fixture'))
  assert.ok(row, 'the multi-warning project appears in Attention')
  const kinds = row!.querySelector('.attention-stage')!.textContent!
  for (const expected of ['BLOCKER', 'APPROVAL PENDING', 'STALE', 'ACTION NOW']) {
    assert.ok(kinds.includes(expected), `attention must surface ${expected}, got "${kinds}"`)
  }
})

test('an empty filtered result keeps an understandable empty state', async (t) => {
  const { container, act, cleanup } = await render(320, hostileRegistry(snapshot))
  t.after(cleanup)

  const ready = [...container.querySelectorAll('.triage-tabs button')].find((b) => b.textContent?.includes('READY'))!
  await act(async () => { ready.click() })
  assert.equal(cards(container).length, 0)
  const empty = container.querySelector('.empty-state')
  assert.ok(empty, 'an explicit empty state replaces a blank screen')
  assert.ok(empty!.textContent!.includes('Ничего не найдено'))
})

test('one project and sixty projects both render without a broken layout contract', async (t) => {
  const one = await render(320, singleProjectRegistry(snapshot), '#/portfolio')
  assert.equal(cards(one.container).length, 1)
  await one.cleanup()

  const many = await render(320, bulkRegistry(snapshot, 60), '#/portfolio')
  assert.equal(cards(many.container).length, 60)
  await many.cleanup()
})

test('the source explanation reaches a touch user as text, not only as a tooltip', async (t) => {
  const { container, cleanup } = await render(320, hostileRegistry(snapshot), '#/portfolio')
  t.after(cleanup)

  const hint = container.querySelector('.project-card .project-source .touch-hint')
  assert.ok(hint, 'the card source hint is rendered as an element, not only in a title attribute')
  assert.ok(hint!.textContent!.includes(unbroken(140, 'R').slice(0, 40)), 'the full conflict reason is in the DOM text')
  // Desktop keeps the compact form: the same element exists but the stylesheet
  // hides it above 760px, asserted in the cascade layer above.
})

test('long history provenance keeps its full evidence id reachable by touch', async (t) => {
  const { container, cleanup } = await render(320, hostileRegistry(snapshot), '#/reports/long-history-fixture')
  t.after(cleanup)

  const provenance = [...container.querySelectorAll('.history-provenance')]
  assert.ok(provenance.length > 0, 'history events render')
  const hint = provenance[0].querySelector('.touch-hint')
  assert.ok(hint, 'the full evidence id is rendered, not only in a title attribute')
  assert.equal(hint!.textContent!.trim().length >= 40, true, `expected the full id, got "${hint!.textContent}"`)
  assert.equal(provenance[0].getAttribute('title')?.length, 40, 'the tooltip still carries the same full id')
  assert.ok(provenance[0].textContent!.includes(LONG_SHA.slice(0, 7)), 'the short form stays for wide screens')
})

test('the Project Detail view survives the extreme project at 320px', async (t) => {
  const registry = hostileRegistry(snapshot)
  const { container, cleanup } = await render(320, registry, '#/project/extreme-hostile-fixture')
  t.after(cleanup)

  assert.ok(container.querySelector('.detail-head'), 'the detail head renders')
  assert.ok(container.querySelector('h1')!.textContent!.includes('Unbrokenextremely'), 'the extreme name reaches the page title')
  assert.ok(container.textContent!.includes('SOURCE CONFLICT'), 'an unresolved status stays explicit')
  assert.ok(container.querySelector('.detail-session-panel'), 'the session panel renders')
  assert.equal(container.querySelectorAll('.project-card button, .detail-panel button').length, 0, 'still read-only')
})
