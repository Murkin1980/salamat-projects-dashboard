import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'
import { fileURLToPath } from 'node:url'
import jsdom from 'jsdom'
import type { ProjectState } from '../src/contract/project-state.js'
import {
  buildProjectDetailEvents,
  formatEventTimestamp,
} from '../src/monitoring/project-detail-events.js'
import {
  parseHashRoute,
  projectDetailHash,
  viewHash,
} from '../src/routing/hash-route.js'

/**
 * CP-16 — Project Detail drill-down & Arena session inspection.
 *
 * Covers the pure routing contract, the derived recent-activity event list, and
 * the rendered detail view at desktop (1440px) and mobile (390px): every project
 * can be opened from its card, deep links survive a direct navigation, return
 * navigation works, project completion is never conflated with session closure,
 * and the view stays strictly read-only.
 */

// --- Unit: hash route --------------------------------------------------------

test('project routes carry the project id and survive a refresh', () => {
  assert.deepEqual(parseHashRoute('#/project/business-discovery'), { view: 'triage', projectId: 'business-discovery' })
  assert.deepEqual(parseHashRoute(projectDetailHash('murat-house')), { view: 'triage', projectId: 'murat-house' })
  assert.deepEqual(parseHashRoute(projectDetailHash('murat-house'), 'portfolio'), { view: 'portfolio', projectId: 'murat-house' })
  // A direct navigation and a refresh deliver the same hash, so the route is stable.
  assert.deepEqual(parseHashRoute(parseHashRoute('#/project/murat-house') && '#/project/murat-house'), {
    view: 'triage',
    projectId: 'murat-house',
  })
})

test('view routes parse to their list view without a project', () => {
  for (const view of ['triage', 'portfolio', 'experiments', 'attention', 'nodes', 'reports', 'discovery'] as const) {
    assert.deepEqual(parseHashRoute(viewHash(view)), { view, projectId: null })
  }
})

test('malformed and unknown routes fail safe to Triage', () => {
  assert.deepEqual(parseHashRoute(''), { view: 'triage', projectId: null })
  assert.deepEqual(parseHashRoute('#/'), { view: 'triage', projectId: null })
  assert.deepEqual(parseHashRoute('#/does-not-exist'), { view: 'triage', projectId: null })
  // A malformed project id is not a project route: it must not open a detail view.
  assert.deepEqual(parseHashRoute('#/project/Not_A_Valid_Id'), { view: 'triage', projectId: null })
  assert.deepEqual(parseHashRoute('#/project/'), { view: 'triage', projectId: null })
})

// --- Unit: derived recent-activity events ------------------------------------

function projectFixture(): ProjectState {
  return {
    id: 'fixture-project',
    activity: {
      lastMeaningfulActivity: {
        status: 'KNOWN', at: '2026-10-01T09:00:00Z', source: 'COMMIT',
        sourceId: 'sha:commit', evidenceUrl: 'https://github.com/x/y/commit/sha:commit',
      },
      statusUpdatedAt: { status: 'UNAVAILABLE', reason: 'no canonical status artifact' },
      snapshotGeneratedAt: { at: '2026-10-01T10:00:00Z', source: 'SNAPSHOT', sourceId: 'config/projects.github.json' },
    },
    session: {
      sessionStartedAt: { status: 'KNOWN', at: '2026-09-30T08:00:00Z', source: 'PROJECT_STATUS', sourceId: 'sha:status', evidenceUrl: null },
      sessionLastActivityAt: { status: 'UNAVAILABLE', reason: 'no session activity timestamp' },
    },
  } as unknown as ProjectState
}

