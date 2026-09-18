'use client'

import { useState, type KeyboardEvent } from 'react'
import { Tag } from '../primitives/Tag'
import { Icon } from '../primitives/Icon'
import { X } from '../primitives/icons'
import styles from './SkillsInput.module.css'
import { formatLabel, useUiLabels } from '../i18n/labels'

export interface SkillsInputProps {
  skills: readonly string[]
  onChange: (skills: string[]) => void
  placeholder?: string
  /**
   * A ceiling the caller's schema also enforces. The field stops offering a
   * place to type once it is reached, which is how someone finds out — a
   * rejection after pressing Save teaches it far too late.
   */
  max?: number
}

/**
 * Free-text tag entry. Matching is semantic rather than exact-tag (PLAN.md
 * D9), so anything the user types is valid — there is no controlled vocabulary
 * to validate against.
 */
export function SkillsInput({ skills, onChange, placeholder, max }: SkillsInputProps) {
  const labels = useUiLabels()
  const [draft, setDraft] = useState('')
  const full = max !== undefined && skills.length >= max

  const commit = () => {
    const value = draft.trim()
    if (!value || skills.includes(value)) {
      setDraft('')
      return
    }
    onChange([...skills, value])
    setDraft('')
  }

  const onKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
    if (event.key === 'Enter' || event.key === ',') {
      event.preventDefault()
      commit()
      return
    }
    if (event.key === 'Backspace' && draft === '' && skills.length > 0) {
      onChange(skills.slice(0, -1))
    }
  }

  return (
    <div className={styles.box}>
      {skills.map((skill) => (
        <Tag key={skill} tone="accent" className={styles.chip}>
          {skill}
          <button
            type="button"
            title={formatLabel(labels.remove, { item: skill })}
            onClick={() => onChange(skills.filter((item) => item !== skill))}
            className={styles.remove}
          >
            <Icon icon={X} size={10} />
          </button>
        </Tag>
      ))}
      {full ? null : (
        <input
          value={draft}
          placeholder={placeholder ?? labels.addSkill}
          onChange={(event) => setDraft(event.target.value)}
          onKeyDown={onKeyDown}
          onBlur={commit}
          className={styles.input}
        />
      )}
    </div>
  )
}
