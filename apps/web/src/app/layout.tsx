import type { Metadata, Viewport } from 'next'
import type { ReactNode } from 'react'

export const metadata: Metadata = {
  title: 'JobSearch — remote jobs you are actually eligible for',
  description:
    'Most boards say "Remote". We verify whether the company hires from your country — and quote the line in the posting that proves it. Any profession.',
}

/**
 * `width=device-width` is what makes the mobile breakpoints apply at all --
 * without it a phone reports a ~980px viewport and renders the desktop layout
 * scaled down. `maximumScale` is deliberately left alone so users can zoom.
 */
export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
}

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <body style={{ margin: 0 }}>{children}</body>
    </html>
  )
}
