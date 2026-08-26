import { CONTRACT_MODEL_LABELS, type ContractModel } from './eligibility'

/**
 * Region and contract option lists.
 *
 * Job families used to live here as a placeholder; they now have their own
 * module with stable ids and a growth policy — see `job-families.ts` and
 * PLAN.md D12. These remaining lists are still display strings and still need
 * the same treatment.
 */

export const ELIGIBILITY_REGIONS = [
  'Worldwide',
  'LATAM',
  'Americas',
  'Brazil listed',
  'EU-eligible',
] as const

export const TARGET_REGIONS = [
  'USA',
  'Canada',
  'Europe',
  'Worldwide only',
  'Anywhere hiring LATAM',
] as const

export const WORK_LANGUAGES = ['English', 'Português', 'Español', 'Deutsch', 'Français'] as const

export const CONTRACT_MODELS: ContractModel[] = [
  'contractor_pj',
  'eor',
  'local_entity',
  'employee_relocation',
]

export const contractOptions = CONTRACT_MODELS.map((value) => ({
  value,
  label: CONTRACT_MODEL_LABELS[value],
}))

/** Turns a plain string list into `ChipToggleGroup` options. */
export function chipOptions<T extends string>(values: readonly T[]) {
  return values.map((value) => ({ value, label: value }))
}
