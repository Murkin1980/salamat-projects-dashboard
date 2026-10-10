/**
 * Dashboard application shell (Triage / Portfolio / Attention / Nodes / Reports).
 *
 * The app lives here, separate from the `src/main.tsx` browser entry, so the
 * shell can be rendered in DOM tests without loading CSS through the bundler.
 * Product boundary: this is a read-only Portfolio Monitoring UI. It renders
 * project state from the normalized snapshot and exposes no execution control
 * (no task runners, no agent/model controls, no Task Packet export). Opening a
 * project (CP-16) only changes the route: the Project Detail view is an
 * observation of the same normalized state, never a control surface.
 */
// Default React import: see NodeView.tsx — required by the tsx test runner's
// classic JSX transform, tree-shaken by the automatic-runtime build.
import React, { useMemo, useState } from 'react'
import {
  IconAlertTriangle,
  IconArrowRight,
  IconClock,
  IconExternalLink,
  IconEye,
  IconFlask,
  IconFolderCode,
  IconGitBranch,
  IconLayoutDashboard,
  IconListDetails,
  IconRadar,
  IconRefresh,
  IconRoute,
  IconSearch,
  IconSettings,
  IconTargetArrow,
} from '@tabler/icons-react'
import projectRegistry from '../../config/projects.github.json'
import nodeGraphRegistry from '../../config/node-graphs.json'
import experimentRegistry from '../../config/experiments.github.json'
import { NodesView } from './NodesView'
import { ReportView } from './ReportView'
import { DiscoveryView } from './DiscoveryView'
import { ProjectDetailView } from './ProjectDetailView'
import { SessionIndicator, StatusBadge, triageMeta } from './status-badges'
import {
  parseProjectRegistry,
  type ProjectState,
  type TriageState,
} from '../contract/project-state'
import { useLiveRegistry } from '../hooks/use-live-registry'
import { useHashRoute } from '../hooks/use-hash-route'
import { deriveLiveProjectState } from '../triage/live-triage'
import { parseNodeGraphRegistry } from '../graph/node-graph'
import { parseExperimentRegistry, type ExperimentStatus } from '../contract/experiment-registry'
import { ARENA_SESSION_INACTIVITY_THRESHOLD_HOURS, getActivityFreshness } from '../monitoring/derived-state'
import { formatEventTimestamp } from '../monitoring/project-detail-events'
import {
  compareByPriorityThenActivity,
  orderByRecentActivity,
} from '../monitoring/portfolio-ordering'
import { projectDetailHash, viewHash, type DashboardView } from '../routing/hash-route'

const initialRegistry = parseProjectRegistry(projectRegistry)
// The full node-graph registry is parsed once; the Nodes view selects from it by projectId.
const nodeGraphs = parseNodeGraphRegistry(nodeGraphRegistry).graphs
const experiments = parseExperimentRegistry(experimentRegistry)
const experimentFilterLabels: Record<ExperimentStatus | 'ALL', string> = { ALL: 'All', READY_TO_TEST: 'To test', RUNNING: 'Running', PASS: 'Passed', FAIL: 'Failed', HOLD: 'Hold', ADOPTED: 'Adopted', IDEA: 'Idea', PLANNED: 'Planned', RETIRED: 'Retired', PARTIAL: 'Partial' }

const viewTitles: Record<DashboardView, string> = {
  triage: 'Triage',
  portfolio: 'Portfolio',
  experiments: 'Experiments',
  attention: 'Attention',
  nodes: 'Node View',
  reports: 'History & Reports',
  discovery: 'Discovery',
}

const triageOrder: TriageState[] = ['ACTION_NOW', 'BLOCKED', 'READY', 'IN_PROGRESS', 'VALIDATION', 'HOLD', 'DONE']

function matchesQuery(project: ProjectState, query: string) {
  const normalized = query.trim().toLowerCase()
  if (!normalized) return true
  return [project.name, project.summary, project.stage ?? '', project.nextAction ?? '']
    .join(' ')
    .toLowerCase()
    .includes(normalized)
}

