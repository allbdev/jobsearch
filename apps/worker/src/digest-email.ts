import type { Job } from '@jobsearch/db'
import type { Email } from './mailer'

/**
 * The digest, as text.
 *
 * The worker cannot reach the web app's message catalogs -- those are a
 * next-intl runtime -- so the three languages it can be written in live here,
 * as four short strings each. The job lines themselves are data.
 */
const COPY = {
  en: {
    subject: (count: number) => `${count} new ${count === 1 ? 'job' : 'jobs'} you can apply to`,
    intro: 'New since your last digest, from the boards we watch:',
    footer: 'Change how often you get this, or stop it:',
    stop: 'Unsubscribe',
  },
  'pt-br': {
    subject: (count: number) => `${count} ${count === 1 ? 'nova vaga' : 'novas vagas'} para você se candidatar`,
    intro: 'Novidades desde o seu último resumo, dos quadros que acompanhamos:',
    footer: 'Mude a frequência ou cancele o envio:',
    stop: 'Cancelar o resumo',
  },
  es: {
    subject: (count: number) => `${count} ${count === 1 ? 'nueva oferta' : 'nuevas ofertas'} a las que puedes postularte`,
    intro: 'Novedades desde tu último resumen, de los portales que seguimos:',
    footer: 'Cambia la frecuencia o cancélalo:',
    stop: 'Cancelar el resumen',
  },
} as const

export type DigestLanguage = keyof typeof COPY

export interface DigestJob extends Pick<Job, 'title' | 'applyUrl' | 'locationRaw'> {
  company: string
  regionLabel: string
}

export function digestEmail(input: {
  to: string
  language: string
  jobs: DigestJob[]
  unsubscribeUrl: string
  settingsUrl: string
}): Email {
  const copy = COPY[(input.language as DigestLanguage) in COPY ? (input.language as DigestLanguage) : 'en']
  const lines = input.jobs.map((job) => {
    // Where it is matters as much as what it is: the whole product is which of
    // these a reader can actually take. The two fields often say the same thing
    // -- "Remote · Remote", "Brazil · Remote - Brazil" -- so the wider one wins
    // rather than both being printed.
    const where = describeWhere(job)
    return `• ${job.title} — ${job.company}\n  ${where}\n  ${job.applyUrl}`
  })

  return {
    to: input.to,
    subject: copy.subject(input.jobs.length),
    text: [copy.intro, '', lines.join('\n\n'), '', '—', `${copy.footer} ${input.settingsUrl}`, `${copy.stop}: ${input.unsubscribeUrl}`].join(
      '\n',
    ),
  }
}

/** One phrase for where a job is, from two fields that often repeat each other. */
function describeWhere(job: DigestJob): string {
  const region = job.regionLabel.trim()
  const location = job.locationRaw?.trim() ?? ''
  if (!region) return location
  if (!location) return region
  const same = (a: string, b: string) => a.toLowerCase().includes(b.toLowerCase())
  if (same(location, region)) return location
  if (same(region, location)) return region
  return `${region} · ${location}`
}
