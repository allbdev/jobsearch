'use client'

import { Cluster } from '../primitives/Stack'
import { Tag } from '../primitives/Tag'
import { color } from '@jobsearch/design-system/tokens'

export interface ChipOption<T extends string = string> {
  value: T
  label: string
}

export interface ChipToggleGroupProps<T extends string> {
  options: readonly ChipOption<T>[]
  selected: readonly T[]
  onToggle: (value: T) => void
  ariaLabel?: string
}

/**
 * Multi-select filter chips.
 *
 * This is the single biggest duplication in the design source: the same chip
 * row is hand-written seven times (three in the Feed dialog — job families,
 * regions, contract types — and four in Profile — regions, languages, families,
 * contracts), each with its own copy of the `on ? 'tag tag-accent' : 'tag
 * tag-neutral'` and inline border computation. One component, seven callers.
 */
export function ChipToggleGroup<T extends string>({
  options,
  selected,
  onToggle,
  ariaLabel,
}: ChipToggleGroupProps<T>) {
  return (
    <Cluster gap="2" role="group" aria-label={ariaLabel}>
      {options.map((option) => {
        const on = selected.includes(option.value)
        return (
          <Tag
            key={option.value}
            as="button"
            type="button"
            tone={on ? 'accent' : 'neutral'}
            aria-pressed={on}
            onClick={() => onToggle(option.value)}
            style={{
              cursor: 'pointer',
              font: 'inherit',
              fontSize: 12,
              border: `1px solid ${on ? color.accent : color.divider}`,
            }}
          >
            {option.label}
          </Tag>
        )
      })}
    </Cluster>
  )
}

/** Toggles a value in an immutable list — the state update every caller repeated. */
export function toggleInList<T>(list: readonly T[], value: T): T[] {
  return list.includes(value) ? list.filter((item) => item !== value) : [...list, value]
}
