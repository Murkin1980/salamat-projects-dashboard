import { useMemo, useState } from 'react'
import { createRoot } from 'react-dom/client'
import {
  IconAlertTriangle,
  IconClock,
  IconFolderCode,
  IconLayoutDashboard,
  IconListDetails,
  IconRefresh,
  IconRoute,
  IconSearch,
  IconSettings,
  IconSparkles,
  IconTargetArrow,
} from '@tabler/icons-react'
import projectRegistry from '../config/projects.github.json'
import nodeGraphRegistry from '../config/node-graphs.json'
import historyRegistry from '../config/project-history.json'
import { NodeView } from './components/NodeView'
import { ProjectCard } from './components/ProjectCard'
import { ProjectInspector } from './components/ProjectInspector'
import { ReportView } from './components/ReportView'
import { StatusBadge, triageDotColor, triageMeta } from './components/StatusBadge'
import { TaskPacketModal } from './components/TaskPacketModal'
import { Tabs, type TabItem } from './components/ui'
import { parseProjectRegistry, type ProjectState, type TriageState } from './contract/project-state'
import { isProjectAllowed, isRepositoryAllowed } from './contract/task-packet'
import { useLiveRegistry } from './hooks/use-live-registry'
import { deriveLiveProjectState, type AttentionSignal } from './triage/live-triage'
import { parseNodeGraphRegistry } from './graph/node-graph'
import { parseHistoryRegistry } from './history/project-history'
import './styles.css'

type View = 'triage' | 'portfolio' | 'attention' | 'nodes' | 'reports'

const initialRegistry = parseProjectRegistry(projectRegistry)
const businessDiscoveryGraph = parseNodeGraphRegistry(nodeGraphRegistry).graphs.find((graph) => graph.id === 'business-discovery')!
const dashboardHistory = parseHistoryRegistry(historyRegistry).projects.find((history) => history.projectId === 'salamat-projects-dashboard')!
const triageOrder: TriageState[] = ['ACTION_NOW', 'BLOCKED', 'READY', 'IN_PROGRESS', 'VALIDATION', 'HOLD', 'DONE']

function matchesQuery(project: ProjectState, query: string) {
  const normalized = query.trim().toLowerCase()
  if (!normalized) return true
  return [project.name, project.summary, project.stage ?? '', project.nextAction ?? '']
    .join(' ')
    .toLowerCase()
    .includes(normalized)
}

/**
 * Presentation-only gate derived from the existing CP-09 allowlist rules.
 * The rules themselves live in contract/task-packet.ts and are untouched.
 */
function continueGate(project: ProjectState): { allowed: boolean; title: string } {
  const isAllowed = isProjectAllowed(project.id) && isRepositoryAllowed(project.repo)
  if (!isAllowed) {
    return { allowed: false, title: 'Эксперимент CP-09 ограничен allowlist (только salamat-projects-dashboard)' }
  }
  if (project.triageState === 'BLOCKED') return { allowed: false, title: 'Заблокировано: проект имеет активный блокер' }
  if (project.triageState === null) return { allowed: false, title: 'Состояние не определено источником' }
  return { allowed: true, title: 'Сформировать и экспортировать Task Packet (CP-09 Baseline)' }
}

