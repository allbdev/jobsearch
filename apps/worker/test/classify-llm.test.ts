import { describe, expect, it } from 'vitest'
import { effortFor, estimateCostUsd, ratesFor } from '../src/classify-llm'

/** One million of each kind of token, so the estimate reads as the rate card. */
const oneMillionEach = {
  inputTokens: 1_000_000,
  cachedInputTokens: 1_000_000,
  cacheWriteTokens: 1_000_000,
  outputTokens: 1_000_000,
}

describe('estimating what a paid pass cost', () => {
  it('prices a run at the rates of the model that actually ran it', () => {
    // 5 + 0.5 + 6.25 + 25 against 1 + 0.1 + 1.25 + 5.
    expect(estimateCostUsd(oneMillionEach, 'claude-opus-5')).toBeCloseTo(36.75, 2)
    expect(estimateCostUsd(oneMillionEach, 'claude-haiku-4-5-20251001')).toBeCloseTo(7.35, 2)
  })

  it('falls back to Opus rates for a model it does not know', () => {
    // Over-estimating is the safe way to be wrong about a bill.
    expect(ratesFor('claude-something-unreleased')).toEqual(ratesFor('claude-opus-5'))
  })

  it('counts cache writes, which bill above the base rate', () => {
    const withoutWrites = { ...oneMillionEach, cacheWriteTokens: 0 }
    expect(estimateCostUsd(oneMillionEach, 'claude-opus-5')).toBeGreaterThan(
      estimateCostUsd(withoutWrites, 'claude-opus-5'),
    )
  })
})

describe('the effort parameter', () => {
  it('goes to Opus, which supports it', () => {
    expect(effortFor('claude-opus-5', 'low')).toEqual({ effort: 'low' })
  })

  it('is left off entirely for Haiku, which rejects the request rather than ignoring it', () => {
    expect(effortFor('claude-haiku-4-5-20251001', 'low')).toEqual({})
  })
})
