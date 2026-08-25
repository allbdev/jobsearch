/**
 * Typed accessors for the Industry token set defined in `styles.css`.
 *
 * Components reference tokens through these constants rather than writing
 * `var(--color-…)` strings by hand, so a token rename is a compile error
 * instead of a silent visual regression, and a typo is caught at build time
 * instead of rendering as `initial`.
 *
 * Source of truth is `styles.css` — this file only mirrors its `:root`.
 */

export type Step = 100 | 200 | 300 | 400 | 500 | 600 | 700 | 800 | 900

export const color = {
  bg: 'var(--color-bg)',
  surface: 'var(--color-surface)',
  text: 'var(--color-text)',
  accent: 'var(--color-accent)',
  divider: 'var(--color-divider)',
  neutral: (step: Step) => `var(--color-neutral-${step})`,
  accentStep: (step: Step) => `var(--color-accent-${step})`,
} as const

export const font = {
  heading: 'var(--font-heading)',
  headingWeight: 'var(--font-heading-weight)',
  body: 'var(--font-body)',
} as const

export const shadow = {
  sm: 'var(--shadow-sm)',
  md: 'var(--shadow-md)',
  lg: 'var(--shadow-lg)',
} as const

export type SpaceStepName = '1' | '2' | '3' | '4' | '6' | '8'

/** A step on the spacing scale, as a CSS value. */
export const space = (step: SpaceStepName) => `var(--space-${step})`

/**
 * A translucent wash of a role over whatever is behind it. The system prefers
 * ramp steps over ad-hoc mixes, so reach for `color.accentStep(200)` first —
 * this is for the hairline rules and hover tints that have no ramp equivalent.
 */
export const tint = (role: string, percent: number) =>
  `color-mix(in srgb, ${role} ${percent}%, transparent)`

/** The system's one border weight. */
export const hairline = `1px solid ${color.divider}`