function App() {
  const [view, setView] = useState<View>('triage')
  const [query, setQuery] = useState('')
  const [filter, setFilter] = useState<TriageState | 'ALL'>('ALL')
  const [activeTaskProject, setActiveTaskProject] = useState<ProjectState | null>(null)
  const [selectedProjectId, setSelectedProjectId] = useState<string | null>(initialRegistry.projects[0]?.id ?? null)
  const [inspectorOpen, setInspectorOpen] = useState(false)
  const { registry, refresh, refreshState, error, lastSuccessAt } = useLiveRegistry(initialRegistry)
  const liveProjects = useMemo(
    () => registry.projects.map((project) => deriveLiveProjectState(project, new Date())),
    [registry],
  )
  const projects = useMemo(
    () => liveProjects.map(({ project, effectiveTriageState }) => ({ ...project, triageState: effectiveTriageState })),
    [liveProjects],
  )

  const attentionById = useMemo(
    () => new Map(liveProjects.map(({ project, attention }) => [project.id, attention] as const)),
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

  const selectedProject = useMemo(
    () => projects.find((project) => project.id === selectedProjectId) ?? null,
    [projects, selectedProjectId],
  )
  const selectedAttention: AttentionSignal[] = selectedProject ? attentionById.get(selectedProject.id) ?? [] : []

  function selectProject(projectId: string) {
    setSelectedProjectId(projectId)
    setInspectorOpen(true)
  }

  const filterTabs: TabItem<TriageState | 'ALL'>[] = [
    { id: 'ALL', label: 'ALL', count: projects.length },
    ...triageOrder.map((state) => ({
      id: state,
      label: triageMeta[state].label,
      count: counts[state],
      dotColor: triageDotColor(state),
    })),
  ]

  const overviewVisible = view !== 'nodes' && view !== 'reports'
  const inspectorHosted = view === 'triage' || view === 'portfolio' || view === 'attention'

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
          <span>CP-09 Codex App Server Experiment</span>
        </div>
      </aside>

      <main className="main-content">
        <header className="page-header">
          <div>
            <p className="eyebrow">Operational portfolio</p>
            <h1>{view === 'triage' ? 'Triage' : view === 'portfolio' ? 'Portfolio' : view === 'attention' ? 'Attention' : view === 'nodes' ? 'Node View' : 'History & Reports'}</h1>
            <p>{view === 'nodes' ? 'Карта реальных связей проекта с evidence для каждого узла и ребра.' : view === 'reports' ? 'Проверяемая хронология checkpoint, state и blocker changes.' : 'Живой пульт проектов. Состояния обновляются из проверенного runtime snapshot без ручного редактирования карточек.'}</p>
          </div>
          {overviewVisible && <div className="header-actions">
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

        {overviewVisible && <section className="summary-grid" aria-label="Сводка">
          <SummaryCard label="Активные" value={projects.filter(p => p.triageState !== null && p.triageState !== 'HOLD' && p.triageState !== 'DONE').length} detail="в рабочем портфеле" />
          <SummaryCard label="Требуют внимания" value={attentionProjects.length} detail="с объяснимой причиной" tone="critical" />
          <SummaryCard label="Можно запускать" value={counts.READY} detail="READY" tone="positive" />
          <SummaryCard label="На валидации" value={counts.VALIDATION} detail="VALIDATION" tone="validation" />
        </section>}

        {inspectorHosted && (
          <div className="control-columns">
            <div className="control-columns__main">
              {view === 'triage' && (
                <Tabs
                  items={filterTabs}
                  value={filter}
                  onChange={setFilter}
                  ariaLabel="Фильтр по готовности"
                  idPrefix="triage-tab"
                  controls="project-panel"
                />
              )}

              {view !== 'attention' ? (
                <div id="project-panel" role="tabpanel" aria-labelledby={`triage-tab-${filter}`}>
                  <ProjectGrid
                    projects={view === 'triage' ? visibleProjects : portfolioProjects}
                    attentionById={attentionById}
                    selectedProjectId={selectedProjectId}
                    onSelect={selectProject}
                    onOpenTaskPacket={setActiveTaskProject}
                  />
                </div>
              ) : (
                <section className="attention-list" aria-label="Проекты, требующие внимания">
                  {attentionProjects.filter(({ project }) => matchesQuery(project, query)).map(({ project, effectiveTriageState, attention }) => (
                    <button
                      type="button"
                      key={project.id}
                      className={`attention-row ${selectedProjectId === project.id ? 'is-selected' : ''}`}
                      onClick={() => selectProject(project.id)}
                    >
                      <StatusBadge state={effectiveTriageState} resolution={project.triageSource.status}/>
                      <div>
                        <strong>{project.name}</strong>
                        <p>{attention.map((signal) => signal.label).join(' · ')}</p>
                        <small>Источник: {attention.map((signal) => signal.sourceId).join(' · ')}</small>
                      </div>
                      <span className="attention-stage">{attention.map((signal) => signal.kind.replaceAll('_', ' ')).join(' / ')}</span>
                    </button>
                  ))}
                </section>
              )}
            </div>

            <div className={`inspector-dock ${inspectorOpen ? 'is-open' : ''}`}>
              <ProjectInspector
                project={selectedProject}
                attention={selectedAttention}
                canContinue={selectedProject ? continueGate(selectedProject).allowed : false}
                continueTitle={selectedProject ? continueGate(selectedProject).title : 'Проект не выбран'}
                onOpenTaskPacket={setActiveTaskProject}
                onClose={() => setInspectorOpen(false)}
              />
            </div>
          </div>
        )}

        {view === 'nodes' && <NodeView graph={businessDiscoveryGraph}/>}
        {view === 'reports' && <ReportView history={dashboardHistory}/>}

        {activeTaskProject && (
          <TaskPacketModal
            project={activeTaskProject}
            onClose={() => setActiveTaskProject(null)}
          />
        )}
      </main>
    </div>
  )
}

function SummaryCard({ label, value, detail, tone = 'neutral' }: { label: string; value: number; detail: string; tone?: string }) {
  return <article className={`summary-card ${tone}`}><span>{label}</span><strong>{value}</strong><small>{detail}</small></article>
}

function ProjectGrid({
  projects,
  attentionById,
  selectedProjectId,
  onSelect,
  onOpenTaskPacket,
}: {
  projects: ProjectState[]
  attentionById: Map<string, AttentionSignal[]>
  selectedProjectId: string | null
  onSelect: (projectId: string) => void
  onOpenTaskPacket: (project: ProjectState) => void
}) {
  if (!projects.length) return <div className="empty-state">Ничего не найдено по текущему фильтру.</div>
  return (
    <section className="project-grid">
      {projects.map((project) => {
        const gate = continueGate(project)
        return (
          <ProjectCard
            key={project.id}
            project={project}
            attention={attentionById.get(project.id) ?? []}
            selected={selectedProjectId === project.id}
            canContinue={gate.allowed}
            continueTitle={gate.title}
            onSelect={onSelect}
            onOpenTaskPacket={onOpenTaskPacket}
          />
        )
      })}
    </section>
  )
}

export default App

createRoot(document.getElementById('root')!).render(<App />)
