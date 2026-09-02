export * from './types'
export { createHttpClient } from './http'
export {
  greenhouseAdapter,
  greenhouseContentHash,
  GREENHOUSE_DEFAULT_BASE_URL,
} from './greenhouse'
export { leverAdapter, leverContentHash, leverLocation, LEVER_DEFAULT_BASE_URL } from './lever'

import { greenhouseAdapter } from './greenhouse'
import { leverAdapter } from './lever'
import type { SourceAdapter } from './types'

/**
 * Every adapter, keyed by the slug in `sources.slug`. The worker looks a source
 * up here rather than importing adapters directly, so adding a source is one
 * line plus its module.
 */
export const ADAPTERS: Record<string, SourceAdapter> = {
  [greenhouseAdapter.slug]: greenhouseAdapter,
  [leverAdapter.slug]: leverAdapter,
}

export function getAdapter(slug: string): SourceAdapter {
  const adapter = ADAPTERS[slug]
  if (!adapter) {
    throw new Error(`No adapter registered for source "${slug}". Known: ${Object.keys(ADAPTERS).join(', ')}`)
  }
  return adapter
}
