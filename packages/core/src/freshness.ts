/**
 * When a posting stops being worth showing (PLAN.md §4).
 *
 * A job leaves the feeds when it stops being *available to apply to* -- never
 * because it has been open a while. An earlier version expired anything older
 * than 60 days, which hid 1,660 of 3,092 postings including 96 of the 251 a
 * Brazilian could actually apply to, most of them still listed on their boards.
 * Age is a guess; disappearing from the source, or answering 404, is evidence.
 */

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
