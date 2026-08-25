import { z } from 'zod'
import { contractModelSchema } from './eligibility'
import { jobInteractionSchema } from './job'

export const senioritySchema = z.enum(['junior', 'mid', 'senior', 'staff_plus'])
export type Seniority = z.infer<typeof senioritySchema>

export const SENIORITY_LABELS: Record<Seniority, string> = {
  junior: 'Junior',
  mid: 'Mid',
  senior: 'Senior',
  staff_plus: 'Staff+',
}

export const digestCadenceSchema = z.enum(['daily', 'weekly', 'off'])
export type DigestCadence = z.infer<typeof digestCadenceSchema>

export const digestSettingsSchema = z.object({
  cadence: digestCadenceSchema,
  sendOn: z.string(),
  sendAt: z.string(),
  language: z.string(),
})
export type DigestSettings = z.infer<typeof digestSettingsSchema>

export const profileSchema = z.object({
  /**
   * The only blocking field. Timezone overlap is a preference — per PLAN.md §5,
   * only residence or work authorization can disqualify a match.
   */
  residenceCountry: z.string(),
  timezone: z.string(),
  targetRegions: z.array(z.string()),
  languages: z.array(z.string()),
  jobFamilies: z.array(z.string()),
  targetRoles: z.string(),
  seniority: senioritySchema,
  skills: z.array(z.string()),
  contractModels: z.array(contractModelSchema),
  minCompensation: z.number().nullable(),
  currency: z.string().length(3),
  email: z.string().email(),
  /**
   * Durable interface-language preference.
   *
   * It does NOT drive the current page: with locale-prefixed routes the URL is
   * the interface language, and the switcher navigates. This is what the API
   * uses to pick a locale when a signed-in user arrives without a prefix --
   * something the NEXT_LOCALE cookie cannot do across devices.
   */
  interfaceLanguage: z.string(),
  digest: digestSettingsSchema,
})
export type Profile = z.infer<typeof profileSchema>

export const historyEntrySchema = z.object({
  jobId: z.string(),
  title: z.string(),
  company: z.string(),
  regionLabel: z.string(),
  confirmed: z.boolean(),
  status: jobInteractionSchema,
  date: z.string(),
})
export type HistoryEntry = z.infer<typeof historyEntrySchema>
