import { z } from 'zod'
import { contractModelSchema } from './eligibility'
import { jobSchema } from './job'

/** A saved query over the global index. Users may keep several. */
export const feedDefinitionSchema = z.object({
  name: z.string().min(1),
  jobFamilies: z.array(z.string()),
  eligibleFrom: z.array(z.string()),
  contractModels: z.array(contractModelSchema),
  minCompensation: z.number().nullable(),
  currency: z.string().length(3),
  freshnessDays: z.number().int().positive().default(30),
  /** Hide `rejected`; `needs_check` always shows in its own tier. */
  hideRejected: z.boolean().default(true),
})
export type FeedDefinition = z.infer<typeof feedDefinitionSchema>

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
  indexUpdatedAt: z.string().datetime(),
})
export type FeedStats = z.infer<typeof feedStatsSchema>

export const feedResultSchema = z.object({
  feed: feedSchema,
  jobs: z.array(jobSchema),
  stats: feedStatsSchema,
})
export type FeedResult = z.infer<typeof feedResultSchema>
