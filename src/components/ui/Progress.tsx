import type { ReactNode } from 'react'

export type ProgressTone = 'positive' | 'attention' | 'critical' | 'active' | 'muted'

export interface ProgressProps {
  completed: number
  total: number
  tone?: ProgressTone
  label?: ReactNode
  showValue?: boolean
  ariaLabel?: string
}

/** Bounded ratio shared by the progress primitive and the project contract. */
export interface ProgressValue {
  completed: number
  total: number
}

const TONE_CLASS: Record<ProgressTone, string> = {
  positive: 'fs-progress--positive',
  attention: 'fs-progress--attention',
  critical: 'fs-progress--critical',
  active: 'fs-progress--active',
  muted: 'fs-progress--muted',
}

/**
 * Progress — 7px track, solid semantic fill, no gradients.
 * Renders nothing when the ratio is unusable so the dashboard never invents a
 * number for a source that does not publish one.
 */
export function Progress({ completed, total, tone = 'active', label, showValue = true, ariaLabel }: ProgressProps) {
  if (!(total > 0) || completed < 0) return null
  const percent = Math.max(0, Math.min(100, Math.round((completed / total) * 100)))

  return (
    <div className={`fs-progress ${TONE_CLASS[tone]}`}>
      {(label || showValue) && (
        <div className="fs-progress__head">
          {label ? <span className="fs-label">{label}</span> : <span />}
          {showValue && <span className="fs-progress__value">{percent}%</span>}
        </div>
      )}
      <div
        className="fs-progress__track"
        role="progressbar"
        aria-valuenow={percent}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-label={ariaLabel ?? 'Прогресс'}
      >
        <div className="fs-progress__fill" style={{ width: `${percent}%` }} />
      </div>
    </div>
  )
}

/** Convenience wrapper for the nullable `progress` field of ProjectState. */
export function SourceProgress({ progress, tone, label }: { progress: ProgressValue | null; tone?: ProgressTone; label?: ReactNode }) {
  if (!progress) return null
  return <Progress completed={progress.completed} total={progress.total} tone={tone} label={label} />
}
