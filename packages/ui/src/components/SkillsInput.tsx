'use client'

import { useState, type KeyboardEvent } from 'react'
import { Tag } from '../primitives/Tag'
import { Icon } from '../primitives/Icon'
import { X } from 'lucide-react'
import { color, hairline } from '@jobsearch/design-system/tokens'

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
    <div
      style={{
        display: 'flex',
        gap: 6,
        flexWrap: 'wrap',
        alignItems: 'center',
        border: hairline,
        background: color.surface,
        padding: '8px 10px',
      }}
    >
      {skills.map((skill) => (
        <Tag key={skill} tone="accent" style={{ gap: 5 }}>
          {skill}
          <button
            type="button"
            title={`Remove ${skill}`}
            onClick={() => onChange(skills.filter((item) => item !== skill))}
            style={{ all: 'unset', cursor: 'pointer', lineHeight: 0 }}
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
        style={{
          border: 'none',
          background: 'none',
          font: 'inherit',
          fontSize: 13,
          outline: 'none',
          flex: 1,
          minWidth: 110,
          color: color.text,
        }}
      />
    </div>
  )
}
