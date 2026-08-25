import type { InputHTMLAttributes, ReactNode } from 'react'
import { cx } from '../lib/cx'

export interface CheckboxProps extends Omit<InputHTMLAttributes<HTMLInputElement>, 'type'> {
  children: ReactNode
  /** Aligns the mark with the first line for multi-line labels. */
  alignStart?: boolean
}

/**
 * Industry styles choices on native inputs with a `.dot` sibling. The checkbox
 * variant squares the dot off; the radio keeps it round.
 */
export function Checkbox({ children, alignStart = false, className, ...rest }: CheckboxProps) {
  return (
    <label
      className={cx('radio', className)}
      style={alignStart ? { alignItems: 'flex-start' } : undefined}
    >
      <input type="checkbox" {...rest} />
      <span className="dot dot-square" style={alignStart ? { marginTop: 2 } : undefined} />
      <span>{children}</span>
    </label>
  )
}
