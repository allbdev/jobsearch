import { CONTRACT_MODEL_LABELS, type ContractModel } from './eligibility'

/**
 * Picker option lists.
 *
 * Job families and regions used to live here as display strings; they now have
 * their own modules with stable ids (`job-families.ts`, `regions.ts`). The
 * languages list below is still display strings and still needs the same
 * treatment.
 */

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
