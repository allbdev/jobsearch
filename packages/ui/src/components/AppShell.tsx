import type { ElementType, ReactNode } from 'react'
import { Button } from '../primitives/Button'
import { Tag } from '../primitives/Tag'
import { cx } from '../lib/cx'
import styles from './AppShell.module.css'

export interface NavItem {
  href: string
  label: string
  current?: boolean
}

export interface AppShellProps {
  nav: readonly NavItem[]
  /** Rendered at the right end of the bar — sign-out, language picker. */
  navAside?: ReactNode
  /**
   * The router's link component. Defaults to a plain anchor so the library
   * stays framework-agnostic; the app passes `next/link` once, in its layout.
   */
  linkComponent?: ElementType
  /** Constrains the content column. The Feed is wider than Profile. */
  maxWidth?: number
  children: ReactNode
  footer?: ReactNode
  /** Feed pins its own scroll areas, so the shell must not add page padding. */
  bare?: boolean
  /**
   * Replaces the top bar below the mobile breakpoint. Each screen's mobile
   * chrome differs — the Feed has a filter header and feed picker, the Profile
   * a title and section nav — so the shell only provides the slot.
   */
  mobileHeader?: ReactNode
  /** Fixed bottom navigation, rendered below the content on mobile only. */
  mobileTabs?: ReactNode
  /** Constrains the whole shell, matching the mobile designs' 480px cap. */
  mobileMaxWidth?: number
}

export function Brand() {
  return (
    <div className={cx('nav-brand', styles.brand)}>
      JOBSEARCH
      <Tag tone="outline" size="xs">
        BETA
      </Tag>
    </div>
  )
}

/**
 * Sticky top bar + content column. All three screens share it, so the brand
 * mark, the nav rules and the column width live in exactly one file.
 */
export function AppShell({
  nav,
  navAside,
  linkComponent,
  maxWidth = 1080,
  children,
  footer,
  bare = false,
  mobileHeader,
  mobileTabs,
}: AppShellProps) {
  const Link = (linkComponent ?? 'a') as ElementType

  return (
    <div
      className={cx(
        styles.shell,
        Boolean(mobileTabs) && styles.withTabs,
        Boolean(mobileHeader) && styles.withMobileHeader,
      )}
    >
      {mobileHeader ? <div className={styles.mobileHeader}>{mobileHeader}</div> : null}
      <nav className={cx('nav', styles.bar)}>
        <Brand />
        {nav.map((item) => (
          <Link key={item.href} href={item.href} aria-current={item.current ? 'page' : undefined}>
            {item.label}
          </Link>
        ))}
        {navAside}
      </nav>
      {bare ? (
        children
      ) : (
        <div
          className={cx('app-main', styles.content, Boolean(mobileTabs) && styles.withTabs)}
          style={{ maxWidth }}
        >
          {children}
        </div>
      )}
      {footer}
      {mobileTabs}
    </div>
  )
}

export interface SignOutButtonProps {
  href: string
  linkComponent?: ElementType
  label?: string
}

export function SignOutButton({ href, linkComponent, label = 'Sign out' }: SignOutButtonProps) {
  return (
    <Button as={(linkComponent ?? 'a') as ElementType} variant="secondary" size="sm" href={href}>
      {label}
    </Button>
  )
}
