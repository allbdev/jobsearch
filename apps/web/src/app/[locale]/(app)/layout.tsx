import type { ReactNode } from 'react'

/**
 * Route group for authenticated screens. The chrome itself lives in
 * `AppShell` (@jobsearch/ui) rather than here, because the Feed manages its
 * own scroll containers and needs to control the content column directly.
 */
export default function AppLayout({ children }: { children: ReactNode }) {
  return <>{children}</>
}
