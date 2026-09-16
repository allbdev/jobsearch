import { GitHub, Google, decodeIdToken, generateCodeVerifier, generateState } from 'arctic'
import type { OAuthProvider, OAuthStartResponse } from '@jobsearch/shared'
import { webUrl } from '../../common/web-url'

/** Who the provider says signed in. `emailVerified` is the provider's claim, and linking depends on it (D15). */
export interface OAuthIdentity {
  provider: OAuthProvider
  providerUserId: string
  email: string | null
  emailVerified: boolean
  name: string | null
}

export interface ProviderClient {
  start(): OAuthStartResponse
  identify(code: string, codeVerifier: string | null): Promise<OAuthIdentity>
}

/** A provider with no credentials is off rather than broken: its button 404s. */
export function providerFromEnv(provider: OAuthProvider): ProviderClient | null {
  const redirect = webUrl(`/auth/callback/${provider}`)
  if (provider === 'google') {
    const { GOOGLE_CLIENT_ID: id, GOOGLE_CLIENT_SECRET: secret } = process.env
    return id && secret ? google(new Google(id, secret, redirect)) : null
  }
  const { GITHUB_CLIENT_ID: id, GITHUB_CLIENT_SECRET: secret } = process.env
  return id && secret ? github(new GitHub(id, secret, redirect)) : null
}

function google(client: Google): ProviderClient {
  return {
    start() {
      const state = generateState()
      const codeVerifier = generateCodeVerifier()
      const url = client.createAuthorizationURL(state, codeVerifier, ['openid', 'email', 'profile'])
      return { url: url.toString(), state, codeVerifier }
    },
    async identify(code, codeVerifier) {
      if (!codeVerifier) throw new Error('google requires the PKCE code verifier')
      const tokens = await client.validateAuthorizationCode(code, codeVerifier)
      // Not signature-checked, deliberately: this token came straight from
      // Google's token endpoint over TLS, which OIDC Core §3.1.3.7 accepts as
      // proof of origin. An ID token passed in by a client would need checking.
      const claims = decodeIdToken(tokens.idToken()) as {
        sub: string
        email?: string
        email_verified?: boolean
        name?: string
      }
      return {
        provider: 'google',
        providerUserId: claims.sub,
        email: claims.email?.toLowerCase() ?? null,
        emailVerified: claims.email_verified === true,
        name: claims.name ?? null,
      }
    },
  }
}

function github(client: GitHub): ProviderClient {
  const api = async <T>(path: string, token: string): Promise<T> => {
    const response = await fetch(`https://api.github.com${path}`, {
      headers: { authorization: `Bearer ${token}`, accept: 'application/vnd.github+json', 'user-agent': 'jobsearch' },
    })
    if (!response.ok) throw new Error(`GitHub ${path} failed: ${response.status}`)
    return (await response.json()) as T
  }

  return {
    start() {
      const state = generateState()
      // `user:email`, because the profile's `email` is only the *public* one and
      // is null for most accounts. GitHub OAuth apps do not support PKCE.
      const url = client.createAuthorizationURL(state, ['user:email'])
      return { url: url.toString(), state, codeVerifier: null }
    },
    async identify(code) {
      const token = (await client.validateAuthorizationCode(code)).accessToken()
      const [user, emails] = await Promise.all([
        api<{ id: number; name: string | null; login: string }>('/user', token),
        api<{ email: string; primary: boolean; verified: boolean }[]>('/user/emails', token),
      ])
      const primary = emails.find((entry) => entry.primary)
      return {
        provider: 'github',
        // The numeric id. Logins can be renamed and then claimed by someone else.
        providerUserId: String(user.id),
        email: primary?.email.toLowerCase() ?? null,
        emailVerified: primary?.verified === true,
        name: user.name ?? user.login,
      }
    },
  }
}
