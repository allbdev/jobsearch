import { forwardRef, type SelectHTMLAttributes } from 'react'
import { cx } from '../lib/cx'

export interface SelectOption {
  value: string
  label: string
}

export interface SelectProps extends Omit<SelectHTMLAttributes<HTMLSelectElement>, 'children'> {
  options: readonly SelectOption[]
}

/**
 * Options are data, not markup — every `<select>` in the design is a list of
 * strings, so passing them as JSX would just re-create the duplication.
 */
export const Select = forwardRef<HTMLSelectElement, SelectProps>(function Select(
  { options, className, ...rest },
  ref,
) {
  return (
    <select ref={ref} className={cx('input', className)} {...rest}>
      {options.map((option) => (
        <option key={option.value} value={option.value}>
          {option.label}
        </option>
      ))}
    </select>
  )
})

/** Builds options from plain strings, where value and label are the same. */
export function toOptions(values: readonly string[]): SelectOption[] {
  return values.map((value) => ({ value, label: value }))
}
