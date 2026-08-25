import type { ElementType } from 'react'
import { cx } from '../lib/cx'
import type { PolymorphicProps } from '../lib/polymorphic'

/** Secondary copy. The system defines exactly one ink tint for this. */
export function Muted<E extends ElementType = 'span'>({
  as,
  className,
  ...rest
}: PolymorphicProps<E, Record<never, never>>) {
  const Component = (as ?? 'span') as ElementType
  return <Component className={cx('text-muted', className)} {...rest} />
}

/** The accent eyebrow above a framed block. */
export function Kicker({ className, ...rest }: React.HTMLAttributes<HTMLDivElement>) {
  return <div className={cx('card-kicker', className)} {...rest} />
}

/** Uppercase micro-label used inside the feed-definition panel. */
export function Overline({ className, ...rest }: React.HTMLAttributes<HTMLDivElement>) {
  return <div className={cx('overline', 'text-muted', className)} {...rest} />
}
