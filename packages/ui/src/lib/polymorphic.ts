import type { ComponentPropsWithoutRef, ElementType, ReactElement } from 'react'

/**
 * Lets a component render as a different element or component without
 * duplicating it — `<Button as={Link} href="/feed">` keeps one Button.
 */
export type PolymorphicProps<E extends ElementType, P> = P &
  Omit<ComponentPropsWithoutRef<E>, keyof P | 'as'> & { as?: E }

export type PolymorphicComponent<P, D extends ElementType> = <E extends ElementType = D>(
  props: PolymorphicProps<E, P>,
) => ReactElement | null
