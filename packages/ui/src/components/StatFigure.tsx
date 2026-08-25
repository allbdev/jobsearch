import { Muted } from '../primitives/Text'
import { cx } from '../lib/cx'
import styles from './StatFigure.module.css'

export interface StatFigureProps {
  value: string
  label: string
}

/** A single headline number over its caption. */
export function StatFigure({ value, label }: StatFigureProps) {
  return (
    <div>
      <span className={styles.value}>
        {value}
      </span>
      {label}
    </div>
  )
}

export function StatRow({
  stats,
  className,
}: {
  stats: readonly StatFigureProps[]
  className?: string
}) {
  return (
    <Muted as="div" className={cx(styles.row, className)}>
      {stats.map((stat) => (
        <StatFigure key={stat.label} {...stat} />
      ))}
    </Muted>
  )
}
