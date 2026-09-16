/**
 * An absolute URL on the web app. Emailed links and OAuth callbacks both land
 * there, because the web holds the session cookie and forwards to the API (D15).
 */
export function webUrl(path: string): string {
  return new URL(path, process.env.WEB_URL ?? 'http://localhost:3000').toString()
}