function App() {
  const [query, setQuery] = useState('')
  const [filter, setFilter] = useState<TriageState | 'ALL'>('ALL')
  const [experimentFilter, setExperimentFilter] = useState<ExperimentStatus | 'ALL'>('ALL')
  // The route lives in the URL hash, so a project detail link survives a refresh
  // and a direct navigation, and the browser Back button returns to the list.
  const { route, navigate } = useHashRoute()
  const view = route.view
  const { registry, refresh, refreshState, error, lastSuccessAt } = useLiveRegistry(initialRegistry)
  const liveProjects = useMemo(
    () => registry.projects.map((project) => deriveLiveProjectState(project, new Date())),
    [registry],
  )
  const projects = useMemo(
    () => liveProjects.map(({ project, effectiveTriageState }) => ({ ...project, triageState: effectiveTriageState })),
    [liveProjects],
  )

  const counts = useMemo(() => {
    const base = Object.fromEntries(triageOrder.map((state) => [state, 0])) as Record<TriageState, number>
    projects.forEach((project) => {
      if (project.triageState) base[project.triageState] += 1
    })
    return base
  }, [projects])

  const visibleProjects = useMemo(() => {
    return projects.filter((project) => {
      if (filter !== 'ALL' && project.triageState !== filter) return false
      return matchesQuery(project, query)
    })
  }, [filter, projects, query])

  // Triage keeps operational priority authoritative; recency only breaks ties
  // inside the same operational state, so ACTION NOW / BLOCKED are never hidden.
  const triageOrderedProjects = useMemo(
    () => [...visibleProjects].sort((a, b) =>
      compareByPriorityThenActivity(a, a.triageState, b, b.triageState)),
    [visibleProjects],
  )

  // Portfolio orders by recent meaningful activity (most recent first) with
  // deterministic tie-breakers; unattributable activity sorts last.
  const portfolioProjects = useMemo(
    () => orderByRecentActivity(projects.filter((project) => matchesQuery(project, query))),
    [projects, query],
  )

  const attentionProjects = useMemo(
    () => liveProjects.filter(({ attention }) => attention.length > 0),
    [liveProjects],
  )

  // Attention preserves operational priority first, then uses recent activity as
  // a secondary ordering signal; it never elevates a quiet project over a blocker.
  const orderedAttentionProjects = useMemo(
    () => [...attentionProjects].sort((a, b) =>
      compareByPriorityThenActivity(a.project, a.effectiveTriageState, b.project, b.effectiveTriageState)),
    [attentionProjects],
  )

  // History & Reports lists every project in the same activity order as Portfolio
  // (unfiltered: the search box does not apply there), so its project selector is explainable.
  const reportProjects = useMemo(() => orderByRecentActivity(projects), [projects])

  // The detail view reads the same normalized state the cards render, so a
  // project can never be described differently in the list and in its detail.
  const detailProjectId = route.projectId
  const detailProject = detailProjectId === null
    ? null
    : projects.find((project) => project.id === detailProjectId) ?? null

  return (
    <div className="app-shell">
      <aside className="sidebar" aria-label="Навигация">
        <div className="brand">
          <div className="brand-mark">SM</div>
          <div>
            <strong>Projects</strong>
            <span>salamat-mebel.kz</span>
          </div>
        </div>
        <nav className="nav-list">
          <button className={view === 'triage' ? 'active' : ''} onClick={() => navigate(viewHash('triage'))}><IconLayoutDashboard size={20}/> Triage</button>
          <button className={view === 'portfolio' ? 'active' : ''} onClick={() => navigate(viewHash('portfolio'))}><IconFolderCode size={20}/> Portfolio</button>
          <button className={view === 'experiments' ? 'active' : ''} onClick={() => navigate(viewHash('experiments'))}><IconFlask size={20}/> Experiments</button>
          <button className={view === 'attention' ? 'active' : ''} onClick={() => navigate(viewHash('attention'))}><IconAlertTriangle size={20}/> Attention</button>
          <button className={view === 'nodes' ? 'active' : ''} onClick={() => navigate(viewHash('nodes'))}><IconRoute size={20}/> Nodes</button>
          <button disabled title="Будет реализовано в следующих checkpoint"><IconTargetArrow size={20}/> Roadmap</button>
          <button className={view === 'reports' ? 'active' : ''} onClick={() => navigate(viewHash('reports'))}><IconListDetails size={20}/> Reports</button>
          <button className={view === 'discovery' ? 'active' : ''} onClick={() => navigate(viewHash('discovery'))}><IconRadar size={20}/> Discovery</button>
          <button disabled title="Настройки появятся позже"><IconSettings size={20}/> Settings</button>
        </nav>
        <div className="sidebar-note">
          <IconEye size={18}/>
          <span>Portfolio Monitoring UI · read-only</span>
        </div>
      </aside>

      <main className="main-content">
        <header className="page-header">
          <div>
            <p className="eyebrow">Operational portfolio</p>
            <h1>{detailProjectId === null ? viewTitles[view] : detailProject?.name ?? 'Проект не найден'}</h1>
            <p>{detailProjectId === null
              ? (view === 'experiments' ? 'Read-only view of the canonical MPE registry. Full plans and results remain in the owning repository.' : view === 'nodes' ? 'Карта реальных связей выбранного проекта с evidence для каждого узла и ребра.' : view === 'reports' ? 'Живая хронология проекта из GitHub evidence: коммиты, PR, переходы статуса и события сессии Arena.' : view === 'discovery' ? 'Кто из поисковых и AI-краулеров заходил на Murat House и какие страницы они запрашивали.' : 'Живой пульт проектов. Состояния обновляются из проверенного runtime snapshot без ручного редактирования карточек.')
              : 'Полная карточка проекта: состояние, активность, сессия Arena и evidence. Только чтение.'}</p>
          </div>
          {(detailProjectId !== null || (view !== 'nodes' && view !== 'reports' && view !== 'discovery')) && <div className="header-actions">
            <div className={`sync-state ${error ? 'sync-error' : ''}`} role="status">
              <span>{error ? `Ошибка обновления: ${error}` : lastSuccessAt ? `Обновлено ${lastSuccessAt.toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' })}` : 'Загрузка live snapshot…'}</span>
              <button type="button" onClick={() => void refresh()} disabled={refreshState === 'REFRESHING'}>
                <IconRefresh size={17} className={refreshState === 'REFRESHING' ? 'spinning' : ''}/>
                {refreshState === 'REFRESHING' ? 'Обновление…' : 'Обновить'}
              </button>
            </div>
            {/* The detail view is a single project, so list filtering does not apply. */}
            {detailProjectId === null && <label className="search-box">
              <IconSearch size={19}/>
              <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Найти проект…" aria-label="Поиск проектов" />
            </label>}
          </div>}
        </header>

        {detailProjectId === null && view !== 'nodes' && view !== 'reports' && view !== 'discovery' && <section className="summary-grid" aria-label="Сводка">
          <SummaryCard label="Активные" value={projects.filter(p => p.triageState !== null && p.triageState !== 'HOLD' && p.triageState !== 'DONE').length} detail="в рабочем портфеле" />
          <SummaryCard label="Требуют внимания" value={attentionProjects.length} detail="с объяснимой причиной" tone="critical" />
          <SummaryCard label="Готовы к следующему этапу" value={counts.READY} detail="READY" tone="positive" />
          <SummaryCard label="На валидации" value={counts.VALIDATION} detail="VALIDATION" tone="validation" />
        </section>}

        {detailProjectId !== null && (
          <ProjectDetailView
            project={detailProject}
            projectId={detailProjectId}
            onNavigate={navigate}
          />
        )}

        {detailProjectId === null && view === 'triage' && (
          <>
            <section className="triage-tabs" aria-label="Фильтр по готовности">
              <button className={filter === 'ALL' ? 'selected' : ''} onClick={() => setFilter('ALL')}>ALL <span>{projects.length}</span></button>
              {triageOrder.map((state) => {
                const meta = triageMeta[state]
                return <button key={state} className={`${filter === state ? 'selected' : ''} ${meta.className}`} onClick={() => setFilter(state)}>{meta.label} <span>{counts[state]}</span></button>
              })}
            </section>
            <ProjectGrid projects={triageOrderedProjects} onNavigate={navigate} />
          </>
        )}

        {detailProjectId === null && view === 'portfolio' && (
          <>
            <p className="view-caption">
              Порядок — по дате последней значимой активности. Отметка <strong>Arena</strong> рядом со статусом проекта
              показывает состояние сессии (порог устаревшей сессии — {ARENA_SESSION_INACTIVITY_THRESHOLD_HOURS} ч) и не
              заменяет операционный статус проекта. Нажмите на карточку, чтобы открыть проект полностью.
            </p>
            <ProjectGrid projects={portfolioProjects} onNavigate={navigate} />
          </>
        )}

        {detailProjectId === null && view === 'experiments' && <ExperimentsView filter={experimentFilter} onFilter={setExperimentFilter} />}

        {detailProjectId === null && view === 'attention' && (
          <section className="attention-list">
            {orderedAttentionProjects.filter(({ project }) => matchesQuery(project, query)).map(({ project, effectiveTriageState, attention }) => (
              <article key={project.id} className="attention-row">
                <StatusBadge state={effectiveTriageState} resolution={project.triageSource.status}/>
                <div>
                  <strong>{project.name}</strong>
                  <p>{attention.map((signal) => signal.label).join(' · ')}</p>
                  <small>Источник: {attention.map((signal) => signal.sourceId).join(' · ')}</small>
                </div>
                <span className="attention-stage">{attention.map((signal) => signal.kind.replaceAll('_', ' ')).join(' / ')}</span>
              </article>
            ))}
          </section>
        )}

        {detailProjectId === null && view === 'nodes' && <NodesView graphs={nodeGraphs}/>}
        {detailProjectId === null && view === 'reports' && <ReportView projects={reportProjects} selectedProjectId={route.reportProjectId ?? null} onNavigate={navigate}/>}
        {detailProjectId === null && view === 'discovery' && <DiscoveryView/>}
      </main>
    </div>
  )
}

