import { useMemo, useState } from 'react'
import { createRoot } from 'react-dom/client'
import {
  IconAlertTriangle,
  IconBolt,
  IconCircleCheck,
  IconClock,
  IconFlask,
  IconFolderCode,
  IconLayoutDashboard,
  IconListDetails,
  IconPlayerPause,
  IconPlayerPlay,
  IconRosetteDiscountCheck,
  IconRefresh,
  IconRoute,
  IconSearch,
  IconSettings,
  IconSparkles,
  IconTargetArrow,
} from '@tabler/icons-react'
import iconMap from '../config/icon-map.json'
import projectRegistry from '../config/projects.github.json'
import nodeGraphRegistry from '../config/node-graphs.json'
import historyRegistry from '../config/project-history.json'
import { NodeView } from './components/NodeView'
import { ReportView } from './components/ReportView'
import {
  parseProjectRegistry,
  type ProjectState,
  type TriageState,
} from './contract/project-state'
import { useLiveRegistry } from './hooks/use-live-registry'
import { deriveLiveProjectState } from './triage/live-triage'
import { parseNodeGraphRegistry } from './graph/node-graph'
import { parseHistoryRegistry } from './history/project-history'
import './styles.css'

type View = 'triage' | 'portfolio' | 'attention' | 'nodes' | 'reports'

const initialRegistry = parseProjectRegistry(projectRegistry)
const businessDiscoveryGraph = parseNodeGraphRegistry(nodeGraphRegistry).graphs.find((graph) => graph.id === 'business-discovery')!
const dashboardHistory = parseHistoryRegistry(historyRegistry).projects.find((history) => history.projectId === 'salamat-projects-dashboard')!
const triageIcons = {
  bolt: IconBolt,
  'alert-triangle': IconAlertTriangle,
  'circle-check': IconCircleCheck,
  'player-play': IconPlayerPlay,
  flask: IconFlask,
  'player-pause': IconPlayerPause,
  'rosette-discount-check': IconRosetteDiscountCheck,
} as const

function getTriageIcon(name: string) {
  const Icon = triageIcons[name as keyof typeof triageIcons]
  if (!Icon) throw new Error(`Unsupported triage icon in config/icon-map.json: ${name}`)
  return Icon
}

