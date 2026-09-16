import type { Email } from './mailer'

/** Where emailed links point: the web app, which forwards the token here (D15). */
export function webUrl(path: string): string {
  return new URL(path, process.env.WEB_URL ?? 'http://localhost:3000').toString()
}

// English only for now. The recipient's language needs a locale the web passes
// at sign-up, and belongs with the web wiring.
export function verifyEmail(to: string, token: string): Email {
  const link = webUrl(`/auth/verify-email?token=${encodeURIComponent(token)}`)
  return {
    to,
    subject: 'Confirm your email for JobSearch',
    text: [
      'Confirm this address to finish setting up your JobSearch account:',
      '',
      link,
      '',
      'The link works once, for 24 hours. If you did not create an account, ignore this email.',
    ].join('\n'),
  }
}

export function resetPassword(to: string, token: string): Email {
  const link = webUrl(`/auth/reset-password?token=${encodeURIComponent(token)}`)
  return {
    to,
    subject: 'Reset your JobSearch password',
    text: [
      'Someone asked to reset the password for this JobSearch account. To choose a new one:',
      '',
      link,
      '',
      'The link works once, for 1 hour. If it was not you, ignore this email: your password has not changed.',
    ].join('\n'),
  }
}