function SummaryCard({ label, value, detail, tone = 'neutral' }: { label: string; value: number; detail: string; tone?: string }) {
  return <article className={`summary-card ${tone}`}><span>{label}</span><strong>{value}</strong><small>{detail}</small></article>
}

function ProjectGrid({ projects, onNavigate }: { projects: ProjectState[]; onNavigate: (hash: string) => void }) {
  if (!projects.length) return <div className="empty-state">Ничего не найдено по текущему фильтру.</div>
  return (
    <section className="project-grid">
      {projects.map((project) => (
        <ProjectCard key={project.id} project={project} onNavigate={onNavigate} />
      ))}
    </section>
  )
}

function ProjectCard({ project, onNavigate }: { project: ProjectState; onNavigate: (hash: string) => void }) {
  // Source attribution stays visible: every rendered status must be explainable
  // from its source artifact, including UNKNOWN and CONFLICT resolutions.
  const sourceHint = project.triageSource.status === 'KNOWN'
    ? project.triageSource.sourceId
    : project.triageSource.reason

  return (
    <article className="project-card">
      <div className="project-card-head">
        <div className="project-icon"><IconFolderCode size={22}/></div>
        <div className="project-head-badges">
          <StatusBadge state={project.triageState} resolution={project.triageSource.status}/>
          <SessionIndicator session={project.session}/>
        </div>
      </div>
      <ActivityFreshness project={project}/>
      <div className="project-body">
        <h2>{project.name}</h2>
        <p>{project.summary}</p>
      </div>
      <dl className="project-meta">
        <div>
          <dt>Репозиторий</dt>
          <dd className={project.repo ? 'meta-repo' : 'meta-unknown'}>
            {project.repo
              ? <><IconGitBranch size={15}/> {project.repo}</>
              : 'Не привязан к репозиторию'}
          </dd>
        </div>
        <div><dt>Текущий этап</dt><dd className={project.stage ? undefined : 'meta-unknown'}>{project.stage ?? 'Не определено источником'}</dd></div>
        {project.progress && (
          <div><dt>Прогресс</dt><dd>{project.progress.completed} из {project.progress.total}</dd></div>
        )}
        {project.blocker && (
          <div><dt>Блокер</dt><dd className="meta-blocker">{project.blocker}</dd></div>
        )}
        <div><dt>Следующее действие</dt><dd className={project.nextAction ? undefined : 'meta-unknown'}>{project.nextAction ?? 'Не определено источником'}</dd></div>
      </dl>
      {project.evidenceLinks.length > 0 && (
        <div className="project-evidence">
          <span className="evidence-label">Evidence</span>
          <div className="evidence-links">
            {project.evidenceLinks.map((link) => (
              <a key={link.url} href={link.url} target="_blank" rel="noreferrer" title={link.sourceId}>
                <IconExternalLink size={14}/> {link.label}
              </a>
            ))}
          </div>
        </div>
      )}
      <div className="project-footer">
        <span><IconClock size={16}/> Обновлено {new Intl.DateTimeFormat('ru-RU').format(new Date(`${project.lastUpdated}T00:00:00`))}</span>
        <span className="project-source" title={sourceHint}>Источник: {project.source.id}<span className="touch-hint"> · {sourceHint}</span></span>
        <span className="project-card-cta">Открыть проект <IconArrowRight size={13}/></span>
      </div>
      {/*
        The whole card is the link to the project detail route. It is a real
        anchor with the deep link as `href`, so the card is keyboard reachable
        and the link can be copied or opened in a new tab; the click handler only
        takes over plain left clicks so navigation stays inside the SPA.
      */}
      <a
        className="project-card-open"
        href={projectDetailHash(project.id)}
        aria-label={`Открыть проект ${project.name}`}
        onClick={(event) => {
          if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return
          event.preventDefault()
          onNavigate(projectDetailHash(project.id))
        }}
      />
    </article>
  )
}

