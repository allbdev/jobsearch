import type { Region } from './regions'

/**
 * The countries each region code covers, as ISO 3166-1 alpha-2.
 *
 * Matching needs both halves and they are not interchangeable. A user's
 * *preferences* are regions -- nobody ticks 27 boxes to mean "Europe" -- while
 * the one field that can disqualify them is `residenceCountry`, a single
 * country (PLAN.md §5). So a posting has to say which countries it is open to,
 * and this is the bridge.
 *
 * Deliberately conservative. These lists say "a posting open to this region is
 * open to someone living here", so a country is included only where that is
 * plainly true. Getting it wrong in this direction shows someone a job they
 * cannot take, which is the failure this product cannot afford.
 */

const words = (list: string): string[] => list.trim().split(/\s+/)

/** The 27 EU member states. Not "Europe": Switzerland and Norway are not in it. */
const EU = words(`
  AT BE BG HR CY CZ DK EE FI FR DE GR HU IE IT LV LT LU MT NL PL PT RO SK SI ES SE
`)

const LATAM = words(`
  AR BO BR CL CO CR CU DO EC SV GT HN MX NI PA PY PE UY VE
`)

const APAC = words(`
  AU NZ JP CN KR IN SG MY TH VN PH ID TW HK
`)

export const COUNTRIES_BY_REGION: Record<Region, readonly string[]> = {
  // Empty is "unbounded" in the shared contract, which is exactly what
  // Worldwide means -- not "we do not know", which is what the verdict says.
  Worldwide: [],
  Americas: ['US', 'CA', ...LATAM],
  LATAM,
  BR: ['BR'],
  US: ['US'],
  // The region code is UK because that is what a person writes; the ISO code
  // for the country is GB.
  UK: ['GB'],
  CA: ['CA'],
  EU,
  APAC,
}

/**
 * Every country a posting open to these regions is open to.
 *
 * Returns an empty array for Worldwide, and for no regions at all. Those are
 * different facts -- unbounded versus unknown -- and the contract keeps them
 * apart by the *verdict*, not by this value: a `confirmed` posting with no
 * countries is open to everyone, and a `needs_check` one simply has not been
 * established. Reading emptiness alone as "open to everyone" is how a
 * classifier that never ran looks like a green badge.
 */
export function countriesFor(regions: readonly string[]): string[] {
  if (regions.length === 0) return []
  // Worldwide subsumes anything listed beside it.
  if (regions.includes('Worldwide')) return []

  const found = new Set<string>()
  for (const region of regions) {
    for (const country of COUNTRIES_BY_REGION[region as Region] ?? []) found.add(country)
  }
  return [...found].sort()
}

/**
 * Can someone living in `residenceCountry` take a posting open to `regions`?
 *
 * The single blocking question in the whole product (PLAN.md §5). Unbounded
 * means yes; anything else is membership. Callers must check the verdict first
 * -- this answers "is the scope compatible", not "is the scope known".
 */
export function isOpenToCountry(regions: readonly string[], residenceCountry: string): boolean {
  const countries = countriesFor(regions)
  if (countries.length === 0) return regions.includes('Worldwide')
  return countries.includes(residenceCountry.toUpperCase())
}
