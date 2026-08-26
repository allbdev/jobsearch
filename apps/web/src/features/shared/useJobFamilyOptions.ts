'use client'

import { useTranslations } from 'next-intl'
import { activeJobFamilies, JOB_FAMILY_GROUPS } from '@jobsearch/shared'
import type { ChipOption } from '@jobsearch/ui'

/**
 * Chip options for the family pickers.
 *
 * Values are taxonomy ids and labels come from the catalog, so renaming a
 * family is a translation change rather than a data migration — which is the
 * whole point of ids being permanent (see job-families.ts).
 *
 * Ordered by group so the list reads as sections rather than alphabet soup.
 */
export function useJobFamilyOptions(): ChipOption[] {
  const t = useTranslations('families')
  const families = activeJobFamilies()

  return JOB_FAMILY_GROUPS.flatMap((group) =>
    families
      .filter((family) => family.group === group)
      .map((family) => ({ value: family.id, label: t(family.id) })),
  )
}

/**
 * Renders stored family ids as readable labels.
 *
 * Unknown ids are skipped rather than shown raw: data written by a newer deploy
 * can name a family this build has never heard of, and `engineering-quantum` in
 * the UI is worse than one missing chip.
 */
export function useJobFamilyLabels(): (ids: readonly string[]) => string[] {
  const t = useTranslations('families')
  const known = new Set(activeJobFamilies().map((family) => family.id))
  return (ids) => ids.filter((id) => known.has(id)).map((id) => t(id))
}
