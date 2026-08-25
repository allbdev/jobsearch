import { Muted } from '../primitives/Text'
import { color } from '@jobsearch/design-system/tokens'

export interface StatFigureProps {
  value: string
  label: string
}

/** A single headline number over its caption. */
export function StatFigure({ value, label }: StatFigureProps) {
  return (
    <div>
      <span
        style={{
          fontFamily: 'var(--font-heading)',
          fontWeight: 600,
          fontSize: 22,
          color: color.text,
          display: 'block',
        }}
      >
        {value}
      </span>
      {label}
    </div>
  )
}

export function StatRow({ stats }: { stats: readonly StatFigureProps[] }) {
  return (
    <Muted as="div" style={{ display: 'flex', gap: 'var(--space-6)', fontSize: 13 }}>
      {stats.map((stat) => (
        <StatFigure key={stat.label} {...stat} />
      ))}
    </Muted>
  )
}
