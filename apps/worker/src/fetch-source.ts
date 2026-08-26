import { prisma } from '@jobsearch/db'
import { createHttpClient, getAdapter } from '@jobsearch/sources'
import { log } from './log'

export interface FetchResult {
  fetched: number
  created: number
  updated: number
  unchanged: number
}

/**
 * Stage 1 of the pipeline (PLAN.md §4): pull a source and store what it
 * returned. Nothing is normalised or classified here.
 *
 * Idempotent by `(sourceId, externalId)`: a second run over unchanged postings
 * writes nothing, which is what makes it safe to schedule aggressively.
 */
export async function fetchSource(slug: string): Promise<FetchResult> {
  const source = await prisma.source.findUnique({ where: { slug } })
  if (!source) throw new Error(`No source row for "${slug}". Seed it first: pnpm worker seed`)
  if (!source.enabled) throw new Error(`Source "${slug}" is disabled`)

  const adapter = getAdapter(slug)
  const http = createHttpClient()
  const result: FetchResult = { fetched: 0, created: 0, updated: 0, unchanged: 0 }

  try {
    for await (const posting of adapter.fetch({ config: source.config, http, log })) {
      result.fetched++

      const existing = await prisma.rawPosting.findUnique({
        where: { sourceId_externalId: { sourceId: source.id, externalId: posting.externalId } },
        select: { id: true, contentHash: true },
      })

      if (!existing) {
        await prisma.rawPosting.create({
          data: {
            sourceId: source.id,
            externalId: posting.externalId,
            payload: posting.payload as object,
            contentHash: posting.contentHash,
          },
        })
        result.created++
        continue
      }

      if (existing.contentHash === posting.contentHash) {
        // The point of the hash. Rewriting an identical row would churn
        // updatedAt and make every downstream stage think it had work to do.
        result.unchanged++
        continue
      }

      await prisma.rawPosting.update({
        where: { id: existing.id },
        data: {
          payload: posting.payload as object,
          contentHash: posting.contentHash,
          fetchedAt: new Date(),
        },
      })
      result.updated++
    }

    await prisma.source.update({
      where: { id: source.id },
      data: { lastPolledAt: new Date(), failureStreak: 0, lastError: null },
    })
  } catch (error) {
    // A source that quietly stops returning results is how an index rots
    // without anyone noticing (PLAN.md §7), so the failure is recorded on the
    // row rather than only in the logs.
    await prisma.source.update({
      where: { id: source.id },
      data: { failureStreak: { increment: 1 }, lastError: String(error) },
    })
    throw error
  }

  return result
}