test('recent activity events are ordered newest first with gaps last', () => {
  const events = buildProjectDetailEvents(projectFixture())
  assert.deepEqual(events.map((event) => event.kind), [
    'SNAPSHOT_GENERATED',   // 2026-10-01T10:00:00Z
    'PROJECT_ACTIVITY',     // 2026-10-01T09:00:00Z
    'SESSION_STARTED',      // 2026-09-30T08:00:00Z
    'SESSION_ACTIVITY',     // UNAVAILABLE
    'STATUS_UPDATED',       // UNAVAILABLE
  ])
  // A gap keeps its recorded reason instead of disappearing or becoming "now".
  const gap = events.find((event) => event.kind === 'STATUS_UPDATED')!
  assert.equal(gap.at, null)
  assert.equal(gap.source, 'UNAVAILABLE')
  assert.equal(gap.sourceId, 'no canonical status artifact')
  // Snapshot generation is always labelled as the dashboard's own clock.
  const snapshot = events.find((event) => event.kind === 'SNAPSHOT_GENERATED')!
  assert.equal(snapshot.source, 'SNAPSHOT')
})

test('equal timestamps keep a deterministic event order', () => {
  const project = projectFixture()
  project.activity.snapshotGeneratedAt.at = '2026-10-01T09:00:00Z'
  const events = buildProjectDetailEvents(project)
  assert.deepEqual(events.map((event) => event.kind), [
    'PROJECT_ACTIVITY',     // ties with the snapshot at 09:00; lower kind order wins
    'SNAPSHOT_GENERATED',
    'SESSION_STARTED',
    'SESSION_ACTIVITY',     // UNAVAILABLE
    'STATUS_UPDATED',       // UNAVAILABLE
  ])
})

// --- DOM harness -------------------------------------------------------------

const snapshotText = readFileSync(
  fileURLToPath(new URL('../public/project-state.json', import.meta.url)),
  'utf8',
)

type Registry = { projects: Array<Record<string, unknown>> }

function installDom(width: number, snapshot: string, hash = '') {
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
  // The live-registry hook polls the runtime snapshot; serve the committed one.
  globals.fetch = async () => new Response(snapshot, {
    status: 200,
    headers: { 'content-type': 'application/json' },
  })
  globals.IS_REACT_ACT_ENVIRONMENT = true
  return dom
}

async function renderDashboard(width: number, hash = '', mutate?: (registry: Registry) => void) {
  const registry: Registry = JSON.parse(snapshotText)
  mutate?.(registry)
  const dom = installDom(width, JSON.stringify(registry), hash)
  const { createElement, act } = await import('react')
  const { createRoot } = await import('react-dom/client')
  const { App } = await import('../src/components/DashboardApp.js')

  const container = dom.window.document.getElementById('root')!
  const root = createRoot(container)
  await act(async () => { root.render(createElement(App)) })

  return {
    container,
    window: dom.window,
    act,
    cleanup: async () => {
      await act(async () => { root.unmount() })
      dom.window.close()
    },
  }
}

function click(container: Element, selector: string) {
  const node = container.querySelector(selector)
  assert.ok(node, `expected to find "${selector}"`)
  ;(node as HTMLElement).click()
}

function buttonByText(container: Element, text: string) {
  return [...container.querySelectorAll('button')].find((button) => button.textContent?.includes(text))
}

function cardFor(container: Element, name: string) {
  return [...container.querySelectorAll('.project-card')]
    .find((card) => card.querySelector('h2')?.textContent?.includes(name))
}

const snapshotProjects = (JSON.parse(snapshotText) as Registry).projects

test('every project card links to its own project detail route', async (t) => {
  const { container, cleanup } = await renderDashboard(1440)
  t.after(cleanup)

  const cards = [...container.querySelectorAll('.project-card')]
  assert.equal(cards.length, snapshotProjects.length, 'every portfolio project renders a card')
  for (const project of snapshotProjects) {
    const card = cards.find((candidate) => candidate.querySelector('h2')?.textContent === project.name)
    assert.ok(card, `card for ${project.name} must render`)
    const link = card.querySelector('.project-card-open')
    assert.ok(link, `${project.name} must be navigable`)
    assert.equal(link.getAttribute('href'), projectDetailHash(project.id as string))
    assert.ok(link.getAttribute('aria-label')?.includes(project.name as string), 'the card link needs an accessible name')
    // Cards stay read-only: the link is the only interactive element and it is a route.
    assert.equal(card.querySelectorAll('button').length, 0)
  }
})

