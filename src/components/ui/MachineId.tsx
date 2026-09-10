export interface MachineIdProps {
  value: string
  /** 0 = keep full value and let CSS ellipsis handle overflow. */
  cut?: number
  className?: string
}

/**
 * MachineId — commit SHAs, source ids, task ids, repo slugs.
 * Monospace, visually truncatable, but the full value always stays available
 * through the tooltip and the data attribute (mobile requirement).
 */
export function MachineId({ value, cut = 0, className = '' }: MachineIdProps) {
  const display = cut > 0 && value.length > cut + 5 ? `${value.slice(0, cut)}…${value.slice(-4)}` : value
  return (
    <span className={['fs-machine-id', className].filter(Boolean).join(' ')} title={value} data-full-id={value}>
      {display}
    </span>
  )
}
