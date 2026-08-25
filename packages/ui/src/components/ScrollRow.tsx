import type { ElementType } from 'react'
import { cx } from '../lib/cx'
import type { PolymorphicProps } from '../lib/polymorphic'
import styles from './ScrollRow.module.css'

/**
 * A horizontally scrolling strip of chips, used where a desktop sidebar
 * collapses to a single line on mobile. Children never shrink; the row
 * scrolls instead.
 */
export function ScrollRow<E extends ElementType = 'div'>({
  as,
  className,
  ...rest
}: PolymorphicProps<E, Record<never, never>>) {
  const Component = (as ?? 'div') as ElementType
  return <Component className={cx(styles.row, className)} {...rest} />
}