test('every portfolio project can be opened and inspected from its card', async (t) => {
  const { container, act, cleanup } = await renderDashboard(1440)
  t.after(cleanup)
  await act(async () => { buttonByText(container, 'Portfolio')!.click() })

  for (const project of snapshotProjects) {
    const name = project.name as string
    await act(async () => {
      cardFor(container, name)!.querySelector<HTMLElement>('.project-card-open')!.click()
    })

    const detail = container.querySelector('.project-detail')
    assert.ok(detail, `${name} must open a project detail view`)
    assert.equal(detail.querySelector('h2')?.textContent, name, 'the detail view shows the same project')
    if (project.repo) {
      assert.ok(detail.textContent?.includes(project.repo as string), 'repository must be shown')
    } else {
      assert.ok(detail.textContent?.includes('Не привязан к репозиторию'), 'a missing repository must stay explicit')
    }
    for (const label of [
      'Операционный статус', 'Текущий этап', 'Checkpoint', 'Прогресс', 'Блокер', 'Следующее действие',
      'Последнее обновление', 'Источник состояния', 'Последняя значимая активность', 'Канонический статус обновлён',
      'Snapshot сформирован', 'Состояние сессии', 'Закрытие сессии', 'Checkpoint сессии', 'Сессия начата',
      'Последняя активность сессии', 'Подтверждение закрытия', 'Evidence состояния сессии',
    ]) {
      assert.ok(detail.textContent?.includes(label), `${name} detail must expose "${label}"`)
    }
    for (const panel of ['Состояние проекта', 'Активность', 'Сессия Arena', 'Evidence', 'Недавние события', 'История проекта']) {
      assert.ok(detail.textContent?.includes(panel), `${name} detail must contain the "${panel}" panel`)
    }
    assert.ok(detail.querySelectorAll('.detail-events li').length > 0, 'recent activity/events must be listed')
    if ((project.evidenceLinks as unknown[]).length > 0) {
      assert.ok(detail.querySelectorAll('.evidence-links a').length > 0, 'evidence links must be listed')
    } else {
      assert.ok(detail.textContent?.includes('Источник не приложил evidence-ссылок'), 'a missing evidence link must stay explicit')
    }

    await act(async () => { buttonByText(container, 'Портфель')!.click() })
  }
})

test('a project deep link survives a direct navigation and a refresh', async (t) => {
  const { container, window, cleanup } = await renderDashboard(1440, '#/project/business-discovery')
  t.after(cleanup)

  assert.equal(window.location.hash, '#/project/business-discovery')
  const detail = container.querySelector('.project-detail')
  assert.ok(detail, 'the detail view must render without any click')
  assert.equal(detail.querySelector('h2')?.textContent, 'Business Discovery')
  // The operational status comes from the same normalized state as the cards.
  assert.ok(detail.querySelector('.status-badge'), 'operational status badge must render')

  // A refresh re-mounts the app on the same URL and must land on the same view.
  const { container: refreshed, cleanup: cleanupRefresh } = await renderDashboard(1440, '#/project/business-discovery')
  t.after(cleanupRefresh)
  assert.ok(refreshed.querySelector('.project-detail'), 'refresh keeps the deep link')
  assert.equal(refreshed.querySelector('.project-detail h2')?.textContent, 'Business Discovery')
})

test('detail data matches the portfolio card for the same project', async (t) => {
  const { container, act, cleanup } = await renderDashboard(1440)
  t.after(cleanup)
  await act(async () => { buttonByText(container, 'Portfolio')!.click() })
  const card = cardFor(container, 'Salamat Projects Dashboard')!
  const cardStatus = card.querySelector('.status-badge')?.textContent
  const cardRepo = card.querySelector('.meta-repo')?.textContent

  await act(async () => { card.querySelector<HTMLElement>('.project-card-open')!.click() })
  const detail = container.querySelector('.project-detail')!
  assert.equal(detail.querySelector('.status-badge')?.textContent, cardStatus, 'status must not differ between card and detail')
  assert.ok(detail.querySelector('.meta-repo')?.textContent?.includes(cardRepo!.trim()), 'repository must not differ')
  // Detail and cards read the same snapshot: the freshness chip is derived from it too.
  assert.ok(detail.querySelector('.freshness-chip'), 'activity freshness must be shown in the detail view')
})

