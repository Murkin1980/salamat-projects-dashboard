import { useMemo, useState } from 'react'
import {
  IconAlertTriangle,
  IconBolt,
  IconCheck,
  IconCircleCheck,
  IconClock,
  IconFolderCode,
  IconLayoutDashboard,
  IconListDetails,
  IconPlayerPause,
  IconPlayerPlay,
  IconSearch,
  IconSettings,
  IconSparkles,
  IconTargetArrow,
  IconTestPipe,
} from '@tabler/icons-react'
import projectRegistry from '../config/projects.json'
import './styles.css'

type TriageState = 'ACTION_NOW' | 'BLOCKED' | 'READY' | 'IN_PROGRESS' | 'VALIDATION' | 'HOLD' | 'DONE'
type View = 'triage' | 'portfolio' | 'attention'

type Project = {
  id: string
  name: string
  triage: TriageState
  summary: string
  currentStage?: string
  nextAction: string
}

const projects = projectRegistry.projects as Project[]

const triageMeta: Record<TriageState, { label: string; className: string; Icon: typeof IconBolt }> = {
  ACTION_NOW: { label: 'ACTION NOW', className: 'status-action', Icon: IconBolt },
  BLOCKED: { label: 'BLOCKED', className: 'status-blocked', Icon: IconAlertTriangle },
  READY: { label: 'READY', className: 'status-ready', Icon: IconCircleCheck },
  IN_PROGRESS: { label: 'IN PROGRESS', className: 'status-progress', Icon: IconPlayerPlay },
  VALIDATION: { label: 'VALIDATION', className: 'status-validation', Icon: IconTestPipe },
  HOLD: { label: 'HOLD', className: 'status-hold', Icon: IconPlayerPause },
  DONE: { label: 'DONE', className: 'status-done', Icon: IconCheck },
}

const triageOrder: TriageState[] = ['ACTION_NOW', 'BLOCKED', 'READY', 'IN_PROGRESS', 'VALIDATION', 'HOLD', 'DONE']

function App() {
  const [view, setView] = useState<View>('triage')
  const [query, setQuery] = useState('')
  const [filter, setFilter] = useState<TriageState | 'ALL'>('ALL')

  const counts = useMemo(() => {
    const base = Object.fromEntries(triageOrder.map((state) => [state, 0])) as Record<TriageState, number>
    projects.forEach((project) => { base[project.triage] += 1 })
    return base
  }, [])

  const visibleProjects = useMemo(() => {
    const normalized = query.trim().toLowerCase()
    return projects.filter((project) => {
      if (filter !== 'ALL' && project.triage !== filter) return false
      if (!normalized) return true
      return [project.name, project.summary, project.currentStage ?? '', project.nextAction]
        .join(' ')
        .toLowerCase()
        .includes(normalized)
    })
  }, [filter, query])

  const attentionProjects = useMemo(
    () => projects.filter((project) => ['ACTION_NOW', 'BLOCKED', 'VALIDATION'].includes(project.triage)),
    [],
  )

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
          <button disabled title="Будет реализовано в следующих checkpoint"><IconTargetArrow size={20}/> Roadmap</button>
          <button disabled title="Будет реализовано в CP-07"><IconListDetails size={20}/> Reports</button>
          <button disabled title="Настройки появятся позже"><IconSettings size={20}/> Settings</button>
        </nav>
        <div className="sidebar-note">
          <IconSparkles size={18}/>
          <span>CP-02 Static Triage Shell</span>
        </div>
      </aside>

      <main className="main-content">
        <header className="page-header">
          <div>
            <p className="eyebrow">Operational portfolio</p>
            <h1>{view === 'triage' ? 'Triage' : view === 'portfolio' ? 'Portfolio' : 'Attention'}</h1>
            <p>Живой пульт проектов. Сейчас данные читаются из локального registry; live GitHub подключится на CP-04/05.</p>
          </div>
          <label className="search-box">
            <IconSearch size={19}/>
            <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Найти проект…" />
          </label>
        </header>

        <section className="summary-grid" aria-label="Сводка">
          <SummaryCard label="Активные" value={projects.filter(p => p.triage !== 'HOLD' && p.triage !== 'DONE').length} detail="в рабочем портфеле" />
          <SummaryCard label="Требуют внимания" value={counts.ACTION_NOW + counts.BLOCKED} detail="action / blocked" tone="critical" />
          <SummaryCard label="Можно запускать" value={counts.READY} detail="READY" tone="positive" />
          <SummaryCard label="На валидации" value={counts.VALIDATION} detail="VALIDATION" tone="validation" />
        </section>

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

        {view === 'portfolio' && <ProjectGrid projects={visibleProjects} />}

        {view === 'attention' && (
          <section className="attention-list">
            {attentionProjects.filter(project => !query || project.name.toLowerCase().includes(query.toLowerCase())).map((project) => (
              <article key={project.id} className="attention-row">
                <StatusBadge state={project.triage}/>
                <div>
                  <strong>{project.name}</strong>
                  <p>{project.nextAction}</p>
                </div>
                <span className="attention-stage">{project.currentStage ?? 'Stage not normalized yet'}</span>
              </article>
            ))}
          </section>
        )}
      </main>
    </div>
  )
}

function SummaryCard({ label, value, detail, tone = 'neutral' }: { label: string; value: number; detail: string; tone?: string }) {
  return <article className={`summary-card ${tone}`}><span>{label}</span><strong>{value}</strong><small>{detail}</small></article>
}

function ProjectGrid({ projects }: { projects: Project[] }) {
  if (!projects.length) return <div className="empty-state">Ничего не найдено по текущему фильтру.</div>
  return (
    <section className="project-grid">
      {projects.map((project) => <ProjectCard key={project.id} project={project}/>) }
    </section>
  )
}

function ProjectCard({ project }: { project: Project }) {
  return (
    <article className="project-card">
      <div className="project-card-head">
        <div className="project-icon"><IconFolderCode size={22}/></div>
        <StatusBadge state={project.triage}/>
      </div>
      <div className="project-body">
        <h2>{project.name}</h2>
        <p>{project.summary}</p>
      </div>
      <dl className="project-meta">
        <div><dt>Текущий этап</dt><dd>{project.currentStage ?? 'Будет нормализован на CP-03'}</dd></div>
        <div><dt>Следующее действие</dt><dd>{project.nextAction}</dd></div>
      </dl>
      <div className="project-footer">
        <span><IconClock size={16}/> Registry 26.08.2026</span>
        <button type="button" disabled title="Continue станет активным после Codex App Server experiment">Continue</button>
      </div>
    </article>
  )
}

function StatusBadge({ state }: { state: TriageState }) {
  const meta = triageMeta[state]
  const Icon = meta.Icon
  return <span className={`status-badge ${meta.className}`}><Icon size={15}/>{meta.label}</span>
}

export default App
