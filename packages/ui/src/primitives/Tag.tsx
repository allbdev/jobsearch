import type { ElementType } from 'react'
import { cx } from '../lib/cx'
import type { PolymorphicProps } from '../lib/polymorphic'

export interface TagOwnProps {
  /** `accent2` resolves to the same role as `accent` — Industry is a mono palette. */
  tone?: 'accent' | 'accent2' | 'neutral' | 'outline'
  size?: 'md' | 'sm' | 'xs'
}

/** Small tinted label. Used for badges, skills, counts and filter chips. */
export function Tag<E extends ElementType = 'span'>({
  as,
  tone = 'neutral',
  size = 'md',
  className,
  ...rest
}: PolymorphicProps<E, TagOwnProps>) {
  const Component = (as ?? 'span') as ElementType
  const toneClass = tone === 'accent2' ? 'tag-accent-2' : `tag-${tone}`
  return <Component className={cx('tag', toneClass, size !== 'md' && `tag-${size}`, className)} {...rest} />
}
