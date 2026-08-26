import type { HttpClient } from './types'

export interface HttpOptions {
  /** Minimum gap between requests to the same host. We are a guest on these APIs. */
  minIntervalMs?: number
  timeoutMs?: number
  retries?: number
  userAgent?: string
}

/**
 * The real HTTP client. Adapters take an `HttpClient` rather than calling
 * `fetch` directly, so tests replay recorded fixtures instead of hitting the
 * network — and so rate limiting is enforced in one place rather than trusted
 * to every adapter.
 */
export function createHttpClient(options: HttpOptions = {}): HttpClient {
  const {
    minIntervalMs = 250,
    timeoutMs = 20_000,
    retries = 3,
    // Identifying ourselves is the minimum courtesy owed to a free API we
    // depend on, and it is what lets an operator ask us to slow down rather
    // than simply blocking us.
    userAgent = 'JobSearchBot/0.1 (+https://github.com/allbdev/jobsearch)',
  } = options

  const lastRequestAt = new Map<string, number>()

  async function throttle(host: string) {
    const last = lastRequestAt.get(host) ?? 0
    const wait = last + minIntervalMs - Date.now()
    if (wait > 0) await new Promise((resolve) => setTimeout(resolve, wait))
    lastRequestAt.set(host, Date.now())
  }

  return {
    async getJson(url: string) {
      const host = new URL(url).host
      let lastError: unknown

      for (let attempt = 0; attempt <= retries; attempt++) {
        await throttle(host)
        try {
          const response = await fetch(url, {
            headers: { accept: 'application/json', 'user-agent': userAgent },
            signal: AbortSignal.timeout(timeoutMs),
          })

          // 429 and 5xx are worth retrying; a 404 board is not.
          if (response.status === 429 || response.status >= 500) {
            throw new Error(`HTTP ${response.status} from ${url}`)
          }
          if (!response.ok) {
            throw Object.assign(new Error(`HTTP ${response.status} from ${url}`), {
              permanent: true,
            })
          }
          return await response.json()
        } catch (error) {
          lastError = error
          if ((error as { permanent?: boolean }).permanent) throw error
          if (attempt === retries) break
          // Exponential backoff. A source that is rate limiting us is telling
          // us something; hammering it is how a free API stops being free.
          await new Promise((resolve) => setTimeout(resolve, 2 ** attempt * 500))
        }
      }
      throw lastError
    },
  }
}
