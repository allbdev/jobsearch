/**
 * Query parameters that identify where a click came from rather than what the
 * posting is. Two links to the same job differing only by these are the same
 * job, and leaving them in defeats dedup.
 */
const TRACKING_PARAMS = [
  /^utm_/i,
  /^gh_(src|jid)$/i,
  /^(ref|source|src)$/i,
  /^(fbclid|gclid|msclkid|mc_cid|mc_eid)$/i,
  /^lever-(origin|source)$/i,
]

/**
 * Canonical form of an apply URL, for deduplication.
 *
 * Lowercases the host (case-insensitive by spec) but never the path, which is
 * case-sensitive and frequently carries a slug or id.
 */
export function canonicalizeUrl(input: string): string {
  let url: URL
  try {
    url = new URL(input.trim())
  } catch {
    // Not parseable: return it trimmed rather than throwing. A posting with a
    // malformed URL is still a posting, and link checking will catch it.
    return input.trim()
  }

  url.hash = ''
  url.hostname = url.hostname.toLowerCase().replace(/^www\./, '')
  url.protocol = url.protocol === 'http:' ? 'https:' : url.protocol

  for (const key of [...url.searchParams.keys()]) {
    if (TRACKING_PARAMS.some((pattern) => pattern.test(key))) url.searchParams.delete(key)
  }
  // Stable ordering, so two links with the same params in a different order
  // hash identically.
  url.searchParams.sort()

  if (url.pathname !== '/' && url.pathname.endsWith('/')) {
    url.pathname = url.pathname.replace(/\/+$/, '')
  }

  return url.toString().replace(/\?$/, '')
}
