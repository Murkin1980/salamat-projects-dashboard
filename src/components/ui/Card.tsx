import type { CSSProperties, HTMLAttributes, ReactNode } from 'react'

type CardTag = 'div' | 'article' | 'section' | 'li' | 'aside'

export interface CardProps extends Omit<HTMLAttributes<HTMLElement>, 'children'> {
  children: ReactNode
  as?: CardTag
  className?: string
  id?: string
  ariaLabel?: string
  /** Marks the card as the currently inspected entity. */
  selected?: boolean
  /** Enables the theme hover treatment (border change + 1px lift, no glow). */
  interactive?: boolean
}

/**
 * Card — the single surface primitive of the theme.
 * Previously duplicated as `.project-card`, `.summary-card`, `.attention-row`
 * and `.report-metrics article`; those rules now inherit the shared treatment.
 */
export function Card({
  children,
  as: Tag = 'div',
  className = '',
  id,
  ariaLabel,
  selected = false,
  interactive = false,
  ...rest
}: CardProps) {
  const classes = [
    'fs-card',
    interactive ? 'fs-card--interactive' : '',
    selected ? 'fs-card--selected' : '',
    className,
  ]
    .filter(Boolean)
    .join(' ')

  return (
    <Tag id={id} className={classes} aria-label={ariaLabel} data-selected={selected ? 'true' : undefined} {...rest}>
      {children}
    </Tag>
  )
}

/** Nested block: detail rows, metric cells, secondary panels. */
export function Block({
  children,
  as: Tag = 'div',
  className = '',
  style,
}: {
  children: ReactNode
  as?: CardTag
  className?: string
  style?: CSSProperties
}) {
  return (
    <Tag className={['fs-block', className].filter(Boolean).join(' ')} style={style}>
      {children}
    </Tag>
  )
}

/** Panel — a surface that owns a full section (workspace, dock, strip). */
export function Panel({
  children,
  as: Tag = 'section',
  className = '',
  ariaLabel,
}: {
  children: ReactNode
  as?: CardTag
  className?: string
  ariaLabel?: string
}) {
  return (
    <Tag className={['fs-panel', className].filter(Boolean).join(' ')} aria-label={ariaLabel}>
      {children}
    </Tag>
  )
}
