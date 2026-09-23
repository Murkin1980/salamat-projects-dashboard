import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'
import { fileURLToPath } from 'node:url'
import jsdom from 'jsdom'

/**
 * Product-boundary regression tests for the Dashboard cleanup (CP-10).
 *
 * The dashboard is a read-only Portfolio Monitoring UI. These checks render the
 * real application shell into a DOM at a phone (390px) and a desktop (1440px)
 * viewport and assert that:
 *
 * 1. no execution vocabulary survives anywhere in the rendered interface —
 *    no `Continue`, Task Packet, JSON copy/export, Codex/Arena or runner
 *    controls, and no button inside a project card at all;
 * 2. the monitoring fields the dashboard exists to show are still present —
 *    name, repository, operational status, stage, blocker, next step,
 *    last updated, source attribution and evidence links.
 *
 * The committed runtime snapshot is served to the live-registry hook, so the
 * rendered state equals what a user sees in production.
 */

/**
 * Scanned against the application chrome only. Project-sourced fields are
 * excluded first: a next step may legitimately read "Continue pilot work",
 * which is monitoring content, not an execution control.
 */
const FORBIDDEN_UI_TERMS = [
  'Continue',
  'Task Packet',
  'task packet',
  'Raw JSON',
  'Copy JSON',
  'Export JSON',
  'Копировать JSON',
  'Экспорт JSON',
  'Send to Arena',
  'Send to Codex',
  'Codex',
  'Arena',
  'executor',
  'Run task',
  'model selector',
  'prompt editor',
]

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
  // The live-registry hook polls the runtime snapshot; serve the committed one.
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
    // Unmounting clears the live-registry poll interval and closing the window
    // stops jsdom's visual loop, so the test process can exit.
    cleanup: async () => {
      await act(async () => { root.unmount() })
      dom.window.close()
    },
  }
}

/** Text of the app chrome, i.e. the rendered UI minus project-sourced fields. */
function chromeText(container: Element) {
  const clone = container.cloneNode(true) as Element
  const projectDataSelectors = [
    '.project-body',
    '.project-meta',
    '.project-evidence',
    '.attention-row p',
    '.attention-row small',
  ]
  for (const selector of projectDataSelectors) {
    clone.querySelectorAll(selector).forEach((node) => node.remove())
  }
  return clone.textContent ?? ''
}

/** No button in the app may expose an execution/runner/agent action. */
function assertNoExecutionButtons(container: Element) {
  const forbiddenLabel = /continu|task packet|codex|arena|json|execut|run task|model|prompt|agent|runner|send to/i
  for (const button of container.querySelectorAll('button')) {
    const label = (button.textContent ?? '').trim()
    assert.ok(
      !forbiddenLabel.test(label),
      `button "${label}" looks like an execution control and must not exist in the dashboard`,
    )
  }
}

function cardFor(container: Element, name: string) {
  return [...container.querySelectorAll('.project-card')]
    .find((card) => card.querySelector('h2')?.textContent?.includes(name))
}

test('dashboard renders no execution controls at 1440px (desktop)', async (t) => {
  const { container, cleanup } = await renderDashboard(1440)
  t.after(cleanup)
  const text = chromeText(container)

  for (const term of FORBIDDEN_UI_TERMS) {
    assert.ok(
      !text.toLowerCase().includes(term.toLowerCase()),
      `execution vocabulary "${term}" must not appear in the dashboard UI`,
    )
  }
  assertNoExecutionButtons(container)

  assert.equal(
    container.querySelectorAll('.project-card button').length,
    0,
    'project cards must not contain any button (no Continue, no task runner)',
  )
  assert.equal(container.querySelectorAll('.task-packet-modal').length, 0)
  assert.equal(container.querySelectorAll('.modal-backdrop').length, 0)
  assert.ok(container.querySelectorAll('.project-card').length > 0, 'project cards must render')
})

