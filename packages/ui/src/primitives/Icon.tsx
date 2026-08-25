import type { LucideIcon } from 'lucide-react'

export interface IconProps {
  icon: LucideIcon
  size?: number
  className?: string
  'aria-hidden'?: boolean
}

/**
 * Every icon in the app goes through here so the system's stroke weight is
 * enforced in one place. Industry specifies Lucide at stroke-width 1.5 and
 * forbids anything thicker — passing a raw `<LucideIcon>` would let a caller
 * silently ship the 2.0 default.
 */
export function Icon({ icon: Glyph, size = 14, className, ...rest }: IconProps) {
  return (
    <Glyph
      width={size}
      height={size}
      strokeWidth={1.5}
      className={className}
      aria-hidden
      focusable="false"
      {...rest}
    />
  )
}

export type { LucideIcon }