test('return navigation goes back to Portfolio and Triage', async (t) => {
  const { container, window, act, cleanup } = await renderDashboard(1440, '#/project/murat-house')
  t.after(cleanup)

  await act(async () => { buttonByText(container, 'Портфель')!.click() })
  assert.equal(window.location.hash, '#/portfolio')
  assert.equal(container.querySelectorAll('.project-card').length, snapshotProjects.length, 'Portfolio renders the full list')

  await act(async () => { container.querySelector<HTMLElement>('.project-card-open')!.click() })
  await act(async () => { buttonByText(container, 'Триаж')!.click() })
  assert.equal(window.location.hash, '#/triage')
  assert.ok(container.querySelector('.triage-tabs'), 'Triage renders its filters again')
  assert.ok(container.querySelectorAll('.project-card').length > 0, 'Triage renders its cards again')
})

test('project DONE is never conflated with Arena session closure', async (t) => {
  const { container, cleanup } = await renderDashboard(1440, '#/project/murat-house', (registry) => {
    const project = registry.projects.find((candidate) => candidate.id === 'murat-house')!
    project.triageState = 'DONE'
    project.triageSource = { status: 'KNOWN', sourceId: 'sha:PROJECT_STATUS.md' }
    project.session = {
      sessionState: 'READY_TO_CLOSE',
      sessionCheckpoint: 'CP-16 — Project Detail Drill-down',
      sessionStartedAt: { status: 'UNAVAILABLE', reason: 'no start evidence' },
      sessionLastActivityAt: {
        status: 'KNOWN', at: '2026-09-30T00:00:00Z', source: 'PROJECT_STATUS',
        sourceId: 'sha:PROJECT_STATUS.md', evidenceUrl: null,
      },
      sessionClosureStatus: 'NOT_CONFIRMED',
      sessionClosureEvidence: null,
      sessionStateEvidence: [{
        label: 'PROJECT_STATUS.md',
        url: 'https://github.com/Murkin1980/murat-house/blob/main/PROJECT_STATUS.md',
        sourceId: 'sha:PROJECT_STATUS.md',
      }],
      sessionStateReason: 'CP-16 test',
    }
  })
  t.after(cleanup)

  const detail = container.querySelector('.project-detail')!
  assert.ok(detail.querySelector('.status-badge')?.textContent?.includes('DONE'), 'project status stays DONE')
  assert.ok(detail.querySelector('.session-detail-badge')?.textContent?.includes('READY_TO_CLOSE'))
  assert.ok(detail.textContent?.includes('DONE не означает CLOSED'), 'the view must state that DONE is not closure')
  assert.ok(detail.querySelector('.closure-not-confirmed'), 'closure must be shown as not confirmed')
})

