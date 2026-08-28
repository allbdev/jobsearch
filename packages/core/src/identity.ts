import { createHash } from 'node:crypto'
import { canonicalizeUrl } from './url'

/**
 * Company names for matching, not for display.
 *
 * The same employer arrives as "Layered", "Layered, Inc.", "layered" and
 * "Layered Inc" across sources. Display keeps whatever the source said; this is
 * only ever a lookup key.
 */
export function normalizeCompanyName(name: string): string {
  return name
    .toLowerCase()
    .normalize('NFKD')
    // Strip accents, so "Nubank" and "Nubânk" match.
    .replace(/[̀-ͯ]/g, '')
    // Legal suffixes carry no identity: "Acme Inc." and "Acme" are one company.
    .replace(/\b(inc|llc|ltd|limited|corp|corporation|gmbh|s\.?a\.?|b\.?v\.?|pty|plc|co)\b\.?/g, '')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim()
    .replace(/\s+/g, ' ')
}

/**
 * Titles for matching. Deliberately gentler than company normalisation: a
 * "Senior" prefix is a different job, so seniority words are kept.
 */
export function normalizeTitle(title: string): string {
  return title
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim()
    .replace(/\s+/g, ' ')
}

/**
 * The dedup key (PLAN.md §5): normalised company, title and canonical URL.
 *
 * The URL is included because two genuinely different roles at one company can
 * share a title — "Software Engineer" opens twice for different teams — and
 * collapsing those would hide a real opening. It is the last component rather
 * than the only one because the same posting reached through two sources can
 * carry different URLs, and company+title is what catches that.
 */
export function jobContentHash(input: {
  companyName: string
  title: string
  applyUrl: string
}): string {
  return createHash('sha256')
    .update(
      JSON.stringify([
        normalizeCompanyName(input.companyName),
        normalizeTitle(input.title),
        canonicalizeUrl(input.applyUrl),
      ]),
    )
    .digest('hex')
}
