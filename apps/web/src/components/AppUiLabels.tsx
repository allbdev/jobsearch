'use client'

import { useMessages } from 'next-intl'
import { UiLabelsProvider, type UiLabels } from '@jobsearch/ui'
import type { ReactNode } from 'react'
import en from '../../messages/en.json'

/**
 * Feeds the component library's strings from the active locale's catalog.
 *
 * The `ui` namespace mirrors `UiLabels` key for key, so the whole namespace is
 * handed over rather than enumerating two dozen `t()` calls. The assertion
 * below is what keeps that mirroring honest: if a label is added to the library
 * and not to `en.json`, this fails to compile.
 */
const _englishCatalogCoversEveryLabel: UiLabels = en.ui

export function AppUiLabels({ children }: { children: ReactNode }) {
  const messages = useMessages() as { ui?: Partial<UiLabels> }
  return <UiLabelsProvider labels={messages.ui}>{children}</UiLabelsProvider>
}
