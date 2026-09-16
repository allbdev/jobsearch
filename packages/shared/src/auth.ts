import { z } from 'zod'

/**
 * Sign-in request and response shapes (D15). Shared so the web's forms and the
 * API reject the same input for the same reason.
 */

/** Lowercased and trimmed on parse: `users.email` is unique as stored. */
export const emailSchema = z.string().trim().toLowerCase().email().max(254)

/**
 * Length only, per NIST SP 800-63B: composition rules push people toward
 * `Password1!` and a length floor does more. The ceiling is not about security;
 * it caps the work an attacker can make argon2 do per request.
 */
export const passwordSchema = z.string().min(10).max(128)

export const registerRequestSchema = z.object({
  email: emailSchema,
  password: passwordSchema,
  name: z.string().trim().min(1).max(100).optional(),
})
export type RegisterRequest = z.infer<typeof registerRequestSchema>

export const loginRequestSchema = z.object({
  email: emailSchema,
  // No length floor on login: a rule tightened later must not lock out an
  // account whose password was valid when it was set.
  password: z.string().min(1).max(128),
})
export type LoginRequest = z.infer<typeof loginRequestSchema>

export const sessionUserSchema = z.object({
  id: z.string(),
  email: z.string(),
  name: z.string().nullable(),
  emailVerified: z.boolean(),
})
export type SessionUser = z.infer<typeof sessionUserSchema>

/** The web stores `token` in an httpOnly cookie and forwards it as a bearer. */
export const sessionResponseSchema = z.object({
  token: z.string(),
  expiresAt: z.string().datetime(),
  user: sessionUserSchema,
})
export type SessionResponse = z.infer<typeof sessionResponseSchema>

/** The token from an emailed link, as the web forwards it. */
export const emailTokenRequestSchema = z.object({ token: z.string().min(1).max(200) })
export type EmailTokenRequest = z.infer<typeof emailTokenRequestSchema>

/**
 * Why an emailed link did not work. Distinguished because each needs a
 * different sentence: "already used" is usually a second click and needs no
 * action; "expired" needs a new link.
 */
export const emailTokenFailureSchema = z.enum(['invalid', 'expired', 'used'])
export type EmailTokenFailure = z.infer<typeof emailTokenFailureSchema>
