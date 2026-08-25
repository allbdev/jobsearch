import type { Metadata } from 'next'
import { localeMeta, locales } from './routing'

/**
 * The site's absolute origin. Google requires `hreflang` hrefs to be fully
 * qualified — a relative `/pt-br` is ignored — and `metadataBase` is what makes
 * Next expand them.
 */
export const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? 'http://localhost:3000'

/**
 * `hreflang` alternates for one page, across every locale.
 *
 * `path` is the locale-stripped route (`''` for the landing, `/feed`, …), so
 * each page points at its own translations rather than at the home page.
 */
export function localeAlternates(path = ''): Metadata['alternates'] {
  return {
    canonical: path || '/',
    languages: Object.fromEntries(
      locales.map((locale) => [localeMeta[locale].hreflang, `/${locale}${path}`]),
    ),
  }
}
