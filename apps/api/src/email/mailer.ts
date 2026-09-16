import { Logger } from '@nestjs/common'

export interface Email {
  to: string
  subject: string
  text: string
}

/**
 * Transactional email through Resend (PLAN.md §7), over plain `fetch` -- one
 * endpoint does not justify an SDK.
 *
 * Without `RESEND_API_KEY` the message is logged instead of sent, so sign-up
 * works on a machine with no email account, and the link can be clicked from
 * the terminal.
 */
export class Mailer {
  private readonly logger = new Logger('Mailer')

  constructor(private readonly config: { apiKey?: string; from?: string }) {}

  static fromEnv(): Mailer {
    return new Mailer({ apiKey: process.env.RESEND_API_KEY, from: process.env.EMAIL_FROM })
  }

  async send(email: Email): Promise<void> {
    const { apiKey, from } = this.config
    if (!apiKey || !from) {
      this.logger.log(`RESEND_API_KEY unset; not sending.\nto: ${email.to}\nsubject: ${email.subject}\n\n${email.text}`)
      return
    }

    const response = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: { authorization: `Bearer ${apiKey}`, 'content-type': 'application/json' },
      body: JSON.stringify({ from, to: [email.to], subject: email.subject, text: email.text }),
    })
    if (!response.ok) {
      throw new Error(`Resend refused the email: ${response.status} ${await response.text()}`)
    }
  }
}
