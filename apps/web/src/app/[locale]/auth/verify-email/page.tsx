import type { Metadata } from 'next'
import { VerifyEmailScreen } from '@/features/auth/LinkScreens'

/**
 * Not indexed, and no Referer: the URL carries a single-use token, and any
 * request this page makes to another origin must not hand it over.
 */
export const metadata: Metadata = {
  robots: { index: false, follow: false },
  alternates: {},
  referrer: 'no-referrer',
}

export default async function VerifyEmailPage({ searchParams }: { searchParams: Promise<{ token?: string }> }) {
  const { token } = await searchParams
  return <VerifyEmailScreen token={token} />
}
