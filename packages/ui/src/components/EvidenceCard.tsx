import type { ReactNode } from 'react'
import { Blueprint } from '../primitives/Blueprint'
import { Kicker, Muted } from '../primitives/Text'
import { Stack } from '../primitives/Stack'
import { color, hairline, tint } from '@jobsearch/design-system/tokens'

export interface EvidenceCardProps {
  snippet: string
  /** Rendered under the quote — source link, verification date, classifier version. */
  footer?: ReactNode
  kicker?: string
  /**
   * `inline` sits inside an already-framed container (the feed row's evidence
   * panel) and uses a tinted hairline box. `framed` stands alone on the page
   * (the landing example) and wears the full blueprint frame with registration
   * marks, which the design system requires of any standalone framed element.
   */
  variant?: 'inline' | 'framed'
}

/**
 * The quoted line from a posting that proves geographic eligibility — the
 * product's core claim, rendered the same way wherever it appears.
 */
export function EvidenceCard({
  snippet,
  footer,
  kicker = 'Eligibility evidence',
  variant = 'inline',
}: EvidenceCardProps) {
  const body = (
    <>
      <Kicker>{kicker}</Kicker>
      <p style={{ margin: 0, fontSize: 13.5, fontStyle: 'italic' }}>{`“${snippet}”`}</p>
      {footer ? (
        <Muted as="div" style={{ fontSize: 12 }}>
          {footer}
        </Muted>
      ) : null}
    </>
  )

  if (variant === 'framed') {
    return (
      <Blueprint style={{ padding: 'var(--space-3)' }}>
        <Stack gap="2">{body}</Stack>
      </Blueprint>
    )
  }

  return (
    <Stack
      gap="2"
      style={{
        border: hairline,
        padding: 'var(--space-3)',
        background: tint(color.accent, 4),
      }}
    >
      {body}
    </Stack>
  )
}
