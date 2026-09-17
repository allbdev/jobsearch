/**
 * The session cookie's name, on its own so middleware can read it without
 * importing server-only modules.
 *
 * The web holds the session; the API only ever sees it as a bearer token (D15).
 */
export const SESSION_COOKIE = 'jobsearch_session'

/**
 * Holds `state`, the PKCE verifier and the page's locale between the redirect
 * to Google or GitHub and the callback -- ten minutes at most, then gone.
 */
export const OAUTH_COOKIE = 'jobsearch_oauth'
