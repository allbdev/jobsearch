'use client'

import { useEffect, type ReactNode } from 'react'
import { Blueprint } from './Blueprint'
import { Button } from './Button'
import { color } from '@jobsearch/design-system/tokens'

export interface DialogProps {
  open: boolean
  onClose: () => void
  title: string
  children: ReactNode
  /** Action row. Falls back to a single Close button when omitted. */
  actions?: ReactNode
  width?: number
}

/**
 * Modal at the top elevation. Owns the behaviour the design prototype only
 * mimicked: Escape to close, backdrop click to close, click-through guard on
 * the panel, and body scroll lock.
 */
export function Dialog({ open, onClose, title, children, actions, width = 440 }: DialogProps) {
  useEffect(() => {
    if (!open) return
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose()
    }
    document.addEventListener('keydown', onKey)
    const previous = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      document.removeEventListener('keydown', onKey)
      document.body.style.overflow = previous
    }
  }, [open, onClose])

  if (!open) return null

  return (
    <div className="dialog-backdrop" style={{ zIndex: 50 }} onClick={onClose}>
      <Blueprint
        elevation="lg"
        className="dialog"
        role="dialog"
        aria-modal="true"
        aria-label={title}
        onClick={(event: React.MouseEvent) => event.stopPropagation()}
        style={{ width: `min(${width}px, 100%)`, background: color.bg }}
      >
        <div className="dialog-title">{title}</div>
        {children}
        <div className="dialog-actions">
          {actions ?? (
            <Button variant="secondary" onClick={onClose}>
              Close
            </Button>
          )}
        </div>
      </Blueprint>
    </div>
  )
}
