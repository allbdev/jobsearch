/**
 * Combine two location strings without repeating or reordering.
 *
 * Order is preserved so the first source's wording stays first and the result
 * is stable across runs; comparison is case- and space-insensitive so
 * "United States" and "united  states" do not both survive.
 */
export function mergeLocations(existing: string | null, incoming: string | null): string | null {
  if (!incoming?.trim()) return existing
  if (!existing?.trim()) return incoming.trim()

  const key = (part: string) => part.trim().toLowerCase().replace(/\s+/g, ' ')
  const parts = existing.split(';').map((part) => part.trim()).filter(Boolean)
  const seen = new Set(parts.map(key))

  for (const part of incoming.split(';').map((p) => p.trim()).filter(Boolean)) {
    if (!seen.has(key(part))) {
      parts.push(part)
      seen.add(key(part))
    }
  }
  return parts.join('; ')
}
