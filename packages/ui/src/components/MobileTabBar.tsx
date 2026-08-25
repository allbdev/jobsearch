'use client'

import type { ElementType } from 'react'
import { cx } from '../lib/cx'
import { Icon, type LucideIcon } from '../primitives/Icon'
import styles from './MobileTabBar.module.css'
import { useUiLabels } from '../i18n/labels'

export interface MobileTab {
  href: string
  label: string
  icon: LucideIcon
  current?: boolean
}

export interface MobileTabBarProps {
  tabs: readonly MobileTab[]
  linkComponent?: ElementType
  className?: string
}

/**
 * The bottom navigation the mobile designs use in place of the desktop top
 * nav. Hidden at or above the mobile breakpoint, where `AppShell`'s bar takes
 * over.
 */
export function MobileTabBar({ tabs, linkComponent, className }: MobileTabBarProps) {
  const labels = useUiLabels()
  const Link = (linkComponent ?? 'a') as ElementType
  return (
    <nav
      className={cx(styles.bar, className)}
      style={{ gridTemplateColumns: `repeat(${tabs.length}, 1fr)` }}
      aria-label={labels.primaryNavigation}
    >
      {tabs.map((tab) => (
        <Link
          key={tab.href}
          href={tab.href}
          aria-current={tab.current ? 'page' : undefined}
          className={cx(styles.tab, tab.current && styles.current)}
        >
          <Icon icon={tab.icon} size={20} />
          {tab.label}
        </Link>
      ))}
    </nav>
  )
}
