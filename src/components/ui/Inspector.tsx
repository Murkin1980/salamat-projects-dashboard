import type { ReactNode } from 'react'
import { IconExternalLink } from '@tabler/icons-react'

export interface InspectorProps {
  children: ReactNode
  /** Small uppercase line above the title. */
  eyebrow?: ReactNode
  title: ReactNode
  subtitle?: ReactNode
  /** Header action slot (badges, close button). */
  action?: ReactNode
  /** Sticky bottom action row (primary action of the inspected entity). */
  footer?: ReactNode
  className?: string
}

/**
 * Inspector — the working panel of the control center.
 * It is a docked surface (never a modal website card): plain background,
 * hairline borders, sectioned content.
 */
export function Inspector({ children, eyebrow, title, subtitle, action, footer, className = '' }: InspectorProps) {
  return (
    <div className={['fs-inspector', className].filter(Boolean).join(' ')}>
      <div className="fs-inspector__head">
        <div style={{ minWidth: 0 }}>
          {eyebrow && <p className="fs-label">{eyebrow}</p>}
          <h2>{title}</h2>
          {subtitle && <p className="fs-inspector__subtitle">{subtitle}</p>}
        </div>
        {action}
      </div>
      <div className="fs-inspector__body">{children}</div>
      {footer && <div className="fs-inspector__foot">{footer}</div>}
    </div>
  )
}

export function InspectorSection({
  title,
  children,
  action,
}: {
  title: ReactNode
  children: ReactNode
  action?: ReactNode
}) {
  return (
    <section className="fs-inspector__section">
      <h3>{title}</h3>
      {action}
      {children}
    </section>
  )
}

export function InspectorFacts({ items }: { items: { label: string; value: ReactNode }[] }) {
  return (
    <dl className="fs-inspector__facts">
      {items.map((item) => (
        <div key={item.label} className="fs-inspector__fact">
          <dt>{item.label}</dt>
          <dd>{item.value}</dd>
        </div>
      ))}
    </dl>
  )
}

export interface EvidenceItem {
  label: string
  url: string
  sourceId: string
}

/** Evidence panel — dedicated dark bordered surface. Renders nothing fake. */
export function EvidencePanel({ items, emptyLabel = 'Источник не публикует evidence.' }: { items: EvidenceItem[]; emptyLabel?: string }) {
  if (!items.length) {
    return (
      <div className="fs-evidence">
        <p className="fs-evidence__empty">{emptyLabel}</p>
      </div>
    )
  }

  return (
    <div className="fs-evidence">
      {items.map((item) => (
        <a key={`${item.label}:${item.sourceId}`} className="fs-evidence__item" href={item.url} target="_blank" rel="noreferrer">
          <span className="fs-dot" style={{ '--dot-color': 'var(--fs-info-fg)' } as React.CSSProperties} />
          <span style={{ minWidth: 0 }}>
            <span className="fs-evidence__label">{item.label}</span>
            <span className="fs-evidence__source">{item.sourceId}</span>
          </span>
          <IconExternalLink size={15} />
        </a>
      ))}
    </div>
  )
}
