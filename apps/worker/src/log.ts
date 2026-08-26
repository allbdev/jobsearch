/** Structured lines, so a run is greppable and a source's health is countable. */
export function log(message: string, detail: Record<string, unknown> = {}) {
  const parts = Object.entries(detail).map(([key, value]) => `${key}=${JSON.stringify(value)}`)
  console.log(`${new Date().toISOString()} ${message}${parts.length ? ' ' + parts.join(' ') : ''}`)
}
