import { z } from 'zod'
import { contractModelSchema } from './eligibility'
import { jobInteractionSchema } from './job'
import { isActiveJobFamily } from './job-families'
import { REGION_VOCABULARY } from './regions'

export const senioritySchema = z.enum(['junior', 'mid', 'senior', 'staff_plus'])
export type Seniority = z.infer<typeof senioritySchema>

/**
 * Display labels for these enums live in the app's message catalogs, not here.
 * A shared package cannot hold a single English string per value once the UI
 * speaks three languages -- shared owns the enum, the app owns the wording.
 */

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

/**
 * The interface languages, as the web's route prefixes spell them. Kept in step
 * with `apps/web/src/i18n/routing.ts` by a test over the message catalogs.
 */
export const INTERFACE_LANGUAGES = ['en', 'pt-br', 'es'] as const
export const interfaceLanguageSchema = z.enum(INTERFACE_LANGUAGES)

export const WEEKDAYS = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'] as const

const unique = <T>(values: T[]) => [...new Set(values)]

function isTimeZone(value: string): boolean {
  try {
    new Intl.DateTimeFormat('en', { timeZone: value })
    return true
  } catch {
    return false
  }
}

/**
 * A profile as a client sends it. Codes, never display strings: residence is
 * matched against `eligibleCountries` as written, and a profile saved as
 * "Brazil" would block nothing and match nothing -- the #48 bug again, on the
 * one field that decides eligibility. Labels are the web's job.
 *
 * `email` is absent on purpose: it belongs to the account, not the profile.
 */
export const profileInputSchema = z.object({
  /** ISO 3166-1 alpha-2, upper case. */
  residenceCountry: z.string().regex(/^[A-Z]{2}$/, 'an ISO 3166-1 alpha-2 code, e.g. BR'),
  /** IANA, e.g. America/Sao_Paulo. */
  timezone: z.string().refine(isTimeZone, 'an IANA time zone, e.g. America/Sao_Paulo'),
  targetRegions: z.array(z.enum(REGION_VOCABULARY)).transform(unique),
  /** BCP-47 language tags, e.g. en, pt-BR. */
  languages: z
    .array(z.string().regex(/^[a-z]{2,3}(-[A-Z]{2})?$/, 'a BCP-47 tag, e.g. pt-BR'))
    .max(10)
    .transform(unique),
  jobFamilies: z
    .array(z.string())
    .max(50)
    .refine((ids) => ids.every(isActiveJobFamily), 'unknown or retired job family')
    .transform(unique),
  targetRoles: z.string().trim().max(300),
  seniority: senioritySchema,
  skills: z.array(z.string().trim().min(1).max(40)).max(50).transform(unique),
  contractModels: z.array(contractModelSchema).transform(unique),
  minCompensation: z.number().nonnegative().max(100_000_000).nullable(),
  currency: z.string().regex(/^[A-Z]{3}$/, 'an ISO 4217 code, e.g. USD'),
  interfaceLanguage: interfaceLanguageSchema,
  digest: z.object({
    cadence: digestCadenceSchema,
    sendOn: z.enum(WEEKDAYS),
    sendAt: z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/, 'HH:MM, 24-hour'),
    language: interfaceLanguageSchema,
  }),
})
export type ProfileInput = z.input<typeof profileInputSchema>

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

/** The unsubscribe link's token, as the digest email carries it. */
export const unsubscribeRequestSchema = z.object({ token: z.string().min(1).max(200) })
export type UnsubscribeRequest = z.infer<typeof unsubscribeRequestSchema>
