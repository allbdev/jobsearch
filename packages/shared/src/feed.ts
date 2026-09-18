import { z } from 'zod'
import { contractModelSchema } from './eligibility'
import { jobSchema } from './job'
import { isActiveJobFamily } from './job-families'
import { REGION_VOCABULARY } from './regions'

/** A saved query over the global index. Users may keep several. */
export const feedDefinitionSchema = z.object({
  name: z.string().min(1),
  jobFamilies: z.array(z.string()),
  eligibleFrom: z.array(z.string()),
  contractModels: z.array(contractModelSchema),
  minCompensation: z.number().nullable(),
  currency: z.string().length(3),
  /** Only jobs posted within this many days. Null is any age, the default (D14). */
  freshnessDays: z.number().int().positive().nullable().default(null),
  /** Hide `rejected`; `needs_check` always shows in its own tier. */
  hideRejected: z.boolean().default(true),
})
export type FeedDefinition = z.infer<typeof feedDefinitionSchema>

const unique = <T>(values: T[]) => [...new Set(values)]

/**
 * A definition as a client sends it to create or replace a feed. Stricter than
 * the read shape, which must still round-trip data written under older rules:
 * a feed saved with a region code the matcher does not speak matches nothing,
 * silently (#48), so it is refused at the door instead.
 */
export const feedDefinitionInputSchema = feedDefinitionSchema.extend({
  name: z.string().trim().min(1).max(80),
  jobFamilies: z
    .array(z.string())
    .max(50)
    .refine((ids) => ids.every(isActiveJobFamily), 'unknown or retired job family')
    .transform(unique),
  eligibleFrom: z.array(z.enum(REGION_VOCABULARY)).transform(unique),
  contractModels: z.array(contractModelSchema).transform(unique),
  minCompensation: z.number().nonnegative().max(100_000_000).nullable(),
  currency: z.string().regex(/^[A-Z]{3}$/, 'an ISO 4217 code, e.g. USD'),
})
export type FeedDefinitionInput = z.input<typeof feedDefinitionInputSchema>

export const feedSchema = z.object({
  id: z.string(),
  definition: feedDefinitionSchema,
  matchedCount: z.number().int().nonnegative(),
})
export type Feed = z.infer<typeof feedSchema>

export const feedSortSchema = z.enum(['best_match', 'newest'])
export type FeedSort = z.infer<typeof feedSortSchema>

/** Counts backing the footer stat line — how much was evaluated and dropped. */
export const feedStatsSchema = z.object({
  evaluated: z.number().int().nonnegative(),
  confirmed: z.number().int().nonnegative(),
  needsCheck: z.number().int().nonnegative(),
  dismissedByUser: z.number().int().nonnegative(),
  /**
   * Jobs this feed would have shown but for its family filter, because nothing
   * has named their family yet. Zero when the feed filters by no family.
   */
  withoutFamily: z.number().int().nonnegative(),
  indexUpdatedAt: z.string().datetime(),
})
export type FeedStats = z.infer<typeof feedStatsSchema>

export const feedResultSchema = z.object({
  feed: feedSchema,
  jobs: z.array(jobSchema),
  stats: feedStatsSchema,
})
export type FeedResult = z.infer<typeof feedResultSchema>
