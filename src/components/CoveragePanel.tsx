// Default React import — required by tsx test runner's classic JSX transform.
import React, { useMemo } from 'react'
import {
  IconCheck,
  IconClock,
  IconDatabaseOff,
  IconFileUnknown,
  IconHistory,
  IconRadar,
  IconReportAnalytics,
  IconShieldCheck,
} from '@tabler/icons-react'
import type { ProjectState } from '../contract/project-state'
import { summarizeCoverage, type CoverageClassification, type ProjectCoverage } from '../monitoring/portfolio-coverage'
import { reportHash } from '../routing/hash-route'

const CLASS_LABELS: Record<CoverageClassification, string> = {
  CURRENT: 'Актуальные',
  STALE: 'Устаревшие',
  UNKNOWN: 'Статус неизвестен',
  UNAVAILABLE: 'Источник недоступен',
  FIXTURE: 'Fixture',
}

const CLASS_ICONS: Record<CoverageClassification, typeof IconCheck> = {
  CURRENT: IconCheck,
  STALE: IconClock,
  UNKNOWN: IconFileUnknown,
  UNAVAILABLE: IconDatabaseOff,
  FIXTURE: IconShieldCheck,
}

/**
 * CP-19 Portfolio Coverage & Data Quality diagnostics panel.
 *
 * Read-only: derives coverage from the same normalized ProjectState the rest of
 * the dashboard renders, so UI counts match `npm run verify:snapshot`.
 */
export function CoveragePanel({
  projects,
  onNavigate,
}: {
  projects: readonly ProjectState[]
  onNavigate: (hash: string) => void
}) {
  const { summary, items } = useMemo(() => {
    const registry = {
      schemaVersion: '1.2.0' as const,
      version: 0,
      updatedAt: '',
      projects: [...projects],
    }
    return summarizeCoverage(registry)
  }, [projects])

  const classes: CoverageClassification[] = ['CURRENT', 'STALE', 'UNKNOWN', 'UNAVAILABLE', 'FIXTURE']

  return (
    <section className="coverage-panel" aria-label="Покрытие источников портфеля">
      <div className="coverage-metrics" aria-label="Сводка покрытия">
        <div className="cov-total">
          <IconReport/>
          <div>
            <span>Всего проектов</span>
            <strong>{summary.total}</strong>
          </div>
        </div>
        {classes.map((cls) => {
          const Icon = CLASS_ICONS[cls]
          const value = summary[cls.toLowerCase() as keyof typeof summary] as number
          return (
            <div key={cls} className={`cov-card cov-${cls.toLowerCase()}`} role="group">
              <Icon size={18}/>
              <span>{CLASS_LABELS[cls]}</span>
              <strong>{value}</strong>
            </div>
          )
        })}
        <div className="cov-card cov-session" role="group">
          <IconRadar size={18}/>
          <span>Сессии Arena подтверждены</span>
          <strong>{summary.sessionKnown}/{summary.total}</strong>
        </div>
        <div className="cov-card cov-history" role="group">
          <IconHistory size={18}/>
          <span>История доступна</span>
          <strong>{summary.historyKnown}/{summary.total}</strong>
        </div>
      </div>

      <details className="coverage-details">
        <summary>Матрица покрытия по проектам ({summary.total})</summary>
        <table className="coverage-table" aria-label="Классификация источников по проектам">
          <thead>
            <tr>
              <th>Проект</th>
              <th>Источник</th>
              <th>Классификация</th>
              <th>Сессия</th>
              <th>История</th>
            </tr>
          </thead>
          <tbody>
            {items.map((item: ProjectCoverage) => {
              const ClassIcon = CLASS_ICONS[item.classification]
              return (
                <tr key={item.project.id} className={`cov-row-${item.classification.toLowerCase()}`}>
                  <td>
                    <a
                      href={reportHash(item.project.id)}
                      rel="noreferrer"
                      onClick={(event) => {
                        if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return
                        event.preventDefault()
                        onNavigate(reportHash(item.project.id))
                      }}
                    >
                      {item.project.name}
                    </a>
                    {item.reason ? <div className="coverage-reason" title={item.reason}>{item.reason}</div> : null}
                  </td>
                  <td className="coverage-source">{item.project.source.id}</td>
                  <td>
                    <span className={`coverage-badge cov-${item.classification.toLowerCase()}`}>
                      <ClassIcon size={13}/> {CLASS_LABELS[item.classification]}
                    </span>
                  </td>
                  <td>
                    <span className={`coverage-sub ${item.sessionCoverage === 'KNOWN' ? 'cov-known' : 'cov-unknown'}`}>
                      {item.sessionCoverage === 'KNOWN' ? 'подтверждена' : 'неизвестна'}
                    </span>
                  </td>
                  <td>
                    <span className={`coverage-sub ${item.historyCoverage === 'KNOWN' ? 'cov-known' : 'cov-unavail'}`}>
                      {item.historyCoverage === 'KNOWN' ? 'доступна' : 'недоступна'}
                    </span>
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </details>
    </section>
  )
}

function IconReport() {
  return <IconReportAnalytics size={18}/>
}