test('a closed Arena session is not project completion', async (t) => {
  const { container, cleanup } = await renderDashboard(1440, '#/project/murat-house', (registry) => {
    const project = registry.projects.find((candidate) => candidate.id === 'murat-house')!
    project.triageState = 'READY'
    project.triageSource = { status: 'KNOWN', sourceId: 'sha:PROJECT_STATUS.md' }
    project.session = {
      sessionState: 'CLOSED',
      sessionCheckpoint: 'CP-15 — Activity-Aware Portfolio',
      sessionStartedAt: { status: 'KNOWN', at: '2026-09-20T00:00:00Z', source: 'PROJECT_STATUS', sourceId: 'sha:PROJECT_STATUS.md', evidenceUrl: null },
      sessionLastActivityAt: { status: 'KNOWN', at: '2026-09-28T00:00:00Z', source: 'PROJECT_STATUS', sourceId: 'sha:PROJECT_STATUS.md', evidenceUrl: null },
      sessionClosureStatus: 'CONFIRMED',
      sessionClosureEvidence: {
        label: 'PROJECT_STATUS.md',
        url: 'https://github.com/Murkin1980/murat-house/blob/main/PROJECT_STATUS.md',
        sourceId: 'sha:PROJECT_STATUS.md',
      },
      sessionStateEvidence: [{
        label: 'PROJECT_STATUS.md',
        url: 'https://github.com/Murkin1980/murat-house/blob/main/PROJECT_STATUS.md',
        sourceId: 'sha:PROJECT_STATUS.md',
      }],
      sessionStateReason: 'explicit closure evidence',
    }
  })
  t.after(cleanup)

  const detail = container.querySelector('.project-detail')!
  assert.ok(detail.querySelector('.status-badge')?.textContent?.includes('READY'), 'project status stays READY')
  assert.ok(detail.querySelector('.session-detail-badge')?.textContent?.includes('CLOSED'))
  assert.ok(detail.querySelector('.closure-confirmed')?.textContent?.includes('Подтверждено'))
  assert.ok(detail.textContent?.includes('CLOSED сам по себе не означает DONE'))
  const closureLink = detail.querySelector('.detail-evidence-link')
  assert.ok(closureLink?.getAttribute('href')?.startsWith('https://'), 'closure evidence must be a link')
})

test('unverifiable session closure is shown as UNKNOWN, never as closed', async (t) => {
  const { container, cleanup } = await renderDashboard(1440, '#/project/murat-house', (registry) => {
    const project = registry.projects.find((candidate) => candidate.id === 'murat-house')!
    project.session = {
      sessionState: 'UNKNOWN',
      sessionCheckpoint: null,
      sessionStartedAt: { status: 'UNAVAILABLE', reason: 'No attributable Arena session start timestamp was found' },
      sessionLastActivityAt: { status: 'UNAVAILABLE', reason: 'No attributable Arena session activity timestamp was found' },
      sessionClosureStatus: 'UNKNOWN',
      sessionClosureEvidence: null,
      sessionStateEvidence: [],
      sessionStateReason: 'No Arena session evidence found in PROJECT_STATUS.md',
    }
  })
  t.after(cleanup)

  const detail = container.querySelector('.project-detail')!
  assert.ok(detail.querySelector('.session-detail-unknown')?.textContent?.includes('UNKNOWN'))
  assert.ok(detail.querySelector('.closure-unknown')?.textContent?.includes('Неизвестно'))
  assert.ok(detail.textContent?.includes('UNKNOWN'), 'the view must state UNKNOWN explicitly')
  assert.ok(detail.textContent?.includes('Отсутствует — закрытие не подтверждено'))
  assert.ok(detail.textContent?.includes('Нет evidence для состояния сессии'))
  assert.ok(detail.querySelector('.detail-event-gap'), 'missing timestamps must be visible as gaps')
})

test('an unknown project id states the gap instead of inventing a project', async (t) => {
  const { container, cleanup } = await renderDashboard(1440, '#/project/project-that-does-not-exist')
  t.after(cleanup)
  assert.ok(container.querySelector('.project-detail'), 'the detail route still renders')
  assert.ok(container.textContent?.includes('отсутствует в текущем snapshot портфеля'))
  assert.equal(container.querySelectorAll('.project-card').length, 0, 'no project data is fabricated')
})

