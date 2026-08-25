import type { CSSProperties, ElementType } from 'react'
import { cx } from '../lib/cx'
import type { PolymorphicProps } from '../lib/polymorphic'
import styles from './Stack.module.css'

/**
 * A step on the spacing scale. Deliberately a string so it cannot be confused
 * with a raw pixel value: `gap="6"` is `var(--space-6)` (20.4px) while
 * `gap={6}` is 6px. An earlier version accepted a number for both and silently
 * turned the design's 6px feed-list gap into 20.4px.
 */
export type SpaceStep = '1' | '2' | '3' | '4' | '6' | '8'

export interface StackOwnProps {
  gap?: SpaceStep | number
  align?: CSSProperties['alignItems']
  justify?: CSSProperties['justifyContent']
}

function gapValue(gap: StackOwnProps['gap']): string | undefined {
  if (gap === undefined) return undefined
  return typeof gap === 'string' ? `var(--space-${gap})` : `${gap}px`
}

/** Vertical rhythm. Replaces the repeated `display:flex;flex-direction:column;gap:…`. */
export function Stack<E extends ElementType = 'div'>({
  as,
  gap = '3',
  align,
  justify,
  className,
  style,
  ...rest
}: PolymorphicProps<E, StackOwnProps>) {
  const Component = (as ?? 'div') as ElementType
  return (
    <Component
      className={cx(styles.stack, className)}
      style={{ gap: gapValue(gap), alignItems: align, justifyContent: justify, ...style }}
      {...rest}
    />
  )
}

export interface ClusterOwnProps extends StackOwnProps {
  wrap?: boolean
}

/** Horizontal grouping that wraps. Replaces the repeated inline flex rows. */
export function Cluster<E extends ElementType = 'div'>({
  as,
  gap = '2',
  align = 'center',
  justify,
  wrap = true,
  className,
  style,
  ...rest
}: PolymorphicProps<E, ClusterOwnProps>) {
  const Component = (as ?? 'div') as ElementType
  return (
    <Component
      className={cx(styles.cluster, className)}
      style={{
        gap: gapValue(gap),
        alignItems: align,
        justifyContent: justify,
        flexWrap: wrap ? 'wrap' : 'nowrap',
        ...style,
      }}
      {...rest}
    />
  )
}
