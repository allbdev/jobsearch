import type { Metadata } from 'next'
import { UnsubscribeScreen } from '@/features/digest/UnsubscribeScreen'

/**
 * Not indexed, and no Referer: the URL carries the token that identifies this
 * reader, and no request this page makes elsewhere should hand it over.
 */
export const metadata: Metadata = {
  robots: { index: false, follow: false },
  alternates: {},
  referrer: 'no-referrer',
}

export default async function UnsubscribePage({ searchParams }: { searchParams: Promise<{ token?: string }> }) {
  const { token } = await searchParams
  return <UnsubscribeScreen token={token} />
}
