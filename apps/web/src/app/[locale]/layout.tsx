import { notFound } from 'next/navigation'
import { NextIntlClientProvider, hasLocale } from 'next-intl'
import { getTranslations, setRequestLocale } from 'next-intl/server'
import type { Metadata, Viewport } from 'next'
import type { ReactNode } from 'react'
import { localeMeta, routing } from '@/i18n/routing'
import { localeAlternates, siteUrl } from '@/i18n/metadata'

export function generateStaticParams() {
  return routing.locales.map((locale) => ({ locale }))
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>
}): Promise<Metadata> {
  const { locale } = await params
  const t = await getTranslations({ locale, namespace: 'meta' })

  return {
    metadataBase: new URL(siteUrl),
    title: t('title'),
    description: t('description'),
    /**
     * hreflang alternates — the reason for locale-prefixed routes in the first
     * place. Without these, three URLs of near-identical structure look like
     * duplicates to a crawler rather than translations of one page.
     *
     * Set here for the landing page; the authenticated screens override it
     * with `noindex` instead, since a personalised feed is not a page anyone
     * should reach from search.
     */
    alternates: localeAlternates(),
  }
}

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
}

export default async function LocaleLayout({
  children,
  params,
}: {
  children: ReactNode
  params: Promise<{ locale: string }>
}) {
  const { locale } = await params
  if (!hasLocale(routing.locales, locale)) notFound()

  // Opts this branch into static rendering; without it every page using
  // translations is forced dynamic.
  setRequestLocale(locale)

  return (
    <html lang={localeMeta[locale].hreflang}>
      <body style={{ margin: 0 }}>
        <NextIntlClientProvider>{children}</NextIntlClientProvider>
      </body>
    </html>
  )
}
