import { feedWhere, notDismissedBy, prisma } from '@jobsearch/db'
import type { DigestCadence, Prisma } from '@jobsearch/db'
import { digestEmail, type DigestJob } from './digest-email'
import { log } from './log'
import { sendEmail } from './mailer'

const DAY = 86_400_000
/** Quality over quantity (PLAN.md §1): a readable email, not everything that matched. */
const JOBS_PER_DIGEST = 8

export interface DigestResult {
  considered: number
  due: number
  sent: number
  skippedEmpty: number
  failed: number
}

/** The reader's own clock: "Monday 08:00" means theirs, not the server's. */
function localParts(now: Date, timeZone: string): { weekday: string; minutes: number; dayStart: Date } {
  const parts = new Intl.DateTimeFormat('en-GB', {
    timeZone,
    weekday: 'long',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  }).formatToParts(now)
  const at = (type: string) => parts.find((part) => part.type === type)?.value ?? ''
  const minutes = Number(at('hour')) * 60 + Number(at('minute'))
  return {
    weekday: at('weekday').toLowerCase(),
    minutes,
    dayStart: new Date(now.getTime() - minutes * 60_000),
  }
}

function toMinutes(sendAt: string): number {
  const [hours, minutes] = sendAt.split(':').map(Number)
  return (hours ?? 0) * 60 + (minutes ?? 0)
}

/**
 * Is this profile due, and what window would the digest cover?
 *
 * The rule is "the send time has passed today, in their timezone, and we have
 * not already sent for this period". Anything else double-sends the first time
 * a cycle runs twice in an evening.
 */
export function digestDue(input: {
  cadence: DigestCadence
  sendOn: string
  sendAt: string
  timezone: string
  lastSentAt: Date | null
  now: Date
}): { due: boolean; periodStart: Date } {
  const { weekday, minutes, dayStart } = localParts(input.now, input.timezone)
  const periodLength = input.cadence === 'daily' ? DAY : 7 * DAY
  const periodStart = input.lastSentAt ?? new Date(input.now.getTime() - periodLength)

  if (input.cadence === 'off') return { due: false, periodStart }
  if (minutes < toMinutes(input.sendAt)) return { due: false, periodStart }
  if (input.cadence === 'weekly' && weekday !== input.sendOn) return { due: false, periodStart }

  // Sent already for this period? Daily: since local midnight. Weekly: within
  // six days, so next week's slot is open but today's is not.
  const alreadySent = input.lastSentAt
    ? input.cadence === 'daily'
      ? input.lastSentAt >= dayStart
      : input.lastSentAt.getTime() > input.now.getTime() - 6 * DAY
    : false

  return { due: !alreadySent, periodStart }
}

/**
 * Sends each due reader the jobs their own feeds matched since last time.
 *
 * Only jobs **first indexed after** the last digest: a digest that repeats what
 * it sent last week is one people stop opening. Nothing to send means nothing
 * sent -- an empty digest is worse than silence, and the window simply carries
 * over to the next run.
 */
export async function runDigest(options: { dryRun?: boolean; email?: string; now?: Date } = {}): Promise<DigestResult> {
  const now = options.now ?? new Date()
  const result: DigestResult = { considered: 0, due: 0, sent: 0, skippedEmpty: 0, failed: 0 }

  const profiles = await prisma.profile.findMany({
    where: {
      digestCadence: { not: 'off' },
      // Never mail an address nobody has confirmed: it is someone else's inbox
      // until they do.
      user: { emailVerifiedAt: { not: null }, ...(options.email ? { email: options.email } : {}) },
    },
    include: { user: { select: { id: true, email: true } } },
  })

  for (const profile of profiles) {
    result.considered++
    const lastDigest = await prisma.digestDelivery.findFirst({
      where: { userId: profile.userId },
      orderBy: { sentAt: 'desc' },
      select: { sentAt: true },
    })

    const { due, periodStart } = digestDue({
      cadence: profile.digestCadence,
      sendOn: profile.digestSendOn,
      sendAt: profile.digestSendAt,
      timezone: profile.timezone,
      lastSentAt: lastDigest?.sentAt ?? null,
      now,
    })
    if (!due) continue
    result.due++

    const jobs = await matchingJobs(profile.userId, profile.residenceCountry, periodStart, now)
    if (jobs.length === 0) {
      result.skippedEmpty++
      continue
    }

    const email = digestEmail({
      to: profile.user.email,
      language: profile.digestLanguage,
      jobs,
      unsubscribeUrl: webUrl(`/digest/unsubscribe?token=${encodeURIComponent(profile.unsubscribeToken)}`),
      settingsUrl: webUrl('/profile#digest'),
    })

    if (options.dryRun) {
      log('digest (dry run)', { to: email.to, jobs: jobs.length, subject: email.subject })
      console.log(`\n${email.text}\n`)
      result.sent++
      continue
    }

    try {
      await sendEmail(email)
      // Recorded only after it went: a delivery row is the claim that this
      // person was mailed, and the next window starts where it says.
      await prisma.digestDelivery.create({ data: { userId: profile.userId, periodStart, jobCount: jobs.length } })
      result.sent++
    } catch (error) {
      result.failed++
      log('digest failed', { to: email.to, error: String(error) })
    }
  }

  return result
}

/** The reader's feeds, matched the way the feed page matches them, new jobs only. */
async function matchingJobs(
  userId: string,
  residenceCountry: string,
  periodStart: Date,
  now: Date,
): Promise<DigestJob[]> {
  const feeds = await prisma.feed.findMany({ where: { userId } })
  const seen = new Set<string>()
  const jobs: DigestJob[] = []

  for (const feed of feeds) {
    const where: Prisma.JobWhereInput = {
      AND: [
        feedWhere(feed, residenceCountry, now),
        notDismissedBy(userId),
        { createdAt: { gt: periodStart } },
        // Confirmed only, unlike the feed. The page shows `needs_check` beside a
        // badge that says the scope is unestablished; an email has no badge, and
        // "jobs you can apply to" has to mean it. The first dry run put an
        // Israel-only posting in a Brazilian's digest this way.
        { eligibility: { is: { verdict: 'confirmed' } } },
      ],
    }
    const rows = await prisma.job.findMany({
      where,
      orderBy: [{ postedAt: 'desc' }, { id: 'asc' }],
      take: JOBS_PER_DIGEST,
      include: { company: { select: { name: true } }, eligibility: { select: { regionLabel: true } } },
    })
    for (const row of rows) {
      if (seen.has(row.id) || jobs.length >= JOBS_PER_DIGEST) continue
      seen.add(row.id)
      jobs.push({
        title: row.title,
        applyUrl: row.applyUrl,
        locationRaw: row.locationRaw,
        company: row.company.name,
        regionLabel: row.eligibility?.regionLabel ?? '',
      })
    }
  }
  return jobs
}

function webUrl(path: string): string {
  return new URL(path, process.env.WEB_URL ?? 'http://localhost:3000').toString()
}
