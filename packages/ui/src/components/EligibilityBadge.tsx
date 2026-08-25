import type { Eligibility, EligibilityVerdict } from '@jobsearch/shared'
import { Tag } from '../primitives/Tag'

export interface EligibilityBadgeProps {
  verdict: EligibilityVerdict
  regionLabel: string
}

/**
 * The product's core signal, rendered identically everywhere it appears —
 * the feed row, the profile history table, and the landing-page example.
 *
 * Keeping the verdict-to-label mapping here means a change to how we phrase
 * "needs check" cannot land in one surface and miss the other two.
 */
export function EligibilityBadge({ verdict, regionLabel }: EligibilityBadgeProps) {
  if (verdict === 'confirmed') {
    return (
      <Tag tone="accent" style={{ fontWeight: 500 }}>
        {`ELIGIBLE · ${regionLabel.toUpperCase()}`}
      </Tag>
    )
  }
  if (verdict === 'needs_check') {
    return (
      <Tag tone="outline" style={{ fontWeight: 500 }}>
        NEEDS CHECK
      </Tag>
    )
  }
  return (
    <Tag tone="neutral" style={{ fontWeight: 500 }}>
      NOT ELIGIBLE
    </Tag>
  )
}

export function eligibilityBadgeProps(eligibility: Eligibility): EligibilityBadgeProps {
  return { verdict: eligibility.verdict, regionLabel: eligibility.regionLabel }
}
