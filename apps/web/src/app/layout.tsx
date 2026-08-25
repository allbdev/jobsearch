import type { Metadata } from 'next'
import type { ReactNode } from 'react'

export const metadata: Metadata = {
  title: 'JobSearch — remote jobs you are actually eligible for',
  description:
    'Most boards say "Remote". We verify whether the company hires from your country — and quote the line in the posting that proves it. Any profession.',
}

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <body style={{ margin: 0 }}>{children}</body>
    </html>
  )
}
