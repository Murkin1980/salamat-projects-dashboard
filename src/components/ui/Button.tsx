import type { ButtonHTMLAttributes } from 'react'

export type ButtonVariant = 'primary' | 'secondary' | 'danger' | 'ghost'

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant
  block?: boolean
}

/**
 * Button — primary is the only magenta fill in the interface,
 * secondary is transparent with a hairline border, danger is outlined magenta
 * so destructive actions never read as the default action.
 */
export function Button({ variant = 'secondary', block = false, className = '', type = 'button', ...rest }: ButtonProps) {
  const classes = ['fs-btn', `fs-btn--${variant}`, block ? 'fs-btn--block' : '', className].filter(Boolean).join(' ')
  return <button type={type} className={classes} {...rest} />
}
