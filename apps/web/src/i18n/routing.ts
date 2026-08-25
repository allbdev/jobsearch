import { defineRouting } from 'next-intl/routing'

/**
 * Locale-prefixed routes (PLAN.md D5 note on SEO): `/en/feed`, `/pt-br/feed`,
 * `/es/feed`. Each locale is separately crawlable and a shared link keeps the
 * sender's language.
 *
 * Locale ids are lowercase because they appear in URLs. `hreflang` and the
 * `Intl` APIs want the canonical BCP-47 casing, which is why the mapping below
 * exists rather than using the id for everything.
 */
export const locales = ['en', 'pt-br', 'es'] as const
export type Locale = (typeof locales)[number]

export const defaultLocale: Locale = 'en'

export const localeMeta: Record<Locale, { label: string; hreflang: string; intl: string }> = {
  en: { label: 'English', hreflang: 'en', intl: 'en-US' },
  'pt-br': { label: 'Português (BR)', hreflang: 'pt-BR', intl: 'pt-BR' },
  es: { label: 'Español', hreflang: 'es', intl: 'es-ES' },
}

export const routing = defineRouting({
  locales,
  defaultLocale,
  /**
   * `always` keeps the prefix on every locale including the default, so one
   * URL never serves two languages and crawlers see three distinct pages.
   */
  localePrefix: 'always',
})
