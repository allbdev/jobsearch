import type { Metadata } from 'next'
import { ForgotPasswordScreen } from '@/features/auth/LinkScreens'

/** A step in someone's account recovery, not a page anyone should reach from search. */
export const metadata: Metadata = {
  robots: { index: false, follow: false },
  alternates: {},
}

export default function ForgotPasswordPage() {
  return <ForgotPasswordScreen />
}
