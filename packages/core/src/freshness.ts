/**
 * When a posting stops being worth showing (PLAN.md §4).
 *
 * The origin prompt's rule was "no broken links", and it is the cheapest trust
 * the product can lose: a user who clicks three dead listings stops believing
 * the eligibility badge either.
 */

/** A posting nobody has re-listed in two months is almost certainly filled. */
export const EXPIRY_DAYS = 60

const DAY_MS = 24 * 60 * 60 * 1000

export function expiryFromPostedAt(postedAt: Date): Date {
  return new Date(postedAt.getTime() + EXPIRY_DAYS * DAY_MS)
}

/**
 * The `postedAt` on or before which a posting is already stale.
 *
 * Dated from when the role opened, not from when we found it: a posting
 * crawled yesterday that opened in January is stale today, and dating expiry
 * from discovery would keep it for two more months.
 */
export function staleBefore(now: Date = new Date()): Date {
  return new Date(now.getTime() - EXPIRY_DAYS * DAY_MS)
}

/**
 * Does this status mean the posting is *gone*, as opposed to unreachable?
 *
 * Only 404 and 410 are the site saying "this does not exist". Everything else
 * is about us or about the moment:
 *
 *   403, 401  a bot wall. The posting is very likely fine; we are the problem.
 *   429       we are being rate limited. Backing off is the answer, not expiry.
 *   5xx       the site is having a bad day.
 *   3xx       a move, which fetch follows; a redirect to a "jobs closed" page
 *             still answers 200 and is not something a status code can catch.
 *
 * Expiring on any of those would delete live jobs from the index on the
 * strength of someone else's outage, and re-crawling would not bring them back
 * until the source re-listed them.
 */
export function isGone(status: number): boolean {
  return status === 404 || status === 410
}
