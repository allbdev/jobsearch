'use client'

import { useState, type KeyboardEvent } from 'react'
import { Tag } from '../primitives/Tag'
import { Icon } from '../primitives/Icon'
import { X } from '../primitives/icons'
import styles from './SkillsInput.module.css'

export interface SkillsInputProps {
  skills: readonly string[]
  onChange: (skills: string[]) => void
  placeholder?: string
}

/**
 * Free-text tag entry. Matching is semantic rather than exact-tag (PLAN.md
 * D9), so anything the user types is valid — there is no controlled vocabulary
 * to validate against.
 */
export function SkillsInput({ skills, onChange, placeholder = 'Add a skill…' }: SkillsInputProps) {
  const [draft, setDraft] = useState('')

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
            title={`Remove ${skill}`}
            onClick={() => onChange(skills.filter((item) => item !== skill))}
            className={styles.remove}
          >
            <Icon icon={X} size={10} />
          </button>
        </Tag>
      ))}
      <input
        value={draft}
        placeholder={placeholder}
        onChange={(event) => setDraft(event.target.value)}
        onKeyDown={onKeyDown}
        onBlur={commit}
        className={styles.input}
      />
    </div>
  )
}
