import type { ElementType } from 'react'
import { cx } from '../lib/cx'
import type { PolymorphicProps } from '../lib/polymorphic'

export interface ButtonOwnProps {
  variant?: 'primary' | 'secondary' | 'ghost'
  /** Square 36px action button holding a single icon. */
  icon?: boolean
  block?: boolean
  /** Denser variant used in the nav bar and footers. */
  size?: 'md' | 'sm'
}

/**
 * Actions. The primary variant is the one solid object on the board — an
 * accent fill that keeps square corners.
 *
 * Renders a `<button>` by default; pass `as={Link}` or `as="a"` for navigation
 * so link and button actions never fork into two components.
 */
export function Button<E extends ElementType = 'button'>({
  as,
  variant = 'secondary',
  icon = false,
  block = false,
  size = 'md',
  className,
  ...rest
}: PolymorphicProps<E, ButtonOwnProps>) {
  const Component = (as ?? 'button') as ElementType
  return (
    <Component
      className={cx(
        'btn',
        `btn-${variant}`,
        icon && 'btn-icon',
        block && 'btn-block',
        size === 'sm' && 'btn-sm',
        className,
      )}
      {...rest}
    />
  )
}
