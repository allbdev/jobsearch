import type { ReactNode } from 'react'

/**
 * Next requires a root layout, but `<html lang>` depends on the locale — which
 * only `[locale]/layout.tsx` knows. So this one passes through and that one
 * renders the document shell.
 */
export default function RootLayout({ children }: { children: ReactNode }) {
  return children
}
