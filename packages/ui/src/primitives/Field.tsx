import type { ReactNode } from 'react'
import { cx } from '../lib/cx'

export interface FieldProps {
  label: ReactNode
  /** Rendered on the right of the label row — e.g. the "Forgot?" link. */
  labelAside?: ReactNode
  hint?: ReactNode
  htmlFor?: string
  className?: string
  children: ReactNode
}

/**
 * Label + control + optional hint. Wraps native inputs *and* non-native
 * controls (chip rows, segmented groups), which is why the label is rendered
 * as a `<label>` only when it points at a real control.
 */
export function Field({ label, labelAside, hint, htmlFor, className, children }: FieldProps) {
  const labelContent = labelAside ? (
    <span style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
      <span>{label}</span>
      {labelAside}
    </span>
  ) : (
    label
  )

  return (
    <div className={cx('field', className)}>
      {htmlFor ? (
        <label htmlFor={htmlFor}>{labelContent}</label>
      ) : (
        <span className="field-label">{labelContent}</span>
      )}
      {children}
      {hint ? (
        <p className="text-muted" style={{ fontSize: 12, margin: '6px 0 0' }}>
          {hint}
        </p>
      ) : null}
    </div>
  )
}
