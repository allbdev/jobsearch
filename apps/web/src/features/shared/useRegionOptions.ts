'use client'

import { useTranslations } from 'next-intl'
import { REGION_VOCABULARY } from '@jobsearch/shared'
import type { ChipOption } from '@jobsearch/ui'

/**
 * Chip options for the region pickers.
 *
 * Values are the classifier's region codes, because a saved feed and a profile
 * are matched against `job_eligibility.eligibleRegions` as written. The pickers
 * used to offer their own display strings ("Brazil listed", "EU-eligible"),
 * and a feed saved from them matched nothing.
 */
export function useRegionOptions(): ChipOption[] {
  const t = useTranslations('regions')
  return REGION_VOCABULARY.map((code) => ({ value: code, label: t(code) }))
}

/** Stored region codes as readable labels; unknown codes are skipped, not shown raw. */
export function useRegionLabels(): (codes: readonly string[]) => string[] {
  const t = useTranslations('regions')
  const known = new Set<string>(REGION_VOCABULARY)
  return (codes) => codes.filter((code) => known.has(code)).map((code) => t(code))
}