test('the project detail view is strictly read-only', async (t) => {
  const { container, cleanup } = await renderDashboard(1440, '#/project/business-discovery')
  t.after(cleanup)
  const detail = container.querySelector('.project-detail')!
  const forbiddenLabel = /continu|task packet|codex|arena|json|execut|run task|model|prompt|agent|runner|send to/i

  for (const button of detail.querySelectorAll('button')) {
    const label = (button.textContent ?? '').trim()
    assert.ok(!forbiddenLabel.test(label), `detail button "${label}" looks like a control`)
  }
  // Only the two return-navigation buttons exist; nothing mutates state.
  assert.deepEqual(
    [...detail.querySelectorAll('button')].map((button) => button.textContent?.trim()),
    ['Портфель', 'Триаж'],
  )
  assert.equal(detail.querySelectorAll('input, select, textarea, form').length, 0, 'no editing surface')
  assert.equal(detail.querySelectorAll('.project-card').length, 0, 'the detail view is not a card list')
  for (const link of detail.querySelectorAll('a')) {
    const href = link.getAttribute('href') ?? ''
    assert.ok(
      href.startsWith('https://') || href.startsWith('#/'),
      `detail links must be evidence or routes, got "${href}"`,
    )
    assert.equal(link.getAttribute('rel'), 'noreferrer')
  }
})

test('the detail view renders on a phone viewport (390px)', async (t) => {
  const { container, act, cleanup } = await renderDashboard(390)
  t.after(cleanup)
  await act(async () => { buttonByText(container, 'Portfolio')!.click() })
  await act(async () => { container.querySelector<HTMLElement>('.project-card-open')!.click() })

  const detail = container.querySelector('.project-detail')!
  assert.ok(detail, 'the detail view renders on mobile')
  assert.equal(container.querySelectorAll('.detail-panel').length, 6, 'all panels render on mobile')
  assert.ok(detail.querySelector('.session-detail-badge'), 'session state renders on mobile')
  assert.ok(detail.querySelector('.detail-return button'), 'return navigation renders on mobile')
  assert.equal(container.querySelector('.app-shell') !== null, true)
  // The mobile shell keeps the same single-column, no-overflow structure.
  assert.ok(container.querySelector('.main-content'), 'main content stays inside the mobile shell')
  // No mobile-only control appears in the detail view.
  assert.equal(detail.querySelectorAll('.project-card-open').length, 0)
})

test('project history renders for the project that has it and states the gap otherwise', async (t) => {
  // CP-17 replaced the static manifest with the live history carried by ProjectState.
  const { container: withHistory, cleanup: cleanupHistory } = await renderDashboard(1440, '#/project/salamat-projects-dashboard')
  t.after(cleanupHistory)
  const historyItems = withHistory.querySelectorAll('.detail-history li')
  assert.ok(historyItems.length > 0, 'the dashboard project shows its live history')
  assert.ok(withHistory.textContent?.includes('История проекта'))
  assert.ok(withHistory.querySelector('.detail-history a')?.getAttribute('href')?.startsWith('https://'))

  const { container: withoutHistory, cleanup: cleanupGap } = await renderDashboard(1440, '#/project/murat-house')
  t.after(cleanupGap)
  assert.equal(withoutHistory.querySelectorAll('.detail-history li').length, 0)
  assert.ok(withoutHistory.textContent?.includes('История недоступна (UNAVAILABLE)'), 'a missing history must be explicit')
})

test('activity timestamps are formatted from the evidence timestamp', () => {
  const formatted = formatEventTimestamp('2026-10-01T10:00:00Z')
  // Second-precision UTC evidence renders as a readable local-independent stamp.
  assert.match(formatted, /10:00/)
  assert.equal(formatEventTimestamp('2026-10-01T10:00:00Z'), formatted, 'formatting is deterministic')
})

test('opening a project from Portfolio preserves the originating list view and shows conflict source provenance', async (t) => {
  const { container, act, cleanup } = await renderDashboard(1440)
  t.after(cleanup)

  const portfolioNav = buttonByText(container, 'Portfolio')!
  await act(async () => { portfolioNav.click() })
  assert.ok(portfolioNav.classList.contains('active'), 'Portfolio is active before opening a project')

  await act(async () => {
    cardFor(container, 'Business Discovery')!.querySelector<HTMLElement>('.project-card-open')!.click()
  })

  assert.ok(portfolioNav.classList.contains('active'), 'originating Portfolio view remains active while inspecting detail')
  const detail = container.querySelector('.project-detail')!
  assert.ok(detail.textContent?.includes('6c984ad810d9babc5dc5871f2629d0acbe4147ee:PROJECT_STATUS.md'))
  assert.ok(detail.textContent?.includes('dfef377613e6d16768b8c417010077648a11df5c:PROJECT_STATUS.md'))
  assert.ok(detail.textContent?.includes('REPOSITORY (Murkin1980/business-discovery)'))
})

