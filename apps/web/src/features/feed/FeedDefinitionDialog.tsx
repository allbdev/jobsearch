'use client'

import { useState, useTransition } from 'react'
import { useTranslations } from 'next-intl'
import type { ContractModel, FeedDefinition } from '@jobsearch/shared'
import { contractOptions } from '@jobsearch/shared'
import { useJobFamilyOptions } from '../shared/useJobFamilyOptions'
import { useRegionOptions } from '../shared/useRegionOptions'
import { useRouter } from '@/i18n/navigation'
import { deleteFeedAction, saveFeedAction, type FeedActionFailure, type FeedActionResult } from './actions'
import {
  Button,
  Checkbox,
  ChipToggleGroup,
  CompensationField,
  Dialog,
  Field,
  Input,
  toggleInList,
} from '@jobsearch/ui'

/** A new feed starts from nothing chosen: every filter off, any age. */
export const BLANK_FEED: FeedDefinition = {
  name: '',
  jobFamilies: [],
  eligibleFrom: [],
  contractModels: [],
  minCompensation: null,
  currency: 'USD',
  freshnessDays: null,
  hideRejected: true,
}

/** Whole currency units from what was typed; separators and symbols ignored. */
function parseAmount(amount: string): number | null {
  const digits = amount.replace(/\D/g, '')
  return digits ? Number(digits) : null
}

/**
 * Creates a feed when `feedId` is null, edits it otherwise. Mount it with a
 * `key` per feed and mode: the draft is initialised once, from `definition`.
 */
export function FeedDefinitionDialog({
  open,
  onClose,
  definition,
  feedId,
}: {
  open: boolean
  onClose: () => void
  definition: FeedDefinition
  feedId: string | null
}) {
  const [draft, setDraft] = useState(definition)
  const [failure, setFailure] = useState<FeedActionFailure | null>(null)
  const [pending, startTransition] = useTransition()
  const router = useRouter()
  const e = useTranslations('feed.errors')
  const f = useTranslations('feed')
  const familyOptions = useJobFamilyOptions()
  const regionOptions = useRegionOptions()
  const [amount, setAmount] = useState(
    definition.minCompensation ? definition.minCompensation.toLocaleString('en-US') : '',
  )

  const update = <K extends keyof FeedDefinition>(key: K, value: FeedDefinition[K]) =>
    setDraft((current) => ({ ...current, [key]: value }))

  // On success the dialog closes itself and opens the saved feed; on failure it
  // stays open with the reason.
  const run = (action: () => Promise<FeedActionResult>) =>
    startTransition(async () => {
      const result = await action()
      if (!result.ok) return setFailure(result)
      onClose()
      router.push(result.href)
    })
  const save = () => run(() => saveFeedAction(feedId, { ...draft, minCompensation: parseAmount(amount) }))
  // Deleting is permanent and one click away from Save, so it asks first.
  const remove = () => {
    if (feedId && window.confirm(f('confirmDelete', { name: definition.name }))) {
      run(() => deleteFeedAction(feedId))
    }
  }
  const invalid = (field: keyof FeedDefinition) => failure?.fields?.includes(field) ?? false

  return (
    <Dialog
      open={open}
      onClose={onClose}
      title={feedId ? f('definition') : f('newFeed')}
      width={520}
      actions={
        <>
          {feedId ? (
            <Button variant="ghost" onClick={remove} disabled={pending}>
              {f('deleteFeed')}
            </Button>
          ) : null}
          <Button variant="secondary" onClick={onClose} disabled={pending}>
            {f('cancel')}
          </Button>
          <Button variant="primary" onClick={save} disabled={pending}>
            {f('saveFeed')}
          </Button>
        </>
      }
    >
      {failure ? <p role="alert">{e(failure.error)}</p> : null}

      <Field
        label={f('feedName')}
        htmlFor="feed-name"
        hint={invalid('name') ? <span role="alert">{e('name')}</span> : undefined}
      >
        <Input
          id="feed-name"
          aria-invalid={invalid('name')}
          value={draft.name}
          onChange={(event) => update('name', event.target.value)}
        />
      </Field>

      <Field label={f('jobFamilies')}>
        <ChipToggleGroup
          options={familyOptions}
          selected={draft.jobFamilies}
          onToggle={(value) => update('jobFamilies', toggleInList(draft.jobFamilies, value))}
          ariaLabel={f('jobFamilies')}
        />
      </Field>

      <Field label={f('mustBeEligibleFrom')}>
        <ChipToggleGroup
          options={regionOptions}
          selected={draft.eligibleFrom}
          onToggle={(value) => update('eligibleFrom', toggleInList(draft.eligibleFrom, value))}
          ariaLabel={f('mustBeEligibleFrom')}
        />
      </Field>

      <Field label={f('contractTypes')}>
        <ChipToggleGroup<ContractModel>
          options={contractOptions}
          selected={draft.contractModels}
          onToggle={(value) => update('contractModels', toggleInList(draft.contractModels, value))}
          ariaLabel={f('contractTypes')}
        />
      </Field>

      <CompensationField
        label={f('minCompensationYearly')}
        currencyLabel={f('currency')}
        amount={amount}
        currency={draft.currency}
        onAmountChange={setAmount}
        onCurrencyChange={(value) => update('currency', value)}
      />

      <Checkbox
        checked={draft.hideRejected}
        onChange={(event) => update('hideRejected', event.target.checked)}
      >
        {f('hideRejected')}
      </Checkbox>
    </Dialog>
  )
}