/**
 * Freshness on the card, derived from the snapshot's own generation time (never
 * a browser clock) so ordering stays explainable and the dashboard stays a
 * periodic read-only observer rather than a realtime monitor.
 */
function ActivityFreshness({ project }: { project: ProjectState }) {
  const now = new Date(project.activity.snapshotGeneratedAt.at)
  const freshness = getActivityFreshness(project.activity.lastMeaningfulActivity, now, project.staleAfterDays)
  const label = freshness === 'FRESH' ? 'СВЕЖАЯ' : freshness === 'STALE' ? 'УСТАРЕЛА' : 'НЕИЗВЕСТНО'
  const activity = project.activity.lastMeaningfulActivity
  const when = activity.status === 'KNOWN'
    ? `Активность: ${formatEventTimestamp(activity.at)}`
    : 'Активность: нет данных'
  return (
    <div className="project-activity">
      <span className={`freshness-chip freshness-${freshness.toLowerCase()}`}>{label}</span>
      <span className="activity-when">{when}</span>
    </div>
  )
}

function ExperimentsView({ filter, onFilter }: { filter: ExperimentStatus | 'ALL'; onFilter: (filter: ExperimentStatus | 'ALL') => void }) {
  const filters: Array<ExperimentStatus | 'ALL'> = ['ALL', 'READY_TO_TEST', 'RUNNING', 'PASS', 'FAIL', 'HOLD', 'ADOPTED']
  const visible = experiments.experiments.filter((experiment) => filter === 'ALL' || experiment.status === filter)
  return <section className="experiments-view" aria-label="MPE experiments">
    <p className="experiment-source">Source: <a href={experiments.source_url} target="_blank" rel="noreferrer">{experiments.source}</a> · snapshot {experiments.updated_at}</p>
    <div className="triage-tabs" aria-label="Experiment status filter">{filters.map((value) => <button key={value} className={filter === value ? 'selected' : ''} onClick={() => onFilter(value)}>{experimentFilterLabels[value]} <span>{value === 'ALL' ? experiments.experiments.length : experiments.experiments.filter((item) => item.status === value).length}</span></button>)}</div>
    <div className="experiment-list">{visible.map((experiment) => <article className="experiment-row" key={experiment.experiment_id}><div><span className={`experiment-status experiment-${experiment.status.toLowerCase()}`}>{experiment.status.replaceAll('_', ' ')}</span><h2>{experiment.name}</h2><p>{experiment.owning_project} · {experiment.repo}</p><p><strong>Next:</strong> {experiment.next_action}</p></div><div className="experiment-links"><time>{experiment.updated_at}</time><a href={experiment.evidence_url} target="_blank" rel="noreferrer"><IconExternalLink size={14}/> Evidence</a></div></article>)}</div>
  </section>
}

export { App }
export default App
