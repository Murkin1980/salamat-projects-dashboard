import type { CSSProperties, ReactNode } from 'react'

export type BadgeTone = 'critical' | 'attention' | 'positive' | 'active' | 'muted' | 'outline'

export interface BadgeProps {
  children: ReactNode
  tone?: BadgeTone
  className?: string
  title?: string
  style?: CSSProperties
}

/**
 * Badge — compact status pill.
 * Contract: 3px 9px padding, 6px radius, 12px / 600, 1px border.
 * It is never a large filled button; the filled magenta treatment belongs to
 * Button variant="primary" only.
 */
export function Badge({ children, tone = 'muted', className = '', title, style }: BadgeProps) {
  return (
    <span className={['fs-badge', `fs-badge--${tone}`, className].filter(Boolean).join(' ')} title={title} style={style}>
      {children}
    </span>
  )
}

/** Small semantic dot used inside tabs, lists and graph nodes. */
export function StatusDot({ color, label }: { color: string; label?: string }) {
  return <span className="fs-dot" style={{ '--dot-color': color } as CSSProperties} aria-hidden={!label} title={label} />
}

export const toneColor: Record<BadgeTone, string> = {
  critical: 'var(--fs-primary-fg)',
  attention: 'var(--fs-warning)',
  positive: 'var(--fs-success)',
  active: 'var(--fs-info-fg)',
  muted: 'var(--fs-text-muted)',
  outline: 'var(--fs-text-secondary)',
}
