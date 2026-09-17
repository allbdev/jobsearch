import 'server-only'

import { headers } from 'next/headers'
import type {
  Feed,
  FeedDefinitionInput,
  FeedSort,
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
  Account,
  ChangePasswordRequest,
  DeleteAccountRequest,
  JobInteraction,
  OAuthCallbackRequest,
  OAuthProvider,
  OAuthStartResponse,
  ProfileInput,
  ResetPasswordRequest,
  SessionUser,
} from '@jobsearch/shared'
import {
  accountSchema,
  historyEntrySchema,
  oauthStartResponseSchema,
  profileSchema,
  sessionUserSchema,
} from '@jobsearch/shared'

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

export function getFeed(
  feedId: string,
  now: number,
  page: { sort?: FeedSort; offset?: number } = {},
): Promise<FeedResult> {
  if (!apiConfigured) return Promise.resolve(fixtures.feedResult(feedId, now))
  const query = new URLSearchParams()
  if (page.sort) query.set('sort', page.sort)
  if (page.offset) query.set('offset', String(page.offset))
  const suffix = query.size > 0 ? `?${query}` : ''
  return request(`/feeds/${encodeURIComponent(feedId)}${suffix}`, feedResultSchema)
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

/** The signed-in user's profile, or null when they have not saved one yet (#61). */
export async function getProfile(): Promise<Profile | null> {
  if (!apiConfigured) return fixtures.profile()
  try {
    return await request('/profile', profileSchema)
  } catch (error) {
    if (error instanceof ApiError && error.status === 404) return null
    throw error
  }
}

export function saveProfile(profile: ProfileInput): Promise<Profile> {
  return request('/profile', profileSchema, { method: 'PUT', body: profile })
}

/** The account itself: what a profile screen shows before a profile exists. */
export function getMe(): Promise<SessionUser> {
  return request('/auth/me', sessionUserSchema)
}

export function getHistory(): Promise<HistoryEntry[]> {
  if (!apiConfigured) return Promise.resolve(fixtures.history())
  return request('/profile/history', z.array(historyEntrySchema))
}

/** Saved, applied or dismissed. Replaces whatever was set before (#69). */
export function setInteraction(jobId: string, status: JobInteraction): Promise<unknown> {
  return request(`/jobs/${encodeURIComponent(jobId)}/interaction`, z.unknown(), { method: 'PUT', body: { status } })
}

export function clearInteraction(jobId: string): Promise<void> {
  return request(`/jobs/${encodeURIComponent(jobId)}/interaction`, z.undefined(), { method: 'DELETE' })
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

export function changePassword(change: ChangePasswordRequest): Promise<void> {
  return request('/auth/password/change', z.undefined(), { method: 'POST', body: change })
}

/** How this person can sign in, and what is linked to the account. */
export function getAccount(): Promise<Account> {
  return request('/account', accountSchema)
}

export function unlinkConnection(provider: OAuthProvider): Promise<void> {
  return request(`/account/connections/${provider}`, z.undefined(), { method: 'DELETE' })
}

export function deleteAccount(confirmation: DeleteAccountRequest): Promise<void> {
  return request('/account', z.undefined(), { method: 'DELETE', body: confirmation })
}

/** From a link in a digest email: no session, just the token (#81). */
export function unsubscribeFromDigest(token: string): Promise<void> {
  return request('/digest/unsubscribe', z.undefined(), { method: 'POST', body: { token } })
}
