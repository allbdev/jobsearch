'use client'

import { createContext, useContext } from 'react'

/**
 * User-facing strings owned by the component library.
 *
 * The library cannot reach for `next-intl`: the architectural boundary keeps
 * `packages/ui` framework-agnostic (CI forbids importing `next`, and a
 * Next-coupled i18n runtime is the same problem wearing a different name).
 *
 * So the library declares what it needs to say, ships English defaults, and the
 * app supplies translations through plain React context. Passing thirty props
 * down to `JobRow` was the alternative; this keeps call sites unchanged.
 *
 * Placeholders are `{name}` and are filled by `formatLabel` below.
 */
export interface UiLabels {
  /** Job row actions */
  save: string
  saved: string
  dismiss: string
  apply: string

  /** Eligibility verdicts. `eligible` takes {region}. */
  eligible: string
  needsCheck: string
  notEligible: string

  /** Evidence panel */
  evidenceKicker: string
  /**
   * Appended to the kicker on desktop and hidden on mobile, so it has to be a
   * separate string rather than a fuller variant of the one above. Takes
   * {version}.
   */
  classifierSuffix: string
  quotedFrom: string
  viewSource: string
  /** Takes {when}. */
  linkVerified: string

  /** Relative time. Each takes {count} except `oneWeekAgo`. */
  minutesAgo: string
  hoursAgo: string
  daysAgo: string
  oneWeekAgo: string
  weeksAgo: string
  today: string
  yesterday: string
  notVerified: string

  /** Controls */
  minCompensation: string
  currency: string
  close: string
  /** Takes {item}. */
  remove: string
  addSkill: string
  emptyTable: string
  primaryNavigation: string
}

export const defaultUiLabels: UiLabels = {
  save: 'Save',
  saved: 'Saved',
  dismiss: 'Dismiss',
  apply: 'Apply',

  eligible: 'ELIGIBLE · {region}',
  needsCheck: 'NEEDS CHECK',
  notEligible: 'NOT ELIGIBLE',

  evidenceKicker: 'Eligibility evidence',
  classifierSuffix: ' · classifier {version}',
  quotedFrom: 'Quoted from the posting',
  viewSource: 'view source',
  linkVerified: 'link verified {when}',

  minutesAgo: '{count}m ago',
  hoursAgo: '{count}h ago',
  daysAgo: '{count}d ago',
  oneWeekAgo: '1w ago',
  weeksAgo: '{count}w ago',
  today: 'today',
  yesterday: 'yesterday',
  notVerified: 'not verified',

  minCompensation: 'Minimum compensation (yearly)',
  currency: 'Currency',
  close: 'Close',
  remove: 'Remove {item}',
  addSkill: 'Add a skill…',
  emptyTable: 'Nothing here yet.',
  primaryNavigation: 'Primary',
}

const UiLabelsContext = createContext<UiLabels>(defaultUiLabels)

export function UiLabelsProvider({
  labels,
  children,
}: {
  /** Partial: anything omitted falls back to the English default. */
  labels?: Partial<UiLabels>
  children: React.ReactNode
}) {
  return (
    <UiLabelsContext.Provider value={labels ? { ...defaultUiLabels, ...labels } : defaultUiLabels}>
      {children}
    </UiLabelsContext.Provider>
  )
}

export function useUiLabels(): UiLabels {
  return useContext(UiLabelsContext)
}

/** Fills `{name}` placeholders. Deliberately minimal — no plurals, no ICU. */
export function formatLabel(template: string, values: Record<string, string | number>): string {
  return template.replace(/\{(\w+)\}/g, (match, key: string) =>
    key in values ? String(values[key]) : match,
  )
}
