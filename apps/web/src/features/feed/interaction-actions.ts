'use server'

import type { JobInteraction } from '@jobsearch/shared'
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
