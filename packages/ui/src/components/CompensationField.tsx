'use client'

import { Field } from '../primitives/Field'
import { Input } from '../primitives/Input'
import { Select, toOptions } from '../primitives/Select'
import styles from './CompensationField.module.css'

export const CURRENCIES = ['USD', 'EUR', 'BRL'] as const
export type Currency = (typeof CURRENCIES)[number]

export interface CompensationFieldProps {
  amount: string
  currency: string
  onAmountChange: (value: string) => void
  onCurrencyChange: (value: string) => void
  label?: string
  maxWidth?: number
}

/**
 * Amount + currency pair. Written twice in the design (the Feed definition
 * dialog and the Profile contract section) with the same 1fr/110px grid —
 * one component instead.
 */
export function CompensationField({
  amount,
  currency,
  onAmountChange,
  onCurrencyChange,
  label = 'Minimum compensation (yearly)',
  maxWidth,
}: CompensationFieldProps) {
  return (
    <div className={styles.grid} style={{ maxWidth }}>
      <Field label={label} htmlFor="comp-amount">
        <Input
          id="comp-amount"
          inputMode="numeric"
          value={amount}
          onChange={(event) => onAmountChange(event.target.value)}
        />
      </Field>
      <Field label="Currency" htmlFor="comp-currency">
        <Select
          id="comp-currency"
          options={toOptions(CURRENCIES)}
          value={currency}
          onChange={(event) => onCurrencyChange(event.target.value)}
        />
      </Field>
    </div>
  )
}
