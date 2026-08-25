import type { ElementType, ReactNode } from 'react'
import { Button } from '../primitives/Button'
import { Tag } from '../primitives/Tag'
import { color, hairline } from '@jobsearch/design-system/tokens'

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
}

export function Brand() {
  return (
    <div className="nav-brand" style={{ letterSpacing: '0.04em', display: 'flex', alignItems: 'center', gap: 8 }}>
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
}: AppShellProps) {
  const Link = (linkComponent ?? 'a') as ElementType

  return (
    <div style={{ minHeight: '100vh', background: color.bg, display: 'flex', flexDirection: 'column' }}>
      <nav
        className="nav"
        style={{
          borderBottom: hairline,
          position: 'sticky',
          top: 0,
          zIndex: 20,
          background: color.bg,
        }}
      >
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
        <div className="app-main" style={{ maxWidth }}>
          {children}
        </div>
      )}
      {footer}
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
