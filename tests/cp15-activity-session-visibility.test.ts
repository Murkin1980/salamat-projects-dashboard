import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'
import { fileURLToPath } from 'node:url'
import jsdom from 'jsdom'
import type { ArenaSessionState, ProjectState, TriageState } from '../src/contract/project-state.js'
import {
  compareByPriorityThenActivity,
  compareByRecentActivity,
  orderByRecentActivity,
  shouldShowSessionIndicator,
  triageRank,
} from '../src/monitoring/portfolio-ordering.js'

/**
 * CP-15 — Activity-aware portfolio, triage and Arena session visibility.
 *
 * Covers the deterministic ordering (Portfolio by recent activity, Triage /
 * Attention by operational priority then recency) and the read-only session
 * indicator + freshness rendering. The DOM harness renders the real shell into a
 * 1440px desktop and a 390px mobile viewport against the committed runtime
 * snapshot, which is the only source of truth (no realtime Arena monitoring).
 */

// --- Unit: session indicator visibility --------------------------------------

test('session indicator shows only for the five attention/gap states', () => {
  const shown: ArenaSessionState[] = [
    'ACTIVE',
    'WAITING_FOR_VALIDATION',
    'READY_TO_CLOSE',
    'STALE_SESSION',
    'UNKNOWN',
  ]
  const hidden: ArenaSessionState[] = ['NOT_ACTIVE', 'CLOSED']

  for (const state of shown) {
    assert.equal(shouldShowSessionIndicator(state), true, `${state} must show an indicator`)
  }
  for (const state of hidden) {
    assert.equal(shouldShowSessionIndicator(state), false, `${state} must not show an indicator`)
  }
})

// --- Unit: portfolio ordering by recent meaningful activity ------------------

function activity(status: 'KNOWN' | 'UNAVAILABLE', at?: string, source?: string, sourceId?: string) {
  return status === 'KNOWN'
    ? { status: 'KNOWN', at: at!, source: source as never, sourceId: sourceId ?? 'sid', evidenceUrl: null }
    : { status: 'UNAVAILABLE', reason: 'no evidence' }
}

function project(id: string, triageState: TriageState | null, act: ReturnType<typeof activity>): ProjectState {
  return {
    id,
    triageState,
    activity: {
      lastMeaningfulActivity: act,
      statusUpdatedAt: { status: 'UNAVAILABLE', reason: 'x' },
      snapshotGeneratedAt: { at: '2026-10-01T00:00:00Z', source: 'SNAPSHOT', sourceId: 's' },
    },
  } as unknown as ProjectState
}

test('more recent KNOWN activity sorts before older KNOWN activity', () => {
  const newer = project('a', 'READY', activity('KNOWN', '2026-10-01T00:00:00Z', 'COMMIT'))
  const older = project('b', 'READY', activity('KNOWN', '2026-09-01T00:00:00Z', 'COMMIT'))
  assert.ok(compareByRecentActivity(newer, older) < 0)
  assert.ok(compareByRecentActivity(older, newer) > 0)
})

test('projects without attributable activity sort after all attributable ones', () => {
  const known = project('a', 'HOLD', activity('KNOWN', '2020-01-01T00:00:00Z', 'COMMIT'))
  const missing = project('b', 'DONE', activity('UNAVAILABLE'))
  assert.ok(compareByRecentActivity(missing, known) > 0)
  assert.ok(compareByRecentActivity(known, missing) < 0)
})

test('equal timestamps break ties deterministically by source, sourceId then id', () => {
  const at = '2026-10-01T00:00:00Z'
  const commitA = project('a', 'READY', activity('KNOWN', at, 'COMMIT', 's-commit'))
  const fixtureB = project('b', 'READY', activity('KNOWN', at, 'FIXTURE', 's-fixture'))
  // COMMIT (priority 0) beats FIXTURE (priority 7)
  assert.ok(compareByRecentActivity(commitA, fixtureB) < 0)

  const c1 = project('c', 'READY', activity('KNOWN', at, 'COMMIT', 's-2'))
  const c2 = project('c2', 'READY', activity('KNOWN', at, 'COMMIT', 's-1'))
  // same timestamp+source; sourceId 's-1' < 's-2' -> c2 first
  assert.ok(compareByRecentActivity(c2, c1) < 0)

  const d1 = project('d1', 'READY', activity('KNOWN', at, 'COMMIT', 'sid'))
  const d2 = project('d2', 'READY', activity('KNOWN', at, 'COMMIT', 'sid'))
  // identical evidence; id tie-break -> d1 first
  assert.ok(compareByRecentActivity(d1, d2) < 0)
})

