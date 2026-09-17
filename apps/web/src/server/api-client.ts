import 'server-only'

import { headers } from 'next/headers'
import type {
  Feed,
  FeedDefinitionInput,
  FeedResult,
  HistoryEntry,
  LoginRequest,
  Profile,
  RegisterRequest,
  SessionResponse,
} from '@jobsearch/shared'
import { feedResultSchema, feedSchema, sessionResponseSchema } from '@jobsearch/shared'
import { z } from 'zod'
import * as fixtures from './fixtures'
import { getSessionToken } from './session'

import type {
  OAuthCallbackRequest,
  OAuthProvider,
  OAuthStartResponse,
  ResetPasswordRequest,
  SessionUser,
} from '@jobsearch/shared'
import { oauthStartResponseSchema, sessionUserSchema } from '@jobsearch/shared'

/**
 * THE ONLY PLACE THE WEB APP GETS DATA.
 *
 * Per PLAN.md D5 the web tier is a BFF: it may render on the server, but it
 * never reaches Postgres. Every read goes through this module, which calls
 * `apps/api` over HTTP.
 *
 * Without API_URL the reads resolve fixtures, so the screens can be worked on
 * with no API running; sign-in then reports itself unavailable.
 *
 * `server-only` makes an accidental client import a build error rather than a
 * runtime leak.
 */

const API_URL = process.env.API_URL

export const apiConfigured = Boolean(API_URL)

/** A non-2xx answer from the API, kept whole so callers can branch on status. */
export class ApiError extends Error {
  constructor(
    readonly status: number,
    readonly body: unknown,
  ) {
    super(`API answered ${status}`)
  }
}

async function request<S extends z.ZodTypeAny>(
  path: string,
  schema: S,
  init: { method?: 'GET' | 'POST' | 'PUT' | 'DELETE'; body?: unknown } = {},
): Promise<z.output<S>> {
  if (!API_URL) throw new ApiError(503, { message: 'API_URL is not set' })

  const outgoing: Record<string, string> = { accept: 'application/json' }
  if (init.body !== undefined) outgoing['content-type'] = 'application/json'

  const token = await getSessionToken()
  if (token) outgoing.authorization = `Bearer ${token}`

  // The browser's address, for the API's rate limits. Every request reaches the
  // API from this server, so without it all users share one limit (#54).
  const forwardedFor = (await headers()).get('x-forwarded-for')
  if (forwardedFor) outgoing['x-forwarded-for'] = forwardedFor

  const response = await fetch(`${API_URL}${path}`, {
    method: init.method ?? 'GET',
    headers: outgoing,
    body: init.body === undefined ? undefined : JSON.stringify(init.body),
    // Per-user answers must never land in a cache another request can read.
    cache: 'no-store',
  })

  const body: unknown = response.status === 204 ? undefined : await response.json().catch(() => undefined)
  if (!response.ok) throw new ApiError(response.status, body)
  // Validate at the boundary so a contract drift surfaces here, not three
  // components deep.
  return schema.parse(body)
}

export function getFeed(feedId: string, now: number): Promise<FeedResult> {
  if (!apiConfigured) return Promise.resolve(fixtures.feedResult(feedId, now))
  return request(`/feeds/${encodeURIComponent(feedId)}`, feedResultSchema)
}

export function listFeeds(now: number) {
  if (!apiConfigured) return Promise.resolve(fixtures.feeds(now))
  return request('/feeds', z.array(feedResultSchema.shape.feed))
}

/** Saves a new feed (no id) or replaces an existing one. */
export function saveFeed(feedId: string | null, definition: FeedDefinitionInput): Promise<Feed> {
  return feedId
    ? request(`/feeds/${encodeURIComponent(feedId)}`, feedSchema, { method: 'PUT', body: definition })
    : request('/feeds', feedSchema, { method: 'POST', body: definition })
}

export function deleteFeed(feedId: string): Promise<void> {
  return request(`/feeds/${encodeURIComponent(feedId)}`, z.undefined(), { method: 'DELETE' })
}

// Fixtures until the API serves a profile and its history; both screens are
// built against the same contract, so only these two functions change then.
export function getProfile(): Promise<Profile> {
  return Promise.resolve(fixtures.profile())
}

export function getHistory(): Promise<HistoryEntry[]> {
  return Promise.resolve(fixtures.history())
}

export function signIn(credentials: LoginRequest): Promise<SessionResponse> {
  return request('/auth/login', sessionResponseSchema, { method: 'POST', body: credentials })
}

export function register(account: RegisterRequest): Promise<SessionResponse> {
  return request('/auth/register', sessionResponseSchema, { method: 'POST', body: account })
}

export function signOut(): Promise<void> {
  return request('/auth/logout', z.undefined(), { method: 'POST' })
}

/** Always resolves for a well-formed address: the API never says whether it has an account. */
export function requestPasswordReset(email: string): Promise<void> {
  return request('/auth/password/forgot', z.undefined(), { method: 'POST', body: { email } })
}

export function resetPassword(input: ResetPasswordRequest): Promise<SessionResponse> {
  return request('/auth/password/reset', sessionResponseSchema, { method: 'POST', body: input })
}

export function verifyEmail(token: string): Promise<SessionUser> {
  return request('/auth/verify-email', sessionUserSchema, { method: 'POST', body: { token } })
}

export function startOAuth(provider: OAuthProvider): Promise<OAuthStartResponse> {
  return request(`/auth/oauth/${provider}/start`, oauthStartResponseSchema)
}

export function completeOAuth(provider: OAuthProvider, exchange: OAuthCallbackRequest): Promise<SessionResponse> {
  return request(`/auth/oauth/${provider}/callback`, sessionResponseSchema, { method: 'POST', body: exchange })
}
