import { createNavigation } from 'next-intl/navigation'
import { routing } from './routing'

/**
 * Locale-aware replacements for `next/link` and the navigation hooks. Using
 * these instead of the Next originals is what keeps `/pt-br/...` intact when
 * moving between pages — a plain `<Link href="/feed">` would drop the locale.
 */
export const { Link, redirect, usePathname, useRouter, getPathname } = createNavigation(routing)
