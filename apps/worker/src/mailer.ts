import { log } from './log'

export interface Email {
  to: string
  subject: string
  text: string
}

/**
 * Transactional email through Resend, for the worker.
 *
 * Deliberately a second, tiny copy of what `apps/api/src/email/mailer.ts` does:
 * the API's version is a Nest provider built around Nest's logger, and neither
 * of those belongs in a CLI process. Both are the same six lines of `fetch`
 * against one endpoint, and both honour the same env contract. If a third
 * caller appears, this earns a package -- until then it is less machinery than
 * a shared one would be.
 *
 * Without `RESEND_API_KEY` the message is logged rather than sent, which is how
 * `digest --dry-run` reads on a machine with no email account.
 */
export async function sendEmail(email: Email): Promise<'sent' | 'logged'> {
  const apiKey = process.env.RESEND_API_KEY
  const from = process.env.EMAIL_FROM
  if (!apiKey || !from) {
    log('email not sent (no RESEND_API_KEY), printing instead', { to: email.to, subject: email.subject })
    console.log(`\n${email.text}\n`)
    return 'logged'
  }

  const response = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: { authorization: `Bearer ${apiKey}`, 'content-type': 'application/json' },
    body: JSON.stringify({ from, to: [email.to], subject: email.subject, text: email.text }),
  })
  if (!response.ok) throw new Error(`Resend refused the email: ${response.status} ${await response.text()}`)
  return 'sent'
}