test('pending (READY_TO_CLOSE) and stale (STALE_SESSION) closure states are explicitly distinguishable in detail view', async (t) => {
  const { container: readyContainer, cleanup: cleanupReady } = await renderDashboard(
    1440,
    '#/project/murat-house',
    (registry) => {
      const project = registry.projects.find((candidate) => candidate.id === 'murat-house')!
      project.triageState = 'VALIDATION'
      project.triageSource = { status: 'KNOWN', sourceId: 'sha:PROJECT_STATUS.md' }
      project.session = {
        sessionState: 'READY_TO_CLOSE',
        sessionCheckpoint: 'CP-16 — Project Detail Drill-down',
        sessionStartedAt: { status: 'KNOWN', at: '2026-10-01T08:00:00Z', source: 'PROJECT_STATUS', sourceId: 'sha:PROJECT_STATUS.md', evidenceUrl: null },
        sessionLastActivityAt: { status: 'KNOWN', at: '2026-10-01T10:00:00Z', source: 'PROJECT_STATUS', sourceId: 'sha:PROJECT_STATUS.md', evidenceUrl: null },
        sessionClosureStatus: 'NOT_CONFIRMED',
        sessionClosureEvidence: null,
        sessionStateEvidence: [{
          label: 'PROJECT_STATUS.md',
          url: 'https://github.com/Murkin1980/murat-house/blob/main/PROJECT_STATUS.md',
          sourceId: 'sha:PROJECT_STATUS.md',
        }],
        sessionStateReason: 'checkpoint complete without closure evidence',
      }
    },
  )
  t.after(cleanupReady)
  const readyDetail = readyContainer.querySelector('.project-detail')!
  assert.ok(readyDetail.querySelector('.session-detail-ready')?.textContent?.includes('READY_TO_CLOSE'))
  assert.ok(readyDetail.textContent?.includes('ожидает подтверждения (READY_TO_CLOSE'))

  const { container: staleContainer, cleanup: cleanupStale } = await renderDashboard(
    1440,
    '#/project/murat-house',
    (registry) => {
      const project = registry.projects.find((candidate) => candidate.id === 'murat-house')!
      project.triageState = 'IN_PROGRESS'
      project.triageSource = { status: 'KNOWN', sourceId: 'sha:PROJECT_STATUS.md' }
      project.session = {
        sessionState: 'STALE_SESSION',
        sessionCheckpoint: 'CP-16 — Project Detail Drill-down',
        sessionStartedAt: { status: 'KNOWN', at: '2026-09-20T08:00:00Z', source: 'PROJECT_STATUS', sourceId: 'sha:PROJECT_STATUS.md', evidenceUrl: null },
        sessionLastActivityAt: { status: 'KNOWN', at: '2026-09-25T10:00:00Z', source: 'PROJECT_STATUS', sourceId: 'sha:PROJECT_STATUS.md', evidenceUrl: null },
        sessionClosureStatus: 'NOT_CONFIRMED',
        sessionClosureEvidence: null,
        sessionStateEvidence: [{
          label: 'PROJECT_STATUS.md',
          url: 'https://github.com/Murkin1980/murat-house/blob/main/PROJECT_STATUS.md',
          sourceId: 'sha:PROJECT_STATUS.md',
        }],
        sessionStateReason: 'open session exceeded inactivity threshold',
      }
    },
  )
  t.after(cleanupStale)
  const staleDetail = staleContainer.querySelector('.project-detail')!
  assert.ok(staleDetail.querySelector('.session-detail-stale')?.textContent?.includes('STALE_SESSION'))
  assert.ok(staleDetail.textContent?.includes('дольше порога бездействия (STALE_SESSION)'))
})
