'use client'

import { useState } from 'react'
import { useTranslations } from 'next-intl'
import type { ContractModel, FeedDefinition } from '@jobsearch/shared'
import {
  ELIGIBILITY_REGIONS,
  JOB_FAMILIES,
  chipOptions,
  contractOptions,
} from '@jobsearch/shared'
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

export function FeedDefinitionDialog({
  open,
  onClose,
  definition,
}: {
  open: boolean
  onClose: () => void
  definition: FeedDefinition
}) {
  const [draft, setDraft] = useState(definition)
  const f = useTranslations('feed')
  const [amount, setAmount] = useState(
    definition.minCompensation ? definition.minCompensation.toLocaleString('en-US') : '',
  )

  const update = <K extends keyof FeedDefinition>(key: K, value: FeedDefinition[K]) =>
    setDraft((current) => ({ ...current, [key]: value }))

  return (
    <Dialog
      open={open}
      onClose={onClose}
      title={f('definition')}
      width={520}
      actions={
        <>
          <Button variant="secondary" onClick={onClose}>
            {f('cancel')}
          </Button>
          <Button variant="primary" onClick={onClose}>
            {f('saveFeed')}
          </Button>
        </>
      }
    >
      <Field label={f('feedName')} htmlFor="feed-name">
        <Input
          id="feed-name"
          value={draft.name}
          onChange={(event) => update('name', event.target.value)}
        />
      </Field>

      <Field label={f('jobFamilies')}>
        <ChipToggleGroup
          options={chipOptions(JOB_FAMILIES)}
          selected={draft.jobFamilies}
          onToggle={(value) => update('jobFamilies', toggleInList(draft.jobFamilies, value))}
          ariaLabel={f('jobFamilies')}
        />
      </Field>

      <Field label={f('mustBeEligibleFrom')}>
        <ChipToggleGroup
          options={chipOptions(ELIGIBILITY_REGIONS)}
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
