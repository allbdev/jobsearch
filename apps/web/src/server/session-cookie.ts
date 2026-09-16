/**
 * The session cookie's name, on its own so middleware can read it without
 * importing server-only modules.
 *
 * The web holds the session; the API only ever sees it as a bearer token (D15).
 */
export const SESSION_COOKIE = 'jobsearch_session'
