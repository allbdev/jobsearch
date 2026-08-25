import type { ReactNode } from 'react'
import { Blueprint } from '../primitives/Blueprint'
import { Stack } from '../primitives/Stack'
import { cx } from '../lib/cx'
import styles from './SectionCard.module.css'

export interface SectionCardProps {
  id?: string
  title: string
  description?: ReactNode
  children: ReactNode
}

/**
 * A framed settings section: heading, optional explanatory line, content.
 * The Profile screen repeats this shell five times.
 */
export function SectionCard({ id, title, description, children }: SectionCardProps) {
  return (
    <Blueprint as="section" id={id} className={styles.section}>
      <h3 className={styles.title}>{title}</h3>
      {description ? (
        <p className={cx('text-muted', styles.description)}>
          {description}
        </p>
      ) : null}
      {/* One rhythm for the whole section, instead of a margin-top on each
          field — which is what the design source hand-writes per element. */}
      <Stack gap="3">{children}</Stack>
    </Blueprint>
  )
}