test('dashboard renders no execution controls at 390px (mobile)', async (t) => {
  const { container, cleanup } = await renderDashboard(390)
  t.after(cleanup)
  const text = chromeText(container)

  for (const term of FORBIDDEN_UI_TERMS) {
    assert.ok(
      !text.toLowerCase().includes(term.toLowerCase()),
      `execution vocabulary "${term}" must not appear in the mobile dashboard UI`,
    )
  }
  assertNoExecutionButtons(container)
  assert.equal(
    container.querySelectorAll('.project-card button').length,
    0,
    'mobile project cards must not contain any button',
  )
  assert.ok(container.querySelectorAll('.project-card').length > 0, 'project cards must render on mobile')
})

test('mobile Experiments view is read-only and Portfolio remains available', async (t) => {
  const { container, cleanup, act } = await renderDashboard(390)
  t.after(cleanup)
  const experimentsButton = [...container.querySelectorAll('button')].find((button) => button.textContent?.includes('Experiments'))!
  await act(async () => { experimentsButton.click() })
  assert.ok(container.textContent?.includes('Firecrawl Alexandria source discovery'))
  assert.ok(container.querySelectorAll('.experiment-row').length >= 17)
  assert.equal(container.querySelectorAll('.experiment-row button').length, 0)
  assert.ok(container.textContent?.includes('Source:'))

  const portfolioButton = [...container.querySelectorAll('button')].find((button) => button.textContent?.includes('Portfolio'))!
  await act(async () => { portfolioButton.click() })
  assert.ok(container.querySelectorAll('.project-card').length > 0, 'Projects view remains unchanged and available')
})

test('project cards keep every monitoring field visible', async (t) => {
  const { container, cleanup } = await renderDashboard(390)
  t.after(cleanup)
  const cards = [...container.querySelectorAll('.project-card')]
  assert.ok(cards.length >= 10, `expected the full portfolio, got ${cards.length} cards`)

  for (const card of cards) {
    const text = card.textContent ?? ''
    assert.ok(card.querySelector('h2')?.textContent?.trim(), 'card must show the project name')
    assert.ok(card.querySelector('.status-badge'), 'card must show an operational status badge')
    for (const label of ['Репозиторий', 'Текущий этап', 'Следующее действие']) {
      assert.ok(text.includes(label), `card must expose the "${label}" monitoring field`)
    }
    assert.ok(text.includes('Обновлено'), 'card must show last updated')
    assert.ok(text.includes('Источник:'), 'card must keep source attribution')
  }

  // UNKNOWN / CONFLICT resolutions stay explicit instead of being hidden.
  const badges = cards.map((card) => card.querySelector('.status-badge')?.textContent ?? '')
  assert.ok(
    badges.some((badge) => badge.includes('STATUS UNKNOWN') || badge.includes('SOURCE CONFLICT')),
    'unresolved source states must remain visible',
  )

  // Evidence links are plain read-only GitHub links, never actions.
  const links = [...container.querySelectorAll('.evidence-links a')]
  assert.ok(links.length > 0, 'evidence links must render on cards that have them')
  for (const link of links) {
    assert.ok(link.getAttribute('href')?.startsWith('https://'), 'evidence links must be external URLs')
    assert.equal(link.getAttribute('rel'), 'noreferrer')
  }
})

test('blocker and progress render when the source provides them', async (t) => {
  const { container, cleanup } = await renderDashboard(390, (registry) => {
    const project = registry.projects.find((candidate) => candidate.id === 'salamat-projects-dashboard')!
    project.triageState = 'BLOCKED'
    project.blocker = 'Ожидает подтверждения владельца'
    project.progress = { completed: 3, total: 10 }
  })
  t.after(cleanup)

  const card = cardFor(container, 'Salamat Projects Dashboard')
  assert.ok(card, 'the mutated project card must render')
  const text = card.textContent ?? ''

  assert.ok(text.includes('Блокер'), 'blocker must be visible on the card')
  assert.ok(text.includes('Ожидает подтверждения владельца'), 'blocker text must be visible')
  assert.ok(text.includes('Прогресс'), 'progress must be visible')
  assert.ok(text.includes('3') && text.includes('10'), 'progress values must be visible')
  assert.ok(card.querySelector('.status-badge')?.textContent?.includes('BLOCKED'))
  assert.equal(card.querySelectorAll('button').length, 0, 'no execution control on a BLOCKED card')
})
