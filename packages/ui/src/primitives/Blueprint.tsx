import type { ElementType } from 'react'
import { cx } from '../lib/cx'
import type { PolymorphicProps } from '../lib/polymorphic'

export interface BlueprintOwnProps {
  /** Drop the four `+` registration marks. The design system forbids this on
   *  framed elements — it exists only for nested frames that would double up. */
  unmarked?: boolean
  elevation?: 'sm' | 'md' | 'lg'
}

/**
 * The wireframe frame every card, figure and section wears in Industry:
 * square, hairline-bordered, transparent, with `+` marks at each corner.
 *
 * The design source repeats `<i class="corner tl">…<i class="corner br">` on
 * every single framed element (14 times across three screens). This component
 * is the only place those marks are written.
 */
export function Blueprint<E extends ElementType = 'div'>({
  as,
  unmarked = false,
  elevation,
  className,
  children,
  ...rest
}: PolymorphicProps<E, BlueprintOwnProps>) {
  const Component = (as ?? 'div') as ElementType
  return (
    <Component className={cx('blueprint', elevation && `elev-${elevation}`, className)} {...rest}>
      {!unmarked && (
        <>
          <i className="corner tl" />
          <i className="corner tr" />
          <i className="corner bl" />
          <i className="corner br" />
        </>
      )}
      {children}
    </Component>
  )
}