test('orderByRecentActivity is stable and puts the most recent project first', () => {
  const projects = [
    project('old', 'DONE', activity('KNOWN', '2026-01-01T00:00:00Z', 'FIXTURE')),
    project('recent', 'HOLD', activity('KNOWN', '2026-10-01T00:00:00Z', 'COMMIT')),
    project('mid', 'READY', activity('KNOWN', '2026-06-01T00:00:00Z', 'PROJECT_STATUS')),
    project('none', 'VALIDATION', activity('UNAVAILABLE')),
  ]
  const ordered = orderByRecentActivity(projects).map((p) => p.id)
  assert.deepEqual(ordered, ['recent', 'mid', 'old', 'none'])
})

// --- Unit: operational priority stays authoritative --------------------------

test('triageRank orders actionable states first and unresolved last', () => {
  assert.equal(triageRank('ACTION_NOW'), 0)
  assert.equal(triageRank('BLOCKED'), 1)
  assert.equal(triageRank('DONE'), 6)
  assert.equal(triageRank(null), 7)
})

test('priority wins over recency; recency only breaks ties within a state', () => {
  const actionNow = project('act', 'ACTION_NOW', activity('UNAVAILABLE'))
  const done = project('done', 'DONE', activity('KNOWN', '2026-10-01T00:00:00Z', 'COMMIT'))
  // ACTION_NOW (rank 0) must beat DONE (rank 6) even though DONE is more recent.
  assert.ok(compareByPriorityThenActivity(actionNow, actionNow.triageState, done, done.triageState) < 0)

  const readyOld = project('ro', 'READY', activity('KNOWN', '2026-01-01T00:00:00Z', 'COMMIT'))
  const readyNew = project('rn', 'READY', activity('KNOWN', '2026-09-01T00:00:00Z', 'COMMIT'))
  assert.ok(compareByPriorityThenActivity(readyNew, readyNew.triageState, readyOld, readyOld.triageState) < 0)
})

// --- DOM: visibility and ordering --------------------------------------------

const snapshotText = readFileSync(
  fileURLToPath(new URL('../public/project-state.json', import.meta.url)),
  'utf8',
)

type Registry = { projects: Array<Record<string, unknown>> }

