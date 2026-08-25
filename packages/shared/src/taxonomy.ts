import { CONTRACT_MODEL_LABELS, type ContractModel } from './eligibility'

/**
 * Placeholder option lists.
 *
 * These are hardcoded here, once, so the Feed dialog and the Profile screen
 * cannot drift apart — the design source declares its own copy in each screen.
 *
 * They are a stand-in for the real occupation taxonomy (PLAN.md §9 open
 * question: ESCO vs O*NET vs homegrown). When that lands, these become a
 * fetched, versioned dataset; the component contract does not change.
 */

export const JOB_FAMILIES = [
  'Engineering — Frontend',
  'Engineering — Fullstack',
  'Engineering — Backend',
  'Design — Product',
  'Marketing — Growth',
  'Support / CX',
  'Finance — Accounting',
  'Operations',
] as const

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
