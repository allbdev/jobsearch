'use client'

import { useEffect, type ReactNode } from 'react'
import { Blueprint } from './Blueprint'
import { Button } from './Button'
import { Icon } from './Icon'
import { X } from './icons'
import { cx } from '../lib/cx'
import styles from './Dialog.module.css'
import { useUiLabels } from '../i18n/labels'

export interface DialogProps {
  open: boolean
  onClose: () => void
  title: string
  children: ReactNode
  /** Action row. Falls back to a single Close button when omitted. */
  actions?: ReactNode
  /** Desktop width. Ignored below the mobile breakpoint, where it is a sheet. */
  width?: number
}

/**
 * Modal at the top elevation on desktop; a bottom sheet below `--bp-md`.
 *
 * Owns the behaviour the design prototype only mimicked: Escape to close,
 * backdrop click to close, click-through guard on the panel, and body scroll
 * lock.
 */
export function Dialog({ open, onClose, title, children, actions, width = 440 }: DialogProps) {
  const labels = useUiLabels()

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
    <div className={cx('dialog-backdrop', styles.backdrop)} onClick={onClose}>
      <Blueprint
        elevation="lg"
        className={cx('dialog', styles.panel)}
        role="dialog"
        aria-modal="true"
        aria-label={title}
        onClick={(event: React.MouseEvent) => event.stopPropagation()}
        style={{ width: `min(${width}px, 100%)` }}
      >
        <div className={cx('dialog-title', styles.title)}>
          {title}
          <Button
            variant="secondary"
            icon
            className={styles.close}
            title={labels.close}
            aria-label={labels.close}
            onClick={onClose}
          >
            <Icon icon={X} size={15} />
          </Button>
        </div>
        {children}
        <div className="dialog-actions">
          {actions ?? (
            <Button variant="secondary" onClick={onClose}>
              {labels.close}
            </Button>
          )}
        </div>
      </Blueprint>
    </div>
  )
}
