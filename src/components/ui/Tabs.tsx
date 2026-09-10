export interface TabItem<T extends string> {
  id: T
  label: string
  count?: number
  /** Optional semantic dot colour (tabular state identity, never decoration). */
  dotColor?: string
}

export interface TabsProps<T extends string> {
  items: TabItem<T>[]
  value: T
  onChange: (id: T) => void
  ariaLabel: string
  className?: string
  /** id prefix used to link each tab with the panel it controls. */
  idPrefix?: string
  /** id of the controlled tabpanel. */
  controls?: string
}

/**
 * Tabs — underline tab bar. Active tab uses off-white text over a thin magenta
 * underline; inactive tabs are muted on a transparent background.
 */
export function Tabs<T extends string>({ items, value, onChange, ariaLabel, className = '', idPrefix, controls }: TabsProps<T>) {
  return (
    <div className={['fs-tabs', className].filter(Boolean).join(' ')} role="tablist" aria-label={ariaLabel}>
      {items.map((item) => (
        <button
          key={item.id}
          type="button"
          role="tab"
          id={idPrefix ? `${idPrefix}-${item.id}` : undefined}
          aria-controls={controls}
          aria-selected={value === item.id}
          onClick={() => onChange(item.id)}
        >
          {item.dotColor && <span className="fs-dot" style={{ '--dot-color': item.dotColor } as React.CSSProperties} />}
          <span>{item.label}</span>
          {item.count !== undefined && <span className="fs-tabs__count">{item.count}</span>}
        </button>
      ))}
    </div>
  )
}
