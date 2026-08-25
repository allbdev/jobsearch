'use client'

import { useLocale, useTranslations } from 'next-intl'
import { useTransition } from 'react'
import { Select } from '@jobsearch/ui'
import { localeMeta, locales, type Locale } from '@/i18n/routing'
import { usePathname, useRouter } from '@/i18n/navigation'

/**
 * Changing language navigates rather than setting a preference: with
 * locale-prefixed routes the URL *is* the language, so staying put would leave
 * the address bar lying about what is on screen.
 */
export function LocaleSwitcher({ className }: { className?: string }) {
  const t = useTranslations('nav')
  const locale = useLocale()
  const router = useRouter()
  const pathname = usePathname()
  const [pending, startTransition] = useTransition()

  return (
    <Select
      aria-label={t('language')}
      className={className}
      value={locale}
      disabled={pending}
      onChange={(event) => {
        const next = event.target.value as Locale
        startTransition(() => {
          // `pathname` is locale-stripped, so this keeps the current page and
          // only swaps the prefix. No `pathnames` mapping is configured, so
          // the href is a plain string.
          router.replace(pathname, { locale: next })
        })
      }}
      options={locales.map((entry) => ({ value: entry, label: localeMeta[entry].label }))}
    />
  )
}
