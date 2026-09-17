'use server'

import type { FeedSort, Job, JobInteraction } from '@jobsearch/shared'
import * as api from '@/server/api-client'

/**
 * Records what the reader did with a job, or clears it.
 *
 * Returns whether it stuck: the screen shows the change at once and puts it
 * back if the server disagreed, rather than lying about what was saved.
 */
export async function setInteractionAction(jobId: string, status: JobInteraction | null): Promise<boolean> {
  try {
    if (status) await api.setInteraction(jobId, status)
    else await api.clearInteraction(jobId)
    return true
  } catch {
    return false
  }
}

/**
 * The next page of a feed, for "Load more".
 *
 * The server sorts and pages; asking it for more is the only way to get jobs
 * the first page did not include.
 */
export async function loadMoreJobsAction(feedId: string, sort: FeedSort, offset: number): Promise<Job[] | null> {
  try {
    return (await api.getFeed(feedId, Date.now(), { sort, offset })).jobs
  } catch {
    return null
  }
}
