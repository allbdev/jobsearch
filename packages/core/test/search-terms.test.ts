import { describe, expect, it } from 'vitest'
import { findTermMatch } from '../src/search-terms'

const canonical =
  'Canonical is a leading provider of open source software. For front end development we prefer React and Flutter. Join us in our mission.'

describe('why a posting answered a search term', () => {
  it('quotes the sentence the term is in', () => {
    const match = findTermMatch(['react'], 'Golang Engineer', canonical)
    // The row that made this necessary: a Golang job matching "react" through
    // a paragraph pasted into every Canonical posting.
    expect(match).toEqual({
      term: 'react',
      snippet: 'For front end development we prefer React and Flutter.',
      field: 'description',
    })
  })

  it('says so plainly when the title is the match', () => {
    const match = findTermMatch(['react'], 'Senior React Engineer', canonical)
    expect(match?.field).toBe('title')
    expect(match?.snippet).toBe('Senior React Engineer')
  })

  it('agrees with the query about what a word is', () => {
    // `searchText` matches ' react ', so "reactive" is not a match and this
    // must not claim one -- a posting that matched cannot fail to say why, and
    // one that did not match must not be explained.
    expect(findTermMatch(['react'], 'Security Engineer', 'We are both reactive and proactive.')).toBeNull()
    expect(findTermMatch(['rust'], 'Engineer', 'A trusted partner.')).toBeNull()
  })

  it('reads punctuation inside a term the way the query flattens it', () => {
    // "node.js" typed by a reader finds "Node.js", "node js" and "node-js",
    // because `searchText` collapses every separator to one space.
    for (const text of ['We use Node.js here.', 'We use node js here.', 'We use node-js here.']) {
      expect(findTermMatch(['node.js'], 'Engineer', text)?.term).toBe('node.js')
    }
  })

  it('explains the first term rather than every one', () => {
    // Every term already matched or the row would not be in the feed. One
    // quote answers "why is this here" without a wall of citations.
    const match = findTermMatch(['react', 'flutter'], 'Engineer', canonical)
    expect(match?.term).toBe('react')
  })

  it('returns null rather than inventing a quote', () => {
    // The feed matches `searchText`, which folds in `skills`. A posting can
    // match on a field with no sentence to quote.
    expect(findTermMatch(['kubernetes'], 'Engineer', canonical)).toBeNull()
    expect(findTermMatch([], 'Engineer', canonical)).toBeNull()
    expect(findTermMatch(['++'], 'Engineer', canonical)).toBeNull()
  })

  it('does not let a term be read as a regular expression', () => {
    expect(() => findTermMatch(['c++', '(a|b)'], 'Engineer', 'We write C++ here.')).not.toThrow()
    expect(findTermMatch(['c++'], 'Engineer', 'We write C++ here.')?.term).toBe('c++')
  })
})
