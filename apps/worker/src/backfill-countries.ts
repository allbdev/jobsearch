import { prisma } from '@jobsearch/db'
import { countriesFor } from '@jobsearch/core'

/**
 * Fill `eligibleCountries` from the regions already stored.
 *
 * A pure derivation, so it costs nothing and never re-runs a classifier: rows
 * written before the countries existed get them without paying to re-decide
 * anything. Idempotent -- it only touches rows whose stored value differs from
 * what the regions imply, so a second run does nothing.
 *
 * Rows with no regions are left alone. Empty means "unbounded" to the API
 * contract, and writing it for a posting whose scope was never established
 * would turn "we do not know" into "open to everyone".
 */
export async function backfillCountries(): Promise<{ considered: number; filled: number }> {
  const rows = await prisma.jobEligibility.findMany({
    where: { eligibleRegions: { isEmpty: false } },
    select: { id: true, eligibleRegions: true, eligibleCountries: true },
  })

  let filled = 0
  const byCountries = new Map<string, string[]>()

  for (const row of rows) {
    const countries = countriesFor(row.eligibleRegions)
    if (countries.length === 0) continue
    if (
      countries.length === row.eligibleCountries.length &&
      countries.every((code, i) => row.eligibleCountries[i] === code)
    ) {
      continue
    }
    const key = countries.join(',')
    const ids = byCountries.get(key)
    if (ids) ids.push(row.id)
    else byCountries.set(key, [row.id])
    filled++
  }

  // Grouped by the value being written: distinct region combinations are far
  // fewer than rows, so this is a handful of statements rather than thousands.
  for (const [key, ids] of byCountries) {
    await prisma.jobEligibility.updateMany({
      where: { id: { in: ids } },
      data: { eligibleCountries: key.split(',') },
    })
  }

  return { considered: rows.length, filled }
}
