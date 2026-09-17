'use server'

import * as api from '@/server/api-client'
import { ApiError } from '@/server/api-client'

export type UnsubscribeOutcome = 'done' | 'unknown' | 'unavailable'

export interface UnsubscribeState {
  outcome?: UnsubscribeOutcome
}

export async function unsubscribeAction(_: UnsubscribeState, form: FormData): Promise<UnsubscribeState> {
  try {
    await api.unsubscribeFromDigest(String(form.get('token') ?? ''))
    return { outcome: 'done' }
  } catch (error) {
    return { outcome: error instanceof ApiError && error.status === 404 ? 'unknown' : 'unavailable' }
  }
}
