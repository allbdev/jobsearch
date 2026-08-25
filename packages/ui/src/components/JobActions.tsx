'use client'

import type { MouseEvent } from 'react'
import { Button } from '../primitives/Button'
import { Icon } from '../primitives/Icon'
import { Bookmark, ExternalLink, X } from '../primitives/icons'
import { cx } from '../lib/cx'
import { useUiLabels } from '../i18n/labels'
import styles from './JobActions.module.css'

export interface JobActionsProps {
  applyUrl: string
  saved: boolean
  onSave: () => void
  onDismiss: () => void
  /**
   * `compact` is the desktop row: three equal icon buttons.
   * `expanded` is the mobile panel: Apply is labelled and takes the width.
   */
  variant: 'compact' | 'expanded'
  className?: string
}

/** Save / dismiss / apply. One implementation, two presentations. */
export function JobActions({
  applyUrl,
  saved,
  onSave,
  onDismiss,
  variant,
  className,
}: JobActionsProps) {
  const labels = useUiLabels()
  const stop = (event: MouseEvent) => event.stopPropagation()
  const compact = variant === 'compact'
  const iconSize = compact ? 14 : 16

  return (
    <div className={cx(styles[variant], className)}>
      <Button
        variant="secondary"
        icon
        size={compact ? 'sm' : 'md'}
        title={saved ? labels.saved : labels.save}
        aria-pressed={saved}
        className={cx(saved && styles.saved)}
        onClick={(event: MouseEvent) => {
          stop(event)
          onSave()
        }}
      >
        <Bookmark
          width={iconSize}
          height={iconSize}
          strokeWidth={1.5}
          fill={saved ? 'currentColor' : 'none'}
          aria-hidden
        />
      </Button>
      <Button
        variant="secondary"
        icon
        size={compact ? 'sm' : 'md'}
        title={labels.dismiss}
        onClick={(event: MouseEvent) => {
          stop(event)
          onDismiss()
        }}
      >
        <Icon icon={X} size={iconSize} />
      </Button>
      <Button
        as="a"
        variant="primary"
        icon={compact}
        size={compact ? 'sm' : 'md'}
        title={labels.apply}
        href={applyUrl}
        target="_blank"
        rel="noreferrer noopener"
        onClick={stop}
      >
        {compact ? null : labels.apply}
        <Icon icon={ExternalLink} size={iconSize} />
      </Button>
    </div>
  )
}
