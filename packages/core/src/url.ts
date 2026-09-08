/**
 * Query parameters that identify where a click came from rather than what the
 * posting is. Two links to the same job differing only by these are the same
 * job, and leaving them in defeats dedup.
 */
const TRACKING_PARAMS = [
  /^utm_/i,
  /^gh_src$/i,
  /^(ref|source|src)$/i,
  /^(fbclid|gclid|msclkid|mc_cid|mc_eid)$/i,
  /^lever-(origin|source)$/i,
]

/**
 * Parameters that identify *which posting* a link points at.
 *
 * These are the opposite of tracking parameters and were mistakenly listed
 * among them: `gh_src` says where a click came from, `gh_jid` is Greenhouse's
 * job id. Stripping it turned `jobs.elastic.co/jobs?gh_jid=8066491` into
 * `jobs.elastic.co/jobs` -- a generic listing page that answers 302, so it
 * looked healthy from every angle except a human clicking it. 253 jobs across
 * three boards shared one useless link.
 *
 * They are still removed for *dedup*, and that distinction is the whole point
 * of having two functions. An employer that lists one role once per country
 * gives each listing its own `gh_jid`; keeping them in the dedup key would
 * split one role into ten jobs and undo the merge #38 exists to protect.
 *
 * So: the stored link keeps them, and the dedup key does not.
 */
const POSTING_ID_PARAMS = [/^gh_jid$/i]

/**
 * Canonical form of an apply URL, for storing and for sending a user to.
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
  // Sources repeat themselves: Greenhouse hands out
  // `?gh_jid=7812397&gh_jid=7812397`. Identical repeats say nothing twice, and
  // `sort()` keeps both. Distinct values for one key are left alone -- that is
  // a multi-valued parameter, not a duplicate.
  for (const key of [...new Set(url.searchParams.keys())]) {
    const all = url.searchParams.getAll(key)
    const unique = [...new Set(all)]
    if (unique.length !== all.length) {
      url.searchParams.delete(key)
      for (const value of unique) url.searchParams.append(key, value)
    }
  }

  // Stable ordering, so two links with the same params in a different order
  // hash identically.
  url.searchParams.sort()

  if (url.pathname !== '/' && url.pathname.endsWith('/')) {
    url.pathname = url.pathname.replace(/\/+$/, '')
  }

  return url.toString().replace(/\?$/, '')
}

/**
 * The form of an apply URL used to decide whether two postings are one job.
 *
 * Stricter than `canonicalizeUrl`, because identity for a *link* and identity
 * for a *job* are different questions: two listings of one role in two
 * countries are the same job and must not both appear in a feed, but they are
 * not the same link and a user has to be sent to the right one.
 */
export function dedupUrl(input: string): string {
  const canonical = canonicalizeUrl(input)
  let url: URL
  try {
    url = new URL(canonical)
  } catch {
    return canonical
  }

  for (const key of [...url.searchParams.keys()]) {
    if (POSTING_ID_PARAMS.some((pattern) => pattern.test(key))) url.searchParams.delete(key)
  }
  return url.toString().replace(/\?$/, '')
}
