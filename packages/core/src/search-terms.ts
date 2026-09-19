import { extractEvidence } from './evidence'

/**
 * Why a posting answered a reader's search term.
 *
 * A term match is not self-explanatory, and pretending it is cost a reader
 * their trust in the whole feed: searching "react" returned *Golang Engineer*
 * and *Software Engineering Director*, because Canonical pastes "we prefer
 * React and Flutter" into every posting it publishes. Six of nine rows looked
 * like a broken filter. They were not -- the word really is in the posting --
 * but nothing on screen said where, so there was no way to tell a boilerplate
 * mention from the job being about React.
 *
 * The rest of this product quotes its evidence (PLAN.md §4). A filter the
 * reader can see the working of is the same idea applied to matching.
 */
export interface TermMatch {
  term: string
  /** The sentence the term appears in, quoted from the posting. */
  snippet: string
  /** Where it was found, because "in the title" needs no quote to be trusted. */
  field: 'title' | 'description'
}

/**
 * The term as it appears in text that has not been flattened.
 *
 * `jobs.searchText` collapses every run of non-alphanumerics to one space and
 * matches `' term '`, so a term typed "node.js" finds "Node.js", "node js" and
 * "node-js". This has to agree with that, or a posting matches the query and
 * then cannot say why -- so the separators inside the term become "any run of
 * non-alphanumerics" and the ends become word boundaries.
 */
function termPattern(term: string): RegExp | null {
  const parts = term
    .toLowerCase()
    .split(/[^\p{L}\p{N}]+/u)
    .filter(Boolean)
    .map((part) => part.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'))

  if (parts.length === 0) return null
  return new RegExp(`(?<![\\p{L}\\p{N}])${parts.join('[^\\p{L}\\p{N}]+')}(?![\\p{L}\\p{N}])`, 'iu')
}

/**
 * The first of the reader's terms that appears in this posting, with the line
 * that proves it.
 *
 * The first rather than all of them: every term must match for the posting to
 * be in the feed at all, so one quote answers "why is this here" without
 * turning a row into a wall of citations. The title wins over the description
 * when both match, because a title match is the strong case.
 *
 * Returns null when nothing matches, which is not an error: the feed query
 * matches `searchText`, which folds in `skills` as well, so a posting can
 * legitimately match on a field there is no sentence to quote from.
 */
export function findTermMatch(
  terms: readonly string[],
  title: string,
  description: string,
): TermMatch | null {
  for (const term of terms) {
    const pattern = termPattern(term)
    if (!pattern) continue

    const inTitle = pattern.exec(title)
    if (inTitle) return { term, snippet: title.trim(), field: 'title' }

    const inDescription = pattern.exec(description)
    if (inDescription) {
      return {
        term,
        snippet: extractEvidence(description, inDescription.index, inDescription[0].length),
        field: 'description',
      }
    }
  }

  return null
}
