'use client'

import { cx } from '../lib/cx'

export interface SegmentedOption<T extends string> {
  value: T
  label: string
}

export interface SegmentedControlProps<T extends string> {
  options: readonly SegmentedOption<T>[]
  value: T
  onChange: (value: T) => void
  /** Stretch each option to fill the track — used by the Login mode switch. */
  fill?: boolean
  ariaLabel?: string
  className?: string
}

/**
 * One controlled segmented control for every use in the app.
 *
 * The design expresses this three different ways — a radio-input `.seg` (Feed
 * sort, Profile seniority, digest cadence) and two hand-rolled button `.seg`
 * variants that recompute `background`/`color` inline (Login mode switch,
 * Profile history tabs). All five collapse into this one component.
 */
export function SegmentedControl<T extends string>({
  options,
  value,
  onChange,
  fill = false,
  ariaLabel,
  className,
}: SegmentedControlProps<T>) {
  return (
    <div
      className={cx('seg', className)}
      role="radiogroup"
      aria-label={ariaLabel}
      style={fill ? { display: 'flex', width: '100%' } : undefined}
    >
      {options.map((option) => {
        const selected = option.value === value
        return (
          <label
            key={option.value}
            className="seg-opt"
            style={fill ? { flex: 1, justifyContent: 'center' } : undefined}
          >
            <input
              type="radio"
              checked={selected}
              onChange={() => onChange(option.value)}
              aria-label={option.label}
            />
            {option.label}
          </label>
        )
      })}
    </div>
  )
}