const triageMeta: Record<TriageState, { label: string; className: string; Icon: typeof IconBolt }> = {
  ACTION_NOW: { label: 'ACTION NOW', className: 'status-action', Icon: getTriageIcon(iconMap.triage.ACTION_NOW) },
  BLOCKED: { label: 'BLOCKED', className: 'status-blocked', Icon: getTriageIcon(iconMap.triage.BLOCKED) },
  READY: { label: 'READY', className: 'status-ready', Icon: getTriageIcon(iconMap.triage.READY) },
  IN_PROGRESS: { label: 'IN PROGRESS', className: 'status-progress', Icon: getTriageIcon(iconMap.triage.IN_PROGRESS) },
  VALIDATION: { label: 'VALIDATION', className: 'status-validation', Icon: getTriageIcon(iconMap.triage.VALIDATION) },
  HOLD: { label: 'HOLD', className: 'status-hold', Icon: getTriageIcon(iconMap.triage.HOLD) },
  DONE: { label: 'DONE', className: 'status-done', Icon: getTriageIcon(iconMap.triage.DONE) },
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
  const [view, setView] = useState<View>('triage')
  const [query, setQuery] = useState('')
  const [filter, setFilter] = useState<TriageState | 'ALL'>('ALL')
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

  const portfolioProjects = useMemo(() => projects.filter((project) => matchesQuery(project, query)), [projects, query])

  const attentionProjects = useMemo(() => liveProjects.filter(({ attention }) => attention.length > 0), [liveProjects])

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
          <button className={view === 'triage' ? 'active' : ''} onClick={() => setView('triage')}><IconLayoutDashboard size={20}/> Triage</button>
          <button className={view === 'portfolio' ? 'active' : ''} onClick={() => setView('portfolio')}><IconFolderCode size={20}/> Portfolio</button>
          <button className={view === 'attention' ? 'active' : ''} onClick={() => setView('attention')}><IconAlertTriangle size={20}/> Attention</button>
          <button className={view === 'nodes' ? 'active' : ''} onClick={() => setView('nodes')}><IconRoute size={20}/> Nodes</button>
          <button disabled title="Будет реализовано в следующих checkpoint"><IconTargetArrow size={20}/> Roadmap</button>
          <button className={view === 'reports' ? 'active' : ''} onClick={() => setView('reports')}><IconListDetails size={20}/> Reports</button>
          <button disabled title="Настройки появятся позже"><IconSettings size={20}/> Settings</button>
        </nav>
        <div className="sidebar-note">
          <IconSparkles size={18}/>
          <span>CP-07 History & Reports</span>
        </div>
      </aside>

      <main className="main-content">
        <header className="page-header">
          <div>
            <p className="eyebrow">Operational portfolio</p>
            <h1>{view === 'triage' ? 'Triage' : view === 'portfolio' ? 'Portfolio' : view === 'attention' ? 'Attention' : view === 'nodes' ? 'Node View' : 'History & Reports'}</h1>
            <p>{view === 'nodes' ? 'Карта реальных связей проекта с evidence для каждого узла и ребра.' : view === 'reports' ? 'Проверяемая хронология checkpoint, state и blocker changes.' : 'Живой пульт проектов. Состояния обновляются из проверенного runtime snapshot без ручного редактирования карточек.'}</p>
          </div>
          {view !== 'nodes' && view !== 'reports' && <div className="header-actions">
            <div className={`sync-state ${error ? 'sync-error' : ''}`} role="status">
              <span>{error ? `Ошибка обновления: ${error}` : lastSuccessAt ? `Обновлено ${lastSuccessAt.toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' })}` : 'Загрузка live snapshot…'}</span>
              <button type="button" onClick={() => void refresh()} disabled={refreshState === 'REFRESHING'}>
                <IconRefresh size={17} className={refreshState === 'REFRESHING' ? 'spinning' : ''}/>
                {refreshState === 'REFRESHING' ? 'Обновление…' : 'Обновить'}
              </button>
            </div>
            <label className="search-box">
              <IconSearch size={19}/>
              <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Найти проект…" />
            </label>
          </div>}
        </header>

        {view !== 'nodes' && view !== 'reports' && <section className="summary-grid" aria-label="Сводка">
          <SummaryCard label="Активные" value={projects.filter(p => p.triageState !== null && p.triageState !== 'HOLD' && p.triageState !== 'DONE').length} detail="в рабочем портфеле" />
          <SummaryCard label="Требуют внимания" value={attentionProjects.length} detail="с объяснимой причиной" tone="critical" />
          <SummaryCard label="Можно запускать" value={counts.READY} detail="READY" tone="positive" />
          <SummaryCard label="На валидации" value={counts.VALIDATION} detail="VALIDATION" tone="validation" />
        </section>}

        {view === 'triage' && (
          <>
            <section className="triage-tabs" aria-label="Фильтр по готовности">
              <button className={filter === 'ALL' ? 'selected' : ''} onClick={() => setFilter('ALL')}>ALL <span>{projects.length}</span></button>
              {triageOrder.map((state) => {
                const meta = triageMeta[state]
                return <button key={state} className={`${filter === state ? 'selected' : ''} ${meta.className}`} onClick={() => setFilter(state)}>{meta.label} <span>{counts[state]}</span></button>
              })}
            </section>
            <ProjectGrid projects={visibleProjects} />
          </>
        )}

        {view === 'portfolio' && <ProjectGrid projects={portfolioProjects} />}

        {view === 'attention' && (
          <section className="attention-list">
            {attentionProjects.filter(({ project }) => matchesQuery(project, query)).map(({ project, effectiveTriageState, attention }) => (
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

        {view === 'nodes' && <NodeView graph={businessDiscoveryGraph}/>}
        {view === 'reports' && <ReportView history={dashboardHistory}/>}
      </main>
    </div>
  )
}

function SummaryCard({ label, value, detail, tone = 'neutral' }: { label: string; value: number; detail: string; tone?: string }) {
  return <article className={`summary-card ${tone}`}><span>{label}</span><strong>{value}</strong><small>{detail}</small></article>
}

function ProjectGrid({ projects }: { projects: ProjectState[] }) {
  if (!projects.length) return <div className="empty-state">Ничего не найдено по текущему фильтру.</div>
  return (
    <section className="project-grid">
      {projects.map((project) => <ProjectCard key={project.id} project={project}/>) }
    </section>
  )
}

function ProjectCard({ project }: { project: ProjectState }) {
  return (
    <article className="project-card">
      <div className="project-card-head">
        <div className="project-icon"><IconFolderCode size={22}/></div>
        <StatusBadge state={project.triageState} resolution={project.triageSource.status}/>
      </div>
      <div className="project-body">
        <h2>{project.name}</h2>
        <p>{project.summary}</p>
      </div>
      <dl className="project-meta">
        <div><dt>Текущий этап</dt><dd>{project.stage ?? 'Не определено источником'}</dd></div>
        <div><dt>Следующее действие</dt><dd>{project.nextAction ?? 'Не определено источником'}</dd></div>
      </dl>
      <div className="project-footer">
        <span><IconClock size={16}/> {project.source.id} · {new Intl.DateTimeFormat('ru-RU').format(new Date(`${project.lastUpdated}T00:00:00`))}</span>
        <button type="button" disabled title="Continue станет активным после Codex App Server experiment">Continue</button>
      </div>
    </article>
  )
}

function StatusBadge({ state, resolution = 'KNOWN' }: { state: TriageState | null; resolution?: 'KNOWN' | 'UNKNOWN' | 'CONFLICT' }) {
  if (state === null) {
    return <span className="status-badge status-hold"><IconAlertTriangle size={15}/>{resolution === 'CONFLICT' ? 'SOURCE CONFLICT' : 'STATUS UNKNOWN'}</span>
  }
  const meta = triageMeta[state]
  const Icon = meta.Icon
  return <span className={`status-badge ${meta.className}`}><Icon size={15}/>{meta.label}</span>
}

export default App

createRoot(document.getElementById('root')!).render(<App />)
