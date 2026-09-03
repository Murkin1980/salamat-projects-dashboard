import { useEffect, useMemo, useState } from 'react'
import {
  IconAlertTriangle,
  IconCheck,
  IconClipboard,
  IconClock,
  IconDownload,
  IconExternalLink,
  IconFolderCode,
  IconLock,
  IconShieldCheck,
  IconX,
} from '@tabler/icons-react'
import { type ProjectState } from '../contract/project-state.js'
import {
  buildBaselineTaskPacket,
  isProjectAllowed,
  isRepositoryAllowed,
  serializeTaskPacket,
  type TaskPacket,
} from '../contract/task-packet.js'

interface TaskPacketModalProps {
  project: ProjectState
  onClose: () => void
}

export function TaskPacketModal({ project, onClose }: TaskPacketModalProps) {
  const [copied, setCopied] = useState(false)

  // Handle ESC key to cancel/close
  useEffect(() => {
    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') {
        onClose()
      }
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [onClose])

  const isAllowed = isProjectAllowed(project.id) && isRepositoryAllowed(project.repo)

  const { packet, error }: { packet: TaskPacket | null; error: string | null } = useMemo(() => {
    if (!isAllowed) {
      return {
        packet: null,
        error: `Project ${project.name} (${project.repo ?? 'no repo'}) is not allowlisted for CP-09 Codex App Server Experiment. Allowlist permits only Murkin1980/salamat-projects-dashboard.`,
      }
    }
    if (project.triageState === 'BLOCKED') {
      return {
        packet: null,
        error: `Cannot generate Task Packet: Project is BLOCKED by "${project.blocker}".`,
      }
    }
    try {
      const generated = buildBaselineTaskPacket(project)
      return { packet: generated, error: null }
    } catch (err) {
      return {
        packet: null,
        error: err instanceof Error ? err.message : 'Failed to generate task packet',
      }
    }
  }, [project, isAllowed])

  const jsonString = useMemo(() => {
    return packet ? serializeTaskPacket(packet) : ''
  }, [packet])

  function handleCopy() {
    if (!jsonString) return
    navigator.clipboard.writeText(jsonString).then(() => {
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    }).catch(() => {
      // Fallback
      setCopied(false)
    })
  }

  function handleDownload() {
    if (!jsonString || !packet) return
    const blob = new Blob([jsonString], { type: 'application/json;charset=utf-8' })
    const url = URL.createObjectURL(blob)
    const anchor = document.createElement('a')
    anchor.href = url
    anchor.download = `${packet.taskId}.json`
    document.body.appendChild(anchor)
    anchor.click()
    document.body.removeChild(anchor)
    URL.revokeObjectURL(url)
  }

  return (
    <div className="modal-backdrop" onClick={onClose} role="dialog" aria-modal="true" aria-labelledby="modal-title">
      <div className="task-packet-modal" onClick={(e) => e.stopPropagation()}>
        <header className="modal-header">
          <div className="modal-header-text">
            <div className="modal-tag">
              <IconShieldCheck size={16} />
              <span>CP-09 Baseline Task Packet</span>
            </div>
            <h2 id="modal-title">{project.name}</h2>
            <p>Экспорт стандартизированного пакета задачи для Codex App Server в строгой Zod-схеме (read-only).</p>
          </div>
          <button type="button" className="modal-close-btn" onClick={onClose} aria-label="Закрыть окно">
            <IconX size={20} />
          </button>
        </header>

        <div className="modal-body">
          {error && (
            <div className="task-packet-error" role="alert">
              <IconAlertTriangle size={20} />
              <div>
                <strong>Ограничение безопасности / Ошибка</strong>
                <p>{error}</p>
              </div>
            </div>
          )}

          {packet && (
            <>
              <div className="task-packet-meta-grid">
                <div className="meta-item">
                  <span className="meta-label">Репозиторий</span>
                  <span className="meta-value repo-badge">
                    <IconFolderCode size={16} /> {packet.repo}
                  </span>
                </div>
                <div className="meta-item">
                  <span className="meta-label">Checkpoint</span>
                  <span className="meta-value">{packet.checkpoint}</span>
                </div>
                <div className="meta-item">
                  <span className="meta-label">Triage State</span>
                  <span className="meta-value status-badge status-ready">{packet.triageState}</span>
                </div>
                <div className="meta-item">
                  <span className="meta-label">ID задачи</span>
                  <span className="meta-value code-font">{packet.taskId}</span>
                </div>
              </div>

              <div className="task-packet-section">
                <h3>Objective (Цель)</h3>
                <p className="section-content">{packet.objective}</p>
              </div>

              <div className="task-packet-section">
                <h3>Next Action (Следующее действие)</h3>
                <p className="section-content">{packet.nextAction}</p>
              </div>

              <div className="task-packet-scope-grid">
                <div className="scope-box scope-included">
                  <h4>Входит в scope (Included)</h4>
                  <ul>
                    {packet.scope.included.map((item, idx) => (
                      <li key={idx}><IconCheck size={14} /> {item}</li>
                    ))}
                  </ul>
                </div>
                <div className="scope-box scope-excluded">
                  <h4>Исключено из scope (Excluded)</h4>
                  <ul>
                    {packet.scope.excluded.map((item, idx) => (
                      <li key={idx}><IconLock size={14} /> {item}</li>
                    ))}
                  </ul>
                </div>
              </div>

              <div className="task-packet-section">
                <h3>Acceptance Criteria (Критерии приёмки)</h3>
                <ul className="criteria-list">
                  {packet.acceptanceCriteria.map((item, idx) => (
                    <li key={idx}>
                      <span className="criteria-num">{idx + 1}</span>
                      <span>{item}</span>
                    </li>
                  ))}
                </ul>
              </div>

              <div className="task-packet-section">
                <h3>Evidence Reference</h3>
                <div className="evidence-ref-box">
                  <a href={packet.evidenceRef.url} target="_blank" rel="noreferrer">
                    <IconExternalLink size={15} /> {packet.evidenceRef.url}
                  </a>
                  <code>{packet.evidenceRef.sourceId}</code>
                </div>
              </div>

              <div className="task-packet-section">
                <div className="json-preview-header">
                  <h3>Raw JSON Payload (Schema v{packet.schemaVersion})</h3>
                  <small><IconClock size={14} /> {packet.createdAt}</small>
                </div>
                <pre className="json-code-block">
                  <code>{jsonString}</code>
                </pre>
              </div>
            </>
          )}

          <div className="security-notice">
            <IconLock size={16} />
            <span>
              <strong>Read-only инвариант:</strong> Dashboard не выполняет задачи, не запускает фоновые процессы и не отправляет запросы в turn/start. Пакет задачи формируется исключительно для локального использования оператором.
            </span>
          </div>
        </div>

        <footer className="modal-footer">
          <button type="button" className="btn btn-secondary" onClick={onClose}>
            Отмена / Закрыть
          </button>
          {packet && (
            <>
              <button type="button" className="btn btn-secondary" onClick={handleCopy}>
                {copied ? <IconCheck size={16} /> : <IconClipboard size={16} />}
                {copied ? 'Скопировано!' : 'Копировать JSON'}
              </button>
              <button type="button" className="btn btn-primary" onClick={handleDownload}>
                <IconDownload size={16} />
                Экспорт JSON
              </button>
            </>
          )}
        </footer>
      </div>
    </div>
  )
}
