import { prisma } from '@jobsearch/db'
import { createHttpClient, getAdapter } from '@jobsearch/sources'
import { log } from './log'

export interface FetchResult {
  fetched: number
  created: number
  updated: number
  unchanged: number
  /** Failures the adapter recovered from — dead boards, unparseable responses. */
  failures: number
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
  const result: FetchResult = { fetched: 0, created: 0, updated: 0, unchanged: 0, failures: 0 }

  // Ids of postings the source still lists but has not changed. Touched in
  // bulk rather than one statement per posting -- an unchanged crawl is
  // thousands of rows and none of them need reading first.
  const seenUnchanged: string[] = []
  const failures: string[] = []
  const reportFailure = (scope: string, error: unknown) => {
    result.failures++
    failures.push(`${scope}: ${String(error).slice(0, 200)}`)
  }

  try {
    for await (const posting of adapter.fetch({
      config: source.config,
      http,
      log,
      reportFailure,
    })) {
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
        // The point of the hash: the payload is not rewritten, so no
        // downstream stage thinks it has work to do.
        //
        // `fetchedAt` still moves, in one statement after the loop. It is the
        // record that the source *still lists this posting*, which is the only
        // honest evidence that a job is still open -- and without it a posting
        // that never changes is indistinguishable from one that vanished.
        seenUnchanged.push(existing.id)
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

    for (let i = 0; i < seenUnchanged.length; i += 500) {
      await prisma.rawPosting.updateMany({
        where: { id: { in: seenUnchanged.slice(i, i + 500) } },
        data: { fetchedAt: new Date() },
      })
    }

    // A run that recovered from every failure and yielded nothing is not a
    // success. It is indistinguishable from a source with no new postings, and
    // treating it as healthy is how an index rots unnoticed — which it did:
    // all five boards failed and the source still reported ok.
    if (result.failures > 0 && result.fetched === 0) {
      throw new Error(
        `every unit failed and nothing was fetched (${result.failures} failures) — ${failures[0]}`,
      )
    }

    await prisma.source.update({
      where: { id: source.id },
      data: {
        lastPolledAt: new Date(),
        failureStreak: 0,
        // A partial failure still gets recorded. Some postings arrived, so the
        // run is not a failure, but a board that has been dead for a month is
        // worth seeing in `worker health`.
        lastError: failures.length > 0 ? `partial: ${failures.length} failed — ${failures[0]}` : null,
      },
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
