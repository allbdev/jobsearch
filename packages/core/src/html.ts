const ENTITIES: Record<string, string> = {
  amp: '&',
  lt: '<',
  gt: '>',
  quot: '"',
  apos: "'",
  nbsp: ' ',
  ndash: '–',
  mdash: '—',
  lsquo: '‘',
  rsquo: '’',
  ldquo: '“',
  rdquo: '”',
  hellip: '…',
  bull: '•',
}

/** One pass of entity decoding. Named entities plus numeric, decimal and hex. */
function decodeOnce(input: string): string {
  return input.replace(/&(#x?[0-9a-fA-F]+|[a-zA-Z]+);/g, (match, body: string) => {
    if (body[0] === '#') {
      const codePoint =
        body[1] === 'x' || body[1] === 'X'
          ? Number.parseInt(body.slice(2), 16)
          : Number.parseInt(body.slice(1), 10)
      return Number.isFinite(codePoint) && codePoint > 0 && codePoint <= 0x10ffff
        ? String.fromCodePoint(codePoint)
        : match
    }
    return ENTITIES[body.toLowerCase()] ?? match
  })
}

/**
 * HTML fragment to plain text.
 *
 * Decodes **twice**, which is not paranoia: Greenhouse double-encodes its
 * `content` field. Every posting in the corpus contains `&amp;nbsp;`, meaning
 * the stored text has `&amp;nbsp;` → `&nbsp;` → a space. One pass leaves markup
 * as visible literal text; the description would read `<p>We are hiring</p>`.
 *
 * Two passes is safe on single-encoded input too — the second finds nothing to
 * decode. The tradeoff is that a posting deliberately displaying the literal
 * text `&lt;` loses it, which is a fair trade against every description being
 * unreadable.
 *
 * Block-level tags become newlines so paragraphs and list items stay separated;
 * otherwise sentences run together and both the search vector and the
 * classifier see one undifferentiated wall.
 */
export function htmlToText(html: string): string {
  if (!html) return ''

  let text = decodeOnce(html)

  text = text
    .replace(/<(script|style)\b[^>]*>[\s\S]*?<\/\1>/gi, ' ')
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/(p|div|li|h[1-6]|tr|section|article)>/gi, '\n')
    .replace(/<li\b[^>]*>/gi, '• ')
    .replace(/<[^>]+>/g, ' ')

  text = decodeOnce(text)

  return text
    .replace(/ /g, ' ')
    .replace(/[ \t]+/g, ' ')
    .replace(/ *\n */g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim()
}
