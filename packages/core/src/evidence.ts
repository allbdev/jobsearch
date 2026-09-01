/**
 * Pulls the sentence containing a match out of a longer text.
 *
 * Evidence is a column, not a nicety (PLAN.md §4): a `confirmed` verdict has to
 * carry the line that proves it, and the database refuses one that does not.
 * A raw offset would be useless to a reader, so this expands to sentence
 * boundaries and caps the length.
 */
export function extractEvidence(text: string, matchIndex: number, matchLength: number): string {
  const MAX = 300
  const before = text.lastIndexOf('.', matchIndex)
  const newlineBefore = text.lastIndexOf('\n', matchIndex)
  const bulletBefore = text.lastIndexOf('•', matchIndex)
  let start = Math.max(before + 1, newlineBefore + 1, bulletBefore + 1, 0)

  const afterDot = text.indexOf('.', matchIndex + matchLength)
  const afterNewline = text.indexOf('\n', matchIndex + matchLength)
  const candidates = [afterDot, afterNewline].filter((index) => index !== -1)
  let end = candidates.length > 0 ? Math.min(...candidates) + 1 : text.length

  // A sentence that runs past the cap is trimmed around the match rather than
  // from the start, so the matched phrase is always visible in the quote.
  if (end - start > MAX) {
    start = Math.max(start, matchIndex - MAX / 3)
    end = Math.min(end, matchIndex + matchLength + (MAX * 2) / 3)
  }

  const snippet = text.slice(start, end).trim().replace(/\s+/g, ' ')
  return snippet.length > MAX ? `${snippet.slice(0, MAX - 1).trimEnd()}…` : snippet
}