function installDom(width: number, snapshot: string) {
  const dom = new jsdom.JSDOM('<!doctype html><html><body><div id="root"></div></body></html>', {
    url: 'https://dashboard.local/',
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
  globals.fetch = async () => new Response(snapshot, {
    status: 200,
    headers: { 'content-type': 'application/json' },
  })
  globals.IS_REACT_ACT_ENVIRONMENT = true
  return dom
}

async function renderDashboard(width: number, mutate?: (registry: Registry) => void) {
  const registry: Registry = JSON.parse(snapshotText)
  mutate?.(registry)
  const dom = installDom(width, JSON.stringify(registry))
  const { createElement, act } = await import('react')
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

function switchView(container: Element, name: string) {
  const button = [...container.querySelectorAll('button')].find((b) => b.textContent?.includes(name))
  if (!button) throw new Error(`nav button "${name}" not found`)
  button.click()
}

function firstCardName(container: Element): string {
  const card = container.querySelector('.project-card')
  return card?.querySelector('h2')?.textContent?.trim() ?? ''
}

test('Portfolio orders by recent meaningful activity at desktop (1440px)', async (t) => {
  const { container, act, cleanup } = await renderDashboard(1440)
  t.after(cleanup)
  await act(async () => { switchView(container, 'Portfolio') })

  const registry = JSON.parse(snapshotText) as Registry
  const expectedFirstName = orderByRecentActivity(registry.projects as unknown as ProjectState[])[0].name
  assert.equal(firstCardName(container), expectedFirstName, 'most recently active project must be first in Portfolio')
  assert.equal(container.querySelectorAll('.project-card').length, registry.projects.length)
})

test('Portfolio ordering is identical at mobile (390px)', async (t) => {
  const { container, act, cleanup } = await renderDashboard(390)
  t.after(cleanup)
  await act(async () => { switchView(container, 'Portfolio') })

  const registry = JSON.parse(snapshotText) as Registry
  const expectedFirstName = orderByRecentActivity(registry.projects as unknown as ProjectState[])[0].name
  assert.equal(firstCardName(container), expectedFirstName)
  assert.equal(
    container.querySelectorAll('.project-card').length,
    registry.projects.length,
    'all portfolio cards render on mobile',
  )
})

test('every card shows freshness and a read-only session indicator separate from status', async (t) => {
  const { container, cleanup } = await renderDashboard(390)
  t.after(cleanup)

  const registry = JSON.parse(snapshotText) as Registry
  const cards = [...container.querySelectorAll('.project-card')]
  assert.ok(cards.length > 0)
  for (const card of cards) {
    assert.ok(card.querySelector('.freshness-chip'), 'each card must show an activity freshness chip')
    assert.ok(card.querySelector('.status-badge'), 'each card must keep its operational status badge')
    // CLOSED / NOT_ACTIVE are settled states and render no indicator; every other
    // committed session state (here UNKNOWN) must show it.
    const name = card.querySelector('h2')?.textContent
    const sessionState = (registry.projects.find((project) => project.name === name)?.session as { sessionState: string }).sessionState
    const settled = sessionState === 'CLOSED' || sessionState === 'NOT_ACTIVE'
    assert.equal(
      card.querySelectorAll('.session-indicator').length,
      settled ? 0 : 1,
      `${name}: the Arena session indicator must follow the committed session state (${sessionState})`,
    )
    // The indicator must never replace the operational status badge.
    assert.equal(card.querySelectorAll('.status-badge').length, 1)
  }
  // The session indicator is a read-only observation span, never a button.
  assert.equal(container.querySelectorAll('.project-card button').length, 0)
  assert.ok(container.querySelector('.session-indicator')?.getAttribute('title')?.includes('Arena session'))
})

test('READY_TO_CLOSE and STALE_SESSION get distinct, status-separated visuals', async (t) => {
  const { container, act, cleanup } = await renderDashboard(1440, (registry) => {
    const mkSession = (state: string) => ({
      sessionCheckpoint: 'CP-15 — Activity-Aware Portfolio',
      sessionStartedAt: {
        status: 'KNOWN', at: '2026-09-20T00:00:00Z', source: 'PROJECT_STATUS',
        sourceId: 'sha:PROJECT_STATUS.md', evidenceUrl: 'https://github.com/x/y/blob/main/PROJECT_STATUS.md',
      },
      sessionLastActivityAt: {
        status: 'KNOWN', at: '2026-09-20T00:00:00Z', source: 'PROJECT_STATUS',
        sourceId: 'sha:PROJECT_STATUS.md', evidenceUrl: 'https://github.com/x/y/blob/main/PROJECT_STATUS.md',
      },
      sessionClosureEvidence: null,
      sessionStateEvidence: [{
        label: 'PROJECT_STATUS.md',
        url: 'https://github.com/x/y/blob/main/PROJECT_STATUS.md',
        sourceId: 'sha:PROJECT_STATUS.md',
      }],
      sessionState: state,
      sessionClosureStatus: 'NOT_CONFIRMED',
      sessionStateReason: `CP-15 test ${state}`,
    })
    const ready = registry.projects.find((p) => p.id === 'salamat-projects-dashboard')!
    ready.session = mkSession('READY_TO_CLOSE')
    const stale = registry.projects.find((p) => p.id === 'murat-project-engineer')!
    stale.session = mkSession('STALE_SESSION')
  })
  t.after(cleanup)
  await act(async () => { switchView(container, 'Portfolio') })

  assert.ok(container.querySelector('.session-indicator.session-ready'), 'READY_TO_CLOSE must render a distinct chip')
  assert.ok(container.querySelector('.session-indicator.session-stale'), 'STALE_SESSION must render a distinct chip')
  // The session chips must remain separate from the operational status badge.
  assert.equal(container.querySelectorAll('.status-badge').length, container.querySelectorAll('.project-card').length)
  // The stale-session threshold is made visible rather than silently assumed active.
  const stale = container.querySelector('.session-indicator.session-stale')
  assert.ok(stale?.getAttribute('title')?.includes('порог бездействия'), 'stale chip must expose the inactivity threshold')
  assert.ok(stale?.getAttribute('title')?.includes('24'), 'stale chip must expose the 24h threshold value')
})

test('Triage keeps operational priority first, independent of recency', async (t) => {
  const { container, act, cleanup } = await renderDashboard(1440, (registry) => {
    const action = registry.projects.find((p) => p.id === 'salamat-projects-dashboard')!
    action.triageState = 'ACTION_NOW'
    action.triageSource = { status: 'KNOWN', sourceId: 'x:PROJECT_STATUS.md' }
    action.nextAction = 'Verify CP-15 merge'
    const done = registry.projects.find((p) => p.id === 'murat-project-engineer')!
    done.triageState = 'DONE'
    done.triageSource = { status: 'KNOWN', sourceId: 'x:PROJECT_STATUS.md' }
  })
  t.after(cleanup)
  // Triage is the default view.
  await act(async () => { switchView(container, 'Triage') })

  assert.equal(firstCardName(container), 'Salamat Projects Dashboard', 'ACTION_NOW must lead Triage regardless of recency')
})
