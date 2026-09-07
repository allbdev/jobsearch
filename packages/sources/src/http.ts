import type { HttpClient } from './types'

export interface HttpOptions {
  /** Minimum gap between requests to the same host. We are a guest on these APIs. */
  minIntervalMs?: number
  timeoutMs?: number
  retries?: number
  userAgent?: string
}

/**
 * One request per host per interval. Extracted so the link checker is a guest
 * on the same terms the crawler is -- it visits far more hosts, and far more of
 * them are employer sites rather than ATS APIs.
 */
function makeThrottle(minIntervalMs: number) {
  const lastRequestAt = new Map<string, number>()
  return async (host: string) => {
    const last = lastRequestAt.get(host) ?? 0
    const wait = last + minIntervalMs - Date.now()
    if (wait > 0) await new Promise((resolve) => setTimeout(resolve, wait))
    lastRequestAt.set(host, Date.now())
  }
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

  const throttle = makeThrottle(minIntervalMs)

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

export interface LinkChecker {
  /** The HTTP status an apply URL answers with, or 0 when it cannot be reached. */
  status(url: string): Promise<number>
}

/**
 * Checks whether an apply URL still resolves.
 *
 * Separate from `HttpClient` because it wants the opposite things: a status
 * code rather than a body, no retries on a 404 (which is the answer, not a
 * failure), and a slower default interval because it visits thousands of
 * employer sites rather than a handful of ATS APIs.
 *
 * HEAD first, since a job description is a large page to download in order to
 * learn a number. Plenty of sites answer HEAD with 405 or 403 while serving GET
 * perfectly, so that falls back rather than being believed.
 */
export function createLinkChecker(options: HttpOptions = {}): LinkChecker {
  const {
    minIntervalMs = 1_000,
    timeoutMs = 15_000,
    userAgent = 'JobSearchBot/0.1 (+https://github.com/allbdev/jobsearch)',
  } = options

  const throttle = makeThrottle(minIntervalMs)

  async function request(url: string, method: 'HEAD' | 'GET'): Promise<number> {
    const response = await fetch(url, {
      method,
      redirect: 'follow',
      headers: { 'user-agent': userAgent },
      signal: AbortSignal.timeout(timeoutMs),
    })
    return response.status
  }

  return {
    async status(url: string) {
      let host: string
      try {
        host = new URL(url).host
      } catch {
        // A URL we cannot even parse is not a network problem; it is a broken
        // row, and 0 records "we never got an answer".
        return 0
      }

      await throttle(host)
      try {
        const head = await request(url, 'HEAD')
        if (head !== 405 && head !== 403 && head !== 501) return head

        await throttle(host)
        return await request(url, 'GET')
      } catch {
        return 0
      }
    },
  }
}
