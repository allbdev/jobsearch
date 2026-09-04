import { describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'
import { classifyByRules } from '@jobsearch/core'
import { leverAdapter, leverContentHash, leverLocation } from '../src/lever'
import type { FetchContext, FetchedPosting } from '../src/types'

const board = JSON.parse(
  readFileSync(new URL('./fixtures/lever-board.json', import.meta.url), 'utf8'),
) as Record<string, unknown>[]

function context(over: Partial<FetchContext> = {}): FetchContext {
  return {
    config: { boards: [{ slug: 'veeva', name: 'Veeva Systems' }] },
    http: { getJson: async () => board },
    log: () => {},
    reportFailure: () => {},
    ...over,
  }
}

async function collect(ctx: FetchContext): Promise<FetchedPosting[]> {
  const out: FetchedPosting[] = []
  for await (const posting of leverAdapter.fetch(ctx)) out.push(posting)
  return out
}

describe('fetch', () => {
  it('yields every posting, namespaced by board', async () => {
    const postings = await collect(context())
    expect(postings).toHaveLength(board.length)
    expect(postings[0]!.externalId).toMatch(/^veeva:/)
  })

  it('stores the posting untouched, plus the board identity it lacks', async () => {
    const [first] = await collect(context())
    const payload = first!.payload as { board: string; company: string; posting: Record<string, unknown> }
    expect(payload.company).toBe('Veeva Systems')
    // The posting is the response as received -- nothing stripped, or normalize
    // could not replay from it.
    expect(payload.posting).toEqual(board[0])
  })

  it('reports a dead board and carries on with the rest', async () => {
    const failures: string[] = []
    const postings = await collect(
      context({
        config: {
          boards: [
            { slug: 'gone', name: 'Gone Inc' },
            { slug: 'veeva', name: 'Veeva Systems' },
          ],
        },
        http: {
          getJson: async (url: string) => {
            if (url.includes('gone')) throw new Error('HTTP 404')
            return board
          },
        },
        reportFailure: (scope) => failures.push(scope),
      }),
    )
    expect(failures).toEqual(['board:gone'])
    expect(postings).toHaveLength(board.length)
  })

  it('treats an empty board as quiet, not broken', async () => {
    const failures: string[] = []
    const postings = await collect(
      context({ http: { getJson: async () => [] }, reportFailure: (scope) => failures.push(scope) }),
    )
    expect(postings).toEqual([])
    expect(failures).toEqual([])
  })

  it('rejects a config without board names', async () => {
    await expect(collect(context({ config: { boards: ['veeva'] } }))).rejects.toThrow(
      /invalid source config/,
    )
  })
})

describe('normalize', () => {
  const normalized = board.map((posting) =>
    leverAdapter.normalize({ board: 'veeva', company: 'Veeva Systems', posting }),
  )

  it('normalizes every fixture posting', () => {
    expect(normalized.every((n) => n !== null)).toBe(true)
  })

  it('takes the company from the envelope, since Lever never states it', () => {
    expect(normalized[0]!.companyName).toBe('Veeva Systems')
  })

  it('returns null rather than throwing on a payload it cannot read', () => {
    expect(leverAdapter.normalize({ posting: { id: 'x' } })).toBeNull()
    expect(leverAdapter.normalize(null)).toBeNull()
  })

  it('keeps the requirements list, where a work-authorisation clause lives', () => {
    const withLists = board.find((p) => ((p.lists as unknown[]) ?? []).length > 0)!
    const result = leverAdapter.normalize({ board: 'veeva', company: 'Veeva', posting: withLists })!
    const heading = ((withLists.lists as { text: string }[])[0]!).text
    expect(result.description).toContain(heading)
    // …and the list HTML arrives as text, not markup.
    expect(result.description).not.toMatch(/<li>|<div>/)
  })
})

describe('leverLocation', () => {
  it('writes Lever’s own two fields in the form the rules already read', () => {
    expect(leverLocation({ workplaceType: 'remote', categories: { allLocations: ['Canada'] } } as never)).toBe(
      'Remote — Canada',
    )
    expect(leverLocation({ workplaceType: 'onsite', categories: { location: 'Dubai' } } as never)).toBe(
      'On-site — Dubai',
    )
  })

  it('invents nothing when a field is missing', () => {
    expect(leverLocation({ categories: { location: 'Berlin' } } as never)).toBe('Berlin')
    expect(leverLocation({ workplaceType: 'remote' } as never)).toBe('Remote')
    expect(leverLocation({} as never)).toBeNull()
  })
})

// The point of rendering the location that way: this source settles on the free
// pass instead of reaching the LLM. If the rules stop reading these strings,
// every Lever posting silently becomes a paid classification.
describe('the rules can read what this adapter emits', () => {
  it.each([
    ['onsite', 'rejected'],
    ['hybrid', 'rejected'],
    ['remote', 'confirmed'],
  ])('%s postings are settled by the rules as %s', (workplaceType, expected) => {
    const verdict = classifyByRules({
      title: 'Engineer',
      locationRaw: leverLocation({ workplaceType, categories: { location: 'United States' } } as never),
      description: 'Nothing here states a hiring scope.',
    })
    expect(verdict.verdict).toBe(expected)
    expect(verdict.decidedByRules).toBe(true)
  })
})

describe('leverContentHash', () => {
  it('ignores createdAt, which moves without the text changing', () => {
    const posting = board[0] as Record<string, unknown>
    expect(leverContentHash({ ...posting, createdAt: 1 } as never)).toBe(
      leverContentHash({ ...posting, createdAt: 999 } as never),
    )
  })

  it('changes when the workplace type does', () => {
    const posting = board[0] as Record<string, unknown>
    expect(leverContentHash({ ...posting, workplaceType: 'remote' } as never)).not.toBe(
      leverContentHash({ ...posting, workplaceType: 'onsite' } as never),
    )
  })
})
